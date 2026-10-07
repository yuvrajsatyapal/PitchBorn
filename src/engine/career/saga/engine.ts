/**
 * Transfer sagas: multi-week transfer stories for the user's player.
 *
 * A saga sits above TransferOffer. It never moves the player itself: it opens offers (bids to the selling club, then
 * personal terms), and the move is completed by the existing negotiate → completeOffer path, so fees, squads,
 * contracts and the transfer log have exactly one implementation. The saga reads the offers' fate to decide how the
 * story ends. It advances once per weekly turn (twice under deadline pressure) and never runs across the season rollover.
 */
import { isTransferWindow } from "../../calendar";
import { clubName } from "../../data/world";
import { overallFor } from "../../players/attributes";
import { formatMoney, marketValue } from "../../players/economy";
import { clamp, Rng } from "../../rng";
import { rememberSaga } from "../../memory/detect";
import { baseRivalry, bumpRivalHeat } from "../../memory/rivalry";
import { careerProfile } from "../../traits/effects";
import type { CareerDecision, ClubId, ClubState, ContractTerms, GameState, Player, SagaOutcome, SagaStage, TransferOffer, TransferSaga } from "../../types";
import { clubLevel } from "../../world/create";
import { addNews, nextId, userPlayer } from "../../world/helpers";
import { agentSkill } from "../agents";
import { evaluateBid, makeTerms, negotiate, setTransferRequest, type OfferDraft } from "../offers";
import { activeSaga, assessSaga, isActiveSaga, type SagaAssessment } from "./eligibility";

export const STAGE_LABEL: Record<SagaStage, string> = {
  interest: "Interest", scouting: "Scouting", "agent-contact": "Agent contact", enquiry: "Initial enquiry", "first-bid": "First bid", "bid-rejected": "Bid rejected",
  "improved-bid": "Improved bid", "player-unsettled": "Player unsettled", "manager-talk": "Manager conversation", "contract-talks": "Contract negotiation",
  "transfer-request": "Transfer request", "competing-bid": "Competing club", "deadline-pressure": "Deadline pressure", agreement: "Agreement", medical: "Medical", completed: "Completed", failed: "Failed",
};

const FINISHED_KEPT = 8;
const MAX_ENTRIES = 40;

// --------------------------------------------------------------------------- small helpers

const left = (state: GameState, s: TransferSaga) => s.deadlineIndex - state.turnIndex;
const offersOf = (state: GameState, s: TransferSaga): TransferOffer[] => s.offerIds.map((id) => state.user.offers.find((o) => o.id === id)).filter((o): o is TransferOffer => !!o);
const isLive = (o: TransferOffer) => o.status === "club-pending" || o.status === "terms" || o.status === "club-rejected";
const roundFee = (n: number) => Math.round(n / 50000) * 50000;

function log(state: GameState, s: TransferSaga, stage: SagaStage, text: string): void {
  s.entries.push({ season: state.season, turn: state.turn, stage, text });
  if (s.entries.length > MAX_ENTRIES) s.entries.splice(1, s.entries.length - MAX_ENTRIES);
}

function go(state: GameState, s: TransferSaga, stage: SagaStage, text: string, news?: { title: string; body?: string }): void {
  s.stage = stage;
  log(state, s, stage, text);
  if (news) addNews(state, { kind: "transfer", title: news.title, body: news.body, important: true });
}

function pickStage(rng: Rng, options: [SagaStage, number][]): SagaStage {
  return rng.weighted(options.filter(([, w]) => w > 0), ([, w]) => w)[0];
}

/** 0–1 leanings of the player, from traits (loyal, ambitious, money-motivated). */
function leanings(p: Player) {
  const cp = careerProfile(p);
  return { loyalty: cp.loyalty, ambition: cp.ambition, money: cp.money };
}

function nudge(state: GameState, rel: Partial<Record<keyof GameState["user"]["relationships"], number>>): void {
  for (const k of Object.keys(rel) as (keyof typeof rel)[]) state.user.relationships[k] = clamp(state.user.relationships[k] + (rel[k] ?? 0), 0, 100);
}

