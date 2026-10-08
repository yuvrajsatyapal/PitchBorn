/**
 * The user's history with managers. A stint is the time spent at one club under one manager, kept as ids and counts.
 * "Played under" means at least one senior appearance in the stint: a manager who was merely at the same club, or in
 * the league, or in the dataset is never a former manager.
 *
 * The relationship stored on a stint is the HISTORICAL one (what it was when the two parted). The active
 * relationship (`user.relationships.manager`) belongs to whoever is in charge now and is never carried by a manager
 * who has gone.
 */
import type { ClubId, GameState, ManagerId, PlayerManagerStint, StintEventKind, TenureHonours, UserManagerState } from "../types";
import { clamp } from "../rng";
import { emptyHonours, recordOf } from "./registry";

export const MAX_STINTS = 60;
const MAX_EVENTS = 12;
const SEEN_CAP = 80;

export const mgrState = (state: GameState): UserManagerState => (state.user.mgr ??= { stints: [], meetings: {}, seen: [] });

export const currentStint = (state: GameState): PlayerManagerStint | undefined => {
  const last = state.user.mgr?.stints[state.user.mgr.stints.length - 1];
  return last && !last.to ? last : undefined;
};

export type RelLabel = "Excellent" | "Strong" | "Neutral" | "Poor" | "Very poor";
export const relLabel = (rel: number): RelLabel => (rel >= 75 ? "Excellent" : rel >= 62 ? "Strong" : rel >= 45 ? "Neutral" : rel >= 30 ? "Poor" : "Very poor");

/** Opens the stint for the club the user is at now, closing any other. Idempotent for the same manager and club. */
export function openStint(state: GameState, clubId: ClubId): PlayerManagerStint | undefined {
  const club = state.clubs[clubId];
  const id = club?.manager.id;
  if (!club || !id) return undefined;
  const ms = mgrState(state);
  const open = currentStint(state);
  if (open && open.managerId === id && open.clubId === clubId) return open;
  if (open) closeStint(state, "player-left");
  const prior = playedUnder(state, id);
  const stint: PlayerManagerStint = {
    managerId: id,
    clubId,
    from: { season: state.season, turn: state.turn },
    relStart: Math.round(state.user.relationships.manager),
    apps: 0,
    starts: 0,
    goals: 0,
    honours: emptyHonours(),
    events: [],
  };
  if (prior) stint.reunion = true;
  ms.stints.push(stint);
  if (ms.stints.length > MAX_STINTS) ms.stints.splice(0, ms.stints.length - MAX_STINTS);
  return stint;
}

export function closeStint(state: GameState, ended: PlayerManagerStint["ended"]): PlayerManagerStint | undefined {
  const s = currentStint(state);
  if (!s) return undefined;
  s.to = { season: state.season, turn: state.turn };
  s.relEnd = Math.round(state.user.relationships.manager);
  s.ended = ended;
  return s;
}

export function addStintEvent(state: GameState, k: StintEventKind): void {
  const s = currentStint(state);
  if (!s) return;
  // One of each kind per stint, except honours (each counts) and talks (a couple are worth keeping).
  const same = s.events.filter((e) => e.k === k).length;
  if (k !== "honour" && k !== "talk" && same) return;
  if (k === "talk" && same >= 2) return;
  s.events.push({ k, s: state.season, t: state.turn });
  if (s.events.length > MAX_EVENTS) s.events.splice(0, s.events.length - MAX_EVENTS);
}

/** Called for every senior club match the user plays for the club the stint belongs to. */
export function noteStintMatch(state: GameState, clubId: ClubId, started: boolean, goals: number): PlayerManagerStint | undefined {
  const s = currentStint(state);
  if (!s || s.clubId !== clubId) return undefined;
  s.apps++;
  if (started) s.starts++;
  s.goals += goals;
  // The breakthrough: the first run of starts for a player who had barely played before.
  const u = state.players[state.user.playerId];
  if (s.starts === 10 && u.career.apps - s.apps < 10 && !s.events.some((e) => e.k === "breakthrough")) addStintEvent(state, "breakthrough");
  return s;
}

