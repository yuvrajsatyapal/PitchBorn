/**
 * Achievements: one-off career goals that unlock automatically and are kept for good.
 *
 * Two kinds of check run against the same catalogue:
 * - match checks read one finished match of the user's (hat-tricks, debut goals, late winners), and
 * - career checks read the state as it stands (appearances, trophies, caps, awards, money).
 * Career checks are idempotent, so they run after every week, on retirement and on load (silently for old saves).
 */
import type { MatchResult, PlayerLine } from "../match/engine";
import { rivalryLevel } from "../memory/rivalry";
import { ageOf } from "../players/generate";
import type { AchievementUnlock, Competition, Fixture, GameState } from "../types";
import { addNews, userPlayer } from "../world/helpers";

export type AchievementTier = "bronze" | "silver" | "gold" | "platinum";
export type AchievementGroup = "Matches" | "Milestones" | "Honours" | "Career" | "Coaching";

export interface MatchContext {
  comp: Competition;
  fixture: Fixture;
  res: MatchResult;
  line: PlayerLine;
  /** The user's side of the score. */
  mine: number;
  theirs: number;
  myTeam: string;
  opponent: string;
  /** National-team match. */
  nat: boolean;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  tier: AchievementTier;
  group: AchievementGroup;
  icon: string;
  /** Hidden until unlocked (the description reads "???"). */
  secret?: boolean;
  match?: (state: GameState, ctx: MatchContext) => boolean;
  career?: (state: GameState) => boolean;
  /** For countable goals: [current, target]. */
  progress?: (state: GameState) => [number, number];
}

const me = (s: GameState) => userPlayer(s);
const count = (target: number, cur: (s: GameState) => number) => ({
  career: (s: GameState) => cur(s) >= target,
  progress: (s: GameState): [number, number] => [Math.min(cur(s), target), target],
});

/** True when the user's goal in this match was the one that put the team ahead for good, scored at or after `minute`. */
function scoredWinnerAfter(ctx: MatchContext, minute: number, uid: string): boolean {
  if (ctx.mine <= ctx.theirs) return false;
  const side = ctx.line.side;
  let us = 0;
  let them = 0;
  let decider: { minute: number; scorer: string } | null = null;
  for (const g of [...ctx.res.goals].sort((a, b) => a.minute - b.minute)) {
    if (g.side === side) {
      us++;
      if (us === them + 1 && us > them) decider = { minute: g.minute, scorer: g.scorer };
    } else {
      them++;
      if (them >= us) decider = null;
    }
  }
  return !!decider && decider.scorer === uid && decider.minute >= minute;
}

/** The user's team was behind at some point and still won. */
function cameFromBehind(ctx: MatchContext): boolean {
  if (ctx.mine <= ctx.theirs) return false;
  let us = 0;
  let them = 0;
  for (const g of [...ctx.res.goals].sort((a, b) => a.minute - b.minute)) {
    if (g.side === ctx.line.side) us++;
    else them++;
    if (them > us) return true;
  }
  return false;
}