function createOffer(state: GameState, rng: Rng, s: TransferSaga, club: ClubState, kind: "transfer" | "free", fee: number, terms: ContractTerms, maxWage: number, status: "club-pending" | "terms"): TransferOffer {
  const p = userPlayer(state);
  const offer: TransferOffer = {
    id: nextId(state, "o"),
    kind,
    fromClubId: club.id,
    toPlayerClubId: p.clubId,
    fee,
    terms,
    maxWage,
    patience: rng.int(2, 3),
    status,
    createdTurn: state.turn,
    expiresTurn: state.turn + 6,
    season: state.season,
    history: [kind === "free" ? `${clubName(club.id)} offer you a contract.` : `${clubName(club.id)} bid ${formatMoney(fee)} for you.`],
    sagaId: s.id,
  };
  state.user.offers.unshift(offer);
  s.offerIds.push(offer.id);
  if (kind === "transfer") s.bids++;
  return offer;
}

function openDecision(state: GameState, s: TransferSaga, kind: "manager" | "terms" | "prefer", title: string, body: string, options: CareerDecision["options"], fallback: string): void {
  if (s.decisionId && state.user.decisions.some((d) => d.id === s.decisionId)) return;
  const d: CareerDecision = {
    id: nextId(state, "d"),
    kind: "event",
    title,
    body,
    options,
    expiresTurn: Math.min(state.turn + (left(state, s) >= 2 ? 2 : 1), 50),
    season: state.season,
    eventId: `saga:${kind}`,
    fallback,
    sagaId: s.id,
  };
  state.user.decisions.push(d);
  s.decisionId = d.id;
}

function dropDecision(state: GameState, s: TransferSaga): void {
  if (s.decisionId) state.user.decisions = state.user.decisions.filter((d) => d.id !== s.decisionId);
  s.decisionId = undefined;
}

// --------------------------------------------------------------------------- starting

/** Hands a prospective offer to the saga system. Returns true when a saga took it (so no ordinary offer is created). */
export function divertToSaga(state: GameState, club: ClubState, draft: OfferDraft, rng: Rng): boolean {
  const a = assessSaga(state, club, draft.kind, draft.fee);
  if (a.blocked || a.chance <= 0 || !rng.chance(a.chance)) return false;
  startSaga(state, club, draft, a);
  return true;
}

export function startSaga(state: GameState, club: ClubState, draft: OfferDraft, a: Pick<SagaAssessment, "score" | "reasons" | "window" | "deadlineTurn">): TransferSaga {
  const p = userPlayer(state);
  const formerClub = p.history.some((h) => h.clubId === club.id && h.stats.apps > 0) && club.id !== p.clubId;
  const saga: TransferSaga = {
    id: nextId(state, "s"),
    kind: draft.kind,
    clubId: club.id,
    fromClubId: p.clubId,
    rivals: [],
    stage: "interest",
    window: a.window,
    startSeason: state.season,
    startTurn: state.turn,
    startIndex: state.turnIndex,
    deadlineIndex: state.turnIndex + (a.deadlineTurn - state.turn),
    lastStepIndex: state.turnIndex,
    fee: draft.fee,
    draft: { terms: draft.terms, maxWage: draft.maxWage },
    offerIds: [],
    bids: 0,
    rejections: 0,
    importance: a.score,
    reasons: a.reasons.slice(0, 4),
    flags: { formerClub },
    entries: [],
    snapshot: { reputation: p.reputation, value: marketValue(p, state.season), requested: state.user.transferRequest, yearsLeft: p.contract ? p.contract.expires - state.season : -1 },
  };
  log(state, saga, "interest", `${clubName(club.id)} are interested in signing you${formerClub ? " — a return to a club you know" : ""}.`);
  state.user.sagas.unshift(saga);
  const finished = state.user.sagas.filter((x) => !isActiveSaga(x));
  if (finished.length > FINISHED_KEPT) state.user.sagas = state.user.sagas.filter((x) => isActiveSaga(x) || finished.indexOf(x) < FINISHED_KEPT);
  addNews(state, { kind: "transfer", title: `${clubName(club.id)} linked with you`, body: "Talk of a move is gathering pace.", important: true });
  return saga;
}

// --------------------------------------------------------------------------- finishing

function finish(state: GameState, s: TransferSaga, outcome: SagaOutcome, text: string, news = true): void {
  if (!isActiveSaga(s)) return;
  dropDecision(state, s);
  for (const o of offersOf(state, s)) {
    if (!isLive(o)) continue;
    o.status = outcome === "player-declined" ? "rejected" : "expired";
    o.history.push(outcome === "player-declined" ? "You turned the move down." : "The offer lapsed.");
  }
  s.stage = outcome === "completed" ? "completed" : "failed";
  s.outcome = outcome;
  s.endedIndex = state.turnIndex;
  log(state, s, s.stage, text);
  if (news && outcome !== "completed") addNews(state, { kind: "transfer", title: `The ${clubName(s.clubId)} saga ends`, body: text, important: true });
  rememberSaga(state, s);
}

