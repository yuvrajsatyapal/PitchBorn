import { BALANCE } from "../balance";
import { isTransferWindow, windowName } from "../calendar";
import { clubName, staticClub, staticLeague } from "../data/world";
import { overallFor } from "../players/attributes";
import { formatMoney, marketValue, playerWage } from "../players/economy";
import { ageOf } from "../players/generate";
import { clamp, type Rng } from "../rng";
import type { ClubState, ContractTerms, GameState, Player, SquadRole, TransferOffer } from "../types";
import { clubLevel } from "../world/create";
import { agentSkill, chargeCommission } from "./agents";
import { renewalGap, retentionOffer } from "./wages";
import { rememberContractDispute, rememberRejection, rememberTransfer } from "../memory/detect";
import { loyaltyStand, negotiationPatience, settlingEffect } from "../traits/career";
import { noteApproachDeclined, noteRenewal } from "../traits/stay";
import { noteUserTransfer } from "./rivalry/engine";
import { payOnce } from "./money";
import { onUserJoinedClub } from "../managers/story";
import { addStintEvent, affinityAt } from "../managers/history";
import { adjustRel } from "./relationships";
import { contractClauses, extrasWeekly, normaliseClauses, openingClauses, sanitizeClauses, signingBonusCeiling, CLAUSE_KEYS, type ClauseKey } from "./contracts";
import { addNews, addTimeline, addToSquad, nextId, removeFromSquad, squadOf, userPlayer } from "../world/helpers";

const ROLE_LABEL: Record<SquadRole, string> = { star: "Star player", first: "First-team regular", rotation: "Rotation", backup: "Squad player", prospect: "Prospect" };
export { ROLE_LABEL };

/** How many overall points below the player a club's usual XI may be and still make an offer. */
const DROP_ALLOWED = 4;

/** How far above the strongest possible club a player may count as for the purposes of interest. */
const ELITE_HEADROOM = 3;

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

export function makeTerms(state: GameState, rng: Rng, club: ClubState, p: Player, kind: TransferOffer["kind"]): { terms: ContractTerms; maxWage: number } {
  const role = expectedRole(state, club, p);
  const diff = state.settings.difficulty;
  const generosity = diff === "relaxed" ? 1.12 : diff === "hardcore" ? 0.92 : 1;
  // A renewal comes from the player's own club's valuation of him; every other offer is that club's market price.
  const retention = kind === "renewal" ? retentionOffer(state, club, p, role) : undefined;
  const base = retention?.wage ?? playerWage(p, state.season, club.reputation, role);
  // Difficulty colours what other clubs offer; a renewal is priced by the club's own valuation, already bounded.
  const wage = Math.round((base * (retention ? rng.range(0.98, 1.02) : rng.range(0.9, 1.08) * generosity)) / 100) * 100;
  const age = ageOf(p, state.season);
  const years = kind === "loan" ? 1 : age <= 23 ? rng.int(3, 5) : age <= 29 ? rng.int(2, 4) : rng.int(1, 2);
  const wantedBonus = Math.round((kind === "free" ? wage * rng.int(8, 20) : kind === "renewal" ? wage * rng.int(2, 6) : 0) * (0.9 + agentSkill(state, "negotiation") / 250));
  return {
    terms: {
      wage,
      years,
      role,
      // A signing bonus is paid in cash, so a club that cannot afford one does not offer it.
      signingBonus: Math.min(wantedBonus, signingBonusCeiling(club, p, wage)),
      goalBonus: 0,
      ...openingClauses(p, wage, role),
      releaseClause: staticClub(club.id)?.countryCode === "ESP" ? Math.round((marketValue(p, state.season) * rng.range(3, 5)) / 1e6) * 1e6 : undefined,
    },
    maxWage: retention ? Math.max(wage, retention.maxWage) : Math.round(wage * rng.range(1.12, 1.38)),
  };
}

export function openOffers(state: GameState) {
  return state.user.offers.filter((o) => o.status === "club-pending" || o.status === "terms");
}

