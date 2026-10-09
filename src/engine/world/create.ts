import { BALANCE } from "../balance";
import { agentMarket, NO_AGENT } from "../career/agents";
import { initialTraits } from "../traits/assign";
import { careerProfile } from "../traits/effects";
import { setupSeason } from "../competitions/setup";
import { WORLD, country, leaguesInPlay, stadium, staticClub, staticLeague } from "../data/world";
import type { StaticManager } from "../data/schema";
import { bestFormation } from "../match/lineup";
import { overallFor } from "../players/attributes";
import { clubRevenue, marketValue, wageFor } from "../players/economy";
import { emptyStat, generatePlayer, randomHidden, randomName } from "../players/generate";
import { jerseyOf, recordNumber, repairAllSquads } from "../jersey/numbers";
import { managerPool } from "./managers";
import { ensureManagerIds } from "../managers/registry";
import { openStint } from "../managers/history";
import { clamp, Rng } from "../rng";
import type {
  Appearance, ClubState, CountryCode, FormationId, GameState, NationalTeamState, Player, Position, SquadRole,
} from "../types";
import { SCHEMA_VERSION, addTimeline, nextId } from "./helpers";
import { generateAttributes } from "../players/attributes";
import { initialWeakFoot } from "../players/foot";
import { NO_FOCUS, isValidFocus, leanAttributes } from "../players/focus";

export const START_SEASON = 2026;

/** Average first-XI overall a club of this prestige fields (Pitchborn scale). */
export function clubLevel(prestige: number): number {
  // Elite ≈85–87, bottom of a top flight ≈75, second tier ≈70–76, third tier ≈65–71.
  return 54.6 + prestige * 0.316;
}

/** Starting overall for a new career depends only on the path, never on the club. */
export const STARTING_OVERALL = { academy: 61, late: 67 } as const;

const SQUAD_TEMPLATE: Position[] = [
  "GK", "GK", "GK", "CB", "CB", "CB", "CB", "RB", "RB", "LB", "LB", "DM", "DM", "CM", "CM", "CM", "AM", "AM", "RW", "RW", "LW", "LW", "ST", "ST", "ST",
];

/** Where foreign players in the simulated leagues come from (relative weights). */
const EXPORT_WEIGHTS: Record<string, number> = {
  FRA: 9, BRA: 8, ESP: 6, POR: 6, ARG: 6, NED: 5, BEL: 4, GER: 4, ENG: 3, ITA: 3, SEN: 4, CIV: 3, NGA: 3, MAR: 4, CRO: 3, SRB: 2,
  DEN: 3, SWE: 2, NOR: 2, POL: 2, SUI: 2, AUT: 2, URU: 3, COL: 3, USA: 2, CAN: 1, MEX: 1, JPN: 2, KOR: 1, GHA: 2, CMR: 2, ALG: 2,
  EGY: 1, TUR: 2, UKR: 2, CZE: 1, SCO: 2, WAL: 1, IRL: 2, NIR: 1, AUS: 1,
};

function pickNationality(rng: Rng, home: CountryCode, tier: number): CountryCode {
  const domestic = tier === 1 ? (home === "ENG" ? 0.38 : 0.55) : tier === 2 ? 0.7 : 0.85;
  if (rng.chance(domestic)) return home;
  const entries = Object.entries(EXPORT_WEIGHTS).filter(([c]) => c !== home);
  return rng.weighted(entries, ([, w]) => w)[0];
}

function ageFor(rng: Rng, role: SquadRole): number {
  if (role === "prospect") return rng.int(17, 20);
  return Math.round(clamp(rng.normal(26.5, 3.6), 19, 36));
}

export function managerName(rng: Rng, nat: CountryCode): string {
  const n = randomName(rng, nat);
  return `${n.firstName} ${n.lastName}`;
}

