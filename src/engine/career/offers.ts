import { BALANCE } from "../balance";
import { isTransferWindow, windowName } from "../calendar";
import { clubName, staticClub, staticLeague } from "../data/world";
import { overallFor } from "../players/attributes";
import { formatMoney, marketValue, wageFor } from "../players/economy";
import { ageOf } from "../players/generate";
import { clamp, type Rng } from "../rng";
import type { ClubState, ContractTerms, GameState, Player, SquadRole, TransferOffer } from "../types";
import { clubLevel } from "../world/create";
import { agentSkill, chargeCommission } from "./agents";
import { rememberContractDispute, rememberRejection, rememberTransfer } from "../memory/detect";
import { receiveIncome } from "./money";
import { addNews, addTimeline, addToSquad, nextId, removeFromSquad, squadOf, userPlayer } from "../world/helpers";

const ROLE_LABEL: Record<SquadRole, string> = { star: "Star player", first: "First-team regular", rotation: "Rotation", backup: "Squad player", prospect: "Prospect" };
export { ROLE_LABEL };

/** How many overall points below the player a club's usual XI may be and still make an offer. */
const DROP_ALLOWED = 4;

function uOvr(p: Player) {
  return overallFor(p.attrs, p.position);
}

/** Rank of the user within a club's squad at their position → expected role. */
export function expectedRole(state: GameState, club: ClubState, p: Player): SquadRole {
  const o = uOvr(p);
  const rivals = squadOf(state, club.id)
    .filter((x) => x.id !== p.id && (x.position === p.position || x.secondary.includes(p.position)))
    .map((x) => overallFor(x.attrs, p.position))
    .sort((a, b) => b - a);
  const better = rivals.filter((r) => r > o + 1).length;
  const slots = p.position === "GK" ? 1 : ["CB", "CM", "ST"].includes(p.position) ? 2 : 1;
  const age = ageOf(p, state.season);
  if (better === 0 && o >= clubLevel(club.reputation) + 3) return "star";
  if (better < slots) return "first";
  if (better < slots + 1) return "rotation";
  if (age <= 20) return "prospect";
  return "backup";
}

function makeTerms(state: GameState, rng: Rng, club: ClubState, p: Player, kind: TransferOffer["kind"]): { terms: ContractTerms; maxWage: number } {
  const role = expectedRole(state, club, p);
  const o = uOvr(p);
  const base = wageFor(o, club.reputation, role);
  const diff = state.settings.difficulty;
  const generosity = diff === "relaxed" ? 1.12 : diff === "hardcore" ? 0.92 : 1;
  const wage = Math.round((base * rng.range(0.9, 1.08) * generosity) / 100) * 100;
  const age = ageOf(p, state.season);
  const years = kind === "loan" ? 1 : age <= 23 ? rng.int(3, 5) : age <= 29 ? rng.int(2, 4) : rng.int(1, 2);
  return {
    terms: {
      wage,
      years,
      role,
      signingBonus: Math.round((kind === "free" ? wage * rng.int(8, 20) : kind === "renewal" ? wage * rng.int(2, 6) : 0) * (0.9 + agentSkill(state, "negotiation") / 250)),
      goalBonus: ["ST", "RW", "LW", "AM"].includes(p.position) ? Math.round(wage * 0.04) : 0,
      releaseClause: staticClub(club.id)?.countryCode === "ESP" ? Math.round((marketValue(p, state.season) * rng.range(3, 5)) / 1e6) * 1e6 : undefined,
    },
    maxWage: Math.round(wage * rng.range(1.12, 1.38)),
  };
}

function openOffers(state: GameState) {
  return state.user.offers.filter((o) => o.status === "club-pending" || o.status === "terms");
}