function complete(state: GameState, s: TransferSaga, o: TransferOffer): void {
  s.clubId = o.fromClubId;
  s.fee = o.fee;
  log(state, s, "agreement", `Terms agreed with ${clubName(o.fromClubId)}: ${formatMoney(o.terms.wage)}/wk for ${o.terms.years} years.`);
  log(state, s, "medical", "Medical and paperwork completed.");
  finish(state, s, "completed", `You join ${clubName(o.fromClubId)}.`, false);
}

/** Reconciles the saga with what actually happened to its offers (the player may have acted through the offers page). */
export function syncSaga(state: GameState, s: TransferSaga): void {
  if (!isActiveSaga(s)) return;
  const p = userPlayer(state);
  const offers = offersOf(state, s);
  const accepted = offers.find((o) => o.status === "accepted");
  if (accepted) return complete(state, s, accepted);
  if (state.user.retired) return finish(state, s, "withdrawn", "Your retirement ends all talk of a move.", false);
  if (p.clubId !== s.fromClubId) return finish(state, s, "withdrawn", p.clubId ? `You joined ${clubName(p.clubId)} instead.` : "Your situation changed and the talks lapse.", false);
  if (s.decisionId && !state.user.decisions.some((d) => d.id === s.decisionId)) s.decisionId = undefined;
  const live = offers.filter(isLive);
  if (offers.length && !live.length) {
    if (offers.some((o) => o.status === "rejected")) return finish(state, s, "player-declined", `You turned down ${clubName(s.clubId)}.`);
    if (offers.some((o) => o.status === "withdrawn" && o.history.some((h) => h.includes("walk away")))) return finish(state, s, "negotiations-failed", `${clubName(s.clubId)} walked away from the talks.`);
    if (offers.some((o) => o.status === "withdrawn")) return finish(state, s, "withdrawn", "The offer was withdrawn.");
    return finish(state, s, left(state, s) <= 0 ? "deadline-expired" : "window-closed", "The offer lapsed.");
  }
  if (s.decisionId && !offers.some((o) => o.status === "terms")) dropDecision(state, s);
}

/** Call after the player acts on an offer (negotiate, decide) so the saga reacts immediately. */
export function syncSagas(state: GameState): void {
  for (const s of state.user.sagas) syncSaga(state, s);
}

// --------------------------------------------------------------------------- weekly step

export function stepSagas(state: GameState, rng: Rng): void {
  const s = activeSaga(state);
  if (!s) return;
  syncSaga(state, s);
  if (!isActiveSaga(s) || s.lastStepIndex >= state.turnIndex) return;
  // One step a week; the closer the deadline, the faster things move.
  const steps = left(state, s) <= 1 ? 3 : left(state, s) <= 3 ? 2 : 1;
  for (let i = 0; i < steps && isActiveSaga(s); i++) {
    if (s.decisionId && state.user.decisions.some((d) => d.id === s.decisionId)) {
      if (left(state, s) > 0) break; // waiting for the player; the decision expires to its default in time
      const d = state.user.decisions.find((x) => x.id === s.decisionId);
      if (d) {
        state.user.decisions = state.user.decisions.filter((x) => x.id !== d.id);
        resolveSagaDecision(state, d, d.fallback);
        if (!isActiveSaga(s)) break;
      }
    }
    stepOnce(state, rng, s);
    syncSaga(state, s);
  }
  s.lastStepIndex = state.turnIndex;
  if (isActiveSaga(s) && left(state, s) <= 0) finalize(state, s);
}

/** The window is shut: whatever is still open lapses and the saga ends. */
function finalize(state: GameState, s: TransferSaga): void {
  const hadBids = s.bids > 0;
  const terms = offersOf(state, s).some((o) => o.status === "terms");
  log(state, s, s.stage, terms ? "The deadline passes with personal terms still unsigned." : "The deadline passes with no deal.");
  finish(state, s, hadBids ? "deadline-expired" : "window-closed", terms ? "The window closed before you signed." : "The window closed with no deal done.");
}

const canAfford = (club: ClubState, fee: number) => club.balance >= fee * 0.3;

