import type { RngState } from "./rng";

export type PlayerId = string;
export type ClubId = string;
export type CountryCode = string;
export type CompetitionId = string;

export const POSITIONS = ["GK", "RB", "CB", "LB", "DM", "CM", "AM", "RW", "LW", "ST"] as const;
export type Position = (typeof POSITIONS)[number];
export type PositionGroup = "GK" | "DEF" | "MID" | "ATT";

export const OUTFIELD_ATTRS = [
  "pace", "acceleration", "stamina", "strength", "finishing", "longShots", "passing", "vision",
  "crossing", "dribbling", "firstTouch", "tackling", "positioning", "heading", "composure",
] as const;
export const GK_ATTRS = ["reflexes", "handling", "diving", "kicking", "command"] as const;
export const ALL_ATTRS = [...OUTFIELD_ATTRS, ...GK_ATTRS] as const;
export type AttrKey = (typeof ALL_ATTRS)[number];
export type Attributes = Record<AttrKey, number>;

export interface Hidden {
  /** Ceiling for the position overall (40-99). */
  potential: number;
  consistency: number; // 1-100
  professionalism: number;
  ambition: number;
  loyalty: number;
  injuryProneness: number;
  adaptability: number;
  bigMatch: number;
  /** Multiplier on growth speed, ~0.7-1.3 */
  developmentRate: number;
  /** Age at which decline begins for this player (position-adjusted). */
  peakAge: number;
}

export type SquadRole = "star" | "first" | "rotation" | "backup" | "prospect";

export interface Contract {
  clubId: ClubId;
  /** Weekly wage in euros. */
  wage: number;
  /** Contract runs until the end of this season (season start year). */
  expires: number;
  signed: number;
  role: SquadRole;
  releaseClause?: number;
  goalBonus?: number;
  appearanceBonus?: number;
  youth?: boolean;
}

export interface Loan {
  fromClubId: ClubId;
  untilSeason: number;
}

export type InjurySeverity = "knock" | "minor" | "moderate" | "serious" | "severe";
export interface Injury {
  type: string;
  severity: InjurySeverity;
  weeksLeft: number;
  totalWeeks: number;
  /** Body area id used for recurrence. */
  area: string;
}

export interface StatLine {
  apps: number;
  starts: number;
  minutes: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  conceded: number;
  yellow: number;
  red: number;
  ratingSum: number;
  motm: number;
  shots: number;
  shotsOnTarget: number;
  keyPasses: number;
  tackles: number;
  saves: number;
}

export interface SeasonRecord {
  season: number;
  clubId: ClubId | null;
  leagueId?: string;
  age: number;
  overall: number;
  stats: StatLine;
  intl?: { caps: number; goals: number };
  /** Optional per-competition breakdown (kept for the user only). */
  byCompetition?: Record<CompetitionId, StatLine>;
}

export interface Appearance {
  skin: number; // 0-5
  hair: number; // style 0-7
  hairColor: number; // 0-5
  facial: number; // 0-3
  eyes: number; // 0-2
}

export interface Player {
  id: PlayerId;
  firstName: string;
  lastName: string;
  nationality: CountryCode;
  /** Second eligible nationality (e.g. birth country) until a competitive cap ties the player. */
  altNationality?: CountryCode;
  birthYear: number;
  position: Position;
  secondary: Position[];
  foot: "L" | "R" | "B";
  height: number;
  attrs: Attributes;
  hidden: Hidden;
  clubId: ClubId | null;
  contract: Contract | null;
  loan?: Loan;
  fitness: number; // 0-100 match fitness
  morale: number; // 0-100
  form: number; // EMA of match ratings (≈6.6 neutral)
  sharpness: number; // 0-100
  injury: Injury | null;
  injuries: number;
  suspension: number; // matches remaining
  yellowAccum: number;
  reputation: number; // domestic 0-100
  intlReputation: number; // 0-100
  value: number;
  season: Record<CompetitionId, StatLine>;
  career: StatLine;
  history: SeasonRecord[];
  intl: { caps: number; goals: number; tiedTo?: CountryCode; retired: boolean; debutSeason?: number };
  look: Appearance;
  /** Players outside the simulated club pyramid (national-team depth pool). */
  virtual?: boolean;
  isUser?: boolean;
  retired?: boolean;
  trophies: number;
  /** Rolling month aggregate for Player of the Month. */
  month: { apps: number; ratingSum: number; goals: number; assists: number };
  /** Wants a move (unhappy NPC) */
  listed?: boolean;
}

export type FormationId = "4-3-3" | "4-4-2" | "4-2-3-1" | "3-5-2" | "5-3-2" | "4-1-4-1";