/** Probability a given club shows concrete interest this turn. */
function interestIn(state: GameState, club: ClubState, p: Player): number {
  const o = uOvr(p);
  const level = clubLevel(club.reputation);
  const age = ageOf(p, state.season);
  const squad = squadOf(state, club.id);
  const starter = squad.filter((x) => x.position === p.position).map((x) => overallFor(x.attrs, p.position)).sort((a, b) => b - a)[0] ?? 0;
  const prospectBonus = age <= 21 && p.hidden.potential > level + 2 && p.reputation > 25 ? 0.6 : 0;
  if (o < level - 7 && !prospectBonus) return 0;
  // Clubs a long way below your level don't come calling: a star isn't offered a deal by a side that
  // fields players ten points worse. Free agents and veterans get a little more leeway.
  const dropAllowed = DROP_ALLOWED + (!p.clubId ? 3 : 0) + (age >= 31 ? 2 : 0) + ((state.user.freeSeasons ?? 0) >= 1 ? 3 : 0);
  if (o - level > dropAllowed) return 0;
  if (o > level + 10) return 0.004; // too good for them; they know they can't afford it
  const upgrade = clamp((o - starter + 4) / 10, 0, 1.2) + prospectBonus;
  const rep = clamp(p.reputation / 55, 0.25, 1.6);
  // Players dominating a weaker league get noticed by bigger clubs.
  const curLevel = p.clubId ? clubLevel(state.clubs[p.clubId]?.reputation ?? 50) : 0;
  const outgrown = p.clubId && o > curLevel + 4 && club.reputation > (state.clubs[p.clubId]?.reputation ?? 0) ? 1 + (o - curLevel - 4) / 4 : 1;
  const form = clamp(1 + (p.form - 6.6) * 0.4, 0.6, 1.6);
  const agent = 0.65 + agentSkill(state, "connections") / 150;
  const request = state.user.transferRequest ? 2 : 1;
  const expiring = p.contract && p.contract.expires <= state.season ? 1.6 : 1;
  // The closer a club is to your level (or above it), the likelier its interest.
  const fit = o - level <= 0 ? 1 : Math.exp(-(o - level) / 3);
  return 0.045 * upgrade * rep * form * agent * request * expiring * outgrown * fit;
}

export function generateUserOffers(state: GameState, rng: Rng): void {
  const p = userPlayer(state);
  if (state.user.retired || p.retired) return;
  const free = !p.clubId;
  const window = isTransferWindow(state.turn);
  if (!window && !free) return;
  if (openOffers(state).length >= 4) return;
  const current = p.clubId ? state.clubs[p.clubId] : null;
  const contractEnding = !!p.contract && p.contract.expires <= state.season && state.turn > BALANCE.calendar.endOfSeasonTurn;
  const candidates = rng.shuffle(Object.values(state.clubs).filter((c) => c.id !== p.clubId && c.id !== p.loan?.fromClubId)).slice(0, 70);
  let made = 0;
  for (const club of candidates) {
    if (made >= (free ? 2 : 1)) break;
    if (state.user.offers.some((o) => o.fromClubId === club.id && o.season === state.season && o.status !== "expired")) continue;
    let pr = interestIn(state, club, p);
    // Unattached players get more calls, but still only from clubs near their level.
    if (free) pr = pr * 3 + (Math.abs(clubLevel(club.reputation) - uOvr(p)) <= 4 ? 0.05 : 0);
    if (!rng.chance(pr)) continue;
    const kind: TransferOffer["kind"] = free || contractEnding ? "free" : "transfer";
    const value = marketValue(p, state.season);
    let fee = kind === "free" ? 0 : Math.round((value * rng.range(0.95, 1.35)) / 50000) * 50000;
    if (p.contract?.releaseClause && fee > p.contract.releaseClause * 0.8 && rng.chance(0.5)) fee = p.contract.releaseClause;
    const { terms, maxWage } = makeTerms(state, rng, club, p, kind);
    const offer: TransferOffer = {
      id: nextId(state, "o"),
      kind,
      fromClubId: club.id,
      toPlayerClubId: p.clubId,
      fee,
      terms,
      maxWage,
      patience: rng.int(2, 3),
      status: kind === "free" ? "terms" : "club-pending",
      createdTurn: state.turn,
      expiresTurn: state.turn + (kind === "free" ? 4 : 3),
      season: state.season,
      history: [kind === "free" ? `${clubName(club.id)} offer you a contract.` : `${clubName(club.id)} bid ${formatMoney(fee)} for you.`],
    };
    state.user.offers.unshift(offer);
    made++;
    addNews(state, {
      kind: "transfer",
      title: kind === "free" ? `${clubName(club.id)} want to sign you` : `${clubName(club.id)} make a bid`,
      body: kind === "free" ? `Contract offer: ${formatMoney(terms.wage)}/wk, ${terms.years} yrs.` : `${formatMoney(fee)} offered to ${clubName(current?.id ?? null)}.`,
      important: true,
    });
  }
  // Loan offers for young players who are not playing.
  if (window && p.clubId && ageOf(p, state.season) <= 22 && (state.user.wantsLoan || lowMinutes(state, p)) && !p.loan && rng.chance((state.user.wantsLoan ? 0.6 : 0.3) * (0.7 + agentSkill(state, "care") / 100))) {
    const parent = state.clubs[p.clubId];
    const pool = Object.values(state.clubs).filter((c) => c.reputation < parent.reputation - 6 && clubLevel(c.reputation) <= uOvr(p) + 3 && clubLevel(c.reputation) >= uOvr(p) - 6);
    const club = pool.length ? rng.pick(pool) : null;
    if (club && !state.user.offers.some((o) => o.kind === "loan" && o.status === "terms")) {
      const { terms, maxWage } = makeTerms(state, rng, club, p, "loan");
      state.user.offers.unshift({
        id: nextId(state, "o"), kind: "loan", fromClubId: club.id, toPlayerClubId: p.clubId, fee: 0, terms, maxWage, patience: 1, status: "terms",
        createdTurn: state.turn, expiresTurn: state.turn + 3, season: state.season, history: [`${clubName(club.id)} want you on a season-long loan.`], note: `Approved by ${clubName(parent.id)}.`,
      });
      addNews(state, { kind: "transfer", title: `Loan interest from ${clubName(club.id)}`, body: "Regular football could accelerate your development.", important: true });
    }
  }
}

