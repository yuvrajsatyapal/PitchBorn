/**
 * Set-piece duties: every side names a penalty taker and a free-kick taker (the best of its starters by the skills each kick
 * asks for). The user can ask the manager for either duty; a granted duty puts him first in line at that club until he is dropped,
 * which happens after missing two of his last three penalties. Pure functions over the game state; no random draws, so naming
 * takers never moves the world RNG.
 */
import type { MatchPlayerInput, PlayerLine } from "../match/engine";
import { overallFor } from "../players/attributes";
import { clamp } from "../rng";
import type { AttrKey, Attributes, GameState, Player, PlayerId, SetPieceKind, SetPieceState, SquadRole } from "../types";
import { addNews, fullName, userPlayer } from "../world/helpers";
import { expectedRole } from "./offers";
import { adjustRel } from "./relationships";

export const SET_PIECE_LABEL: Record<SetPieceKind, { one: string; many: string; duty: string }> = {
  penalty: { one: "penalty", many: "Penalties", duty: "penalty taker" },
  freekick: { one: "free kick", many: "Free kicks", duty: "free-kick taker" },
};

const MIX: Record<SetPieceKind, readonly (readonly [AttrKey, number])[]> = {
  penalty: [["finishing", 0.4], ["composure", 0.4], ["technique", 0.2]],
  freekick: [["longShots", 0.45], ["technique", 0.35], ["composure", 0.2]],
};

/**
 * How much worse than the best regular the user may be and still be handed a duty. Clubs' first-choice takers are
 * specialists, so even a star usually trails his on skill: the manager weighs standing in the squad and the relationship
 * too (tuned with `npm run sim:systems`, where a 3-point allowance granted 22 of about 500 requests).
 */
const ASK_MARGIN = 5;
const ROLE_SLACK: Record<SquadRole, number> = { star: 4, first: 2, rotation: 0, backup: -2, prospect: -2 };
/** Points of allowance per point of manager relationship away from neutral (50). */
const MANAGER_SLACK = 1 / 5;
/** Penalties remembered for the drop rule, and how many misses among them cost the duty. */
const RECENT = 3;
const MISSES_TO_DROP = 2;

export function takerScore(attrs: Attributes, kind: SetPieceKind): number {
  return MIX[kind].reduce((s, [k, w]) => s + (attrs[k] ?? 0) * w, 0);
}

export function setPieceState(state: GameState): SetPieceState {
  return (state.user.setPieces ??= { granted: {}, dropped: {}, refused: {}, pens: 0, pensScored: 0, fks: 0, fksScored: 0, recentPens: [] });
}

/** Whether the user holds a duty granted at his current club. */
export function holdsDuty(state: GameState, kind: SetPieceKind): boolean {
  const g = state.user.setPieces?.granted[kind];
  const p = state.players[state.user.playerId];
  return !!g && !!p?.clubId && g.clubId === p.clubId;
}

function droppedThisSeason(state: GameState, kind: SetPieceKind): boolean {
  return state.user.setPieces?.dropped[kind] === state.season;
}

/**
 * The order a side's players step up for one kind of set piece. At the user's club a granted duty puts him first and a lost
 * one puts him last; everyone else goes by skill.
 */
export function takerOrder(state: GameState, teamId: string, players: readonly Pick<MatchPlayerInput, "id" | "attrs">[], kind: SetPieceKind): PlayerId[] {
  const uid = state.user.playerId;
  const club = !!state.clubs[teamId];
  const sorted = [...players].sort((a, b) => takerScore(b.attrs, kind) - takerScore(a.attrs, kind) || (a.id < b.id ? -1 : 1)).map((p) => p.id);
  if (!club || !sorted.includes(uid) || state.user.retired) return sorted;
  const rest = sorted.filter((id) => id !== uid);
  if (droppedThisSeason(state, kind)) return [...rest, uid];
  if (holdsDuty(state, kind)) return [uid, ...rest];
  return sorted;
}

export function takersFor(state: GameState, teamId: string, players: readonly Pick<MatchPlayerInput, "id" | "attrs">[]): { penalty: PlayerId[]; freekick: PlayerId[] } {
  return { penalty: takerOrder(state, teamId, players, "penalty"), freekick: takerOrder(state, teamId, players, "freekick") };
}

export interface DutyStatus {
  kind: SetPieceKind;
  /** The user is first choice when he starts. */
  mine: boolean;
  /** Granted by the manager (as opposed to simply being the best). */
  granted: boolean;
  /** Who takes it at the club when the user is not first. */
  current?: { id: PlayerId; name: string };
  canAsk: boolean;
  reason?: string;
  /** Whether the manager would say yes right now. */
  likely: boolean;
}

/** The club's first-choice taker among its regular players (the squad, not a single line-up). */
function clubOrder(state: GameState, kind: SetPieceKind): PlayerId[] {
  const p = userPlayer(state);
  if (!p.clubId) return [];
  const squad = state.clubs[p.clubId].squad.map((id) => state.players[id]).filter((x): x is Player => !!x && !x.injury && x.position !== "GK");
  // Regulars only: the eleven or so best by overall are the ones who would actually be on the pitch.
  const regulars = squad.sort((a, b) => overallFor(b.attrs, b.position) - overallFor(a.attrs, a.position)).slice(0, 13);
  if (!regulars.some((x) => x.id === p.id) && p.position !== "GK") regulars.push(p);
  return takerOrder(state, p.clubId, regulars, kind);
}