function stepOnce(state: GameState, rng: Rng, s: TransferSaga): void {
  const p = userPlayer(state);
  const club = state.clubs[s.clubId];
  if (!club) return finish(state, s, "withdrawn", "The club is no longer in the picture.");
  const name = clubName(s.clubId);
  const urgent = left(state, s) <= 2;
  const free = s.kind === "free";
  // Before the window opens a story can only brew: bids wait for the first week of the window.
  const open = free || isTransferWindow(state.turn);
  const lean = leanings(p);
  const agent = agentSkill(state, "connections") / 100;

  // Deadline pressure: in the last week the saga stops dawdling. Talks and bids already under way carry on; anything
  // earlier is cut short and the buyer must move now.
  const firstWarning = left(state, s) <= 1 && !s.flags.deadline;
  if (left(state, s) <= 1) s.flags.deadline = true;
  const interruptible = !["contract-talks", "deadline-pressure", "first-bid", "improved-bid", "competing-bid"].includes(s.stage);
  if (s.flags.deadline && interruptible && !offersOf(state, s).some((o) => o.status === "terms")) {
    return go(state, s, "deadline-pressure", `The window is about to close — ${name} must move now.`, firstWarning ? { title: "Deadline looming", body: `${name} are running out of time to get a deal done.` } : undefined);
  }

  switch (s.stage) {
    case "interest": {
      const next = pickStage(rng, free ? [["agent-contact", 0.6], ["contract-talks", 0.4]] : [["scouting", 0.4 - (urgent ? 0.25 : 0)], ["agent-contact", 0.3 + agent * 0.2], ["first-bid", open ? 0.3 + (urgent ? 0.5 : 0) + (s.flags.formerClub ? 0.3 : 0) : 0]]);
      if (next === "scouting") return go(state, s, next, `${name} send scouts to watch you in training and on matchday.`);
      if (next === "agent-contact") return agentContact(state, s);
      if (next === "contract-talks") return openFreeTerms(state, rng, s);
      return placeBid(state, rng, s, club, "An opening bid goes in.");
    }
    case "scouting":
      return pickStage(rng, [["agent-contact", 0.6], ["enquiry", 0.4]]) === "agent-contact" || free ? agentContact(state, s) : enquiry(state, rng, s);
    case "agent-contact":
      if (free) return openFreeTerms(state, rng, s);
      return pickStage(rng, [["enquiry", 0.7], ["first-bid", open ? 0.3 + (urgent ? 0.4 : 0) : 0]]) === "enquiry" ? enquiry(state, rng, s) : placeBid(state, rng, s, club, "No more waiting — a bid is lodged.");
    case "enquiry":
      if (!open) return; // the club is waiting for the window to open
      return placeBid(state, rng, s, club, "A formal bid follows the enquiry.");
    case "first-bid":
    case "improved-bid":
    case "competing-bid":
    case "deadline-pressure":
      return respondToBids(state, rng, s);
    case "bid-rejected":
      return afterRejection(state, rng, s, club);
    case "player-unsettled":
      return afterUnsettled(state, rng, s, lean);
    case "manager-talk": {
      // The decision was settled (listen): the saga moves on.
      const next = pickStage(rng, [["improved-bid", 0.65], ["competing-bid", s.rivals.length < 2 ? 0.2 : 0], ["transfer-request", s.flags.requested ? 0 : 0.15 * (1 + lean.ambition)]]);
      if (next === "competing-bid") return addRival(state, rng, s);
      if (next === "transfer-request") return requestTransfer(state, s);
      return improveBid(state, rng, s);
    }
    case "transfer-request":
      return pickStage(rng, [["improved-bid", 0.55], ["competing-bid", s.rivals.length < 2 ? 0.3 : 0]]) === "improved-bid" ? improveBid(state, rng, s) : addRival(state, rng, s);
    case "contract-talks":
      // Personal terms are the player's to settle. A saga with waited-for rivals may see one arrive.
      if (s.flags.waited && s.rivals.length < 2 && rng.chance(0.4)) return addRival(state, rng, s);
      return;
    default:
      return;
  }
}

// --------------------------------------------------------------------------- stages

function agentContact(state: GameState, s: TransferSaga): void {
  const has = state.user.agent.id !== "none";
  if (has) nudge(state, { agent: 1 });
  go(state, s, "agent-contact", has ? `${clubName(s.clubId)} sound out your agent about your situation.` : `${clubName(s.clubId)} approach you through intermediaries.`);
}