function lowMinutes(state: GameState, p: Player): boolean {
  let mins = 0;
  for (const k in p.season) mins += p.season[k].minutes;
  const elapsed = Math.max(1, state.turn - BALANCE.calendar.seasonStart);
  return state.turn > 12 ? mins < elapsed * 25 : state.season > state.user.startSeason && (p.history[p.history.length - 1]?.stats.minutes ?? 0) < 900;
}

/** Selling club responds to pending bids; buyers may improve rejected bids. */
export function processBids(state: GameState, rng: Rng): void {
  const p = userPlayer(state);
  for (const o of state.user.offers) {
    if (o.status === "club-pending") {
      const value = marketValue(p, state.season);
      const club = p.clubId ? state.clubs[p.clubId] : null;
      const key = p.contract?.role === "star" || p.contract?.role === "first";
      const yearsLeft = (p.contract?.expires ?? state.season) - state.season;
      let asking = value * (1.15 + (key ? 0.35 : 0)) * (yearsLeft >= 3 ? 1.15 : yearsLeft <= 0 ? 0.6 : 1);
      if (state.user.transferRequest) asking *= 0.82;
      if (club && state.clubs[o.fromClubId].reputation > club.reputation + 15) asking *= 0.95;
      const clause = p.contract?.releaseClause;
      const accept = (clause && o.fee >= clause) || o.fee >= asking || (o.fee >= asking * 0.85 && rng.chance(0.35));
      if (accept) {
        o.status = "terms";
        o.history.push(clause && o.fee >= clause ? "Release clause triggered — the club cannot block the move." : `${clubName(p.clubId)} accept the bid. Personal terms to agree.`);
        o.expiresTurn = state.turn + 3;
        addNews(state, { kind: "transfer", title: `Bid accepted: ${clubName(o.fromClubId)}`, body: "Negotiate your personal terms.", important: true });
      } else {
        o.status = "club-rejected";
        o.history.push(`${clubName(p.clubId)} reject the bid (asking around ${formatMoney(Math.round(asking / 100000) * 100000)}).`);
      }
    } else if (o.status === "club-rejected" && o.season === state.season && isTransferWindow(state.turn) && rng.chance(0.4) && !o.history.some((h) => h.includes("improved"))) {
      o.fee = Math.round((o.fee * rng.range(1.12, 1.3)) / 50000) * 50000;
      o.status = "club-pending";
      o.expiresTurn = state.turn + 2;
      o.history.push(`${clubName(o.fromClubId)} return with an improved bid of ${formatMoney(o.fee)}.`);
      addNews(state, { kind: "transfer", title: `${clubName(o.fromClubId)} improve their offer`, body: formatMoney(o.fee), important: true });
    }
  }
}