export function dutyStatus(state: GameState, kind: SetPieceKind): DutyStatus {
  const p = userPlayer(state);
  const order = clubOrder(state, kind);
  const mine = order[0] === p.id;
  const granted = holdsDuty(state, kind);
  const first = order.find((id) => id !== p.id);
  const current = !mine && first ? { id: first, name: fullName(state.players[first]) } : undefined;
  const check = canAskForDuty(state, kind);
  return { kind, mine, granted, current, canAsk: check.ok, reason: check.reason, likely: !mine && dutyGap(state, kind) <= askMargin(state) };
}

/** Where the user stands in the pecking order (not the contract's label, which a custom start signs as a prospect). */
function standing(state: GameState): SquadRole {
  const p = userPlayer(state);
  const club = p.clubId ? state.clubs[p.clubId] : undefined;
  return club ? expectedRole(state, club, p) : "prospect";
}

/** How far the user may trail the current taker and still be given the duty. */
export function askMargin(state: GameState, role: SquadRole = standing(state)): number {
  return ASK_MARGIN + ROLE_SLACK[role] + (state.user.relationships.manager - 50) * MANAGER_SLACK;
}

/** How far the user trails the club's best regular taker on the skills the kick asks for (negative: he is ahead). */
export function dutyGap(state: GameState, kind: SetPieceKind): number {
  const p = userPlayer(state);
  const bestId = clubOrder(state, kind).find((id) => id !== p.id);
  return (bestId ? takerScore(state.players[bestId].attrs, kind) : 0) - takerScore(p.attrs, kind);
}

export function canAskForDuty(state: GameState, kind: SetPieceKind): { ok: boolean; reason?: string } {
  const u = state.user;
  const p = userPlayer(state);
  if (u.retired || !p.clubId) return { ok: false, reason: "You need a club" };
  if (p.position === "GK") return { ok: false, reason: "Keepers don't take them here" };
  if (holdsDuty(state, kind)) return { ok: false, reason: "It's already yours" };
  const sp = u.setPieces;
  if (sp?.dropped[kind] === state.season) return { ok: false, reason: "You lost the duty this season" };
  if (sp?.refused[kind] === state.season) return { ok: false, reason: "The manager said no this season" };
  if (clubOrder(state, kind)[0] === p.id) return { ok: false, reason: "You're already first in line" };
  return { ok: true };
}

/**
 * Ask the manager for a duty. He says yes when the user is close enough to the current taker (`askMargin`: more slack for
 * key players and for a good relationship); a refusal stands for the rest of the season. Displacing a teammate costs a little goodwill in the dressing room.
 */
export function askForDuty(state: GameState, kind: SetPieceKind): { ok: boolean; reason?: string } {
  const check = canAskForDuty(state, kind);
  if (!check.ok) return check;
  const p = userPlayer(state);
  const sp = setPieceState(state);
  const bestId = clubOrder(state, kind).find((id) => id !== p.id);
  const label = SET_PIECE_LABEL[kind];
  if (dutyGap(state, kind) <= askMargin(state)) {
    sp.granted[kind] = { season: state.season, clubId: p.clubId as string };
    delete sp.refused[kind];
    addNews(state, { kind: "club", title: `You're the new ${label.duty}`, body: bestId ? `The manager hands you the duty ahead of ${fullName(state.players[bestId])}.` : "The manager hands you the duty.", important: true });
    if (bestId) adjustRel(state, "teammates", -1, `You took the ${label.one} duty from ${fullName(state.players[bestId])}`);
    return { ok: true };
  }
  sp.refused[kind] = state.season;
  adjustRel(state, "manager", -1, `Asked to be ${label.duty} and was turned down`);
  addNews(state, { kind: "club", title: `The manager keeps ${bestId ? fullName(state.players[bestId]) : "his choice"} on ${label.one}s`, body: `"Show me in training." You can ask again next season.` });
  return { ok: false, reason: "The manager said no" };
}

/** After one of the user's matches: count his kicks, and take the penalty duty away after too many misses. */
export function noteSetPieces(state: GameState, line: Pick<PlayerLine, "sp">): void {
  const kicks = line.sp;
  if (!kicks || (!kicks.pens && !kicks.fks)) return;
  const sp = setPieceState(state);
  sp.pens += kicks.pens;
  sp.pensScored += kicks.pensScored;
  sp.fks += kicks.fks;
  sp.fksScored += kicks.fksScored;
  for (let i = 0; i < kicks.pens; i++) sp.recentPens.push(i < kicks.pensScored ? 1 : 0);
  sp.recentPens = sp.recentPens.slice(-RECENT);
  const misses = sp.recentPens.filter((x) => x === 0).length;
  if (kicks.pens > kicks.pensScored && misses >= MISSES_TO_DROP && sp.recentPens.length >= MISSES_TO_DROP) {
    const p = userPlayer(state);
    delete sp.granted.penalty;
    sp.dropped.penalty = state.season;
    sp.recentPens = [];
    p.morale = clamp(p.morale - 3, 0, 100);
    addNews(state, { kind: "club", title: "You lose the penalty duty", body: `${misses} misses in your last ${RECENT} penalties. Someone else takes them for the rest of the season.`, important: true });
  }
}

/** The career record from the spot, for the profile. */
export function setPieceRecord(state: GameState): { pens: number; pensScored: number; fks: number; fksScored: number } {
  const sp = state.user.setPieces;
  return { pens: sp?.pens ?? 0, pensScored: sp?.pensScored ?? 0, fks: sp?.fks ?? 0, fksScored: sp?.fksScored ?? 0 };
}
