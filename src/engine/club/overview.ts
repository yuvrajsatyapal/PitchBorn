/**
 * Everything the Club page says about a club, derived from the state the game already keeps: standings, squad,
 * tactics, finances, transfers, honours and rivalries. Real-world history (the dataset's league tables) is kept
 * apart from what happened in this save.
 */
import { clubRevenue, formatMoney } from "../players/economy";
import { staticClub, staticLeague, stadium, WORLD, clubName } from "../data/world";
import { FORMATIONS, fitFor, selectTeam, tacticalFit } from "../match/lineup";
import { rivalsOf } from "../memory/rivalry";
import { positionGroup } from "../players/attributes";
import { ageOf } from "../players/generate";
import type { ClubState, GameState, Position } from "../types";
import { squadOf, userPlayer } from "../world/helpers";
import { adjustRel, relReasons } from "../career/relationships";
import { journeyOf, type Journey } from "../competitions/bracket";
import { standingOf } from "./standing";

// ---------------------------------------------------------------------------------------------------- identity

const band = (v: number, low: string, mid: string, high: string) => (v >= 0.62 ? high : v <= 0.38 ? low : mid);

export interface ClubIdentity {
  formation: string;
  /** Attacking or defensive lean of the shape itself, from how many players it puts forward. */
  lean: string;
  pressing: string;
  tempo: string;
  directness: string;
  approach: string;
  /** The manager and how long they have been in charge: the style is theirs. */
  manager: string;
  tenure: number;
  values: { pressing: number; tempo: number; directness: number };
  /** What the style really does in a match, in plain words (kept to what the engine implements). */
  effects: string[];
}

export function clubIdentity(state: GameState, club: ClubState): ClubIdentity {
  const slots = FORMATIONS[club.formation];
  const forward = slots.filter((s) => ["RW", "LW", "ST", "AM"].includes(s)).length;
  const back = slots.filter((s) => ["CB", "RB", "LB"].includes(s) && s).length;
  const lean = forward >= 4 ? "Attacking shape" : back >= 5 ? "Defensive shape" : "Balanced shape";
  const s = club.style;
  const counter = s.directness >= 0.6 && s.tempo >= 0.5;
  const possession = s.directness <= 0.4;
  return {
    formation: club.formation,
    lean,
    pressing: band(s.pressing, "Low block", "Mid-block", "High press"),
    tempo: band(s.tempo, "Patient tempo", "Measured tempo", "High tempo"),
    directness: band(s.directness, "Short passing", "Mixed build-up", "Direct play"),
    approach: counter ? "Counter-attacking" : possession ? "Possession-based" : "Flexible",
    manager: club.manager.name,
    tenure: Math.max(0, state.season - club.manager.since),
    values: { ...s },
    effects: [
      s.pressing >= 0.62 ? "A high press wins more of the midfield battle." : s.pressing <= 0.38 ? "A low block concedes the midfield but defends the box." : "",
      s.tempo >= 0.62 ? "A high tempo opens games up at both ends." : s.tempo <= 0.38 ? "A patient tempo keeps games tight." : "",
      s.directness >= 0.62 ? "Direct play gives up some of the ball in exchange for more shots." : s.directness <= 0.38 ? "Short passing keeps the ball but creates less per attack." : "",
    ].filter(Boolean),
  };
}

export interface FitView {
  score: number;
  label: string;
  /** The style the player suits least, if it is a problem. */
  note: string;
}

/** How well the user's attributes suit the club's style: the same number the manager's selection uses. */
export function userTacticalFit(state: GameState, club: ClubState): FitView {
  const u = userPlayer(state);
  const score = Math.round(tacticalFit(u, club.style));
  const label = score >= 68 ? "Natural fit" : score >= 55 ? "Good fit" : score >= 42 ? "Awkward fit" : "Poor fit";
  const note =
    u.position === "GK"
      ? "Goalkeepers are not affected by the outfield style."
      : score >= 55
        ? "Your attributes suit how the team plays."
        : "Your attributes don't suit how the team plays, which costs a little in selection.";
  return { score, label, note };
}

// ---------------------------------------------------------------------------------------------------- strength

export interface Department {
  key: "attack" | "midfield" | "defence" | "goalkeeping";
  label: string;
  value: number;
  /** Place among the league's clubs for the same department (1 = strongest). */
  rank: number;
  of: number;
}

const DEPT_SLOTS: Record<Department["key"], Position[]> = {
  attack: ["ST", "RW", "LW", "AM"],
  midfield: ["CM", "DM"],
  defence: ["CB", "RB", "LB"],
  goalkeeping: ["GK"],
};
const DEPT_LABEL: Record<Department["key"], string> = { attack: "Attack", midfield: "Midfield", defence: "Defence", goalkeeping: "Goalkeeping" };