export function expireOffers(state: GameState): void {
  const windowOpen = isTransferWindow(state.turn) || !userPlayer(state).clubId;
  for (const o of state.user.offers) {
    if ((o.status === "club-pending" || o.status === "terms" || o.status === "club-rejected") && (state.turn > o.expiresTurn || o.season !== state.season || (!windowOpen && o.kind !== "renewal" && o.kind !== "free"))) {
      if (o.status !== "club-rejected") o.history.push("The offer lapsed.");
      o.status = "expired";
    }
  }
  if (state.user.offers.length > 30) state.user.offers = state.user.offers.slice(0, 30);
}

export type NegotiationAction =
  | { type: "accept" }
  | { type: "reject" }
  | { type: "counter"; wage: number; role?: SquadRole; years?: number; releaseClause?: boolean };

export interface NegotiationResult {
  ok: boolean;
  message: string;
  completed?: boolean;
}

export function negotiate(state: GameState, offerId: string, action: NegotiationAction, rng: Rng): NegotiationResult {
  const o = state.user.offers.find((x) => x.id === offerId);
  if (!o) return { ok: false, message: "Offer not found." };
  if (o.status !== "terms") return { ok: false, message: "This offer is not open for negotiation." };
  const p = userPlayer(state);
  if (action.type === "reject") {
    o.status = "rejected";
    o.history.push("You turned the offer down.");
    if (o.kind !== "renewal" && o.kind !== "loan") rememberRejection(state, o);
    if (o.kind === "renewal") state.user.relationships.board = clamp(state.user.relationships.board - 6, 0, 100);
    return { ok: true, message: "Offer rejected." };
  }
  if (action.type === "accept") {
    completeOffer(state, o);
    return { ok: true, message: o.kind === "renewal" ? "Contract extended!" : `Welcome to ${clubName(o.fromClubId)}!`, completed: true };
  }
  // Counter-offer
  const club = state.clubs[o.fromClubId];
  const roleOk = !action.role || action.role === o.terms.role || roleRank(action.role) >= roleRank(o.terms.role) || expectedRole(state, club, p) === action.role || rng.chance(0.25);
  const ask = Math.round(action.wage / 100) * 100;
  o.history.push(`You ask for ${formatMoney(ask)}/wk${action.role ? ` as ${ROLE_LABEL[action.role].toLowerCase()}` : ""}${action.years ? ` over ${action.years} years` : ""}.`);
  const agentEdge = 1 + (agentSkill(state, "negotiation") - 40) / 350;
  if (ask <= o.maxWage * agentEdge && roleOk) {
    o.terms = { ...o.terms, wage: ask, role: action.role && roleOk ? action.role : o.terms.role, years: action.years ?? o.terms.years };
    o.history.push("They agree to your terms.");
    completeOffer(state, o);
    return { ok: true, message: "Terms agreed!", completed: true };
  }
  o.patience--;
  if (o.patience <= 0) {
    o.status = "withdrawn";
    o.history.push(`${clubName(o.fromClubId)} walk away from talks.`);
    if (o.kind === "renewal") rememberContractDispute(state, p.clubId, "renewal");
    return { ok: false, message: `${clubName(o.fromClubId)} have withdrawn the offer.` };
  }
  const newWage = Math.round(Math.min(o.maxWage, (o.terms.wage + Math.min(ask, o.maxWage * 1.1)) / 2) / 100) * 100;
  o.terms = { ...o.terms, wage: Math.max(o.terms.wage, newWage) };
  o.history.push(`Counter-offer: ${formatMoney(o.terms.wage)}/wk${!roleOk ? `, role stays ${ROLE_LABEL[o.terms.role].toLowerCase()}` : ""}.`);
  return { ok: true, message: `They counter with ${formatMoney(o.terms.wage)}/wk.` };
}

function roleRank(r: SquadRole): number {
  return { prospect: 0, backup: 1, rotation: 2, first: 3, star: 4 }[r];
}

