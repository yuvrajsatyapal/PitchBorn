/**
 * Weekly goals and cosmetic rewards. Three small goals run at a time ("Score in 3 straight games"), each with a few
 * weeks to finish; a finished goal unlocks a cosmetic (boots, a kit colour or a goal celebration) and a new goal takes
 * its place. Cosmetics never change the football: they show on the portrait, the career card and in live matches.
 *
 * Goals are judged from the match log after the goal was set, so nothing is counted twice. New goals are drawn from
 * `Rng.fromSeed(seed:goals:<n>)` and never move the world RNG.
 */
import { Rng } from "../rng";
import type { CareerGoal, CosmeticKind, GameState, MatchLogEntry } from "../types";
import { addNews, userPlayer } from "../world/helpers";

export interface CosmeticDef {
  id: string;
  kind: CosmeticKind;
  name: string;
  /** Boots: [upper, sole]; kit: [shirt, trim]; celebration: an emoji and a line for the live match. */
  colors?: [string, string];
  icon?: string;
  line?: string;
  /** Owned from the start. */
  starter?: boolean;
}

export const COSMETICS: CosmeticDef[] = [
  { id: "boots-classic", kind: "boots", name: "Classic black", colors: ["#1b1712", "#f4efe2"], starter: true },
  { id: "boots-sun", kind: "boots", name: "Sunburst", colors: ["#ffc62b", "#1b1712"] },
  { id: "boots-pitch", kind: "boots", name: "Turf green", colors: ["#2e8b57", "#f4efe2"] },
  { id: "boots-coral", kind: "boots", name: "Coral blaze", colors: ["#ff6b4a", "#1b1712"] },
  { id: "boots-sky", kind: "boots", name: "Sky speed", colors: ["#3aa0ff", "#ffffff"] },
  { id: "boots-plum", kind: "boots", name: "Midnight plum", colors: ["#6b3fa0", "#ffc62b"] },
  { id: "boots-white", kind: "boots", name: "Whiteout", colors: ["#ffffff", "#c9c2b0"] },
  { id: "boots-gold", kind: "boots", name: "Golden boot", colors: ["#d4a017", "#1b1712"] },
  { id: "kit-club", kind: "kit", name: "Club colours", starter: true },
  { id: "kit-retro", kind: "kit", name: "Retro cream", colors: ["#f4efe2", "#1b1712"] },
  { id: "kit-night", kind: "kit", name: "Night match", colors: ["#1b2a4a", "#ffc62b"] },
  { id: "kit-sunset", kind: "kit", name: "Sunset", colors: ["#ff8a3d", "#6b3fa0"] },
  { id: "kit-mint", kind: "kit", name: "Mint", colors: ["#9de0c0", "#1b1712"] },
  { id: "kit-blackout", kind: "kit", name: "Blackout", colors: ["#141414", "#e0e0e0"] },
  { id: "cel-point", kind: "celebration", name: "Point to the crowd", icon: "👉", line: "points to the fans", starter: true },
  { id: "cel-slide", kind: "celebration", name: "Knee slide", icon: "🛝", line: "goes into a long knee slide" },
  { id: "cel-flip", kind: "celebration", name: "Backflip", icon: "🤸", line: "lands a backflip" },
  { id: "cel-heart", kind: "celebration", name: "Heart hands", icon: "🫶", line: "makes a heart for the crowd" },
  { id: "cel-shush", kind: "celebration", name: "Shush", icon: "🤫", line: "shushes the away end" },
  { id: "cel-robot", kind: "celebration", name: "The robot", icon: "🤖", line: "does the robot by the corner flag" },
  { id: "cel-airplane", kind: "celebration", name: "Aeroplane", icon: "✈️", line: "runs off with arms out like a plane" },
  { id: "cel-cool", kind: "celebration", name: "Ice cold", icon: "🧊", line: "stands still, ice cold" },
];
const COSMETIC_BY_ID = new Map(COSMETICS.map((c) => [c.id, c]));
export const cosmeticDef = (id: string | undefined) => (id ? COSMETIC_BY_ID.get(id) : undefined);
export const STARTER_COSMETICS = COSMETICS.filter((c) => c.starter).map((c) => c.id);

type Template = {
  id: string;
  label: (n: number) => string;
  /** Target sizes to pick from. */
  sizes: number[];
  weeks: number;
  /** Progress from the matches since the goal was set (oldest first). */
  progress: (m: MatchLogEntry[]) => number;
  /** Only for players this makes sense for. */
  fits?: (pos: string) => boolean;
};