const seasonsWith = (s: GameState, kinds: Competition["kind"][]) => {
  const by = new Map<number, Set<string>>();
  for (const t of s.user.trophies) {
    const set = by.get(t.season) ?? new Set<string>();
    set.add(t.kind);
    by.set(t.season, set);
  }
  return [...by.values()].some((set) => kinds.every((k) => set.has(k)));
};
const clubsPlayedFor = (s: GameState) => {
  const p = me(s);
  const ids = new Set(p.history.filter((h) => h.clubId && h.stats.apps > 0).map((h) => h.clubId as string));
  if (p.clubId && Object.values(p.season).some((x) => x.apps > 0)) ids.add(p.clubId);
  return ids.size;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  // Matches
  { id: "off-the-mark", name: "Off the Mark", description: "Score your first senior goal.", tier: "bronze", group: "Matches", icon: "⚽", ...count(1, (s) => me(s).career.goals) },
  {
    id: "dream-debut", name: "Dream Debut", description: "Score on your professional debut.", tier: "silver", group: "Matches", icon: "🌟",
    match: (s, c) => !c.nat && c.line.goals > 0 && me(s).career.apps === 1,
  },
  { id: "hat-trick", name: "Hat-trick Hero", description: "Score three goals in one match.", tier: "silver", group: "Matches", icon: "🎩", match: (_s, c) => c.line.goals >= 3 },
  {
    id: "debut-hat-trick", name: "Hat-trick on Debut", description: "Score a hat-trick in your very first senior match.", tier: "platinum", group: "Matches", icon: "👑", secret: true,
    match: (s, c) => c.line.goals >= 3 && me(s).career.apps === 1,
  },
  { id: "four-goals", name: "Haul of Four", description: "Score four or more goals in a match.", tier: "gold", group: "Matches", icon: "🔥", secret: true, match: (_s, c) => c.line.goals >= 4 },
  { id: "provider", name: "The Provider", description: "Set up three goals in one match.", tier: "gold", group: "Matches", icon: "🎯", match: (_s, c) => c.line.assists >= 3 },
  { id: "motm", name: "Player of the Match", description: "Be named Player of the Match.", tier: "bronze", group: "Matches", icon: "⭐", match: (s, c) => c.res.motm === s.user.playerId },
  { id: "nine-plus", name: "Masterclass", description: "Earn a match rating of 9.0 or better.", tier: "silver", group: "Matches", icon: "📈", match: (_s, c) => c.line.rating >= 9 },
  { id: "perfect-ten", name: "Perfect Ten", description: "Earn a perfect 10 match rating.", tier: "platinum", group: "Matches", icon: "💯", secret: true, match: (_s, c) => c.line.rating >= 10 },
  { id: "last-gasp", name: "Last-Gasp Winner", description: "Score a winning goal in the 88th minute or later.", tier: "silver", group: "Matches", icon: "⏱️", match: (s, c) => scoredWinnerAfter(c, 88, s.user.playerId) },
  { id: "comeback", name: "Comeback Kings", description: "Score in a win after your team was behind.", tier: "bronze", group: "Matches", icon: "↩️", match: (_s, c) => c.line.goals > 0 && cameFromBehind(c) },
  { id: "big-game", name: "Big-Game Player", description: "Score in a cup or continental final.", tier: "gold", group: "Matches", icon: "🏟️", match: (_s, c) => c.fixture.stage === "Final" && c.line.goals > 0 },
  {
    id: "derby-day", name: "Derby Day", description: "Score the winner against a local rival.", tier: "silver", group: "Matches", icon: "⚔️",
    match: (s, c) => !c.nat && rivalryLevel(s, c.myTeam, c.opponent) >= 0.4 && scoredWinnerAfter(c, 0, s.user.playerId),
  },
  {
    id: "brick-wall", name: "Brick Wall", description: "Keep a clean sheet in a full match as a keeper or defender.", tier: "bronze", group: "Matches", icon: "🧱",
    match: (_s, c) => ["GK", "CB", "RB", "LB"].includes(c.line.slot) && c.theirs === 0 && c.line.started && c.line.minuteOff === null,
  },
  { id: "for-your-country", name: "For Your Country", description: "Score for your national team.", tier: "silver", group: "Matches", icon: "🌍", match: (_s, c) => c.nat && c.line.goals > 0 },

  // Milestones
  { id: "apps-50", name: "Regular", description: "Make 50 senior appearances.", tier: "bronze", group: "Milestones", icon: "👟", ...count(50, (s) => me(s).career.apps) },
  { id: "apps-200", name: "Mainstay", description: "Make 200 senior appearances.", tier: "silver", group: "Milestones", icon: "👟", ...count(200, (s) => me(s).career.apps) },
  { id: "apps-500", name: "Ever-Present", description: "Make 500 senior appearances.", tier: "gold", group: "Milestones", icon: "🏃", ...count(500, (s) => me(s).career.apps) },
  { id: "goals-50", name: "Half-Century", description: "Score 50 senior goals.", tier: "silver", group: "Milestones", icon: "🥅", ...count(50, (s) => me(s).career.goals) },
  { id: "goals-100", name: "Centurion Striker", description: "Score 100 senior goals.", tier: "gold", group: "Milestones", icon: "🥅", ...count(100, (s) => me(s).career.goals) },
  { id: "goals-250", name: "Goal Machine", description: "Score 250 senior goals.", tier: "platinum", group: "Milestones", icon: "🚀", ...count(250, (s) => me(s).career.goals) },
  { id: "assists-50", name: "Creator", description: "Provide 50 senior assists.", tier: "silver", group: "Milestones", icon: "🪄", ...count(50, (s) => me(s).career.assists) },
  { id: "clean-sheets-50", name: "Safe Hands", description: "Keep 50 clean sheets.", tier: "silver", group: "Milestones", icon: "🧤", ...count(50, (s) => me(s).career.cleanSheets) },
  { id: "caps-1", name: "Capped", description: "Win your first senior international cap.", tier: "bronze", group: "Milestones", icon: "🧢", ...count(1, (s) => me(s).intl.caps) },
  { id: "caps-50", name: "International Regular", description: "Win 50 international caps.", tier: "silver", group: "Milestones", icon: "🧢", ...count(50, (s) => me(s).intl.caps) },
  { id: "caps-100", name: "Centurion", description: "Win 100 international caps.", tier: "gold", group: "Milestones", icon: "💯", ...count(100, (s) => me(s).intl.caps) },
  { id: "ovr-80", name: "Top-Flight Quality", description: "Reach an overall rating of 80.", tier: "silver", group: "Milestones", icon: "📊", ...count(80, (s) => s.user.peakOverall) },
  { id: "ovr-90", name: "World Class", description: "Reach an overall rating of 90.", tier: "gold", group: "Milestones", icon: "💎", ...count(90, (s) => s.user.peakOverall) },

  // Honours
  { id: "first-trophy", name: "Silverware", description: "Win your first trophy.", tier: "bronze", group: "Honours", icon: "🏆", ...count(1, (s) => s.user.trophies.length) },
  { id: "trophies-10", name: "Serial Winner", description: "Win ten trophies.", tier: "gold", group: "Honours", icon: "🏆", ...count(10, (s) => s.user.trophies.length) },
  { id: "champions", name: "Champions", description: "Win a league title.", tier: "silver", group: "Honours", icon: "🥇", ...count(1, (s) => s.user.trophies.filter((t) => t.kind === "league").length) },
  {
    id: "three-clubs", name: "Champion Everywhere", description: "Win the league with three different clubs.", tier: "platinum", group: "Honours", icon: "🌐",
    ...count(3, (s) => new Set(s.user.trophies.filter((t) => t.kind === "league" && t.clubId).map((t) => t.clubId)).size),
  },
  { id: "double", name: "The Double", description: "Win the league and the domestic cup in the same season.", tier: "gold", group: "Honours", icon: "✌️", career: (s) => seasonsWith(s, ["league", "cup"]) },
  { id: "treble", name: "The Treble", description: "Win the league, cup and a continental trophy in one season.", tier: "platinum", group: "Honours", icon: "🔱", secret: true, career: (s) => seasonsWith(s, ["league", "cup", "continental"]) },
  { id: "continental", name: "Kings of the Continent", description: "Win a continental trophy.", tier: "gold", group: "Honours", icon: "🌟", ...count(1, (s) => s.user.trophies.filter((t) => t.kind === "continental").length) },
  { id: "intl-trophy", name: "National Hero", description: "Win an international tournament.", tier: "platinum", group: "Honours", icon: "🌍", ...count(1, (s) => s.user.trophies.filter((t) => t.kind === "international").length) },
  { id: "first-award", name: "Recognised", description: "Win an individual award.", tier: "bronze", group: "Honours", icon: "🎖️", ...count(1, (s) => s.user.awards.length) },
  { id: "player-of-season", name: "Player of the Season", description: "Win your league's Player of the Season.", tier: "gold", group: "Honours", icon: "🏅", career: (s) => s.user.awards.some((a) => a.id === "pots") },
  { id: "golden-pitch", name: "Golden Pitch", description: "Be crowned the best player in the world.", tier: "platinum", group: "Honours", icon: "🌕", career: (s) => s.user.awards.some((a) => a.id === "golden-pitch") },

  // Career
  { id: "teen-debut", name: "Wonderkid", description: "Make your senior debut before turning 18.", tier: "silver", group: "Career", icon: "🍼", career: (s) => me(s).career.apps > 0 && debutAge(s) < 18 },
  { id: "veteran", name: "Still Got It", description: "Play a senior match at 37 or older.", tier: "silver", group: "Career", icon: "🧓", career: (s) => !s.user.retired && ageOf(me(s), s.season) >= 37 && Object.values(me(s).season).some((x) => x.apps > 0) },
  { id: "journeyman", name: "Journeyman", description: "Play for five different clubs.", tier: "bronze", group: "Career", icon: "🧳", ...count(5, clubsPlayedFor) },
  { id: "one-club", name: "One-Club Hero", description: "Spend ten seasons at the same club.", tier: "gold", group: "Career", icon: "❤️", ...count(10, (s) => longestStay(s)) },
  { id: "captain", name: "Armband", description: "Be named club captain.", tier: "silver", group: "Career", icon: "©️", career: (s) => s.user.memories.some((m) => m.kind === "captaincy") || (!!me(s).clubId && s.clubs[me(s).clubId as string]?.captain === s.user.playerId) },
  { id: "big-money", name: "Big-Money Move", description: "Move for a fee of €50m or more.", tier: "gold", group: "Career", icon: "💸", career: (s) => s.user.transfers.some((t) => t.fee >= 50_000_000) },
  { id: "millionaire", name: "Millionaire", description: "Earn €1m over your career.", tier: "bronze", group: "Career", icon: "💰", ...count(1_000_000, (s) => Math.round(s.user.earnings)) },
  { id: "promoted", name: "Going Up", description: "Win promotion with your club.", tier: "silver", group: "Career", icon: "⬆️", career: (s) => s.user.memories.some((m) => m.kind === "promotion") },
  { id: "legend", name: "Legend", description: "Retire with a legacy rated Legend or higher.", tier: "platinum", group: "Career", icon: "🗿", career: (s) => (s.user.legacy?.score ?? 0) >= 450 },
];