/** Probability a given club shows concrete interest this turn. */
function interestIn(state: GameState, club: ClubState, p: Player): number {
  // No club can be better than the best in the world, so a 95+ superstar is compared as if he were only a
  // little above the elite clubs. Without this cap the gap to even the biggest club exceeds every limit
  // below and nobody ever bids for the very best players.
  const o = Math.min(uOvr(p), clubLevel(100) + ELITE_HEADROOM);
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
  // A release clause a club can pay is an open door: the lower it sits, the more clubs that can afford it try the handle.
  const clause = p.contract?.releaseClause;
  const clauseDoor = clause && club.balance >= clause * 0.6 ? 1.35 : 1;
  // The closer a club is to your level (or above it), the likelier its interest.
  const fit = o - level <= 0 ? 1 : Math.exp(-(o - level) / 3);
  // A manager the player once worked under nudges interest up or down: bounded, and only ever a multiplier on a
  // chance that already reflects need, quality and money, so a former manager alone never produces an offer.
  const bond = affinityAt(state, club.id)?.factor ?? 1;
  return 0.045 * upgrade * rep * form * agent * request * expiring * outgrown * fit * clauseDoor * bond;
}

/** What a club would offer, before it becomes a TransferOffer. A diverter may turn it into a transfer saga instead. */
export interface OfferDraft {
  kind: "transfer" | "free";
  fee: number;
  terms: ContractTerms;
  maxWage: number;
}
export type OfferDiverter = (club: ClubState, draft: OfferDraft, rng: Rng) => boolean;

/**
 * Weekly: clubs show concrete interest. With `rumour` set (the weeks before a window opens) nothing is offered:
 * the only possible outcome is a transfer saga starting early, so ordinary careers see no change.
 */