export function creditStintHonour(state: GameState, kind: keyof TenureHonours): void {
  const s = currentStint(state);
  if (!s || s.apps === 0) return;
  s.honours[kind]++;
  addStintEvent(state, "honour");
}

export const stintsWith = (state: GameState, id: ManagerId): PlayerManagerStint[] => (state.user.mgr?.stints ?? []).filter((s) => s.managerId === id);

/** hasPlayedUnder(player, manager): a genuine shared period with at least one senior appearance. */
export function playedUnder(state: GameState, id: ManagerId | undefined): boolean {
  if (!id) return false;
  return (state.user.mgr?.stints ?? []).some((s) => s.managerId === id && s.apps > 0);
}

export interface WithManager {
  managerId: ManagerId;
  name: string;
  /** Distinct seasons the two shared. */
  seasons: number;
  span: { from: number; to: number };
  clubs: ClubId[];
  apps: number;
  starts: number;
  goals: number;
  honours: TenureHonours;
  /** The historical relationship: where it stood when the two last parted (or stands now, if still together). */
  rel: number;
  rel0: number;
  label: RelLabel;
  breakthrough: boolean;
  captain: boolean;
  disputes: number;
  reunited: boolean;
  together: boolean;
  /** How much of the career this manager shaped. */
  importance: number;
}

/** What the user shared with a manager, merged over every stint. Null if the user never played under him. */
export function withManager(state: GameState, id: ManagerId): WithManager | null {
  const stints = stintsWith(state, id).filter((s) => s.apps > 0);
  if (!stints.length) return null;
  const seasons = new Set<number>();
  const honours = emptyHonours();
  let apps = 0;
  let starts = 0;
  let goals = 0;
  let breakthrough = false;
  let captain = false;
  let disputes = 0;
  let reunited = false;
  for (const s of stints) {
    const end = s.to?.season ?? state.season;
    const lastTurn = s.to?.turn ?? state.turn;
    for (let y = s.from.season; y <= end; y++) if (!(y === end && y !== s.from.season && lastTurn <= 4)) seasons.add(y);
    apps += s.apps;
    starts += s.starts;
    goals += s.goals;
    for (const k of Object.keys(honours) as (keyof TenureHonours)[]) honours[k] += s.honours[k];
    for (const e of s.events) {
      if (e.k === "breakthrough") breakthrough = true;
      else if (e.k === "captain") captain = true;
      else if (e.k === "playing-dispute" || e.k === "transfer-dispute" || e.k === "fallout") disputes++;
    }
    if (s.reunion) reunited = true;
  }
  const last = stints[stints.length - 1];
  const rel = last.relEnd ?? Math.round(state.user.relationships.manager);
  const sorted = [...seasons].sort((a, b) => a - b);
  const w: WithManager = {
    managerId: id,
    name: recordOf(state, id)?.name ?? "A former manager",
    seasons: seasons.size,
    span: { from: sorted[0], to: sorted[sorted.length - 1] },
    clubs: [...new Set(stints.map((s) => s.clubId))],
    apps,
    starts,
    goals,
    honours,
    rel,
    rel0: stints[0].relStart,
    label: relLabel(rel),
    breakthrough,
    captain,
    disputes,
    reunited,
    together: !last.to,
    importance: 0,
  };
  w.importance = Math.round(importanceOf(w));
  return w;
}

function importanceOf(w: WithManager): number {
  const h = w.honours;
  let score = w.seasons * 8 + Math.min(30, w.apps / 6) + h.league * 10 + h.continental * 12 + h.cup * 6 + h.promotions * 7;
  if (w.breakthrough) score += 18;
  if (w.captain) score += 10;
  score += w.rel >= 70 ? 8 : w.rel <= 30 ? 6 : 0;
  score += Math.min(10, w.disputes * 5);
  if (w.reunited) score += 6;
  return score;
}

/** A shared past that matters: more than a few weeks together. */
export const IMPORTANT = 30;
/** Enough evidence to call someone the defining manager of a career. */
export const DEFINING = 45;

export function influentialManager(state: GameState): WithManager | null {
  const ids = [...new Set((state.user.mgr?.stints ?? []).filter((s) => s.apps > 0).map((s) => s.managerId))];
  let best: WithManager | null = null;
  for (const id of ids) {
    const w = withManager(state, id);
    if (w && (!best || w.importance > best.importance)) best = w;
  }
  return best && best.importance >= DEFINING ? best : null;
}