const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
export const achievementById = (id: string) => BY_ID.get(id);

function debutAge(s: GameState): number {
  const p = me(s);
  const first = [...p.history].sort((a, b) => a.season - b.season).find((h) => h.stats.apps > 0);
  const season = first?.season ?? s.season;
  return season - p.birthYear;
}

function longestStay(s: GameState): number {
  const p = me(s);
  const by = new Map<string, number>();
  for (const h of p.history) if (h.clubId && h.stats.apps > 0) by.set(h.clubId, (by.get(h.clubId) ?? 0) + 1);
  return Math.max(0, ...by.values());
}

export function unlocked(state: GameState): AchievementUnlock[] {
  return (state.user.achievements ??= []);
}

export function hasAchievement(state: GameState, id: string): boolean {
  return (state.user.achievements ?? []).some((a) => a.id === id);
}

/** Records an unlock once. Returns true when it is new. */
export function unlock(state: GameState, id: string, opts: { silent?: boolean; detail?: string } = {}): boolean {
  const def = BY_ID.get(id);
  if (!def || hasAchievement(state, id)) return false;
  const rec: AchievementUnlock = { id, season: state.season, turn: state.turn };
  if (opts.detail) rec.detail = opts.detail;
  if (opts.silent) rec.backfilled = true;
  unlocked(state).push(rec);
  if (!opts.silent) {
    addNews(state, { kind: "career", title: `${def.icon} Achievement unlocked: ${def.name}`, body: def.description, important: def.tier === "gold" || def.tier === "platinum" });
  }
  return true;
}

