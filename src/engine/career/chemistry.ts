/**
 * Teammate chemistry: a bond between the player and each club teammate, from -100 (feud) to 100 (telepathic).
 *
 * Bonds grow by playing together, more between neighbours on the pitch, and most of all through goals made for
 * each other. Competing for the same shirt, a sharp tongue in the press and abrasive personalities pull them down.
 * Strong partnerships make both players a little sharper in the passing and movement that link play when they
 * start together; a feud on the pitch costs a little composure. Mentors (see traits) bond faster with youngsters.
 *
 * No randomness: bonds are a pure function of what happened, so the world's RNG is never touched.
 */
import type { MatchResult, PlayerLine } from "../match/engine";
import type { MatchPlayerInput } from "../match/engine";
import { positionGroup } from "../players/attributes";
import { ageOf } from "../players/generate";
import { clamp } from "../rng";
import { careerProfile } from "../traits/effects";
import type { AttrKey, ChemistryBond, GameState, Player, PlayerId } from "../types";
import { addNews, fullName, userPlayer } from "../world/helpers";
import { feedChemistry } from "./feed";

export const BOND_LEVELS = { partnership: 60, friend: 30, rival: -30, feud: -60 } as const;
/** The link-up attributes a partnership sharpens. */
const LINK_ATTRS: AttrKey[] = ["passing", "vision", "offBall", "firstTouch", "anticipation", "decisions"];
const FRICTION_ATTRS: AttrKey[] = ["decisions", "composure"];

export type BondLabel = "Telepathic" | "Partnership" | "Friends" | "Teammates" | "Rivals" | "Feud";

export function bondLabel(v: number): BondLabel {
  if (v >= 85) return "Telepathic";
  if (v >= BOND_LEVELS.partnership) return "Partnership";
  if (v >= BOND_LEVELS.friend) return "Friends";
  if (v <= BOND_LEVELS.feud) return "Feud";
  if (v <= BOND_LEVELS.rival) return "Rivals";
  return "Teammates";
}

function bonds(state: GameState): Record<PlayerId, ChemistryBond> {
  return (state.user.chemistry ??= {});
}

function bondWith(state: GameState, id: PlayerId): ChemistryBond {
  const all = bonds(state);
  return (all[id] ??= { v: 0, games: 0, links: 0, since: state.season });
}

const GROUP_ORDER = { GK: 0, DEF: 1, MID: 2, ATT: 3 } as const;

/** How naturally two positions combine: same unit or neighbouring units link more. */
function proximity(a: Player["position"], b: Player["position"]): number {
  const d = Math.abs(GROUP_ORDER[positionGroup(a)] - GROUP_ORDER[positionGroup(b)]);
  return d === 0 ? 1 : d === 1 ? 0.7 : 0.3;
}

/** Personality: team players and mentors warm up faster, abrasive ones slower (and can sour). */
function warmth(p: Player): number {
  const cp = careerProfile(p);
  return clamp(1 + cp.team * 0.4 + cp.leader * 0.2 - cp.friction * 0.5, 0.4, 1.6);
}

function move(state: GameState, mate: Player, delta: number): void {
  const b = bondWith(state, mate.id);
  const before = b.v;
  b.v = Math.round(clamp(b.v + delta, -100, 100) * 10) / 10;
  announce(state, mate, before, b.v);
}

/** News (and a feed post) when a bond crosses into a new band. */
function announce(state: GameState, mate: Player, before: number, after: number): void {
  const name = fullName(mate);
  if (before < BOND_LEVELS.partnership && after >= BOND_LEVELS.partnership) {
    addNews(state, { kind: "club", title: `🤝 A partnership is born with ${name}`, body: "You're reading each other's game. Expect sharper link-up play when you start together.", important: true });
    feedChemistry(state, mate, "partnership");
  } else if (before < BOND_LEVELS.friend && after >= BOND_LEVELS.friend) {
    addNews(state, { kind: "club", title: `You and ${name} are getting on well`, body: "A friendship is forming in the dressing room." });
  } else if (before > BOND_LEVELS.rival && after <= BOND_LEVELS.rival) {
    addNews(state, { kind: "club", title: `Tension with ${name}`, body: "There's friction between you in the dressing room.", important: true });
    feedChemistry(state, mate, "rival");
  } else if (before > BOND_LEVELS.feud && after <= BOND_LEVELS.feud) {
    addNews(state, { kind: "club", title: `Open feud with ${name}`, body: "The two of you can barely look at each other. It shows on the pitch.", important: true });
  }
}