const streak = (m: MatchLogEntry[], ok: (e: MatchLogEntry) => boolean) => {
  let best = 0;
  let run = 0;
  for (const e of m) {
    run = ok(e) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
};
const ATT = (pos: string) => !["GK", "CB"].includes(pos);
const DEF = (pos: string) => ["GK", "CB", "RB", "LB", "DM"].includes(pos);

export const GOAL_TEMPLATES: Template[] = [
  { id: "score-streak", label: (n) => `Score in ${n} straight games`, sizes: [2, 3], weeks: 6, progress: (m) => streak(m, (e) => e.goals > 0), fits: ATT },
  { id: "goals", label: (n) => `Score ${n} goals`, sizes: [2, 3, 4], weeks: 5, progress: (m) => m.reduce((s, e) => s + e.goals, 0), fits: ATT },
  { id: "assists", label: (n) => `Make ${n} assists`, sizes: [2, 3], weeks: 5, progress: (m) => m.reduce((s, e) => s + e.assists, 0), fits: (p) => p !== "GK" },
  { id: "rating", label: (n) => `Earn a 7.5+ rating ${n} times`, sizes: [2, 3], weeks: 5, progress: (m) => m.filter((e) => e.rating >= 7.5).length },
  { id: "clean-sheets", label: (n) => `Keep ${n} clean sheets`, sizes: [2, 3], weeks: 6, progress: (m) => m.filter((e) => e.cleanSheet && (e.minutes ?? 90) >= 60).length, fits: DEF },
  { id: "full-90", label: (n) => `Play the full 90 in ${n} games`, sizes: [3, 4], weeks: 6, progress: (m) => m.filter((e) => (e.minutes ?? 0) >= 90).length },
  { id: "wins", label: (n) => `Win ${n} games in a row`, sizes: [2, 3], weeks: 6, progress: (m) => streak(m, (e) => e.result === "W") },
  { id: "brace", label: () => "Score twice in one game", sizes: [1], weeks: 8, progress: (m) => m.filter((e) => e.goals >= 2).length, fits: ATT },
];

export const ACTIVE_GOALS = 3;

function goalsState(state: GameState) {
  return (state.user.goals ??= { active: [], completed: 0, drawn: 0 });
}

export function cosmeticsOf(state: GameState) {
  return (state.user.cosmetics ??= { owned: [...STARTER_COSMETICS], equipped: { boots: "boots-classic", kit: "kit-club", celebration: "cel-point" } });
}

function matchesSince(state: GameState, g: CareerGoal): MatchLogEntry[] {
  return (state.user.matchLog ?? []).filter((e) => e.season > g.season || (e.season === g.season && e.turn >= g.turn));
}

/** The next locked cosmetic to award, cycling kinds so the rewards vary. */
function nextReward(state: GameState, r: Rng): string | undefined {
  const owned = new Set(cosmeticsOf(state).owned);
  const locked = COSMETICS.filter((c) => !owned.has(c.id) && !(state.user.goals?.active ?? []).some((g) => g.reward === c.id));
  return locked.length ? r.pick(locked).id : undefined;
}

function drawGoal(state: GameState): CareerGoal | undefined {
  const gs = goalsState(state);
  const r = Rng.fromSeed(`${state.seed}:goals:${gs.drawn}`);
  gs.drawn++;
  const pos = userPlayer(state).position;
  const taken = new Set(gs.active.map((g) => g.template));
  const pool = GOAL_TEMPLATES.filter((t) => (!t.fits || t.fits(pos)) && !taken.has(t.id));
  if (!pool.length) return undefined;
  const t = r.pick(pool);
  const target = r.pick(t.sizes);
  return { id: `goal-${gs.drawn}`, template: t.id, label: t.label(target), target, season: state.season, turn: state.turn, expiresIndex: state.turnIndex + t.weeks, reward: nextReward(state, r) };
}

export function goalProgress(state: GameState, g: CareerGoal): number {
  const t = GOAL_TEMPLATES.find((x) => x.id === g.template);
  return t ? Math.min(g.target, t.progress(matchesSince(state, g))) : 0;
}

/** Weekly (and after matches): finish, expire and refill goals. Returns the goals completed now. */
export function goalsWeekly(state: GameState): CareerGoal[] {
  if (state.user.retired) return [];
  const gs = goalsState(state);
  const done: CareerGoal[] = [];
  gs.active = gs.active.filter((g) => {
    if (goalProgress(state, g) >= g.target) {
      done.push(g);
      return false;
    }
    return g.expiresIndex >= state.turnIndex;
  });
  for (const g of done) {
    gs.completed++;
    // The last few, for the season review.
    (gs.done ??= []).push({ season: state.season, label: g.label, reward: g.reward });
    if (gs.done.length > 30) gs.done.shift();
    const c = cosmeticsOf(state);
    const def = cosmeticDef(g.reward);
    if (def && !c.owned.includes(def.id)) c.owned.push(def.id);
    (c.newly ??= []).push(...(def ? [def.id] : []));
    addNews(state, { kind: "career", title: `🎯 Goal complete: ${g.label}`, body: def ? `Unlocked: ${def.name} (${def.kind}). Equip it in the Kit Room.` : "Nice work.", important: true });
  }
  while (gs.active.length < ACTIVE_GOALS) {
    const g = drawGoal(state);
    if (!g) break;
    gs.active.push(g);
  }
  return done;
}

export function equipCosmetic(state: GameState, id: string): { ok: boolean; reason?: string; msg?: string } {
  const def = cosmeticDef(id);
  const c = cosmeticsOf(state);
  if (!def) return { ok: false, reason: "Unknown item." };
  if (!c.owned.includes(id)) return { ok: false, reason: "Locked: complete goals to unlock it." };
  c.equipped[def.kind] = id;
  c.newly = (c.newly ?? []).filter((x) => x !== id);
  return { ok: true, msg: `${def.name} equipped.` };
}

/** Merge cosmetics unlocked in other saves (kept in the browser's profile) into this one. */
export function mergeOwned(state: GameState, ids: readonly string[]): void {
  const c = cosmeticsOf(state);
  for (const id of ids) if (cosmeticDef(id) && !c.owned.includes(id)) c.owned.push(id);
}

/** Kit colours for the portrait: the equipped personal kit, or the club colour. */
export function kitColor(state: GameState, clubColor: string | undefined): string | undefined {
  const def = cosmeticDef(state.user.cosmetics?.equipped.kit);
  return def?.colors?.[0] ?? clubColor;
}