/** The manager of the user's club, if the user has played under him before. */
export function formerManagerAt(state: GameState, clubId: ClubId): WithManager | null {
  const id = state.clubs[clubId]?.manager.id;
  return id && playedUnder(state, id) ? withManager(state, id) : null;
}

export interface Affinity {
  /** Multiplier on the chance that the manager's club shows interest. Bounded. */
  factor: number;
  w: WithManager;
  kind: "strong" | "warm" | "cool" | "poor";
}

/**
 * A small nudge to transfer interest from a shared past. It scales with how good the relationship was and how
 * long the two worked together; it never creates interest on its own (it multiplies a chance that already
 * reflects quality, need and money), and a poor past pulls the other way.
 */
export function affinityAt(state: GameState, clubId: ClubId): Affinity | null {
  const w = formerManagerAt(state, clubId);
  if (!w || w.together) return null;
  const weight = clamp(w.importance / 40, 0.35, 1);
  if (w.rel >= 70) return { factor: 1 + 0.2 * weight, w, kind: "strong" };
  if (w.rel >= 58) return { factor: 1 + 0.08 * weight, w, kind: "warm" };
  if (w.rel <= 25) return { factor: 1 - 0.3 * weight, w, kind: "poor" };
  if (w.rel <= 38) return { factor: 1 - 0.12 * weight, w, kind: "cool" };
  return null;
}

/** How a reunion should start: history nudges the opening relationship but never locks it. */
export function reunionNudge(w: WithManager): number {
  return clamp((w.rel - 50) * 0.35, -9, 9);
}

/** Meetings with a manager's side so far, and one more (call after recording a meeting). */
export function meetings(state: GameState, id: ManagerId): number {
  return state.user.mgr?.meetings[id] ?? 0;
}

export function markSeen(state: GameState, key: string): boolean {
  const ms = mgrState(state);
  if (ms.seen.includes(key)) return false;
  ms.seen.push(key);
  if (ms.seen.length > SEEN_CAP) ms.seen.splice(0, ms.seen.length - SEEN_CAP);
  return true;
}

export function sanitizeManagerState(state: GameState): void {
  const u = state.user;
  if (!u.mgr) return;
  const ms = u.mgr;
  const ok = (n: unknown) => typeof n === "number" && Number.isFinite(n);
  ms.stints = Array.isArray(ms.stints)
    ? ms.stints.filter((s) => s && typeof s.managerId === "string" && typeof s.clubId === "string" && s.from && ok(s.from.season) && ok(s.apps) && s.apps >= 0)
    : [];
  for (const s of ms.stints) {
    s.honours = { ...emptyHonours(), ...(s.honours ?? {}) };
    s.events = Array.isArray(s.events) ? s.events.filter((e) => e && typeof e.k === "string").slice(-MAX_EVENTS) : [];
    s.starts = Math.min(ok(s.starts) ? s.starts : 0, s.apps);
    s.goals = ok(s.goals) ? s.goals : 0;
    s.relStart = clamp(ok(s.relStart) ? s.relStart : 50, 0, 100);
    if (s.relEnd !== undefined) s.relEnd = clamp(ok(s.relEnd) ? s.relEnd : 50, 0, 100);
  }
  // At most one open stint, the last one: any earlier open stint is closed where the next began.
  for (let i = 0; i < ms.stints.length - 1; i++) {
    const s = ms.stints[i];
    if (!s.to) {
      s.to = ms.stints[i + 1].from;
      s.relEnd ??= s.relStart;
      s.ended ??= "player-left";
    }
  }
  ms.stints = ms.stints.slice(-MAX_STINTS);
  ms.meetings = ms.meetings && typeof ms.meetings === "object" ? Object.fromEntries(Object.entries(ms.meetings).filter(([, v]) => ok(v) && v >= 0)) : {};
  ms.seen = Array.isArray(ms.seen) ? ms.seen.filter((x) => typeof x === "string").slice(-SEEN_CAP) : [];
}