export function generateUserOffers(state: GameState, rng: Rng, divert?: OfferDiverter, rumour = false): void {
  const p = userPlayer(state);
  if (state.user.retired || p.retired) return;
  const free = !p.clubId;
  const window = isTransferWindow(state.turn);
  // Players under contract only move in a transfer window; a free agent can sign at any time.
  if (rumour ? free || window : !window && !free) return;
  if (openOffers(state).length >= 4) return;
  const current = p.clubId ? state.clubs[p.clubId] : null;
  const candidates = rng.shuffle(Object.values(state.clubs).filter((c) => c.id !== p.clubId && c.id !== p.loan?.fromClubId)).slice(0, 70);
  let made = 0;
  for (const club of candidates) {
    if (made >= (free ? 2 : 1)) break;
    if (state.user.offers.some((o) => o.fromClubId === club.id && o.season === state.season && o.status !== "expired")) continue;
    let pr = interestIn(state, club, p);
    // Unattached players get more calls, but still only from clubs near their level.
    if (free) pr = pr * 3 + (Math.abs(clubLevel(club.reputation) - Math.min(uOvr(p), clubLevel(100) + ELITE_HEADROOM)) <= 4 ? 0.05 : 0);
    if (!rng.chance(pr)) continue;
    const kind: TransferOffer["kind"] = free ? "free" : "transfer";
    const value = marketValue(p, state.season);
    let fee = kind === "free" ? 0 : Math.round((value * rng.range(0.95, 1.35)) / 50000) * 50000;
    if (p.contract?.releaseClause && fee > p.contract.releaseClause * 0.8 && rng.chance(0.5)) fee = p.contract.releaseClause;
    const { terms, maxWage } = makeTerms(state, rng, club, p, kind);
    if (divert?.(club, { kind, fee, terms, maxWage }, rng)) {
      made++;
      continue;
    }
    if (rumour) continue;
    const offer: TransferOffer = {
      id: nextId(state, "o"),
      kind,
      fromClubId: club.id,
      toPlayerClubId: p.clubId,
      fee,
      terms,
      maxWage,
      patience: negotiationPatience(p, rng.int(2, 3)),
      status: kind === "free" ? "terms" : "club-pending",
      createdTurn: state.turn,
      expiresTurn: state.turn + (kind === "free" ? 4 : 3),
      season: state.season,
      history: [kind === "free" ? `${clubName(club.id)} offer you a contract.` : `${clubName(club.id)} bid ${formatMoney(fee)} for you.`],
    };
    const bond = affinityAt(state, club.id);
    if (bond && bond.kind === "strong") offer.history.push(`${club.manager.name}, your former manager, wants to work with you again.`);
    state.user.offers.unshift(offer);
    made++;
    addNews(state, {
      kind: "transfer",
      title: kind === "free" ? `${clubName(club.id)} want to sign you` : `${clubName(club.id)} make a bid`,
      body: `${kind === "free" ? `Contract offer: ${formatMoney(terms.wage)}/wk, ${terms.years} yrs.` : `${formatMoney(fee)} offered to ${clubName(current?.id ?? null)}.`}${bond && bond.kind === "strong" ? ` Reunion? ${club.manager.name} knows what you can do.` : ""}`,
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

/** The selling club's verdict on a bid: its asking price, and whether the bid meets it. Draws from `rng` only when the bid is close. */
export function evaluateBid(state: GameState, o: TransferOffer, rng: Rng, askingMultiplier = 1): { accept: boolean; asking: number; clause: boolean } {
  const p = userPlayer(state);
  const value = marketValue(p, state.season);
  const club = p.clubId ? state.clubs[p.clubId] : null;
  const key = p.contract?.role === "star" || p.contract?.role === "first";
  const yearsLeft = (p.contract?.expires ?? state.season) - state.season;
  let asking = value * (1.15 + (key ? 0.35 : 0)) * (yearsLeft >= 3 ? 1.15 : yearsLeft <= 0 ? 0.6 : 1);
  if (state.user.transferRequest) asking *= 0.82;
  if (club && state.clubs[o.fromClubId].reputation > club.reputation + 15) asking *= 0.95;
  asking *= askingMultiplier;
  const clause = p.contract?.releaseClause;
  const clauseHit = !!clause && o.fee >= clause;
  const accept = clauseHit || o.fee >= asking || (o.fee >= asking * 0.85 && rng.chance(0.35));
  return { accept, asking, clause: clauseHit };
}

/** Selling club responds to pending bids; buyers may improve rejected bids. */
export function processBids(state: GameState, rng: Rng): void {
  const p = userPlayer(state);
  for (const o of state.user.offers) {
    if (o.sagaId) continue;
    if (o.status === "club-pending") {
      const { accept, asking, clause } = evaluateBid(state, o, rng);
      if (accept) {
        o.status = "terms";
        o.history.push(clause ? "Release clause triggered — the club cannot block the move." : `${clubName(p.clubId)} accept the bid. Personal terms to agree.`);
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
    if (o.sagaId) continue; // a saga closes its own offers at its deadline
    if ((o.status === "club-pending" || o.status === "terms" || o.status === "club-rejected") && (state.turn > o.expiresTurn || o.season !== state.season || (!windowOpen && o.kind !== "renewal"))) {
      if (o.status !== "club-rejected") o.history.push("The offer lapsed.");
      o.status = "expired";
    }
  }
  if (state.user.offers.length > 30) state.user.offers = state.user.offers.slice(0, 30);
}

/** Clauses a counter-offer may ask for. `releaseClause: null` asks for none; leaving a field out keeps the club's figure. */
export type CounterClauses = Partial<Record<ClauseKey, number>> & { signingBonus?: number; releaseClause?: number | null };

export type NegotiationAction =
  | { type: "accept" }
  | { type: "reject" }
  | ({ type: "counter"; wage: number; role?: SquadRole; years?: number } & CounterClauses);

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
  // A move from one club to another can only be completed while a window is open. Free agents and renewals are exempt.
  if (action.type !== "reject" && o.kind !== "renewal" && o.kind !== "free" && !isTransferWindow(state.turn)) {
    o.status = "expired";
    o.history.push("The transfer window closed before the deal was done.");
    return { ok: false, message: "The transfer window is closed: you can't join a new club until it reopens." };
  }
  if (action.type === "reject") {
    o.status = "rejected";
    o.history.push("You turned the offer down.");
    if (o.kind !== "renewal" && o.kind !== "loan") {
      if (!loyaltyStand(state, o)) rememberRejection(state, o);
      noteApproachDeclined(state, p, state.clubs[o.fromClubId]?.reputation ?? 0);
    }
    if (o.kind === "renewal") {
      // Turning down money you were never going to accept is a business decision; turning down a fair deal is a snub.
      const lowball = renewalGap(state, p, o.terms.wage) > 0;
      adjustRel(state, "board", lowball ? -2 : -6, lowball ? "You turned down a renewal below your market value" : "You turned down a new contract");
    }
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
  const years = action.years ?? o.terms.years;
  const askTerms = normaliseClauses(
    {
      ...o.terms,
      wage: ask,
      role: action.role && roleOk ? action.role : o.terms.role,
      years,
      signingBonus: action.signingBonus ?? o.terms.signingBonus,
      releaseClause: action.releaseClause === null ? undefined : action.releaseClause ?? o.terms.releaseClause,
      ...Object.fromEntries(CLAUSE_KEYS.filter((k) => action[k] !== undefined).map((k) => [k, action[k]])),
    },
    p.position,
  );
  // The bank decides what can be paid up front: this is a plain "no", and costs the club no patience.
  const cap = signingBonusCeiling(club, p, askTerms.wage);
  if (askTerms.signingBonus > Math.max(cap, o.terms.signingBonus)) {
    return { ok: false, message: `${clubName(o.fromClubId)} can't afford a signing bonus that large (up to ${formatMoney(Math.max(cap, o.terms.signingBonus))}).` };
  }
  const changed = describeAsk(o.terms, askTerms);
  o.history.push(`You ask for ${formatMoney(ask)}/wk${action.role ? ` as ${ROLE_LABEL[askTerms.role].toLowerCase()}` : ""}${action.years ? ` over ${years} years` : ""}${changed ? `, ${changed}` : ""}.`);
  const agentEdge = 1 + (agentSkill(state, "negotiation") - 40) / 350;
  // The club prices the whole package against one ceiling: its own extras are already part of that ceiling, so the
  // wage it can add is what is left after the extras you ask for.
  const ceiling = o.maxWage * agentEdge + extrasWeekly(o.terms, p, club, state);
  const cost = askTerms.wage + extrasWeekly(askTerms, p, club, state);
  if (cost <= ceiling && roleOk) {
    o.terms = askTerms;
    o.history.push("They agree to your terms.");
    completeOffer(state, o);
    return { ok: true, message: "Terms agreed!", completed: true };
  }
  o.patience--;
  if (o.patience <= 0) {
    o.status = "withdrawn";
    o.history.push(`${clubName(o.fromClubId)} walk away from talks.`);
    if (o.kind === "renewal") rememberContractDispute(state, p.clubId, "renewal");
    else if (o.sagaId) rememberContractDispute(state, o.fromClubId, `terms-${o.id}`);
    addNews(state, { kind: "contract", title: `Talks collapse with ${clubName(o.fromClubId)}`, body: o.kind === "renewal" ? "No agreement on a new contract." : "The two sides couldn't agree personal terms.", important: o.kind === "renewal" || !!o.sagaId });
    return { ok: false, message: `${clubName(o.fromClubId)} have withdrawn the offer.` };
  }
  const room = Math.max(o.terms.wage, ceiling - extrasWeekly(o.terms, p, club, state));
  const newWage = Math.round(Math.min(o.maxWage, room, (o.terms.wage + Math.min(ask, o.maxWage * 1.1)) / 2) / 100) * 100;
  o.terms = { ...o.terms, wage: Math.max(o.terms.wage, newWage) };
  const over = Math.round((cost / ceiling - 1) * 100);
  o.history.push(`Counter-offer: ${formatMoney(o.terms.wage)}/wk${!roleOk ? `, role stays ${ROLE_LABEL[o.terms.role].toLowerCase()}` : ""}${over > 0 ? `. Your package is about ${over}% over what they will pay` : ""}.`);
  return { ok: true, message: `They counter with ${formatMoney(o.terms.wage)}/wk.` };
}

/** A short list of what a counter changes besides the wage, for the negotiation log. */
function describeAsk(from: ContractTerms, to: ContractTerms): string {
  const parts: string[] = [];
  if (to.signingBonus !== from.signingBonus) parts.push(`${formatMoney(to.signingBonus)} signing bonus`);
  if (to.releaseClause !== from.releaseClause) parts.push(to.releaseClause ? `a ${formatMoney(to.releaseClause)} release clause` : "no release clause");
  for (const k of CLAUSE_KEYS) if ((to[k] ?? 0) !== (from[k] ?? 0)) parts.push(k === "wageRise" ? `a ${Math.round((to[k] ?? 0) * 100)}% annual rise` : `${CLAUSE_NAME[k]} ${formatMoney(to[k] ?? 0)}`);
  return parts.join(", ");
}

const CLAUSE_NAME: Record<ClauseKey, string> = {
  appearanceBonus: "appearance bonus",
  goalBonus: "goal bonus",
  assistBonus: "assist bonus",
  cleanSheetBonus: "clean-sheet bonus",
  trophyBonus: "trophy bonus",
  promotionBonus: "promotion bonus",
  wageRise: "annual rise",
};
export { CLAUSE_NAME };

function roleRank(r: SquadRole): number {
  return { prospect: 0, backup: 1, rotation: 2, first: 3, star: 4 }[r];
}

/** The signing bonus is paid when the contract is signed, once, by the club that signs the player. */
function paySigningBonus(state: GameState, o: TransferOffer): void {
  if (!o.terms.signingBonus) return;
  if (payOnce(state, `sign:${o.id}`, o.terms.signingBonus, "signing")) {
    const club = state.clubs[o.fromClubId];
    if (club) club.balance -= o.terms.signingBonus;
  }
}

function completeOffer(state: GameState, o: TransferOffer) {
  const p = userPlayer(state);
  o.status = "accepted";
  const club = state.clubs[o.fromClubId];
  const season = state.season;
  const afterSeason = state.turn >= BALANCE.calendar.endOfSeasonTurn;
  if (o.kind === "renewal") {
    const prevWage = p.contract?.wage ?? 0;
    // A renewal adds its years on top of the contract you already have; it never shortens it.
    const current = p.contract?.expires ?? season - (afterSeason ? 0 : 1);
    p.contract = {
      clubId: club.id,
      wage: o.terms.wage,
      expires: Math.min(Math.max(current, season - (afterSeason ? 0 : 1)) + o.terms.years, season + 6),
      signed: season,
      role: o.terms.role,
      ...contractClauses(o.terms),
    };
    paySigningBonus(state, o);
    chargeCommission(state, o.terms.wage, o.terms.signingBonus);
    // Judged before this signing is recorded, so it doesn't raise the bar it is measured against.
    const undervalued = renewalGap(state, p, o.terms.wage) > 0.03;
    const cut = prevWage > 0 && o.terms.wage < prevWage * 0.9;
    noteRenewal(state, p);
    // Signing for less than the market rate, or taking a visible cut, is remembered in the dressing room.
    p.morale = clamp(p.morale + 6 - (undervalued ? 3 : 0) - (cut ? 3 : 0), 0, 100);
    adjustRel(state, "board", undervalued ? 3 : 8, "You signed a new contract");
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
    onUserJoinedClub(state, club.id);
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
    ...contractClauses(o.terms),
  };
  paySigningBonus(state, o);
  chargeCommission(state, o.terms.wage, o.terms.signingBonus);
  state.user.transfers.push({ season, turn: state.turn, from, to: club.id, fee: o.fee, kind: o.kind });
  rememberTransfer(state, from, club.id, o.fee);
  noteUserTransfer(state, club.id);
  state.user.transferRequest = false;
  const settle = settlingEffect(p, from ? staticClub(from)?.countryCode : undefined, staticClub(club.id)?.countryCode);
  state.user.relationships = { ...state.user.relationships, manager: clamp(52 + settle.manager, 30, 80), teammates: 48, supporters: 50, board: 55 };
  p.morale = clamp(p.morale + 10 + settle.morale, 0, 100);
  onUserJoinedClub(state, club.id);
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
      state.user.offers.unshift({
        id: nextId(state, "o"), kind: "renewal", fromClubId: club.id, toPlayerClubId: club.id, fee: 0, terms, maxWage, patience: negotiationPatience(p, rng.int(2, 3)),
        status: "terms", createdTurn: state.turn, expiresTurn: state.turn + 6, season: state.season, history: [`${clubName(club.id)} offer a new contract.`],
      });
      addNews(state, { kind: "contract", title: "Contract renewal offered", body: `${clubName(club.id)} want to extend your deal.`, important: true });
    }
  }
}

/** Seasons left on the contract (1 = final season) from which the player may ask for a new deal. */
const RENEWAL_REQUEST_SEASONS = 3;
/** Turns the club needs before it will hear another request. */
const RENEWAL_REQUEST_COOLDOWN = 8;

/** Why the player can't ask for a new contract right now, or null when he can. */
export function renewalRequestBlock(state: GameState): string | null {
  const p = userPlayer(state);
  if (!p.contract || !p.clubId) return "You have no contract to renew.";
  if (p.loan) return "You are on loan; your parent club decides your future.";
  if (p.contract.expires - state.season + 1 > RENEWAL_REQUEST_SEASONS) return `Your club won't talk until you're within ${RENEWAL_REQUEST_SEASONS} seasons of expiry.`;
  if (state.user.offers.some((o) => o.kind === "renewal" && (o.status === "terms" || o.status === "club-pending"))) return "Renewal talks are already open.";
  if (state.user.offers.some((o) => o.kind === "renewal" && state.turn - o.createdTurn < RENEWAL_REQUEST_COOLDOWN)) return "You asked recently. Give the club some time.";
  return null;
}

/** The player asks his own club for a new contract. The club either opens talks or turns him down. */
export function requestRenewal(state: GameState, rng: Rng): { ok: boolean; message: string } {
  const blocked = renewalRequestBlock(state);
  if (blocked) return { ok: false, message: blocked };
  const p = userPlayer(state);
  const club = state.clubs[p.contract?.clubId ?? ""];
  if (!p.contract || !club) return { ok: false, message: "You have no contract to renew." };
  const o = uOvr(p);
  const level = clubLevel(club.reputation);
  const age = ageOf(p, state.season);
  const valued = o >= level - 8 || (age <= 21 && p.hidden.potential >= level - 3);
  const wants = valued || rng.chance(0.2);
  const name = clubName(club.id);
  if (!wants) {
    state.user.offers.unshift({
      id: nextId(state, "o"), kind: "renewal", fromClubId: club.id, toPlayerClubId: club.id, fee: 0, terms: makeTerms(state, rng, club, p, "renewal").terms, maxWage: p.contract.wage, patience: 0,
      status: "rejected", createdTurn: state.turn, expiresTurn: state.turn, season: state.season, history: [`${name} declined to open contract talks.`],
    });
    return { ok: false, message: `${name} aren't ready to offer you a new deal.` };
  }
  const { terms, maxWage } = makeTerms(state, rng, club, p, "renewal");
  state.user.offers.unshift({
    id: nextId(state, "o"), kind: "renewal", fromClubId: club.id, toPlayerClubId: club.id, fee: 0, terms, maxWage, patience: negotiationPatience(p, rng.int(2, 3)),
    status: "terms", createdTurn: state.turn, expiresTurn: state.turn + 6, season: state.season, history: [`You asked for a new contract. ${name} agree to talk.`],
  });
  addNews(state, { kind: "contract", title: "Contract talks opened", body: `${name} will discuss a new deal.`, important: false });
  return { ok: true, message: `${name} have opened contract talks.` };
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
      onUserJoinedClub(state, parent);
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

export { sanitizeClauses };

export function setTransferRequest(state: GameState, on: boolean): string {
  state.user.transferRequest = on;
  if (on) {
    adjustRel(state, "board", -12, "You handed in a transfer request");
    addStintEvent(state, "transfer-dispute");
    adjustRel(state, "supporters", -10, "You handed in a transfer request");
    adjustRel(state, "manager", -6, "You handed in a transfer request");
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