function enquiry(state: GameState, rng: Rng, s: TransferSaga): void {
  const p = userPlayer(state);
  const club = p.clubId ? state.clubs[p.clubId] : null;
  const yearsLeft = p.contract ? p.contract.expires - state.season : 0;
  const key = p.contract?.role === "star" || p.contract?.role === "first";
  const notForSale = !!club && key && club.balance > 0 && yearsLeft >= 2 && !state.user.transferRequest && rng.chance(0.3);
  if (notForSale) return finish(state, s, "club-declined", `${clubName(p.clubId)} make it clear you are not for sale.`);
  go(state, s, "enquiry", `${clubName(s.clubId)} make an enquiry to ${club ? clubName(club.id) : "your representatives"}.`);
}

function placeBid(state: GameState, rng: Rng, s: TransferSaga, club: ClubState, text: string): void {
  if (s.kind === "free") return openFreeTerms(state, rng, s);
  const p = userPlayer(state);
  const value = marketValue(p, state.season);
  const fee = roundFee(Math.max(s.fee * 0.9, value * rng.range(0.82, 1.02)));
  if (!canAfford(club, fee)) return finish(state, s, "club-declined", `${clubName(club.id)} cannot find the money for a bid.`);
  s.fee = fee;
  createOffer(state, rng, s, club, "transfer", fee, s.draft.terms, s.draft.maxWage, "club-pending");
  go(state, s, "first-bid", `${text} ${clubName(club.id)} offer ${formatMoney(fee)}.`);
}

function openFreeTerms(state: GameState, rng: Rng, s: TransferSaga): void {
  const club = state.clubs[s.clubId];
  const o = createOffer(state, rng, s, club, "free", 0, s.draft.terms, s.draft.maxWage, "terms");
  enterTalks(state, s, o);
}

/** Bids are answered; accepted ones become personal terms, rejected ones feed the next move. */
function respondToBids(state: GameState, rng: Rng, s: TransferSaga): void {
  const p = userPlayer(state);
  if (!s.offerIds.length) return placeBid(state, rng, s, state.clubs[s.clubId], "Time is short — a bid goes in.");
  const pending = offersOf(state, s).filter((o) => o.status === "club-pending");
  const mult = (s.flags.managerTalked ? 1.06 : 1) * (s.flags.deadline ? 0.93 : 1);
  const accepted: TransferOffer[] = [];
  for (const o of pending) {
    const ev = evaluateBid(state, o, rng, mult);
    if (ev.accept) {
      o.status = "terms";
      o.expiresTurn = state.turn + 3;
      o.history.push(ev.clause ? "Release clause triggered — the club cannot block the move." : `${clubName(p.clubId)} accept the bid. Personal terms to agree.`);
      accepted.push(o);
    } else {
      o.status = "club-rejected";
      s.rejections++;
      o.history.push(`${clubName(p.clubId)} reject the bid (asking around ${formatMoney(Math.round(ev.asking / 100000) * 100000)}).`);
    }
  }
  if (accepted.length) return enterTalks(state, s, accepted.sort((a, b) => state.clubs[b.fromClubId].reputation - state.clubs[a.fromClubId].reputation)[0]);
  const inTalks = offersOf(state, s).find((o) => o.status === "terms");
  if (inTalks) {
    if (s.stage !== "contract-talks") go(state, s, "contract-talks", `The other bid falls away; talks with ${clubName(inTalks.fromClubId)} continue.`);
    return;
  }
  const rejected = offersOf(state, s).filter((o) => o.status === "club-rejected");
  if (!pending.length && !rejected.length) return;
  if (s.flags.deadline && rejected.length) {
    // Deadline day: one final, bigger bid to the club that is closest.
    const target = rejected.find((o) => o.fromClubId === s.clubId) ?? rejected[0];
    if (!target.history.some((h) => h.includes("final"))) {
      raise(state, s, target, rng.range(1.15, 1.3), "final");
      return log(state, s, "deadline-pressure", `${clubName(target.fromClubId)} lodge a final bid of ${formatMoney(target.fee)}.`);
    }
    return finish(state, s, "deadline-expired", `${clubName(target.fromClubId)} cannot meet the price before the window shuts.`);
  }
  if (!s.flags.deadline) go(state, s, "bid-rejected", `${clubName(p.clubId)} turn down ${formatMoney(rejected[0].fee)}.`, s.rejections === 1 ? { title: `Bid rejected`, body: `${clubName(rejected[0].fromClubId)}'s ${formatMoney(rejected[0].fee)} offer was turned down.` } : undefined);
}