export interface ClubState {
  id: ClubId;
  leagueId: string;
  reputation: number; // dynamic prestige 1-100
  balance: number; // euros
  formation: FormationId;
  style: { pressing: number; tempo: number; directness: number }; // 0-1
  manager: { name: string; quality: number; since: number; nationality: CountryCode };
  youth: number; // academy quality 1-100
  facilities: number; // training facilities 1-100
  squad: PlayerId[];
  captain?: PlayerId;
  form: ("W" | "D" | "L")[];
  /** Season objective rank (expected finish). */
  expectation?: number;
}

export interface MatchGoal {
  minute: number;
  side: "home" | "away";
  scorer: PlayerId;
  assist?: PlayerId;
  penalty?: boolean;
  ownGoal?: boolean;
}

export interface FixtureResult {
  hg: number;
  ag: number;
  et?: boolean;
  pens?: [number, number];
  goals: MatchGoal[];
  motm?: PlayerId;
  attendance?: number;
  /** Detailed stats kept only for matches involving the user. */
  detail?: MatchDetailSummary;
}

export interface MatchDetailSummary {
  possession: [number, number];
  shots: [number, number];
  onTarget: [number, number];
  corners: [number, number];
  fouls: [number, number];
  yellows: [number, number];
  reds: [number, number];
  xg: [number, number];
  ratings: Record<PlayerId, number>;
}

export interface Fixture {
  id: string;
  compId: CompetitionId;
  round: number;
  turn: number;
  home: string; // ClubId or CountryCode for internationals
  away: string;
  stage?: string;
  group?: number;
  leg?: 1 | 2;
  neutral?: boolean;
  result?: FixtureResult;
}

export interface TableRow {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  points: number;
  form: ("W" | "D" | "L")[];
}

export type CompetitionKind = "league" | "cup" | "continental" | "international" | "friendly";

export interface Competition {
  id: CompetitionId;
  kind: CompetitionKind;
  name: string;
  shortName: string;
  season: number;
  countryCode?: CountryCode;
  tier?: number;
  teams: string[];
  fixtures: Fixture[];
  table?: TableRow[];
  groups?: { name: string; teams: string[]; table: TableRow[] }[];
  /** For knockout comps: teams still alive. */
  alive?: string[];
  /** Teams that skip the first knockout round. */
  byes?: string[];
  winner?: string;
  runnerUp?: string;
  /** Prestige weight used by legacy/awards (1-10). */
  prestige: number;
  complete: boolean;
  trophyAwarded?: boolean;
}

export interface NationalTeamState {
  code: CountryCode;
  strength: number;
  squad: PlayerId[];
  manager: string;
  /** Last results */
  form: ("W" | "D" | "L")[];
  titles: { season: number; compId: string; name: string }[];
}

export type NewsKind = "match" | "transfer" | "award" | "injury" | "contract" | "national" | "club" | "career" | "event" | "world";
export interface NewsItem {
  id: string;
  season: number;
  turn: number;
  kind: NewsKind;
  title: string;
  body?: string;
  important?: boolean;
}

export type TimelineKind =
  | "start" | "debut" | "first-goal" | "milestone" | "transfer" | "loan" | "contract" | "trophy" | "award"
  | "international" | "injury" | "breakthrough" | "record" | "retirement" | "event" | "promotion" | "relegation";
export interface TimelineEvent {
  season: number;
  turn: number;
  kind: TimelineKind;
  title: string;
  detail?: string;
}

export interface AwardRecord {
  season: number;
  id: string;
  name: string;
  scope: string; // league / world / club
  playerId: PlayerId;
  clubId?: ClubId | null;
  value?: string;
}

export interface TrophyRecord {
  season: number;
  compId: string;
  name: string;
  kind: CompetitionKind;
  clubId?: ClubId;
  country?: CountryCode;
}

export type OfferStatus =
  | "club-pending" // waiting for selling club response
  | "club-rejected"
  | "terms" // club agreed, player to negotiate personal terms
  | "accepted"
  | "rejected"
  | "expired"
  | "withdrawn";

export interface ContractTerms {
  wage: number;
  years: number;
  role: SquadRole;
  releaseClause?: number;
  signingBonus: number;
  goalBonus: number;
}

export interface TransferOffer {
  id: string;
  kind: "transfer" | "loan" | "free" | "renewal";
  fromClubId: ClubId; // club making the offer (for renewal: own club)
  toPlayerClubId: ClubId | null; // current club
  fee: number;
  terms: ContractTerms;
  /** Max the club is willing to concede during negotiation. */
  maxWage: number;
  patience: number; // negotiation rounds left
  status: OfferStatus;
  createdTurn: number;
  expiresTurn: number;
  season: number;
  note?: string;
  history: string[];
}

export interface CareerDecision {
  id: string;
  kind: "event";
  title: string;
  body: string;
  options: { id: string; label: string; hint?: string }[];
  expiresTurn: number;
  season: number;
  eventId: string;
  /** default option chosen if it expires */
  fallback: string;
}

