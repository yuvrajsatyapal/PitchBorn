/**
 * Transfers and scouting for the user as a manager. Once he runs a club, the AI no longer signs players for it: he scouts,
 * bids and sells himself, inside the club's transfer budget and the transfer windows. Scouting reveals a player's potential
 * as a range (narrower with a better coaching rating), three reports a week. Prices and answers are worked out from the state
 * with no random draws: the asking price is the market value with a premium for key men, a bid at or above it is accepted,
 * and the player still has to want to come.
 */
import { BALANCE } from "../balance";
import { isTransferWindow } from "../calendar";
import { annualRevenue, transferBudget as ownedBudget } from "../club/ownership";
import { clubName, staticLeague } from "../data/world";
import { overallFor } from "../players/attributes";
import { formatMoney, marketValue, playerWage } from "../players/economy";
import { ageOf } from "../players/generate";
import { clamp } from "../rng";
import type { ClubState, GameState, Player, PlayerId, Position, SquadRole } from "../types";
import { clubLevel } from "../world/create";
import { addNews, fullName, squadOf } from "../world/helpers";
import { executeTransfer, playerWillJoin, squadNeeds } from "../transfers/market";
import { coachClub, coaching } from "./coaching";
import { wageBill, wageCap } from "./board";

const S = BALANCE.squad;
export const SCOUT_REPORTS_PER_WEEK = 3;
/** Key men at a club of similar standing cost this much over their value; others a little over. */
const KEY_PREMIUM = 1.45;
const PREMIUM = 1.1;
/** A quick sale goes at this share of value (a club that wants him now pays less than one that comes looking). */
const QUICK_SALE = 0.85;

export interface ScoutReport {
  season: number;
  /** Potential as the scouts see it. */
  low: number;
  high: number;
}

const ovr = (p: Player) => Math.round(overallFor(p.attrs, p.position));

export function managing(state: GameState): ClubState | null {
  const c = coaching(state);
  return c?.role === "manager" ? coachClub(state) : null;
}

export function managerBudget(state: GameState): number {
  const club = managing(state);
  if (!club) return 0;
  const tier = staticLeague(club.leagueId)?.tier ?? 1;
  const base = club.reputation * club.reputation * (tier === 1 ? 26000 : tier === 2 ? 7000 : 1800);
  return Math.max(0, Math.min(ownedBudget(club, base, annualRevenue(club)), club.balance));
}

export function marketOpen(state: GameState): boolean {
  return isTransferWindow(state.turn);
}

function isKey(p: Player, seller: ClubState | undefined, buyer: ClubState): boolean {
  return !!seller && (p.contract?.role === "star" || p.contract?.role === "first") && seller.reputation >= buyer.reputation - 5;
}

/** What the selling club asks for a player. */
export function askingPrice(state: GameState, p: Player): number {
  const buyer = managing(state);
  const seller = p.clubId ? state.clubs[p.clubId] : undefined;
  if (!seller) return 0;
  let fee = marketValue(p, state.season) * (buyer && isKey(p, seller, buyer) ? KEY_PREMIUM : PREMIUM);
  if (p.contract?.releaseClause && fee > p.contract.releaseClause) fee = p.contract.releaseClause;
  if (p.contract && p.contract.expires <= state.season) fee *= 0.5;
  if (p.listed) fee *= 0.85;
  return Math.round(fee / 50_000) * 50_000;
}

export function offerWage(state: GameState, p: Player, role: SquadRole): number {
  const club = managing(state);
  return Math.round(playerWage(p, state.season, club?.reputation ?? 50, role) / 100) * 100;
}

function roleFor(state: GameState, p: Player): SquadRole {
  const club = managing(state);
  const level = clubLevel(club?.reputation ?? 50);
  const o = ovr(p);
  return o >= level + 2 ? "star" : o >= level - 2 ? "first" : "rotation";
}

export interface Target {
  player: Player;
  overall: number;
  age: number;
  value: number;
  asking: number;
  wage: number;
  role: SquadRole;
  report?: ScoutReport;
  free: boolean;
}

