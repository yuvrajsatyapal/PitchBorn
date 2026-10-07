import type { AppearanceKey } from "./appearance/options";
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

/** Registry id of a player trait (see engine/traits/registry.ts). */
export type TraitId = string;
export type TraitStage = "emerging" | "established" | "signature";

/** A trait a player currently has. `xp` is internal progress; the stage is derived from it. */
export interface OwnedTrait {
  id: TraitId;
  xp: number;
  /** Season in which the trait was acquired. */
  since: number;
}

export interface TraitEvent {
  season: number;
  turn: number;
  id: TraitId;
  kind: "gained" | "upgraded" | "weakened" | "lost" | "evolved";
  stage?: TraitStage;
  /** For evolutions: the trait it grew out of. */
  from?: TraitId;
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

/**
 * A player's face. Every field is a small integer so it stores compactly and never changes by accident.
 * Identity (face, skin, eyes, nose, mouth, geometry) is fixed for life; hair, facial hair and ageing evolve on top.
 */
export type Appearance = Record<AppearanceKey, number> & { v: 2 };

/** The pre-portrait avatar, kept so old saves can be upgraded. */
export interface LegacyAppearance {
  skin: number;
  hair: number;
  hairColor: number;
  facial: number;
  eyes: number;
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
  /** How the player tends to play: playstyle, technical, mental, physical and personality traits. */
  traits?: OwnedTrait[];
  /** Behaviour evidence towards traits not yet owned (tracked for the user and players in the user's matches). */
  traitProgress?: Record<TraitId, number>;
}

export type FormationId = "4-3-3" | "4-4-2" | "4-2-3-1" | "3-5-2" | "5-3-2" | "4-1-4-1";

export interface ClubState {
  id: ClubId;
  leagueId: string;
  reputation: number; // dynamic prestige 1-100
  balance: number; // euros
  formation: FormationId;
  style: { pressing: number; tempo: number; directness: number }; // 0-1
  manager: { name: string; quality: number; since: number; nationality: CountryCode; born?: number };
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

export type NewsKind = "match" | "transfer" | "award" | "injury" | "contract" | "national" | "club" | "career" | "event" | "world" | "memory";
export interface NewsItem {
  id: string;
  season: number;
  turn: number;
  kind: NewsKind;
  title: string;
  body?: string;
  important?: boolean;
  /** For "memory" news: the memory being recalled. */
  memoryId?: string;
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

export type CeremonyStatus = "not-ready" | "ready" | "in-progress" | "completed";

/** One player's season in the numbers the ceremony shows (never the internal scoring). */
export interface AwardNominee {
  playerId: PlayerId;
  clubId: ClubId | null;
  position: Position;
  age: number;
  apps: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  saves: number;
  avgRating: number;
  /** A football reason for the nomination, e.g. "31 apps · 14 clean sheets · 7.4 avg rating". */
  reason: string;
}

export interface AwardResult {
  id: string;
  name: string;
  /** What kind of award: a pure statistic, a positional/special award, or a major judged one. */
  tier: "statistical" | "special" | "major";
  /** The competition it belongs to. The first ceremony covers the user's domestic league; the shape allows others. */
  scope: string;
  leagueId: string;
  compId: string;
  winnerId: PlayerId;
  /** Best first. The winner is `nominees[0]`; stored once and never recalculated. */
  nominees: AwardNominee[];
  /** How close the winner was to the runner-up: 1 = a whisker, 3 = close, 9 = clear. */
  margin: number;
  /** How a tie in a statistical award was settled, if there was one. */
  tiebreak?: string;
}

export interface TeamOfSeasonSlot {
  slot: string;
  label: string;
  playerId: PlayerId;
  clubId: ClubId | null;
  position: Position;
  reason: string;
}

/** The end-of-season awards: calculated once from final results, presented by the ceremony, applied once. */
export interface SeasonCeremony {
  season: number;
  leagueId: string;
  leagueName: string;
  status: CeremonyStatus;
  /** How far through the scenes the player has got, so a reload resumes in place. */
  step: number;
  results: AwardResult[];
  team: TeamOfSeasonSlot[];
  formation: string;
  /** Winners of the other leagues' awards: no ceremony for them, but their careers feel the same consequences. */
  others: { id: string; name: string; scope: string; leagueId: string; playerId: PlayerId }[];
  /** Career consequences (reputation, memories, history, rivalry, news) have been applied. */
  applied: boolean;
  /** Presentation only: how it was completed. Both give an identical world. */
  how?: "watched" | "skipped" | "auto";
  turnIndex: number;
}

export interface AwardNomination {
  season: number;
  id: string;
  name: string;
  scope: string;
  /** 2 = runner-up, 3 and 4 = nominee. */
  place: number;
}

export interface AwardRecord {
  season: number;
  id: string;
  name: string;
  scope: string; // league / world / club
  playerId: PlayerId;
  clubId?: ClubId | null;
  value?: string;
  /** Winner's age when awarded (for youngest/oldest winner records). */
  age?: number;
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
  /** Set when a transfer saga opened this offer; the saga, not the weekly offer logic, decides its fate. */
  sagaId?: string;
}

export type SagaStage =
  | "interest" | "scouting" | "agent-contact" | "enquiry" | "first-bid" | "bid-rejected" | "improved-bid" | "player-unsettled"
  | "manager-talk" | "contract-talks" | "transfer-request" | "competing-bid" | "deadline-pressure" | "agreement" | "medical"
  | "completed" | "failed";

export type SagaOutcome = "completed" | "rejected" | "withdrawn" | "negotiations-failed" | "player-declined" | "club-declined" | "window-closed" | "deadline-expired";

export interface SagaEntry {
  season: number;
  turn: number;
  stage: SagaStage;
  text: string;
}

export interface SagaFlags {
  unsettled?: boolean;
  managerTalked?: boolean;
  requested?: boolean;
  agentPushed?: boolean;
  waited?: boolean;
  committed?: boolean;
  deadline?: boolean;
  formerClub?: boolean;
}

/** A multi-week transfer story for the user's player. It sits above TransferOffer and ends through the normal offer flow. */
export interface TransferSaga {
  id: string;
  kind: "transfer" | "free";
  /** The club leading the pursuit (switches if the player prefers a rival). */
  clubId: ClubId;
  /** The player's club when the saga began. */
  fromClubId: ClubId | null;
  rivals: ClubId[];
  stage: SagaStage;
  outcome?: SagaOutcome;
  window: "summer" | "january" | "free";
  startSeason: number;
  startTurn: number;
  startIndex: number;
  /** Absolute turn index of the last week the player can still act. */
  deadlineIndex: number;
  /** Absolute turn index of the last step taken (a saga moves at most once a week, twice under deadline pressure). */
  lastStepIndex: number;
  endedIndex?: number;
  fee: number;
  draft: { terms: ContractTerms; maxWage: number };
  offerIds: string[];
  bids: number;
  rejections: number;
  /** How important the move was judged to be when it began (0-100), and why. */
  importance: number;
  reasons: string[];
  flags: SagaFlags;
  entries: SagaEntry[];
  decisionId?: string;
  /** Circumstances at the start, so a later saga with the same club needs a material change. */
  snapshot: { reputation: number; value: number; requested: boolean; yearsLeft: number };
}

export type RivalEventKind = "formed" | "meeting" | "race" | "award" | "transfer" | "intl" | "incident" | "media" | "record" | "cooled" | "ended";

export interface RivalMeeting {
  season: number;
  turn: number;
  fixtureId: string;
  compId: string;
  compName: string;
  stage?: string;
  intl: boolean;
  /** Team goals: yours, theirs. */
  score: [number, number];
  /** Goals scored by the two players themselves. */
  myGoals: number;
  theirGoals: number;
  result: "win" | "draw" | "loss";
  /** How much the meeting moved the rivalry. */
  weight: number;
  note?: string;
}

export interface RivalEvent {
  season: number;
  turn: number;
  kind: RivalEventKind;
  text: string;
}

/** Another player who has become a recurring character in the user's career. */
export interface PlayerRival {
  playerId: PlayerId;
  /** Kept so the story survives if the player is later removed from the world. */
  name: string;
  clubId?: ClubId | null;
  since: { season: number; turn: number };
  /** 0–100. Rises with meaningful moments, fades with distance and time. */
  intensity: number;
  peak: number;
  status: "active" | "dormant" | "ended";
  endedReason?: string;
  causes: string[];
  lastContactIndex: number;
  /** Media contribution so far (capped: media alone never makes a rival). */
  media: number;
  lastNewsIndex: number;
  h2h: { meetings: number; wins: number; draws: number; losses: number; myGoals: number; theirGoals: number };
  meetings: RivalMeeting[];
  events: RivalEvent[];
}

/** A player who is accumulating evidence but is not (yet) a rival. */
export interface RivalCandidate {
  points: number;
  /** Points from international meetings, which need a higher bar on their own. */
  intl: number;
  /** Points from media comparisons (capped, and never enough alone). */
  media: number;
  /** Points from plain, ordinary meetings, which are capped: playing someone often is not a rivalry. */
  plain?: number;
  causes: string[];
  lastIndex: number;
  /** Meetings seen so far, kept so the head-to-head is complete if the player becomes a rival. */
  meetings: RivalMeeting[];
  /** Short notes on what built the points, kept for the timeline if the player becomes a rival. */
  events: RivalEvent[];
}

export interface RivalryState {
  rivals: PlayerRival[];
  candidates: Record<PlayerId, RivalCandidate>;
  /** How far into `transferLog` the weekly scan has read. */
  transferScan: number;
  lastFormedIndex: number;
  lastMediaIndex?: number;
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
  /** Set for decisions that belong to a transfer saga. */
  sagaId?: string;
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

export type MemoryKind =
  | "debut" | "first-goal" | "intl-debut" | "first-intl-goal"
  | "derby-winner" | "late-winner" | "winner-goal" | "hat-trick" | "haul" | "comeback" | "final-goal" | "final-winner" | "famous-upset"
  | "trophy" | "first-title" | "continental-trophy" | "intl-trophy" | "record" | "award"
  | "major-injury" | "injury-comeback"
  | "big-transfer" | "controversial-transfer" | "transfer-rejected" | "return-to-club" | "captaincy"
  | "promotion" | "relegation" | "contract-dispute" | "financial-exit" | "manager-conflict" | "career-decision"
  | "retirement" | "final-match" | "identity" | "transfer-saga" | "rivalry";

export type RecallReason = "anniversary" | "origin" | "former-club" | "opponent-history" | "venue" | "grudge";

export interface VaultItem {
  memoryId: string;
  reason: RecallReason;
  turnIndex: number;
  fixtureId?: string;
  /** Whole seasons since the memory (anniversaries). */
  years?: number;
}

export type MemoryTier = "iconic" | "major" | "notable" | "minor";

/**
 * A structured career memory. Only ids and numbers are stored; titles and sentences
 * are generated from this at display time (see engine/memory/describe.ts).
 */
export interface Memory {
  id: string;
  kind: MemoryKind;
  season: number;
  turn: number;
  /** Player's age when it happened. */
  age: number;
  clubId?: ClubId | null;
  opponentId?: string;
  compId?: string;
  compName?: string;
  stage?: string;
  fixtureId?: string;
  minute?: number;
  /** Final score from the user's side: [for, against]. */
  score?: [number, number];
  outcome?: "win" | "draw" | "loss";
  /** Club whose stadium hosted it (for "return to the ground" recall). */
  venueClubId?: ClubId;
  /** 0–100, computed from context. */
  importance: number;
  /** How the importance was built: [factor, raw points]. */
  factors: [string, number][];
  participants?: PlayerId[];
  manager?: { name: string; clubId?: ClubId };
  rivalId?: ClubId;
  transfer?: { from: ClubId | null; to: ClubId; fee: number };
  trophy?: { season: number; compId: string };
  tags: string[];
  data?: Record<string, number | string | boolean>;
  /** Times resurfaced and when last (turn index), for anti-spam. */
  recall?: { shown: number; lastTurnIndex?: number };
  backfilled?: boolean;
}

export type AgentTier = "none" | "rookie" | "established" | "top" | "super";

export interface AgentSkills {
  /** Wage ceilings and signing bonuses. */
  negotiation: number;
  /** How many clubs hear about you, and how big they are. */
  connections: number;
  /** Reputation growth and sponsorship value. */
  media: number;
  /** Morale support and loan searches. */
  care: number;
}

export interface Agent {
  id: string;
  name: string;
  nationality: CountryCode;
  tier: AgentTier;
  /** 1-100 overall, weighted from the four skills. */
  rating: number;
  skills: AgentSkills;
  /** Weekly retainer in euros. */
  weeklyFee: number;
  /** Share of each new contract's signing bonus + first-year wages (0.03 = 3%). */
  commission: number;
  /** Player reputation this agent requires before taking them on. */
  minReputation: number;
  specialty?: keyof AgentSkills;
}

export interface UserCareer {
  playerId: PlayerId;
  startSeason: number;
  startAge: number;
  startClubId: ClubId;
  startTier: number;
  agent: Agent;
  /** Identity-defining trait developments (gained, upgraded, weakened, evolved). */
  traitLog: TraitEvent[];
  /** Training can only add trait progress up to a budget per season: season → trait → points used. */
  traitTraining?: { season: number; used: Record<TraitId, number> };
  /** Times the user turned down a bigger move out of loyalty. */
  loyaltyStands?: number;
  /** Career memories, strongest context first at display time. */
  memories: Memory[];
  /** This week's "from the vault" recall, chosen by engine/memory/recall.ts. */
  vault?: VaultItem;
  /** Turn index of the last memory news item (limits how often memories surface in the feed). */
  memoryNewsTurnIndex?: number;
  /** The user's most recent match, kept for the "final match" memory. */
  lastMatch?: { fixtureId: string; compId: string; opponentId: string; score: [number, number]; minutes: number; goals: number; assists: number; rating: number; season: number; turn: number };
  /** Pending injury comeback to remember: set on a long injury, cleared on the first match back. */
  comebackFrom?: { type: string; weeks: number; season: number };
  /** Grudges and rivalries the user's own career created: club id → heat 0–1. */
  rivalHeat?: Record<ClubId, number>;
  /** Money in hand: wages, bonuses and deals in; agent fees and commission out. */
  bank: number;
  agentUnpaidWeeks?: number;
  /** Season in which the player last hired an agent (one change per season). */
  agentChangedSeason?: number;
  relationships: Relationships;
  priorities: CareerPriorities;
  training: TrainingPlan;
  timeline: TimelineEvent[];
  offers: TransferOffer[];
  /** Transfer sagas: at most one active, plus the most recent finished ones (they drive cooldowns). */
  sagas: TransferSaga[];
  /** Emergent player rivalries. */
  rivalry: RivalryState;
  /** Season-award nominations the player missed out on (wins are in `awards`). Optional for old saves. */
  awardNoms?: AwardNomination[];
  decisions: CareerDecision[];
  awards: AwardRecord[];
  trophies: TrophyRecord[];
  transfers: { season: number; turn: number; from: ClubId | null; to: ClubId; fee: number; kind: TransferOffer["kind"] }[];
  /** Total gross income over the career (a stat; spending comes out of `bank`). */
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
  /** Consecutive intense training weeks (overload raises injury risk). */
  intenseStreak?: number;
  /** Turn index on which the player asked the manager to be rested. */
  restTurnIndex?: number;
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
  /** What kind of footballer this was, from traits, stats and career (see engine/traits/identity.ts). */
  identity?: { label: string; lines: string[]; traits: TraitId[] };
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

export interface PoolManager {
  name: string;
  nationality: CountryCode;
  quality: number;
  born?: number;
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
  /** The latest end-of-season awards ceremony. Optional so old saves load. */
  ceremony?: SeasonCeremony;
  records: WorldRecord[];
  /** Hall of fame of retired notable NPCs (name + totals) to keep records after removal. */
  legends: { id: PlayerId; name: string; nationality: CountryCode; goals: number; apps: number; caps: number; peak: number; retiredSeason: number }[];
  transferLog: { season: number; turn: number; playerId: PlayerId; name: string; from: ClubId | null; to: ClubId; fee: number }[];
  settings: { difficulty: "relaxed" | "standard" | "hardcore"; autoSave: boolean; countries?: string[] };
  /** Match the user must play this turn before the world advances. */
  pending: PendingMatch[];
  /** Agents available to represent the user (generated lazily per career). */
  agents?: Agent[];
  /** Unemployed managers clubs can hire (seeded from real free agents; sacked managers join it). */
  managerPool?: PoolManager[];
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