/** After one of the user's club matches: playing together, goal combinations and battles for a shirt. */
export function chemistryAfterMatch(state: GameState, res: MatchResult, userLine: PlayerLine, won: boolean, lost: boolean): void {
  const me = userPlayer(state);
  if (!me.clubId || state.user.retired) return;
  const uid = me.id;
  const myMins = minutesOf(userLine);
  const squad = new Set(state.clubs[me.clubId]?.squad ?? []);
  const combos = new Map<string, number>();
  for (const g of res.goals) {
    if (g.side !== userLine.side || !g.assist) continue;
    if (g.scorer === uid && g.assist !== uid) combos.set(g.assist, (combos.get(g.assist) ?? 0) + 1);
    if (g.assist === uid && g.scorer !== uid) combos.set(g.scorer, (combos.get(g.scorer) ?? 0) + 1);
  }
  for (const l of res.lines) {
    if (l.id === uid || l.side !== userLine.side || !squad.has(l.id)) continue;
    const mate = state.players[l.id];
    if (!mate) continue;
    const together = Math.min(myMins, minutesOf(l)) / 90;
    const links = combos.get(l.id) ?? 0;
    const b = bondWith(state, l.id);
    if (together > 0) b.games++;
    b.links += links;
    // Shared minutes matter most early; a settled bond grows slowly.
    const saturation = b.v > 0 ? 1 - b.v / 140 : 1;
    let delta = together * (1.4 * proximity(me.position, mate.position) + (won ? 0.6 : lost ? -0.2 : 0.2)) * warmth(mate) * saturation + links * 6;
    // The same shirt: whoever starts, the other one notices.
    if (mate.position === me.position && positionGroup(me.position) !== "MID") delta -= userLine.started && !l.started ? 1.5 : !userLine.started && l.started ? 0.6 : 0;
    move(state, mate, delta);
  }
}

/** Squad-mates competing for the user's place who never got on the pitch with him still feel it. */
export function chemistryBenchRivals(state: GameState, startedIds: Set<string>, userStarted: boolean): void {
  const me = userPlayer(state);
  if (!me.clubId || !userStarted) return;
  for (const id of state.clubs[me.clubId]?.squad ?? []) {
    if (id === me.id || startedIds.has(id)) continue;
    const mate = state.players[id];
    if (!mate || mate.position !== me.position || mate.injury) continue;
    // Only a real rival for the shirt: around his level and not a kid.
    if (ageOf(mate, state.season) < 20) continue;
    move(state, mate, -0.8 * (careerProfile(mate).friction > 0 ? 1.6 : 1));
  }
}

/** Every week: bonds with players who have left are dropped; mentors take youngsters under their wing. */
export function chemistryWeekly(state: GameState): void {
  const u = state.user;
  if (!u.chemistry || u.retired) return;
  const me = userPlayer(state);
  const squad = new Set(me.clubId ? state.clubs[me.clubId]?.squad ?? [] : []);
  for (const id of Object.keys(u.chemistry)) {
    if (!squad.has(id) || !state.players[id] || state.players[id].retired) {
      delete u.chemistry[id];
      continue;
    }
    const b = u.chemistry[id];
    // Unused bonds fade a little towards neutral.
    b.v = Math.round((b.v - Math.sign(b.v) * Math.min(Math.abs(b.v), 0.15)) * 10) / 10;
  }
  if (me.clubId && ageOf(me, state.season) <= 22) {
    for (const id of squad) {
      const mate = state.players[id];
      if (!mate || mate.id === me.id || ageOf(mate, state.season) < 28) continue;
      const mentor = careerProfile(mate).mentor;
      if (mentor > 0) move(state, mate, 0.6 * mentor);
    }
  }
}