/** Players worth a look for one position: within reach of the club's level, best first. */
export function scoutTargets(state: GameState, pos: Position, limit = 12): Target[] {
  const club = managing(state);
  if (!club) return [];
  const level = clubLevel(club.reputation);
  const out: Target[] = [];
  for (const p of Object.values(state.players)) {
    if (p.position !== pos || p.virtual || p.retired || p.isUser || p.loan || p.clubId === club.id) continue;
    const o = ovr(p);
    if (o < level - 8 || o > level + 9) continue;
    const role = roleFor(state, p);
    out.push({ player: p, overall: o, age: ageOf(p, state.season), value: marketValue(p, state.season), asking: askingPrice(state, p), wage: offerWage(state, p, role), role, report: reportFor(state, p.id), free: !p.clubId });
  }
  return out.sort((a, b) => b.overall - a.overall || a.age - b.age).slice(0, limit);
}

/** The positions the squad is short in, most urgent first. */
export function managerNeeds(state: GameState): Position[] {
  const club = managing(state);
  return club ? squadNeeds(state, club).map((n) => n.pos) : [];
}

export function reportFor(state: GameState, id: PlayerId): ScoutReport | undefined {
  return state.user.coach?.scouting?.reports[id];
}

export function reportsLeft(state: GameState): number {
  const sc = state.user.coach?.scouting;
  return sc && sc.turnIndex === state.turnIndex ? Math.max(0, SCOUT_REPORTS_PER_WEEK - sc.used) : SCOUT_REPORTS_PER_WEEK;
}