function completeOffer(state: GameState, o: TransferOffer) {
  const p = userPlayer(state);
  o.status = "accepted";
  const club = state.clubs[o.fromClubId];
  const season = state.season;
  const afterSeason = state.turn >= BALANCE.calendar.endOfSeasonTurn;
  if (o.kind === "renewal") {
    // A renewal adds its years on top of the contract you already have; it never shortens it.
    const current = p.contract?.expires ?? season - (afterSeason ? 0 : 1);
    p.contract = {
      clubId: club.id,
      wage: o.terms.wage,
      expires: Math.min(Math.max(current, season - (afterSeason ? 0 : 1)) + o.terms.years, season + 6),
      signed: season,
      role: o.terms.role,
      releaseClause: o.terms.releaseClause,
      goalBonus: o.terms.goalBonus,
    };
    receiveIncome(state, o.terms.signingBonus);
    chargeCommission(state, o.terms.wage, o.terms.signingBonus);
    p.morale = clamp(p.morale + 6, 0, 100);
    state.user.relationships.board = clamp(state.user.relationships.board + 8, 0, 100);
    addTimeline(state, { kind: "contract", title: `New contract with ${clubName(club.id)}`, detail: `${formatMoney(o.terms.wage)}/wk until ${p.contract.expires + 1}` });
    addNews(state, { kind: "contract", title: "Contract extension signed", body: `${formatMoney(o.terms.wage)}/wk · ${o.terms.years} years`, important: true });
    return;
  }
  const from = p.clubId;
  if (o.kind === "loan") {
    const parent = p.clubId as string;
    removeFromSquad(state, p.id);
    addToSquad(state, p.id, club.id);
    p.loan = { fromClubId: parent, untilSeason: afterSeason ? season + 1 : season };
    state.user.transfers.push({ season, turn: state.turn, from, to: club.id, fee: 0, kind: "loan" });
    addTimeline(state, { kind: "loan", title: `Loan move to ${clubName(club.id)}`, detail: `From ${clubName(parent)}` });
    addNews(state, { kind: "transfer", title: `Loan to ${clubName(club.id)} completed`, important: true });
    state.user.relationships.manager = 50;
    state.user.wantsLoan = false;
    return;
  }
  const seller = from ? state.clubs[from] : null;
  if (seller) seller.balance += o.fee;
  club.balance -= o.fee;
  if (p.loan) p.loan = undefined;
  removeFromSquad(state, p.id);
  addToSquad(state, p.id, club.id);
  p.contract = {
    clubId: club.id,
    wage: o.terms.wage,
    expires: season + o.terms.years - (afterSeason ? 0 : 1),
    signed: season,
    role: o.terms.role,
    releaseClause: o.terms.releaseClause,
    goalBonus: o.terms.goalBonus,
  };
  receiveIncome(state, o.terms.signingBonus);
  chargeCommission(state, o.terms.wage, o.terms.signingBonus);
  state.user.transfers.push({ season, turn: state.turn, from, to: club.id, fee: o.fee, kind: o.kind });
  rememberTransfer(state, from, club.id, o.fee);
  state.user.transferRequest = false;
  state.user.relationships = { ...state.user.relationships, manager: 52, teammates: 48, supporters: 50, board: 55 };
  p.morale = clamp(p.morale + 10, 0, 100);
  state.transferLog.push({ season, turn: state.turn, playerId: p.id, name: `${p.firstName} ${p.lastName}`, from, to: club.id, fee: o.fee });
  addTimeline(state, {
    kind: "transfer",
    title: `${o.fee ? "Transfer" : "Free transfer"} to ${clubName(club.id)}`,
    detail: `${from ? `From ${clubName(from)}` : "As a free agent"}${o.fee ? ` · ${formatMoney(o.fee)}` : ""} · ${formatMoney(o.terms.wage)}/wk`,
  });
  addNews(state, { kind: "transfer", title: `Done deal: you join ${clubName(club.id)}`, body: o.fee ? `Fee: ${formatMoney(o.fee)}` : "Free transfer", important: true });
  // Other open offers lapse once a move is done.
  for (const other of state.user.offers) if (other !== o && (other.status === "terms" || other.status === "club-pending")) {
    other.status = "withdrawn";
    other.history.push("Withdrawn after you signed elsewhere.");
  }
  const lg = staticLeague(club.leagueId);
  if (lg && state.user.startTier > lg.tier && lg.tier === 1 && !state.user.milestones.includes("top-flight")) {
    state.user.milestones.push("top-flight");
    addTimeline(state, { kind: "promotion", title: `Reached the top flight: ${lg.name}` });
  }
}