function raise(state: GameState, s: TransferSaga, o: TransferOffer, factor: number, tag: string): void {
  const club = state.clubs[o.fromClubId];
  let fee = roundFee(o.fee * factor);
  if (!canAfford(club, fee)) fee = roundFee(Math.max(o.fee, club.balance / 0.3));
  o.fee = Math.max(o.fee, fee);
  o.status = "club-pending";
  o.history.push(`${clubName(o.fromClubId)} come back with ${tag === "final" ? "a final" : "an improved"} bid of ${formatMoney(o.fee)}.`);
  s.bids++;
  if (o.fromClubId === s.clubId) s.fee = o.fee;
}

function improveBid(state: GameState, rng: Rng, s: TransferSaga): void {
  const rejected = offersOf(state, s).filter((o) => o.status === "club-rejected");
  const target = rejected.find((o) => o.fromClubId === s.clubId) ?? rejected[0];
  if (!target) return placeBid(state, rng, s, state.clubs[s.clubId], "The chase restarts.");
  const club = state.clubs[target.fromClubId];
  if (!canAfford(club, target.fee * 1.12)) return finish(state, s, "club-declined", `${clubName(target.fromClubId)} cannot stretch to another bid.`);
  raise(state, s, target, rng.range(1.12, 1.3), "improved");
  go(state, s, "improved-bid", `${clubName(target.fromClubId)} return with an improved bid of ${formatMoney(target.fee)}.`, { title: `${clubName(target.fromClubId)} improve their offer`, body: formatMoney(target.fee) });
}

function afterRejection(state: GameState, rng: Rng, s: TransferSaga, club: ClubState): void {
  const p = userPlayer(state);
  const lean = leanings(p);
  const rich = canAfford(club, s.fee * 1.15);
  const rival = s.rivals.length < 2 && s.importance >= 50;
  const next = pickStage(rng, [
    ["improved-bid", rich ? 0.45 : 0.1],
    ["player-unsettled", s.flags.unsettled || !p.clubId ? 0 : 0.5 * (1 + lean.ambition + lean.money * 0.5 - lean.loyalty)],
    ["competing-bid", rival ? 0.35 : 0],
    ["failed", Math.max(0, s.rejections - 2) * 0.4 + (rich ? 0 : 0.5)],
  ]);
  if (next === "improved-bid") return improveBid(state, rng, s);
  if (next === "player-unsettled") return unsettle(state, rng, s);
  if (next === "competing-bid") return addRival(state, rng, s);
  finish(state, s, rich ? "withdrawn" : "club-declined", rich ? `${clubName(s.clubId)} lose patience and walk away.` : `${clubName(s.clubId)} cannot afford to keep bidding.`);
}

function unsettle(state: GameState, rng: Rng, s: TransferSaga): void {
  const p = userPlayer(state);
  s.flags.unsettled = true;
  p.morale = clamp(p.morale - rng.int(4, 8), 0, 100);
  go(state, s, "player-unsettled", `With ${clubName(s.clubId)} so keen, your head is turned. Training is harder to focus on.`, { title: "Player unsettled", body: `Talk of a move to ${clubName(s.clubId)} has left you distracted.` });
}

function afterUnsettled(state: GameState, rng: Rng, s: TransferSaga, lean: ReturnType<typeof leanings>): void {
  const rel = state.user.relationships;
  const next = pickStage(rng, [
    ["manager-talk", 0.5 + (rel.manager >= 40 ? 0.2 : 0) + lean.loyalty * 0.3],
    ["transfer-request", s.flags.requested ? 0 : 0.3 + lean.ambition * 0.4],
    ["improved-bid", 0.2],
  ]);
  if (next === "manager-talk") return managerTalk(state, s);
  if (next === "transfer-request") return requestTransfer(state, s);
  improveBid(state, rng, s);
}

function managerTalk(state: GameState, s: TransferSaga): void {
  const p = userPlayer(state);
  const mgr = p.clubId ? state.clubs[p.clubId]?.manager.name : "The manager";
  s.flags.managerTalked = true;
  go(state, s, "manager-talk", `${mgr} calls you in to talk about your future.`);
  openDecision(
    state, s, "manager", "The manager wants a word",
    `${mgr} knows ${clubName(s.clubId)} are pushing. He wants to hear where your head is at.`,
    [
      { id: "commit", label: "Stay committed", hint: "Tell the club you're staying. The manager and fans will love it." },
      { id: "listen", label: "Hear him out", hint: "Keep your options open for now." },
      { id: "push", label: "Tell him you want to leave", hint: "A transfer request: the board and fans will not like it." },
    ],
    "listen",
  );
}