/** Send the scouts: potential as a range, narrower the better the coach. Deterministic per player and coach rating. */
export function scoutPlayer(state: GameState, id: PlayerId): { ok: boolean; reason?: string; msg?: string } {
  const c = coaching(state);
  const p = state.players[id];
  if (!c || c.role !== "manager" || !p) return { ok: false, reason: "Only a manager runs the scouting" };
  if (reportsLeft(state) <= 0) return { ok: false, reason: "No scouting reports left this week" };
  const sc = (c.scouting ??= { turnIndex: state.turnIndex, used: 0, reports: {} });
  if (sc.turnIndex !== state.turnIndex) {
    sc.turnIndex = state.turnIndex;
    sc.used = 0;
  }
  sc.used++;
  const width = Math.round(clamp(10 - c.rating / 12, 2, 8));
  // Where the true potential sits inside the range comes from the ids, not a dice roll.
  let h = 0;
  for (const ch of `${state.seed}:${id}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const offset = h % (width + 1);
  const pot = p.hidden.potential;
  const report = { season: state.season, low: Math.max(ovr(p), pot - offset), high: Math.min(99, pot - offset + width) };
  sc.reports[id] = report;
  return { ok: true, msg: `Report on ${fullName(p)}: potential ${report.low}–${report.high}.` };
}

export function bidForPlayer(state: GameState, id: PlayerId, fee?: number): { ok: boolean; reason?: string; msg?: string } {
  const club = managing(state);
  const p = state.players[id];
  if (!club || !p) return { ok: false, reason: "Only a manager can sign players" };
  if (!marketOpen(state)) return { ok: false, reason: "The transfer window is closed" };
  if (p.clubId === club.id) return { ok: false, reason: "Already your player" };
  if (squadOf(state, club.id).length >= S.max) return { ok: false, reason: "The squad is full: sell someone first" };
  const asking = askingPrice(state, p);
  const bid = fee ?? asking;
  if (bid < asking) return { ok: false, reason: `${p.clubId ? clubName(p.clubId) : "He"} wants ${formatMoney(asking)}` };
  if (bid > managerBudget(state)) return { ok: false, reason: `Over your budget of ${formatMoney(managerBudget(state))}` };
  const seller = p.clubId ? state.clubs[p.clubId] : undefined;
  if (seller && seller.squad.length <= S.min && !p.listed) return { ok: false, reason: `${clubName(seller.id)} can't spare him` };
  const role = roleFor(state, p);
  const wage = offerWage(state, p, role);
  const cap = wageCap(state, club);
  if (wageBill(state, club.id) + wage > cap) return { ok: false, reason: `His ${formatMoney(wage)}/wk would break the board's wage cap of ${formatMoney(cap)}/wk` };
  if (!playerWillJoin(state, p, club, wage)) return { ok: false, reason: `${fullName(p)} doesn't want to join` };
  executeTransfer(state, p, club, bid, wage, 3, role);
  addNews(state, { kind: "transfer", title: `✍️ You sign ${fullName(p)}`, body: `${seller ? `From ${clubName(seller.id)}` : "On a free"} for ${bid ? formatMoney(bid) : "nothing"} · ${formatMoney(wage)}/wk`, important: true });
  return { ok: true, msg: `${fullName(p)} signs.` };
}

/** Clubs in for one of the manager's players now (they need the position and can afford it), most prestigious first. */
export function interestedBuyers(state: GameState, p: Player, fee: number): ClubState[] {
  const own = managing(state);
  const out: ClubState[] = [];
  for (const club of Object.values(state.clubs)) {
    if (club.id === own?.id || club.squad.length >= S.max || club.balance < fee) continue;
    const level = clubLevel(club.reputation);
    if (Math.abs(ovr(p) - level) > 6) continue;
    if (!squadNeeds(state, club).some((n) => n.pos === p.position)) continue;
    out.push(club);
  }
  return out.sort((a, b) => b.reputation - a.reputation || (a.id < b.id ? -1 : 1));
}

function saleRole(p: Player, buyer: ClubState): SquadRole {
  return ovr(p) >= clubLevel(buyer.reputation) + 2 ? "star" : "first";
}

/** The weekly wage a buying club offers the player. */
export function saleWage(state: GameState, p: Player, buyer: ClubState): number {
  return Math.round(playerWage(p, state.season, buyer.reputation, saleRole(p, buyer)) / 100) * 100;
}

export function salePrice(state: GameState, p: Player): number {
  return Math.round((marketValue(p, state.season) * QUICK_SALE) / 50_000) * 50_000;
}

export function sellPlayer(state: GameState, id: PlayerId): { ok: boolean; reason?: string; msg?: string } {
  const club = managing(state);
  const p = state.players[id];
  if (!club || !p || p.clubId !== club.id) return { ok: false, reason: "Not your player" };
  if (!marketOpen(state)) return { ok: false, reason: "The transfer window is closed" };
  if (club.squad.length <= S.min) return { ok: false, reason: "The squad is too thin to sell" };
  const fee = salePrice(state, p);
  const buyers = interestedBuyers(state, p, fee);
  if (!buyers.length) return { ok: false, reason: "No club is in for him right now: list him and wait" };
  // The best club he'd actually go to: a player who turns down the biggest name may still take the next offer.
  const buyer = buyers.find((b) => playerWillJoin(state, p, b, saleWage(state, p, b)));
  if (!buyer) return { ok: false, reason: buyers.length === 1 ? `${fullName(p)} won't go to ${clubName(buyers[0].id)}` : `${fullName(p)} won't go to any of the ${buyers.length} clubs in for him` };
  executeTransfer(state, p, buyer, fee, saleWage(state, p, buyer), 3, saleRole(p, buyer));
  addNews(state, { kind: "transfer", title: `💰 You sell ${fullName(p)}`, body: `To ${clubName(buyer.id)} for ${formatMoney(fee)}.`, important: true });
  return { ok: true, msg: `Sold to ${clubName(buyer.id)} for ${formatMoney(fee)}.` };
}

/** Put a player on (or take him off) the transfer list, so other clubs come for him in the window. */
export function toggleListed(state: GameState, id: PlayerId): { ok: boolean; reason?: string; msg?: string } {
  const club = managing(state);
  const p = state.players[id];
  if (!club || !p || p.clubId !== club.id) return { ok: false, reason: "Not your player" };
  p.listed = !p.listed;
  return { ok: true, msg: p.listed ? `${fullName(p)} is up for sale.` : `${fullName(p)} is off the list.` };
}