/** Something said in public about the dressing room touches every bond a little. */
export function chemistryShock(state: GameState, delta: number): void {
  const me = userPlayer(state);
  if (!me.clubId) return;
  for (const id of state.clubs[me.clubId]?.squad ?? []) {
    if (id === me.id || !state.players[id]) continue;
    if (state.user.chemistry?.[id] || delta < 0) move(state, state.players[id], delta);
  }
}

function minutesOf(l: PlayerLine): number {
  return Math.max(0, (l.minuteOff ?? 90) - l.minuteOn);
}

/** Attribute points a bond is worth on the pitch: up to +3 for a telepathic pair, down to -2 in a feud. */
export function bondBoost(v: number): number {
  if (v >= BOND_LEVELS.partnership) return v >= 85 ? 3 : 2;
  if (v >= 45) return 1;
  if (v <= BOND_LEVELS.feud) return -2;
  if (v <= BOND_LEVELS.rival) return -1;
  return 0;
}

/**
 * Apply chemistry to a team's match inputs when the user is among the starters: each partner on the pitch and the
 * user share the bond's link-up bonus; a feud costs both a little composure. Inputs get copied attributes, never
 * the players' own.
 */
export function applyChemistry(state: GameState, starters: MatchPlayerInput[]): void {
  const all = state.user.chemistry;
  if (!all) return;
  const me = starters.find((s) => s.id === state.user.playerId);
  if (!me) return;
  let mine = 0;
  for (const s of starters) {
    if (s === me) continue;
    const v = all[s.id]?.v;
    if (v === undefined) continue;
    const boost = bondBoost(v);
    if (!boost) continue;
    tweak(s, boost);
    mine = boost > 0 ? Math.max(mine, boost) : mine + boost;
  }
  if (mine) tweak(me, clamp(mine, -3, 3));
}

function tweak(input: MatchPlayerInput, boost: number): void {
  const attrs = { ...input.attrs };
  for (const k of boost > 0 ? LINK_ATTRS : FRICTION_ATTRS) attrs[k] = clamp(attrs[k] + boost, 1, 99);
  input.attrs = attrs;
}

export interface BondView {
  player: Player;
  bond: ChemistryBond;
  label: BondLabel;
}

/** The user's bonds, strongest first, with players still at the club. */
export function bondsByStrength(state: GameState): BondView[] {
  const out: BondView[] = [];
  for (const [id, bond] of Object.entries(state.user.chemistry ?? {})) {
    const player = state.players[id];
    if (player) out.push({ player, bond, label: bondLabel(bond.v) });
  }
  return out.sort((a, b) => b.bond.v - a.bond.v);
}

export function bestBond(state: GameState): number {
  return Math.max(0, ...Object.values(state.user.chemistry ?? {}).map((b) => b.v));
}

export function mostLinks(state: GameState): number {
  return Math.max(0, ...Object.values(state.user.chemistry ?? {}).map((b) => b.links));
}

export function sanitizeChemistry(state: GameState): void {
  const u = state.user;
  if (!u) return;
  if (!u.chemistry || typeof u.chemistry !== "object") {
    u.chemistry = {};
    return;
  }
  for (const [id, b] of Object.entries(u.chemistry)) {
    if (!b || !Number.isFinite(b.v) || !state.players[id]) {
      delete u.chemistry[id];
      continue;
    }
    b.v = clamp(b.v, -100, 100);
    b.games = Number.isFinite(b.games) ? Math.max(0, b.games) : 0;
    b.links = Number.isFinite(b.links) ? Math.max(0, b.links) : 0;
  }
}