function contractFor(rng: Rng, p: Player, club: ClubState, season: number, role: SquadRole) {
  const ovr = overallFor(p.attrs, p.position);
  return {
    clubId: club.id,
    wage: wageFor(ovr, club.reputation, role),
    expires: season + rng.int(role === "prospect" ? 1 : 0, role === "prospect" ? 3 : 4),
    signed: season - rng.int(0, 3),
    role,
    releaseClause: staticClub(club.id)?.countryCode === "ESP" ? Math.round(marketValue(p, season) * rng.range(2.5, 5) / 1e6) * 1e6 : undefined,
  };
}

/** Assign squad roles by quality rank. */
export function assignRoles(squad: Player[]): void {
  const sorted = [...squad].sort((a, b) => overallFor(b.attrs, b.position) - overallFor(a.attrs, a.position));
  sorted.forEach((p, i) => {
    if (!p.contract) return;
    if (p.contract.role === "prospect" && i > 11) return;
    p.contract.role = i < 3 ? "star" : i < 12 ? "first" : i < 18 ? "rotation" : "backup";
  });
}

export function generateSquad(state: GameState, rng: Rng, club: ClubState, season: number): Player[] {
  const st = staticClub(club.id);
  const league = staticLeague(club.leagueId);
  const level = clubLevel(club.reputation);
  const players: Player[] = [];
  SQUAD_TEMPLATE.forEach((position, i) => {
    // Indices: per position the first slot is a starter, later ones backups; last 4 squad spots skew young.
    const isProspect = i % 6 === 5;
    const role: SquadRole = isProspect ? "prospect" : "first";
    const age = ageFor(rng, role);
    const starterBoost = SQUAD_TEMPLATE.indexOf(position) === i ? 2.5 : -2;
    const ageAdj = age < 21 ? -(21 - age) * 2.6 : age > 31 ? -(age - 31) * 0.8 : 0;
    const ovr = clamp(level + starterBoost + ageAdj + rng.normal(0, 3), 35, 92);
    const potGap = age < 24 ? Math.max(0, rng.normal(10 + (24 - age) * 2.2, 5)) : age < 28 ? Math.max(0, rng.normal(2, 2)) : 0;
    const p = generatePlayer(rng, {
      id: nextId(state, "p"),
      nationality: pickNationality(rng, st?.countryCode ?? "ENG", league?.tier ?? 1),
      position,
      age,
      season,
      overall: ovr,
      potential: ovr + potGap,
      clubId: club.id,
    });
    p.contract = contractFor(rng, p, club, season, role);
    p.value = marketValue(p, season);
    players.push(p);
  });
  assignRoles(players);
  return players;
}

/** Real head coach at snapshot time when known; otherwise a generated one. Successors are always generated. */
function startingManager(real: StaticManager | undefined, generatedName: string, generatedNat: CountryCode, quality: number, generatedSince: number, season: number): ClubState["manager"] {
  if (!real) return { name: generatedName, quality, since: generatedSince, nationality: generatedNat };
  return { name: real.name, quality, since: Math.min(season, real.since ?? season), nationality: real.nationality ?? "", born: real.born };
}

function createClubState(rng: Rng, id: string, season: number): ClubState {
  const st = staticClub(id);
  if (!st) throw new Error(`unknown club ${id}`);
  const tier = staticLeague(st.leagueId)?.tier ?? 1;
  const cap = stadium(st.stadiumId)?.capacity ?? 15000;
  const mgrNat = rng.chance(0.65) ? st.countryCode : rng.pick(["ESP", "POR", "ITA", "GER", "FRA", "NED", "ARG", "ENG"]);
  return {
    id,
    leagueId: st.leagueId,
    reputation: st.prestige,
    balance: Math.round(clubRevenue(st.prestige, tier, cap) * rng.range(0.15, 0.45)),
    formation: "4-3-3",
    style: { pressing: rng.next(), tempo: rng.next(), directness: rng.next() },
    manager: startingManager(st.manager, managerName(rng, mgrNat), mgrNat, Math.round(clamp(st.prestige * 0.7 + rng.normal(20, 8), 20, 99)), season - rng.int(0, 4), season),
    youth: Math.round(clamp(st.prestige * 0.8 + rng.normal(10, 12), 10, 99)),
    facilities: Math.round(clamp(st.prestige * 0.9 + rng.normal(5, 8), 10, 99)),
    squad: [],
    form: [],
  };
}

