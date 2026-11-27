/**
 * Transfer drama around the user's offers: rival clubs bidding against each other, deadline day, and an agent who can
 * leak interest to force a better contract from the player's own club.
 *
 *  - Bidding war: while a bid for the user is open, a club of similar standing may join with a higher bid and better
 *    wages; the first club may answer. Each club raises at most twice.
 *  - Deadline day (the last week of each window): late bids arrive and must be answered that week, and open wars get
 *    one last raise.
 *  - Leaking interest: once a window, the agent tells the press who has called. The player's club, if it values him,
 *    comes back with an improved deal; the manager is less pleased.
 *
 * Randomness comes from `Rng.fromSeed(seed:market:…)` streams so the world RNG never moves.
 */
import { BALANCE } from "../balance";
import { isTransferWindow, windowName } from "../calendar";
import { clubName } from "../data/world";
import { overallFor } from "../players/attributes";
import { formatMoney } from "../players/economy";
import { clamp, Rng } from "../rng";
import { negotiationPatience } from "../traits/career";
import type { GameState, TransferOffer } from "../types";
import { clubLevel } from "../world/create";
import { addNews, nextId, userPlayer } from "../world/helpers";
import { makeTerms } from "./offers";
import { adjustRel } from "./relationships";

const M = {
  /** Weekly chance a rival joins an open bid. */
  rivalChance: 0.3,
  /** Chance the first bidder answers a rival's bid. */
  answerChance: 0.55,
  maxRaises: 2,
  deadlineBidChance: 0.4,
  deadlineMinReputation: 40,
  leakManager: -5,
};

const rngFor = (state: GameState, tag: string) => Rng.fromSeed(`${state.seed}:market:${tag}:${state.turnIndex}`);

export function isDeadlineDay(turn: number): boolean {
  const w = windowName(turn);
  if (!w) return false;
  const turns = w === "summer" ? BALANCE.calendar.summerWindow : BALANCE.calendar.januaryWindow;
  return turn === turns[turns.length - 1];
}

const live = (o: TransferOffer) => (o.kind === "transfer" || o.kind === "free") && (o.status === "club-pending" || o.status === "terms") && !o.sagaId;

function raise(o: TransferOffer, feeMul: number, wageMul: number, note: string): void {
  o.fee = Math.round((o.fee * feeMul) / 50000) * 50000;
  o.terms.wage = Math.round((o.terms.wage * wageMul) / 100) * 100;
  o.maxWage = Math.max(o.maxWage, Math.round(o.terms.wage * 1.15));
  o.raises = (o.raises ?? 0) + 1;
  o.history.push(note);
}

/** A club that could credibly join the race for the user, other than those already bidding. */
function rivalClub(state: GameState, against: TransferOffer, r: Rng) {
  const p = userPlayer(state);
  const base = state.clubs[against.fromClubId];
  if (!base) return undefined;
  const bidding = new Set(state.user.offers.filter(live).map((o) => o.fromClubId));
  const o = overallFor(p.attrs, p.position);
  const pool = Object.values(state.clubs).filter(
    (c) => c.id !== p.clubId && !bidding.has(c.id) && Math.abs(c.reputation - base.reputation) <= 12 && c.balance >= against.fee * 1.2 && o >= clubLevel(c.reputation) - 6,
  );
  return pool.length ? r.pick(pool) : undefined;
}

/** Weekly, during a window: rivals join, first bidders answer, deadline day brings late bids. */
export function marketWeekly(state: GameState): void {
  const u = state.user;
  if (u.retired || u.coach || !isTransferWindow(state.turn)) return;
  const p = userPlayer(state);
  const r = rngFor(state, "week");
  const deadline = isDeadlineDay(state.turn);
  for (const o of [...u.offers.filter(live)]) {
    if (o.kind !== "transfer" || o.season !== state.season) continue;
    if (!o.warWith && r.chance(deadline ? M.rivalChance * 1.5 : M.rivalChance)) {
      const club = rivalClub(state, o, r);
      if (!club) continue;
      const { terms, maxWage } = makeTerms(state, r, club, p, "transfer");
      terms.wage = Math.max(terms.wage, Math.round((o.terms.wage * r.range(1.05, 1.15)) / 100) * 100);
      const rival: TransferOffer = {
        id: nextId(state, "o"), kind: "transfer", fromClubId: club.id, toPlayerClubId: p.clubId, fee: Math.round((o.fee * r.range(1.1, 1.25)) / 50000) * 50000,
        terms, maxWage: Math.max(maxWage, Math.round(terms.wage * 1.2)), patience: negotiationPatience(p, r.int(2, 3)), status: "club-pending",
        createdTurn: state.turn, expiresTurn: deadline ? state.turn : state.turn + 3, season: state.season, warWith: o.id,
        history: [`${clubName(club.id)} join the race, outbidding ${clubName(o.fromClubId)}.`],
      };
      o.warWith = rival.id;
      o.history.push(`${clubName(club.id)} have bid more for you.`);
      u.offers.unshift(rival);
      addNews(state, { kind: "transfer", title: `⚔️ Bidding war: ${clubName(club.id, true)} v ${clubName(o.fromClubId, true)}`, body: `${clubName(club.id)} bid ${formatMoney(rival.fee)}, topping ${clubName(o.fromClubId)}.`, important: true });
      continue;
    }
    const rival = o.warWith ? u.offers.find((x) => x.id === o.warWith) : undefined;
    if (rival && live(rival) && rival.fee >= o.fee && (o.raises ?? 0) < M.maxRaises && r.chance(deadline ? 0.75 : M.answerChance)) {
      const club = state.clubs[o.fromClubId];
      if (club && club.balance >= rival.fee * 1.1) {
        raise(o, clamp(rival.fee / Math.max(1, o.fee), 1, 2) * r.range(1.04, 1.1), r.range(1.03, 1.08), `${clubName(o.fromClubId)} respond with ${formatMoney(Math.round((rival.fee * 1.07) / 50000) * 50000)} and better wages.`);
        o.expiresTurn = Math.max(o.expiresTurn, state.turn + (deadline ? 0 : 2));
        if (o.status === "terms") o.status = "club-pending";
        addNews(state, { kind: "transfer", title: `${clubName(o.fromClubId)} raise their bid`, body: `Now ${formatMoney(o.fee)}.`, important: true });
      }
    }
  }
  if (deadline && p.clubId && p.reputation >= M.deadlineMinReputation && r.chance(M.deadlineBidChance) && !u.offers.some((o) => o.deadline && o.season === state.season && o.createdTurn === state.turn)) {
    deadlineBid(state, r);
  }
}