function departmentValues(state: GameState, club: ClubState): Record<Department["key"], number> {
  const sel = selectTeam(squadOf(state, club.id), club.formation, null);
  const out = {} as Record<Department["key"], number>;
  for (const key of Object.keys(DEPT_SLOTS) as Department["key"][]) {
    const xs = sel.starters.filter((s) => DEPT_SLOTS[key].includes(s.slot)).map((s) => fitFor(s.player, s.slot));
    out[key] = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  }
  return out;
}

type DeptValues = Record<Department["key"], number>;
let deptCache: { key: string; values: Record<string, DeptValues> } | null = null;

/** Strength by department from the best eleven the squad can field, ranked against the rest of the league. */
export function departments(state: GameState, clubId: string): Department[] {
  const club = state.clubs[clubId];
  if (!club) return [];
  // Squads change little within a week: one league's worth of clubs is worked out once per game week.
  const key = `${state.id}:${state.turnIndex}:${club.leagueId}`;
  if (!deptCache || deptCache.key !== key) {
    const values: Record<string, DeptValues> = {};
    for (const id of state.leagueClubs[club.leagueId] ?? []) values[id] = departmentValues(state, state.clubs[id]);
    deptCache = { key, values };
  }
  const values = deptCache.values;
  const mine = departmentValues(state, club);
  const ids = Object.keys(values).filter((id) => id !== clubId);
  ids.push(clubId);
  const vals = { ...values, [clubId]: mine };
  return (Object.keys(DEPT_SLOTS) as Department["key"][]).map((k) => ({
    key: k,
    label: DEPT_LABEL[k],
    value: Math.round(mine[k]),
    rank: 1 + ids.filter((id) => vals[id][k] > mine[k] + 0.001).length,
    of: ids.length,
  }));
}

// ---------------------------------------------------------------------------------------------------- money & moves

export interface Finances {
  balance: number;
  /** Annual revenue estimate and the weekly wage bill, which together decide the verdict. */
  revenue: number;
  wageBill: number;
  wageRatio: number;
  verdict: "Healthy" | "Stable" | "Tight" | "In trouble";
  /** What the club has done in the market recently, from the transfer log. */
  netSpend: number;
  direction: string;
  averageAge: number;
}

export function finances(state: GameState, clubId: string): Finances | null {
  const club = state.clubs[clubId];
  const st = staticClub(clubId);
  if (!club || !st) return null;
  const tier = staticLeague(club.leagueId)?.tier ?? 3;
  const revenue = clubRevenue(club.reputation, tier, stadium(st.stadiumId)?.capacity ?? 10000);
  const squad = squadOf(state, clubId);
  const wageBill = squad.reduce((s, p) => s + (p.contract?.wage ?? 0), 0);
  const wageRatio = revenue ? (wageBill * 50) / revenue : 0;
  const verdict = club.balance < 0 ? "In trouble" : club.balance < revenue * 0.05 || wageRatio > 0.85 ? "Tight" : club.balance > revenue * 0.4 && wageRatio < 0.6 ? "Healthy" : "Stable";
  let net = 0;
  let youngIn = 0;
  let oldIn = 0;
  for (const t of state.transferLog) {
    if (t.to === clubId) {
      net -= t.fee;
      const p = state.players[t.playerId];
      if (p && ageOf(p, state.season) <= 23) youngIn++;
      else if (p && ageOf(p, state.season) >= 29) oldIn++;
    }
    if (t.from === clubId) net += t.fee;
  }
  const averageAge = squad.length ? squad.reduce((s, p) => s + ageOf(p, state.season), 0) / squad.length : 0;
  const direction =
    youngIn > oldIn && youngIn > 0 ? "Buying young talent" : oldIn > youngIn && oldIn > 0 ? "Buying experience" : net > revenue * 0.05 ? "Selling to balance the books" : averageAge <= 24.5 ? "Building around a young squad" : averageAge >= 28.5 ? "An experienced squad" : "Steady, no big shifts";
  return { balance: club.balance, revenue, wageBill, wageRatio, verdict, netSpend: net, direction, averageAge };
}

export interface MoveRow {
  playerId: string;
  name: string;
  other: string | null;
  fee: number;
  season: number;
  turn: number;
  position: string;
}

