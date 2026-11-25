/**
 * Challenge scenarios: an optional goal chosen when a career starts ("start in a third-tier league and win the Champions Cup by
 * 25"), checked every week and settled once: won when the goal is met, failed when the deadline passes, the player retires, or
 * the run is broken (leaving the one club). The weekly challenge picks one of them and a world seed from the calendar week, so
 * everyone who starts it that week plays the same world. Checks only read the state; they never draw from the world RNG.
 */
import { staticLeague } from "../data/world";
import { ageOf } from "../players/generate";
import type { ChallengeState, GameState, Player } from "../types";
import type { StartPath } from "../world/create";
import { addNews, addTimeline, userPlayer } from "../world/helpers";

export interface ChallengeStart {
  path?: StartPath;
  /** League tier the first club must be in (1 = top flight). */
  tier?: number;
  /** Outfield only (goalscoring challenges). */
  outfield?: boolean;
}

export interface ChallengeDef {
  id: string;
  title: string;
  icon: string;
  blurb: string;
  start: ChallengeStart;
  /** The goal must be met by this age (inclusive), or within this many seasons of the start. */
  byAge?: number;
  seasons?: number;
  goal: (s: GameState, p: Player) => boolean;
  progress: (s: GameState, p: Player) => string;
  /** A reason the run can no longer be completed, regardless of the deadline. */
  broken?: (s: GameState, p: Player) => string | null;
}

const leagueTitles = (s: GameState) => s.user.trophies.filter((t) => t.kind === "league");
const countryOf = (clubId?: string) => (clubId ? clubId.split("-")[0].toUpperCase() : "");
const leftStartClub = (s: GameState) => s.user.transfers.some((t) => t.from === s.user.startClubId && t.kind !== "loan");

export const CHALLENGES: readonly ChallengeDef[] = [
  {
    id: "underdog",
    title: "From the Bottom",
    icon: "🪜",
    blurb: "Start at a third-tier club and lift the Champions Cup by the age of 25.",
    start: { tier: 3 },
    byAge: 25,
    goal: (s) => s.user.trophies.some((t) => t.kind === "continental" && t.compId.startsWith("ccup")),
    progress: (s, p) => {
      const tier = p.clubId ? staticLeague(s.clubs[p.clubId]?.leagueId ?? "")?.tier : undefined;
      const titles = leagueTitles(s).length;
      return `${tier ? `Playing in tier ${tier}` : "Without a club"} · ${titles} league title${titles === 1 ? "" : "s"} · no Champions Cup yet`;
    },
  },
  {
    id: "one-club",
    title: "One-Club Legend",
    icon: "🏟️",
    blurb: "Never leave your first club, and win the league with them within 10 seasons.",
    start: {},
    seasons: 10,
    goal: (s) => !leftStartClub(s) && leagueTitles(s).some((t) => t.clubId === s.user.startClubId),
    progress: (s) => `${s.season - s.user.startSeason} season${s.season - s.user.startSeason === 1 ? "" : "s"} at the club · ${leagueTitles(s).filter((t) => t.clubId === s.user.startClubId).length} league titles`,
    broken: (s) => (leftStartClub(s) ? "You left your first club." : null),
  },
  {
    id: "golden-27",
    title: "Golden Before 27",
    icon: "🌟",
    blurb: "Win the Golden Pitch, the world player of the year, before you turn 27.",
    start: {},
    byAge: 26,
    goal: (s) => s.user.awards.some((a) => a.id === "golden-pitch" && a.playerId === s.user.playerId),
    progress: (s) => {
      const noms = (s.user.awardNoms ?? []).filter((n) => n.id === "golden-pitch").length;
      return noms ? `Nominated ${noms} time${noms === 1 ? "" : "s"}.` : "Not nominated yet.";
    },
  },
  {
    id: "century-24",
    title: "Century by 24",
    icon: "💯",
    blurb: "Score 100 senior club goals before your 25th birthday.",
    start: { outfield: true },
    byAge: 24,
    goal: (_s, p) => p.career.goals >= 100,
    progress: (_s, p) => `${p.career.goals}/100 goals`,
  },
  {
    id: "globetrotter",
    title: "Globetrotter",
    icon: "🧭",
    blurb: "Win league titles in three different countries before you retire.",
    start: {},
    byAge: 37,
    goal: (s) => new Set(leagueTitles(s).map((t) => t.country ?? countryOf(t.clubId))).size >= 3,
    progress: (s) => `${new Set(leagueTitles(s).map((t) => t.country ?? countryOf(t.clubId))).size}/3 countries conquered`,
  },
  {
    id: "late-bloomer",
    title: "Late Bloomer",
    icon: "🌱",
    blurb: "Start as a late starter and win 50 international caps by the age of 30.",
    start: { path: "late" },
    byAge: 30,
    goal: (_s, p) => p.intl.caps >= 50,
    progress: (_s, p) => `${p.intl.caps}/50 caps`,
  },
];