/** Depth pool for nations whose players mostly play outside the simulated leagues. */
export function generateVirtualPool(state: GameState, rng: Rng, code: CountryCode, season: number, count: number): Player[] {
  const c = country(code);
  if (!c) return [];
  const base = c.strength - 3;
  const out: Player[] = [];
  const positions: Position[] = ["GK", "GK", "CB", "CB", "CB", "RB", "LB", "DM", "CM", "CM", "AM", "RW", "LW", "ST", "ST", "CM", "CB", "ST", "RW", "LB", "DM", "AM", "GK", "RB", "LW", "CM"];
  for (let i = 0; i < count; i++) {
    const age = Math.round(clamp(rng.normal(27, 3.5), 19, 34));
    const ovr = clamp(base - i * 0.35 + rng.normal(0, 3), 45, 90);
    const p = generatePlayer(rng, {
      id: nextId(state, "v"), nationality: code, position: positions[i % positions.length], age, season, overall: ovr, potential: ovr + (age < 24 ? rng.int(2, 8) : 0), clubId: null, virtual: true,
    });
    p.intl.tiedTo = code;
    out.push(p);
  }
  return out;
}

/** Expected starting overall for a new career (path only — fair regardless of club). */
export function expectedStartingOverall(_prestige: number, path: StartPath, custom?: CustomStart): number {
  return path === "custom" && custom ? custom.overall : STARTING_OVERALL[path === "custom" ? "late" : path];
}

export type PlayingTimeOutlook = "good" | "fight" | "few";

/** How likely early first-team minutes are, from the gap to the squad's level. */
export function playingTimeOutlook(prestige: number, path: StartPath, custom?: CustomStart): { outlook: PlayingTimeOutlook; level: number; start: number } {
  const level = clubLevel(prestige);
  const start = expectedStartingOverall(prestige, path, custom);
  const gap = level - start;
  return { outlook: gap <= 9 ? "good" : gap <= 15 ? "fight" : "few", level: Math.round(level), start: Math.round(start) };
}

export type StartPath = "academy" | "late" | "custom";

/** Fully player-chosen starting point. */
export interface CustomStart {
  age: number;
  overall: number;
  potential: number;
}

export const CUSTOM_LIMITS = { age: [16, 36], overall: [40, 92], potential: [40, 99] } as const;

export function sanitizeCustom(c: CustomStart): CustomStart {
  const age = Math.round(clamp(c.age, CUSTOM_LIMITS.age[0], CUSTOM_LIMITS.age[1]));
  const overall = Math.round(clamp(c.overall, CUSTOM_LIMITS.overall[0], CUSTOM_LIMITS.overall[1]));
  return { age, overall, potential: Math.round(clamp(c.potential, overall, CUSTOM_LIMITS.potential[1])) };
}

interface StartProfile {
  age: number;
  overall: number;
  potential: number | null;
  reputation: number;
  youth: boolean;
  contractYears: number;
}

function startProfile(input: NewCareerInput): StartProfile {
  if (input.path === "custom" && input.custom) {
    const c = sanitizeCustom(input.custom);
    return { age: c.age, overall: c.overall, potential: c.potential, reputation: clamp((c.overall - 55) * 2, 5, 90), youth: c.age <= 18, contractYears: c.age <= 21 ? 2 : 3 };
  }
  const academy = input.path === "academy";
  return { age: academy ? 17 : 20, overall: STARTING_OVERALL[academy ? "academy" : "late"], potential: null, reputation: academy ? 8 : 15, youth: academy, contractYears: 2 };
}