function requestTransfer(state: GameState, s: TransferSaga): void {
  s.flags.requested = true;
  setTransferRequest(state, true);
  go(state, s, "transfer-request", "You hand in a transfer request. The club's position weakens.", { title: "Transfer request submitted", body: `You want to leave. ${clubName(s.clubId)} are waiting.` });
}

function addRival(state: GameState, rng: Rng, s: TransferSaga): void {
  const p = userPlayer(state);
  const lead = state.clubs[s.clubId];
  const ovr = overallFor(p.attrs, p.position);
  const taken = new Set<ClubId>([s.clubId, ...s.rivals, ...(p.clubId ? [p.clubId] : [])]);
  const pool = Object.values(state.clubs).filter(
    (c) => !taken.has(c.id) && clubLevel(c.reputation) >= ovr - 8 && c.reputation >= lead.reputation - 12 && c.balance > 0,
  );
  if (!pool.length) return improveBid(state, rng, s);
  const sameLeague = (c: ClubState) => (c.leagueId === lead.leagueId ? 1.5 : 1);
  const rival = rng.weighted(pool, (c) => Math.pow(c.reputation, 1.5) * sameLeague(c) * (1 + baseRivalry(lead.id, c.id)));
  const fee = roundFee(Math.max(s.fee * rng.range(1.0, 1.15), marketValue(p, state.season) * rng.range(0.95, 1.2)));
  if (!canAfford(rival, fee)) return improveBid(state, rng, s);
  const { terms, maxWage } = makeTerms(state, rng, rival, p, "transfer");
  s.rivals.push(rival.id);
  createOffer(state, rng, s, rival, "transfer", fee, terms, maxWage, "club-pending");
  bumpRivalHeat(state, rival.id, 0.02);
  go(state, s, "competing-bid", `${clubName(rival.id)} enter the race with a bid of ${formatMoney(fee)}.`, { title: `${clubName(rival.id)} enter the race`, body: `A rival bid of ${formatMoney(fee)} for you.` });
}

/** An offer is in personal terms: settled by the player, here or on the offers page. */
function enterTalks(state: GameState, s: TransferSaga, o: TransferOffer): void {
  s.clubId = o.fromClubId;
  const terms = offersOf(state, s).filter((x) => x.status === "terms");
  go(state, s, "contract-talks", terms.length > 1 ? `Two clubs are now ready to talk personal terms.` : `${clubName(o.fromClubId)} agree a fee. Your personal terms are next.`, { title: `Bid accepted: ${clubName(o.fromClubId)}`, body: "Negotiate your personal terms." });
  if (terms.length > 1) {
    const best = [...terms].sort((a, b) => state.clubs[b.fromClubId].reputation - state.clubs[a.fromClubId].reputation);
    openDecision(
      state, s, "prefer", "Which club do you want?",
      "More than one club has agreed a deal. Choose the move you want to pursue; the other will be dropped.",
      best.slice(0, 3).map((x) => ({ id: `club:${x.fromClubId}`, label: clubName(x.fromClubId), hint: `${formatMoney(x.terms.wage)}/wk · ${x.terms.years} yrs · ${formatMoney(x.fee)} fee` })),
      `club:${preferred(state, best).fromClubId}`,
    );
    return;
  }
  termsDecision(state, s);
}

function preferred(state: GameState, offers: TransferOffer[]): TransferOffer {
  const p = userPlayer(state);
  const money = leanings(p).money >= 0.35;
  return [...offers].sort((a, b) => (money ? b.terms.wage - a.terms.wage : state.clubs[b.fromClubId].reputation - state.clubs[a.fromClubId].reputation))[0];
}

function termsDecision(state: GameState, s: TransferSaga): void {
  if (s.flags.agentPushed) return;
  openDecision(
    state, s, "terms", `Personal terms with ${clubName(s.clubId)}`,
    "The fee is agreed. How do you want to handle your own contract?",
    [
      { id: "accept", label: "Accept the terms", hint: "Complete the move now." },
      { id: "agent", label: "Push your agent to negotiate", hint: "A better deal, if they're willing — but patience is limited." },
      { id: "wait", label: "Wait for a better offer", hint: "Keep it open. Rival interest may appear — or the window may close." },
      { id: "decline", label: "Turn the move down", hint: "Stay where you are." },
    ],
    "wait",
  );
}