export function challengeDef(id: string | undefined): ChallengeDef | undefined {
  return CHALLENGES.find((c) => c.id === id);
}

/** Whether a new career's start meets a challenge's requirements. */
export function challengeFits(def: ChallengeDef, start: { path: StartPath; tier: number; position: string }): { ok: boolean; reason?: string } {
  if (def.start.path && start.path !== def.start.path) return { ok: false, reason: `Needs the ${def.start.path === "late" ? "late starter" : def.start.path} start` };
  if (def.start.tier && start.tier !== def.start.tier) return { ok: false, reason: `Needs a club in tier ${def.start.tier}` };
  if (def.start.outfield && start.position === "GK") return { ok: false, reason: "Outfield players only" };
  return { ok: true };
}

/** ISO-8601 week key, e.g. "2026-W48". */
export function weekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** This week's challenge: the same scenario and the same world seed for everyone who starts it during the week. */
export function weeklyChallenge(date: Date): { week: string; def: ChallengeDef; seed: string } {
  const week = weekKey(date);
  return { week, def: CHALLENGES[hash(week) % CHALLENGES.length], seed: `weekly-${week}` };
}

export function startChallenge(state: GameState, id: string, weekly?: string): void {
  const def = challengeDef(id);
  if (!def) return;
  state.user.challenge = { id, weekly, status: "active", startedSeason: state.season };
  addTimeline(state, { kind: "event", title: `Challenge accepted: ${def.title}`, detail: def.blurb });
}

export interface ChallengeView {
  def: ChallengeDef;
  state: ChallengeState;
  progress: string;
  deadline: string;
}

export function challengeView(state: GameState): ChallengeView | null {
  const c = state.user.challenge;
  const def = challengeDef(c?.id);
  if (!c || !def) return null;
  const p = userPlayer(state);
  const deadline = def.byAge !== undefined ? `by age ${def.byAge}` : `by ${state.user.startSeason + (def.seasons ?? 0)}/${String((state.user.startSeason + (def.seasons ?? 0) + 1) % 100).padStart(2, "0")}`;
  return { def, state: c, progress: def.progress(state, p), deadline };
}

/** Settle the challenge when its outcome is known. Runs every week and on retirement; does nothing once settled. */
export function checkChallenge(state: GameState): void {
  const c = state.user.challenge;
  const def = challengeDef(c?.id);
  if (!c || !def || c.status !== "active") return;
  const p = userPlayer(state);
  const age = ageOf(p, state.season);
  const settle = (status: "won" | "failed", why: string) => {
    c.status = status;
    c.settledSeason = state.season;
    c.note = why;
    addTimeline(state, { kind: status === "won" ? "milestone" : "event", title: status === "won" ? `Challenge complete: ${def.title}` : `Challenge failed: ${def.title}`, detail: why });
    addNews(state, { kind: "career", title: status === "won" ? `${def.icon} Challenge complete: ${def.title}` : `Challenge over: ${def.title}`, body: why, important: true });
  };
  if (def.goal(state, p)) return settle("won", `Done at the age of ${age}.`);
  const broken = def.broken?.(state, p);
  if (broken) return settle("failed", broken);
  if (state.user.retired) return settle("failed", "You retired before finishing it.");
  if (def.byAge !== undefined && age > def.byAge) return settle("failed", `The deadline passed at ${def.byAge}.`);
  if (def.seasons !== undefined && state.season - state.user.startSeason >= def.seasons) return settle("failed", `${def.seasons} seasons went by.`);
}