export interface NewCareerInput {
  saveName: string;
  firstName: string;
  lastName: string;
  nationality: CountryCode;
  birthCountry: CountryCode;
  position: Position;
  foot: "L" | "R";
  height: number;
  look: Appearance;
  clubId: string;
  path: StartPath;
  /** Used when path is "custom". */
  custom?: CustomStart;
  seed?: string;
  difficulty?: GameState["settings"]["difficulty"];
  /** Restrict the simulated world (stress tests). */
  countries?: string[];
  priorities?: GameState["user"]["priorities"];
  /** Development focus: the kind of player to grow into (an id from players/focus.ts for the chosen position). Absent or invalid means no preference. */
  focus?: string;
}

export function createUserPlayer(state: GameState, rng: Rng, input: NewCareerInput): Player {
  const season = state.season;
  const club = state.clubs[input.clubId];
  const start = startProfile(input);
  const age = start.age;
  const level = clubLevel(club.reputation);
  // Starting ability: academy kids are raw; late starters are closer to the senior squad.
  const startOvr = start.potential === null ? clamp(start.overall + rng.normal(0, 1.2), 56, 72) : start.overall;
  void level;
  const diff = input.difficulty ?? "standard";
  const potBase = input.path === "academy" ? 89 : 85;
  const potential = start.potential ?? clamp(potBase + rng.normal(0, 4) + (diff === "relaxed" ? 2 : diff === "hardcore" ? -2 : 0), 76, 97);
  const attrs = generateAttributes(rng, input.position, startOvr, input.height);
  // An aspiration leans the starting attributes (same total quality); an unknown or wrong-position id is simply no preference.
  const focus = isValidFocus(input.position, input.focus) ? input.focus : NO_FOCUS;
  leanAttributes(attrs, input.position, focus);
  const hidden = randomHidden(rng, input.position, potential);
  hidden.professionalism = Math.max(hidden.professionalism, 55);
  hidden.injuryProneness = Math.min(hidden.injuryProneness, 55);
  const id = nextId(state, "u");
  const p: Player = {
    id,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    nationality: input.nationality,
    altNationality: input.birthCountry !== input.nationality ? input.birthCountry : undefined,
    birthYear: season - age,
    position: input.position,
    secondary: [],
    foot: input.foot === "L" ? "L" : "R",
    weakFoot: initialWeakFoot(id, attrs, age),
    height: input.height,
    attrs,
    hidden,
    clubId: club.id,
    contract: null,
    fitness: 100,
    morale: 75,
    form: 6.6,
    sharpness: 60,
    injury: null,
    injuries: 0,
    suspension: 0,
    yellowAccum: 0,
    reputation: start.reputation,
    intlReputation: 3,
    value: 0,
    season: {},
    career: emptyStat(),
    history: [],
    intl: { caps: 0, goals: 0, retired: false },
    look: input.look,
    isUser: true,
    focus,
    trophies: 0,
    month: { apps: 0, ratingSum: 0, goals: 0, assists: 0 },
  };
  const ovr = overallFor(attrs, input.position);
  p.contract = {
    clubId: club.id,
    wage: wageFor(ovr, club.reputation, "prospect"),
    expires: season + start.contractYears,
    signed: season,
    role: "prospect",
    youth: start.youth,
  };
  p.value = marketValue(p, season);
  // The user's playing style has to be earned on the pitch; only temperament is there from the start.
  p.traits = initialTraits(p, season, { tier: "user" });
  return p;
}