/** Recent arrivals and departures of the club, from the transfer log (the single record of AI and user moves). */
export function recentMoves(state: GameState, clubId: string): { arrivals: MoveRow[]; departures: MoveRow[] } {
  const row = (t: GameState["transferLog"][number], other: string | null): MoveRow => ({ playerId: t.playerId, name: t.name, other, fee: t.fee, season: t.season, turn: t.turn, position: state.players[t.playerId]?.position ?? "" });
  const log = [...state.transferLog].reverse();
  return {
    arrivals: log.filter((t) => t.to === clubId).slice(0, 5).map((t) => row(t, t.from)),
    departures: log.filter((t) => t.from === clubId).slice(0, 5).map((t) => row(t, t.to)),
  };
}

// ---------------------------------------------------------------------------------------------------- history

export interface ClubHistory {
  /** Real league seasons in the dataset (the last few years of actual tables). */
  real: { span: string; seasons: number; titles: number; bestPos: number | null; lastPos: number | null; lastSeason: string | null };
  /** What has happened in this save. */
  simulated: { leagueTitles: number; cups: number; continental: number; bestPos: number | null; promotions: number; relegations: number; seasons: number };
  rivals: { clubId: string; label: string; level: number }[];
  user: { apps: number; goals: number; assists: number; trophies: number; seasons: number; memories: number };
  records: { label: string; value: string }[];
}

export function clubHistory(state: GameState, clubId: string): ClubHistory {
  const rows = WORLD.history.flatMap((h) => h.table.filter((r) => r.clubId === clubId).map((r) => ({ season: h.season, pos: r.pos, leagueId: h.leagueId })));
  const sorted = [...rows].sort((a, b) => a.season.localeCompare(b.season));
  const top = (pred: (r: (typeof rows)[number]) => boolean) => sorted.filter(pred);
  const titles = top((r) => r.pos === 1 && (staticLeague(r.leagueId)?.tier ?? 9) === 1).length;
  const seasons = [...new Set(sorted.map((r) => r.season))];

  let leagueTitles = 0;
  let cups = 0;
  let continental = 0;
  let best: number | null = null;
  let promotions = 0;
  let relegations = 0;
  const finishes: { season: number; pos: number; goals: number }[] = [];
  for (const a of state.archive) {
    for (const [compId, c] of Object.entries(a.champions)) {
      if (c.winner !== clubId) continue;
      if (compId.startsWith("cup-")) cups++;
      else if (compId.startsWith("ccup") || compId.startsWith("ecup")) continental++;
      else leagueTitles++;
    }
    for (const [compId, table] of Object.entries(a.tables)) {
      const i = table.findIndex((r) => r.team === clubId);
      if (i >= 0) {
        best = best === null ? i + 1 : Math.min(best, i + 1);
        finishes.push({ season: a.season, pos: i + 1, goals: table[i].gf });
      }
      void compId;
    }
    for (const arr of Object.values(a.promoted)) if (arr.includes(clubId)) promotions++;
    for (const arr of Object.values(a.relegated)) if (arr.includes(clubId)) relegations++;
  }
  const u = userPlayer(state);
  let apps = 0;
  let goals = 0;
  let assists = 0;
  let years = 0;
  for (const h of u.history) if (h.clubId === clubId) {
    apps += h.stats.apps;
    goals += h.stats.goals;
    assists += h.stats.assists;
    years++;
  }
  if (u.clubId === clubId) {
    for (const k in u.season) {
      apps += u.season[k].apps;
      goals += u.season[k].goals;
      assists += u.season[k].assists;
    }
    years++;
  }
  const records: { label: string; value: string }[] = [];
  const bestGoals = [...finishes].sort((a, b) => b.goals - a.goals)[0];
  if (bestGoals) records.push({ label: "Most league goals in a season", value: `${bestGoals.goals} (${bestGoals.season}/${String((bestGoals.season + 1) % 100).padStart(2, "0")})` });
  const topScorer = state.archive.flatMap((a) => Object.values(a.topScorers).filter((t) => t.clubId === clubId).map((t) => ({ ...t, season: a.season }))).sort((a, b) => b.goals - a.goals)[0];
  if (topScorer) records.push({ label: "Best league top scorer", value: `${topScorer.name}, ${topScorer.goals} goals` });
  return {
    real: {
      span: seasons.length ? `${seasons[0]} – ${seasons[seasons.length - 1]}` : "",
      seasons: seasons.length,
      titles,
      bestPos: sorted.length ? Math.min(...sorted.map((r) => r.pos)) : null,
      lastPos: sorted.length ? sorted[sorted.length - 1].pos : null,
      lastSeason: sorted.length ? sorted[sorted.length - 1].season : null,
    },
    simulated: { leagueTitles, cups, continental, bestPos: best, promotions, relegations, seasons: state.archive.length },
    rivals: rivalsOf(state, clubId, 4),
    user: { apps, goals, assists, trophies: state.user.trophies.filter((t) => t.clubId === clubId).length, seasons: years, memories: state.user.memories.filter((m) => m.clubId === clubId).length },
    records,
  };
}