function deadlineBid(state: GameState, r: Rng): void {
  const p = userPlayer(state);
  const cur = p.clubId ? state.clubs[p.clubId] : undefined;
  if (!cur) return;
  const o = overallFor(p.attrs, p.position);
  const pool = Object.values(state.clubs).filter((c) => c.id !== cur.id && c.reputation >= cur.reputation - 5 && Math.abs(clubLevel(c.reputation) - o) <= 6 && !state.user.offers.some((x) => x.fromClubId === c.id && live(x)));
  if (!pool.length) return;
  const club = r.pick(pool);
  const { terms, maxWage } = makeTerms(state, r, club, p, "transfer");
  const fee = Math.round((Math.max(500_000, (p.contract?.wage ?? 10_000) * 120) * r.range(1, 1.4)) / 50000) * 50000;
  state.user.offers.unshift({
    id: nextId(state, "o"), kind: "transfer", fromClubId: club.id, toPlayerClubId: p.clubId, fee, terms, maxWage, patience: 1, status: "club-pending",
    createdTurn: state.turn, expiresTurn: state.turn, season: state.season, deadline: true,
    history: [`📺 Deadline day: ${clubName(club.id)} make a late bid of ${formatMoney(fee)}. It has to be done today.`],
  });
  addNews(state, { kind: "transfer", title: `📺 Deadline-day bid from ${clubName(club.id)}`, body: "A late move: answer before the window shuts.", important: true });
}

/** Why the agent can't leak interest now, or null. */
export function leakBlock(state: GameState): string | null {
  const p = userPlayer(state);
  if (state.user.agent.id === "none") return "You need an agent to work the press.";
  if (!p.contract || !p.clubId || p.loan) return "You need a club contract for this.";
  if (!isTransferWindow(state.turn)) return "Leaks only work while a transfer window is open.";
  if (state.user.leakedSeason === state.season && state.user.leakedWindow === windowName(state.turn)) return "Your agent already leaked interest this window.";
  const interest = state.user.offers.some((o) => o.fromClubId !== p.clubId && o.season === state.season && o.kind !== "renewal") || state.user.sagas.some((s) => !s.outcome);
  if (!interest) return "There's no interest from other clubs to leak.";
  return null;
}

/** The agent leaks interest to the press. A club that values the player comes back with an improved contract. */
export function leakInterest(state: GameState): { ok: boolean; reason?: string; msg?: string } {
  const blocked = leakBlock(state);
  if (blocked) return { ok: false, reason: blocked };
  const p = userPlayer(state);
  const club = state.clubs[p.clubId ?? ""];
  const contract = p.contract;
  if (!club || !contract) return { ok: false, reason: "No club." };
  state.user.leakedSeason = state.season;
  state.user.leakedWindow = windowName(state.turn) ?? undefined;
  const suitors = [...new Set(state.user.offers.filter((o) => o.fromClubId !== club.id && o.season === state.season && o.kind !== "renewal").map((o) => clubName(o.fromClubId, true)))].slice(0, 2);
  addNews(state, { kind: "transfer", title: `📰 ${p.lastName} wanted by ${suitors.join(" and ") || "rival clubs"}`, body: "Sources close to the player say several clubs have made contact.", important: true });
  adjustRel(state, "manager", M.leakManager, "Your agent leaked transfer interest");
  const r = rngFor(state, "leak");
  const valued = overallFor(p.attrs, p.position) >= clubLevel(club.reputation) - 4;
  if (valued && r.chance(0.8)) {
    const { terms, maxWage } = makeTerms(state, r, club, p, "renewal");
    terms.wage = Math.max(Math.round((terms.wage * 1.12) / 100) * 100, Math.round((contract.wage * 1.15) / 100) * 100);
    state.user.offers = state.user.offers.filter((o) => !(o.kind === "renewal" && o.status === "terms"));
    state.user.offers.unshift({
      id: nextId(state, "o"), kind: "renewal", fromClubId: club.id, toPlayerClubId: club.id, fee: 0, terms, maxWage: Math.round(maxWage * 1.15), patience: negotiationPatience(p, r.int(2, 3)),
      status: "terms", createdTurn: state.turn, expiresTurn: state.turn + 6, season: state.season, history: [`Spooked by the headlines, ${clubName(club.id)} table an improved contract.`],
    });
    adjustRel(state, "board", -2, "Forced into a new contract by press leaks");
    return { ok: true, msg: `It worked: ${clubName(club.id)} put an improved contract on the table.` };
  }
  adjustRel(state, "supporters", -2, "Your agent leaked transfer interest");
  return { ok: true, msg: `${clubName(club.id)} don't react. The manager isn't impressed.` };
}