/** Match checks for one finished match of the user's. */
export function checkMatchAchievements(state: GameState, ctx: MatchContext): string[] {
  const out: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (!a.match || hasAchievement(state, a.id)) continue;
    let ok = false;
    try {
      ok = a.match(state, ctx);
    } catch {
      ok = false;
    }
    if (ok && unlock(state, a.id, { detail: `${ctx.mine}-${ctx.theirs} · ${ctx.comp.name}` })) out.push(a.id);
  }
  return out;
}

/** Career checks against the state as it stands. Idempotent. */
export function checkCareerAchievements(state: GameState, opts: { silent?: boolean } = {}): string[] {
  const out: string[] = [];
  if (!state.players[state.user.playerId]) return out;
  for (const a of ACHIEVEMENTS) {
    if (!a.career || hasAchievement(state, a.id)) continue;
    let ok = false;
    try {
      ok = a.career(state);
    } catch {
      ok = false;
    }
    if (ok && unlock(state, a.id, opts)) out.push(a.id);
  }
  return out;
}

/** Old saves: everything already earned is recorded without fanfare. Also drops unknown ids and duplicates. */
export function sanitizeAchievements(state: GameState): void {
  const u = state.user;
  if (!u) return;
  const seen = new Set<string>();
  u.achievements = Array.isArray(u.achievements)
    ? u.achievements.filter((a) => a && typeof a.id === "string" && BY_ID.has(a.id) && Number.isFinite(a.season) && !seen.has(a.id) && !!seen.add(a.id))
    : [];
  checkCareerAchievements(state, { silent: true });
}

export const TIER_POINTS: Record<AchievementTier, number> = { bronze: 10, silver: 25, gold: 50, platinum: 100 };

export function achievementScore(state: GameState): { points: number; max: number; count: number; total: number } {
  const have = new Set((state.user.achievements ?? []).map((a) => a.id));
  let points = 0;
  let max = 0;
  for (const a of ACHIEVEMENTS) {
    max += TIER_POINTS[a.tier];
    if (have.has(a.id)) points += TIER_POINTS[a.tier];
  }
  return { points, max, count: have.size, total: ACHIEVEMENTS.length };
}