/** The club's cup and continental runs this season, for the context card. */
export function competitionRuns(state: GameState, clubId: string): { name: string; journey: Journey }[] {
  return Object.values(state.competitions)
    .filter((c) => c.season === state.season && (c.kind === "cup" || c.kind === "continental") && (c.teams.includes(clubId) || c.byes?.includes(clubId)))
    .map((c) => ({ name: c.name, journey: journeyOf(c, clubId) }))
    .filter((r) => r.journey.entered);
}

// ---------------------------------------------------------------------------------------------------- relationships

export interface RelInsight {
  key: "manager" | "teammates" | "supporters" | "board";
  value: number;
  headline: string;
  /** What this does in the game, in plain words. */
  consequences: string[];
  /** Things that actually moved it lately. */
  reasons: { delta: number; cause: string }[];
}

const standingWord = (v: number) => (v >= 80 ? "Excellent" : v >= 65 ? "Good" : v >= 45 ? "Neutral" : v >= 30 ? "Strained" : "Poor");

export function relationshipInsights(state: GameState): RelInsight[] {
  const u = userPlayer(state);
  const club = u.clubId ? state.clubs[u.clubId] : null;
  const r = state.user.relationships;
  const diffBias = state.settings.difficulty === "relaxed" ? 2 : state.settings.difficulty === "hardcore" ? -1.5 : 0;
  const bias = (r.manager - 50) / 12 + diffBias;
  const fit = club ? userTacticalFit(state, club) : null;
  const years = u.clubId ? u.history.filter((h) => h.clubId === u.clubId).length + 1 : 0;
  const objectives = state.user.objectives;
  const out: RelInsight[] = [];
  out.push({
    key: "manager",
    value: r.manager,
    headline: `${standingWord(r.manager)} trust${club ? ` with ${club.manager.name}` : ""}`,
    consequences: [
      `Selection: trust shifts your selection score by ${bias >= 0 ? "+" : ""}${bias.toFixed(1)} against teammates for the same place.`,
      ...(fit ? [`Tactical fit: ${fit.label} (${fit.score}/100). ${fit.note}`] : []),
      ...(r.manager < 25 ? ["At this level the relationship pushes you towards leaving."] : []),
    ],
    reasons: relReasons(state, "manager").map(({ delta, cause }) => ({ delta, cause })),
  });
  out.push({
    key: "teammates",
    value: r.teammates,
    headline: `${standingWord(r.teammates)} standing in the dressing room${club?.captain === u.id ? " · captain" : ""}`,
    consequences: [
      r.teammates < 70 ? "Poor dressing-room standing can lead to training-ground arguments." : "A settled dressing room makes you a candidate for the armband.",
      ...(club?.captain && club.captain !== u.id && state.players[club.captain] ? [`Captain: ${state.players[club.captain].lastName}.`] : []),
    ],
    reasons: relReasons(state, "teammates").map(({ delta, cause }) => ({ delta, cause })),
  });
  out.push({
    key: "supporters",
    value: r.supporters,
    headline: `${standingWord(r.supporters)} standing with the supporters`,
    consequences: [
      "Goals and big displays raise it; a transfer request lowers it.",
      years >= 5 && r.supporters >= 70 ? `${years} years and a loyal following make leaving harder for you.` : years >= 5 ? `${years} years here, but the supporters need to be behind you for loyalty to count.` : `${years} season${years === 1 ? "" : "s"} at the club so far.`,
    ],
    reasons: relReasons(state, "supporters").map(({ delta, cause }) => ({ delta, cause })),
  });
  out.push({
    key: "board",
    value: r.board,
    headline: `${standingWord(r.board)} confidence from the board`,
    consequences: [
      "A transfer request costs board confidence; accepting a new contract earns it back; turning one down costs a little.",
      objectives ? `The board is judging the club on ${objectives.items.length} ambition${objectives.items.length === 1 ? "" : "s"} this season (see Season ambitions).` : "No season ambitions are set yet.",
      ...(r.board < 20 ? ["The board has lost faith: it pushes you towards leaving."] : []),
    ],
    reasons: relReasons(state, "board").map(({ delta, cause }) => ({ delta, cause })),
  });
  return out;
}

export { adjustRel, clubName, formatMoney, positionGroup, standingOf };