export interface Relationships {
  manager: number; // 0-100
  teammates: number;
  supporters: number;
  board: number;
  agent: number;
}

export interface TrainingPlan {
  focus: TrainingFocus;
  intensity: "light" | "normal" | "intense";
}
export type TrainingFocus =
  | "balanced" | "finishing" | "passing" | "dribbling" | "pace" | "physical" | "defending" | "setPieces" | "goalkeeping" | "recovery";

export interface CareerPriorities {
  money: number; // 0-2 importance
  playingTime: number;
  ambition: number;
  loyalty: number;
}

export interface ActiveBoost {
  id: string;
  kind: "training" | "recovery" | "morale";
  amount: number;
  untilTurnIndex: number; // absolute turn index
  source: "reward" | "event";
}

export interface UserCareer {
  playerId: PlayerId;
  startSeason: number;
  startAge: number;
  startClubId: ClubId;
  startTier: number;
  agent: { name: string; quality: number };
  relationships: Relationships;
  priorities: CareerPriorities;
  training: TrainingPlan;
  timeline: TimelineEvent[];
  offers: TransferOffer[];
  decisions: CareerDecision[];
  awards: AwardRecord[];
  trophies: TrophyRecord[];
  transfers: { season: number; turn: number; from: ClubId | null; to: ClubId; fee: number; kind: TransferOffer["kind"] }[];
  earnings: number;
  peakOverall: number;
  peakSeason: number;
  transferRequest: boolean;
  wantsLoan: boolean;
  lastMatchTurn?: number;
  eventCooldowns: Record<string, number>;
  boosts: ActiveBoost[];
  milestones: string[];
  retired: boolean;
  retiredSeason?: number;
  legacy?: LegacyResult;
  /** Recent match ratings for UI sparkline */
  recentRatings: { season: number; turn: number; rating: number; compId: string; opponent: string; goals: number; assists: number }[];
  injuryHistory: { season: number; type: string; weeks: number }[];
  lastAdTurnIndex?: number;
  /** Growth multipliers from the last few training weeks (feeds monthly development). */
  trainingHistory: number[];
  /** Development-squad (U21) games when not picked for the first team. */
  reserves?: { season: number; apps: number; goals: number; assists: number; ratingSum: number };
  lastTraining?: { note: string; injured?: string };
  /** Consecutive season rollovers spent without a club. */
  freeSeasons?: number;
  rewardCooldowns: Record<string, number>;
}

export interface LegacyResult {
  score: number;
  tier: string;
  breakdown: { label: string; points: number }[];
  stories: string[];
  headline: string;
}

export interface SeasonArchive {
  season: number;
  champions: Record<CompetitionId, { name: string; winner: string; runnerUp?: string }>;
  topScorers: Record<CompetitionId, { playerId: PlayerId; name: string; clubId: ClubId | null; goals: number }>;
  awards: AwardRecord[];
  tables: Record<CompetitionId, TableRow[]>;
  promoted: Record<CompetitionId, string[]>;
  relegated: Record<CompetitionId, string[]>;
}

export interface WorldRecord {
  id: string;
  label: string;
  value: number;
  playerId: PlayerId;
  name: string;
  season?: number;
}

export interface PendingMatch {
  fixtureId: string;
  compId: CompetitionId;
}

export interface GameState {
  schemaVersion: number;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  seed: string;
  rng: RngState;
  datasetVersion: string;
  season: number;
  turn: number;
  /** Absolute turn counter since career start. */
  turnIndex: number;
  idCounter: number;
  clubs: Record<ClubId, ClubState>;
  players: Record<PlayerId, Player>;
  competitions: Record<CompetitionId, Competition>;
  /** Mapping league id -> club ids for the current season (changes with promotion). */
  leagueClubs: Record<string, ClubId[]>;
  nationalTeams: Record<CountryCode, NationalTeamState>;
  user: UserCareer;
  news: NewsItem[];
  archive: SeasonArchive[];
  records: WorldRecord[];
  /** Hall of fame of retired notable NPCs (name + totals) to keep records after removal. */
  legends: { id: PlayerId; name: string; nationality: CountryCode; goals: number; apps: number; caps: number; peak: number; retiredSeason: number }[];
  transferLog: { season: number; turn: number; playerId: PlayerId; name: string; from: ClubId | null; to: ClubId; fee: number }[];
  settings: { difficulty: "relaxed" | "standard" | "hardcore"; autoSave: boolean; countries?: string[] };
  /** Match the user must play this turn before the world advances. */
  pending: PendingMatch[];
  /** Promotion/relegation decided at season end, applied at rollover. */
  pendingMoves?: { clubId: string; to: string }[];
  lastTurnSummary?: TurnSummary;
}

export interface TurnSummary {
  season: number;
  turn: number;
  userMatches: { fixtureId: string; compId: string; rating?: number; goals: number; assists: number; result: string }[];
  headlines: string[];
}