/** Club offers renewals to valued players with ≤ 1 season left; handles expiry to free agency. */
export function checkUserContract(state: GameState, rng: Rng): void {
  const p = userPlayer(state);
  if (!p.contract || !p.clubId || p.loan) return;
  const club = state.clubs[p.contract.clubId];
  if (!club) return;
  const left = p.contract.expires - state.season;
  const renewalTurns = [12, 28, 40, 46];
  if (left <= 1 && renewalTurns.includes(state.turn) && !state.user.offers.some((o) => o.kind === "renewal" && o.season === state.season && (o.status === "terms" || o.status === "rejected"))) {
    const o = uOvr(p);
    const level = clubLevel(club.reputation);
    const age = ageOf(p, state.season);
    const valued = o >= level - 8 || (age <= 21 && p.hidden.potential >= level - 3);
    const wantChance = valued ? 0.85 : 0.25;
    if (rng.chance(wantChance * (state.user.transferRequest ? 0.3 : 1))) {
      const { terms, maxWage } = makeTerms(state, rng, club, p, "renewal");
      terms.wage = Math.max(terms.wage, Math.round(p.contract.wage * 1.08));
      state.user.offers.unshift({
        id: nextId(state, "o"), kind: "renewal", fromClubId: club.id, toPlayerClubId: club.id, fee: 0, terms, maxWage: Math.max(maxWage, terms.wage * 1.15), patience: rng.int(2, 3),
        status: "terms", createdTurn: state.turn, expiresTurn: state.turn + 6, season: state.season, history: [`${clubName(club.id)} offer a new contract.`],
      });
      addNews(state, { kind: "contract", title: "Contract renewal offered", body: `${clubName(club.id)} want to extend your deal.`, important: true });
    }
  }
}

/** Called at season rollover: expired user contracts end → free agency; loans return. */
export function rolloverUserContract(state: GameState): void {
  const p = userPlayer(state);
  if (p.loan && p.loan.untilSeason <= state.season) {
    const parent = p.loan.fromClubId;
    removeFromSquad(state, p.id);
    p.loan = undefined;
    if (p.contract && p.contract.expires > state.season) {
      addToSquad(state, p.id, parent);
      addNews(state, { kind: "transfer", title: `Loan over — back at ${clubName(parent)}`, important: true });
    } else {
      p.clubId = null;
    }
  }
  // `expires` is the last season covered. This runs after the season counter has advanced, so only a
  // contract whose final season is already over ends here (it used to end a full year early).
  if (p.contract && p.contract.expires < state.season && !p.loan) {
    const from = p.clubId;
    removeFromSquad(state, p.id);
    p.clubId = null;
    p.contract = null;
    addTimeline(state, { kind: "contract", title: `Left ${clubName(from)} as a free agent` });
    addNews(state, { kind: "contract", title: "Your contract has expired", body: "You are now a free agent — clubs can sign you without a fee.", important: true });
  }
}

export function setTransferRequest(state: GameState, on: boolean): string {
  state.user.transferRequest = on;
  const r = state.user.relationships;
  if (on) {
    r.board = clamp(r.board - 12, 0, 100);
    r.supporters = clamp(r.supporters - 10, 0, 100);
    r.manager = clamp(r.manager - 6, 0, 100);
    addNews(state, { kind: "career", title: "Transfer request submitted", body: "Clubs will be alerted that you are available.", important: true });
    return "Your agent has made it known you want to leave.";
  }
  addNews(state, { kind: "career", title: "Transfer request withdrawn" });
  return "You commit your future to the club for now.";
}

export function windowLabel(turn: number): string | null {
  const w = windowName(turn);
  return w === "summer" ? "Summer transfer window" : w === "january" ? "January transfer window" : null;
}