export function createWorld(input: NewCareerInput): GameState {
  const seed = input.seed ?? `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  const rng = Rng.fromSeed(seed);
  const now = new Date().toISOString();
  const season = START_SEASON;
  const state: GameState = {
    schemaVersion: SCHEMA_VERSION,
    id: `save-${seed}`.replace(/[^a-z0-9-]/gi, "").slice(0, 40),
    name: input.saveName || `${input.firstName} ${input.lastName}`,
    createdAt: now,
    updatedAt: now,
    seed,
    rng: rng.state(),
    datasetVersion: WORLD.version,
    season,
    turn: 1,
    turnIndex: 0,
    idCounter: 0,
    clubs: {},
    players: {},
    competitions: {},
    leagueClubs: {},
    nationalTeams: {},
    user: {
      playerId: "",
      startSeason: season,
      startAge: startProfile(input).age,
      startClubId: input.clubId,
      startTier: staticLeague(staticClub(input.clubId)?.leagueId ?? "")?.tier ?? 1,
      agent: NO_AGENT,
      memories: [],
      traitLog: [],
      bank: BALANCE.agents.startingBank,
      relationships: { manager: 55, teammates: 55, supporters: 50, board: 50, agent: 60 },
      priorities: input.priorities ?? { money: 1, playingTime: 1, ambition: 1, loyalty: 1 },
      training: { focus: "balanced", intensity: "normal" },
      timeline: [],
      offers: [],
      sagas: [],
      rivalry: { rivals: [], candidates: {}, transferScan: 0, lastFormedIndex: -999 },
      decisions: [],
      awards: [],
      trophies: [],
      transfers: [],
      earnings: 0,
      peakOverall: 0,
      peakSeason: season,
      transferRequest: false,
      wantsLoan: false,
      eventCooldowns: {},
      boosts: [],
      milestones: [],
      retired: false,
      recentRatings: [],
      matchLog: [],
      reserveLog: [],
      relLog: [],
      pay: { career: {}, season: { season, amounts: {} }, paid: [] },
      intl: { history: [], cooldownUntil: 0 },
      injuryHistory: [],
      rewardCooldowns: {},
      trainingHistory: [],
    },
    news: [],
    archive: [],
    records: [],
    legends: [],
    transferLog: [],
    settings: { difficulty: input.difficulty ?? "standard", autoSave: true, countries: input.countries },
    pending: [],
  };

  // Everyone starts with the market's most modest agent; better ones cost more and must be hired.
  state.user.agent = { ...agentMarket(state)[0], skills: { ...agentMarket(state)[0].skills } };

  const leagueIds = new Set(leaguesInPlay(state).map((l) => l.id));
  for (const c of WORLD.clubs.filter((x) => leagueIds.has(x.leagueId))) {
    const club = createClubState(rng, c.id, season);
    state.clubs[c.id] = club;
    (state.leagueClubs[c.leagueId] ??= []).push(c.id);
  }
  for (const club of Object.values(state.clubs)) {
    const squad = generateSquad(state, rng, club, season);
    for (const p of squad) state.players[p.id] = p;
    club.squad = squad.map((p) => p.id);
    club.formation = bestFormation(squad) as FormationId;
    club.captain = [...squad].sort((a, b) => b.reputation + careerProfile(b).leader * 14 - b.birthYear * 0.5 - (a.reputation + careerProfile(a).leader * 14 - a.birthYear * 0.5))[0]?.id;
  }

  for (const c of WORLD.countries) {
    const generated = managerName(rng, c.code);
    const nt: NationalTeamState = { code: c.code, strength: c.strength, squad: [], manager: c.manager?.name ?? generated, form: [], titles: [] };
    state.nationalTeams[c.code] = nt;
    const pool = generateVirtualPool(state, rng, c.code, season, c.hasLeagues ? 8 : 24);
    for (const p of pool) state.players[p.id] = p;
  }

  const user = createUserPlayer(state, rng, input);
  state.players[user.id] = user;
  state.user.playerId = user.id;
  state.clubs[input.clubId].squad.push(user.id);
  state.user.peakOverall = overallFor(user.attrs, user.position);

  setupSeason(state, rng);
  managerPool(state);
  ensureManagerIds(state);
  openStint(state, input.clubId);
  repairAllSquads(state);
  recordNumber(state, input.clubId, user.squadNo as number);
  jerseyOf(state).choice = true;
  state.rng = rng.state();
  addTimeline(state, {
    kind: "start",
    title: startProfile(input).youth ? `Joined the ${staticClub(input.clubId)?.shortName} academy` : `Signed first professional deal with ${staticClub(input.clubId)?.shortName}`,
    detail: `Aged ${state.user.startAge}, ${country(input.nationality)?.name} · ${input.position}`,
  });
  void BALANCE;
  return state;
}