// --------------------------------------------------------------------------- decisions

/** Applies a saga decision. Consequences run through the existing relationship, morale, offer and transfer-request systems. */
export function resolveSagaDecision(state: GameState, d: CareerDecision, optionId: string): string {
  const s = state.user.sagas.find((x) => x.id === d.sagaId);
  if (!s || !isActiveSaga(s)) return "The moment has passed.";
  s.decisionId = undefined;
  const p = userPlayer(state);
  const rng = Rng.fromSeed(`${state.seed}:saga:${s.id}:${state.turnIndex}:${optionId}`);
  const lean = leanings(p);

  if (d.eventId === "saga:manager") {
    if (optionId === "commit") {
      nudge(state, { manager: 10, supporters: 8, board: 4 });
      p.morale = clamp(p.morale + 3 - Math.round(lean.ambition * 7), 0, 100);
      state.user.loyaltyStands = (state.user.loyaltyStands ?? 0) + 1;
      s.flags.committed = true;
      finish(state, s, "player-declined", `You tell ${clubName(p.clubId)} you are staying. ${clubName(s.clubId)} move on.`);
      return "You commit your future to the club.";
    }
    if (optionId === "push") {
      requestTransfer(state, s);
      return "You ask to leave.";
    }
    nudge(state, { manager: 3 });
    log(state, s, "manager-talk", "You listen. Nothing is settled, but the door stays open.");
    return "You hear him out.";
  }

  if (d.eventId === "saga:prefer") {
    const clubId = optionId.replace("club:", "");
    const keep = offersOf(state, s).find((o) => o.status === "terms" && o.fromClubId === clubId);
    if (!keep) return "That offer is no longer there.";
    for (const o of offersOf(state, s)) {
      if (o !== keep && isLive(o)) {
        o.status = "withdrawn";
        o.history.push(`Withdrawn: you chose ${clubName(clubId)}.`);
        if (baseRivalry(s.fromClubId, o.fromClubId) >= 0.4) bumpRivalHeat(state, o.fromClubId, 0.04);
      }
    }
    s.clubId = clubId;
    log(state, s, "contract-talks", `You make ${clubName(clubId)} your first choice.`);
    termsDecision(state, s);
    return `You prefer ${clubName(clubId)}.`;
  }

  // Personal terms.
  const offer = offersOf(state, s).find((o) => o.status === "terms" && o.fromClubId === s.clubId) ?? offersOf(state, s).find((o) => o.status === "terms");
  if (!offer) return "The offer has gone.";
  if (optionId === "accept") {
    const r = negotiate(state, offer.id, { type: "accept" }, rng);
    syncSaga(state, s);
    return r.message;
  }
  if (optionId === "decline") {
    negotiate(state, offer.id, { type: "reject" }, rng);
    if (lean.loyalty >= 0.35) s.flags.committed = true;
    syncSaga(state, s);
    return "You turn the move down.";
  }
  if (optionId === "agent") {
    s.flags.agentPushed = true;
    const skill = agentSkill(state, "negotiation");
    if (rng.chance(0.35 + skill / 200)) {
      const room = Math.max(0, offer.maxWage - offer.terms.wage);
      offer.terms = { ...offer.terms, wage: Math.round((offer.terms.wage + room * (0.4 + skill / 250)) / 100) * 100 };
      offer.history.push(`Your agent squeezes the wage up to ${formatMoney(offer.terms.wage)}/wk.`);
      log(state, s, s.stage, "Your agent wrings out a better deal.");
      return "Your agent improves the terms.";
    }
    offer.patience--;
    offer.history.push("Your agent pushes, but the club holds firm.");
    if (offer.patience <= 0) {
      offer.status = "withdrawn";
      offer.history.push(`${clubName(offer.fromClubId)} walk away from talks.`);
      syncSaga(state, s);
      return `${clubName(offer.fromClubId)} have walked away.`;
    }
    log(state, s, s.stage, "The club will not move on its offer.");
    return "The club holds firm.";
  }
  s.flags.waited = true;
  log(state, s, s.stage, "You keep the offer waiting while you weigh your options.");
  return "You wait.";
}
