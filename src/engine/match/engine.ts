/**
 * Pitchborn event-based match engine.
 *
 * The match is simulated as a sequence of possession phases (≈1 per minute).
 * Each phase decides who has the ball (midfield control), whether the attack
 * reaches the final third, whether a chance is created and by whom, and how
 * the shot resolves against the goalkeeper. Every goal, assist, card, injury
 * and rating comes from these events — the score is never drawn first.
 *
 * The same engine runs in two fidelities: `detail` (commentary + key-moment
 * decisions for the user's player) and fast (no text) for the rest of the
 * world.
 */
import { BALANCE } from "../balance";
import { overallExact, overallFor } from "../players/attributes";
import { footAttrMultipliers, type Foot } from "../players/foot";
import type { MatchFx, SignalKey } from "../traits/types";
import { clamp, type Rng } from "../rng";
import type { Attributes, AttrKey, Position } from "../types";
import { ATTR_LABEL } from "../players/model";
import {
  ATTACK_K, ATTACK_PROMPT, ATTACK_SET, BUILD_W, CARRY_W, CLEAR_WEIGHT, CROSSERS, DEFEND_K, DEFEND_PROMPT, DEFEND_SET, DRIB_MIX, DUEL_MIX, FINAL_W, FINISHERS,
  MOMENT, NOTE_CHANCE, NOTE_TEXT, PASS_MIX, SIDE_OF, WIDE_MIX, WIDE_SLOTS, isAerial, isLongShot, isPlaymaker, isTrickster,
  type ChanceType, type FlowContext, type Mix, type MomentOpt, type NoteKind, type PlayerState,
} from "./moments";

const M = BALANCE.match;

export interface MatchPlayerInput {
  id: string;
  name: string;
  slot: Position;
  attrs: Attributes;
  /** 0-100 */
  fitness: number;
  morale: number;
  form: number;
  sharpness: number;
  bigMatch: number;
  consistency: number;
  isUser?: boolean;
  /** Behavioural modifiers from the player's traits (see engine/traits). */
  fx?: MatchFx;
  /** Dominant foot and weak-foot rating; absent = neutral (national sides built from bare inputs, tests). */
  foot?: Foot;
  weakFoot?: number;
  /** The Ambidextrous trait: the weak foot is as good as the strong one. */
  ambidextrous?: boolean;
}

export interface TeamInput {
  id: string;
  name: string;
  short: string;
  starters: MatchPlayerInput[];
  bench: MatchPlayerInput[];
  /** -1 defensive .. +1 attacking */
  mentality: number;
  color: string;
  /** How the club plays (0–1 each). Shifts the three zones by a few percent either way; absent for national sides. */
  style?: { pressing: number; tempo: number; directness: number };
}

export interface MatchInput {
  home: TeamInput;
  away: TeamInput;
  neutral?: boolean;
  /** Knockout: extra time + penalties when level. */
  knockout?: boolean;
  /** First-leg score for two-legged ties (home team of this match perspective: [thisHome, thisAway] aggregate before match). */
  aggregate?: [number, number];
  importance: number; // 1 normal .. 3 final
  detail: boolean;
  /** Ask the user to decide key moments (interactive play). */
  interactive?: boolean;
}

export type Side = "home" | "away";

export interface MatchEvent {
  minute: number;
  side?: Side;
  type:
    | "kickoff" | "chance" | "goal" | "save" | "miss" | "woodwork" | "blocked" | "tackle" | "foul" | "yellow" | "red"
    | "injury" | "sub" | "halftime" | "fulltime" | "penalty" | "decision" | "extratime" | "shootout" | "info";
  text: string;
  playerId?: string;
  otherId?: string;
  user?: boolean;
  score?: [number, number];
  /** `involve`: a small action by the user's player; `status`: a rolling-form summary of the user's match. */
  tag?: "involve" | "status";
  /** A chance big enough to count as a key moment even though it did not end in a goal. */
  big?: boolean;
}

/** What a player did in the flow of play (not just the moments that decide a match). Only tracked in detailed matches. */
export interface Involvement {
  touches: number;
  passes: number;
  passesOk: number;
  dribbles: number;
  dribblesWon: number;
  duels: number;
  duelsWon: number;
  aerials: number;
  aerialsWon: number;
  interceptions: number;
  clearances: number;
  recoveries: number;
  possLost: number;
  crosses: number;
  crossesOk: number;
  boxTouches: number;
  claims: number;
  /** Expected goals from the player's own shots. */
  xg: number;
  /** Chances the player had a clear sight of and wasted, or gave away through an error. */
  errors: number;
}

export type RatingReason =
  | "goal" | "assist" | "chance" | "shot" | "save" | "cleanSheet" | "defence" | "duel" | "dribble" | "pass" | "cross" | "aerial"
  | "possession" | "missed" | "error" | "card" | "conceded" | "decision";

export interface PlayerLine {
  id: string;
  side: Side;
  slot: Position;
  started: boolean;
  minuteOn: number;
  minuteOff: number | null;
  rating: number;
  goals: number;
  assists: number;
  shots: number;
  onTarget: number;
  keyPasses: number;
  tackles: number;
  saves: number;
  fouls: number;
  yellow: number;
  red: number;
  injured: boolean;
  conceded: number;
  /** Goalkeepers: expected goals from the shots on target they faced (for "goals prevented"). */
  xgFaced?: number;
  /** Counts of trait-relevant actions (shots by type, chances created, interceptions…): evidence for trait development. */
  acts?: Partial<Record<SignalKey, number>>;
  /** Flow-of-play counts (detailed matches only). */
  inv?: Involvement;
  /** Rating points earned or lost per kind of action, so a rating can be explained afterwards (detailed matches only). */
  why?: Partial<Record<RatingReason, number>>;
  /** Why the player left the pitch. */
  offReason?: "sub" | "injury" | "red";
}

export interface DecisionOption {
  id: string;
  label: string;
  detail: string;
  /** Success odds 0-1. Used to auto-resolve and to bucket the risk label; never shown as a number. */
  odds: number;
  /** The abilities this choice leans on, as the player knows them. */
  skills?: string[];
  /** One of the player's traits makes this the natural thing for him to try. */
  suits?: boolean;
}

export interface PendingDecision {
  minute: number;
  kind: "shoot" | "create" | "defend" | "keep" | "knock" | "progress" | "hold" | "claim";
  prompt: string;
  /** A short label for what kind of moment this is (shown over the prompt). */
  moment?: string;
  options: DecisionOption[];
}

export interface MatchResult {
  homeGoals: number;
  awayGoals: number;
  extraTime: boolean;
  penalties?: [number, number];
  goals: { minute: number; side: Side; scorer: string; assist?: string; penalty?: boolean }[];
  lines: PlayerLine[];
  events: MatchEvent[];
  stats: {
    /** Passes attempted and completed (detailed matches only). */
    passes?: [number, number];
    passesOk?: [number, number];
    possession: [number, number];
    shots: [number, number];
    onTarget: [number, number];
    xg: [number, number];
    corners: [number, number];
    fouls: [number, number];
    yellows: [number, number];
    reds: [number, number];
  };
  motm: string;
  injuries: { id: string; side: Side; minute: number }[];
}

interface LivePlayer {
  /** Zone ratings (effective, before fatigue): midfield, attack, defence. */
  zones: [number, number, number];
  input: MatchPlayerInput;
  line: PlayerLine;
  energy: number;
  onPitch: boolean;
  /** This match's random form swing (fraction of ability). */
  dayForm: number;
  fx?: MatchFx;
  eff: Record<AttrKey, number>;
  condition: number;
  /** His overall in this slot, scaled like `eff`: the level the specialist attributes are measured against. */
  lvl: number;
  /** Specialist readings above his own level (before fatigue), worked out once when he takes the pitch: they feed the side's cached metrics. */
  sp: Specials;
}

interface Specials { mark: number; air: number; lane: number; press: number; resist: number }
const MARK_MIX: Mix = [["marking", 0.7], ["anticipation", 0.3]];
const AIR_MIX: Mix = [["jumping", 0.45], ["heading", 0.35], ["strength", 0.2]];
const LANE_MIX: Mix = [["interceptions", 0.6], ["anticipation", 0.4]];
const PRESS_MIX: Mix = [["workRate", 0.4], ["aggression", 0.2], ["stamina", 0.2], ["anticipation", 0.2]];
const RESIST_MIX: Mix = [["firstTouch", 0.35], ["balance", 0.25], ["composure", 0.25], ["agility", 0.15]];

function blend(eff: Record<AttrKey, number>, mix: Mix): number {
  let sum = 0;
  for (let i = 0; i < mix.length; i++) sum += eff[mix[i][0]] * mix[i][1];
  return sum;
}

function specials(eff: Record<AttrKey, number>, lvl: number): Specials {
  return { mark: blend(eff, MARK_MIX) - lvl, air: blend(eff, AIR_MIX) - lvl, lane: blend(eff, LANE_MIX) - lvl, press: blend(eff, PRESS_MIX) - lvl, resist: blend(eff, RESIST_MIX) - lvl };
}

/** Trait effects summed over the XI on the pitch (cached with the team's strength). */
interface TeamAgg {
  freqHeader: number; freqLong: number; freq1v1: number;
  againstFreqHeader: number; againstFreqLong: number; againstFreq1v1: number;
  againstXgOpen: number; againstXgHeader: number; againstXgLong: number; againstXg1v1: number;
  /** Chance per opposition phase that a defensive lapse hands them a chance. */
  lapse: number;
  /** Chance that winning the ball back becomes an immediate counter-attack. */
  counter: number;
  /** Multiplier on the quality of chances for the opposition's most dangerous finisher. */
  againstStar: number;
}

const NEUTRAL_AGG: TeamAgg = {
  freqHeader: 0, freqLong: 0, freq1v1: 0, againstFreqHeader: 1, againstFreqLong: 1, againstFreq1v1: 1, againstXgOpen: 1, againstXgHeader: 1, againstXgLong: 1, againstXg1v1: 1,
  lapse: 0, counter: 0, againstStar: 1,
};

/** Hard ceilings on the situational levers, so stacking traits can never swamp the football. */
const MAX_LAPSE = 0.03;
const MAX_COUNTER = 0.05;
/** Minutes after coming on during which a Super Sub's fresh legs count. */
const SUB_WINDOW = 30;
/** Display names for the abilities a choice leans on. */
const skillNames = (...keys: AttrKey[]) => keys.map((k) => ATTR_LABEL[k]);

/** The most the user is asked in one match (about one choice every seven minutes). */
export const MAX_DECISIONS = 14;

interface LiveTeam {
  input: TeamInput;
  side: Side;
  players: LivePlayer[];
  bench: LivePlayer[];
  subsUsed: number;
  subWindows: number;
  goals: number;
  shots: number;
  onTarget: number;
  xg: number;
  corners: number;
  fouls: number;
  yellows: number;
  reds: number;
  possessionTicks: number;
  /** Attacks by the way they went: [left, centre, right]. Only tracked in detailed matches. */
  flank: [number, number, number];
  passes: number;
  passesOk: number;
  cache?: TeamCache;
}

interface TeamCache {
  mid: number; att: number; def: number; gk: number; agg: TeamAgg; star?: LivePlayer;
  /** Marking and anticipation of the back line: what a runner's movement is up against. */
  mark: number;
  /** Aerial defence: jumping, heading and strength of the back line. */
  air: number;
  /** Passing-lane defence: interceptions and anticipation of the back line and screen. */
  lane: number;
  /** Pressing intensity: work rate, aggression, stamina, anticipation of the outfield players. */
  press: number;
  /** Resistance to being pressed: first touch, balance, composure, agility of the outfield players. */
  resist: number;
  /** Average aggression of the outfield players (challenge frequency, fouls, cards). */
  aggr: number;
  /** The keeper's reading of through-balls: anticipation, command and one-on-ones. */
  sweep: number;
  /** The keeper as a first passer: kicking, decisions, composure. */
  build: number;
}


const XG_BASE: Record<ChanceType, number> = { open: 0.12, header: 0.095, long: 0.04, oneonone: 0.34, penalty: 0.76, freekick: 0.065 };

const XG_KEY: Record<ChanceType, keyof MatchFx> = { open: "xgOpen", header: "xgHeader", long: "xgLong", oneonone: "xg1v1", freekick: "xgFree", penalty: "xgPen" };
const SHOT_ACT: Partial<Record<ChanceType, SignalKey>> = { open: "shotOpen", header: "shotHeader", long: "shotLong", oneonone: "shot1v1" };
const GOAL_ACT: Partial<Record<ChanceType, SignalKey>> = { open: "goalOpen", header: "goalHeader", long: "goalLong", oneonone: "goal1v1" };

/** The shot quality at which a chance converts at its base rate. Shot quality is now a blend of finishing, composure, touch, technique and decisions, which sits a few points under finishing alone. */
const Q_CENTRE = 72;

const SHOOT_WEIGHT: Record<Position, number> = { GK: 0, CB: 0.28, RB: 0.32, LB: 0.32, DM: 0.4, CM: 0.85, AM: 1.5, RW: 1.6, LW: 1.6, ST: 2.7 };
const HEADER_WEIGHT: Record<Position, number> = { GK: 0, CB: 1.1, RB: 0.2, LB: 0.2, DM: 0.5, CM: 0.5, AM: 0.4, RW: 0.6, LW: 0.6, ST: 2.8 };
const LONG_WEIGHT: Record<Position, number> = { GK: 0, CB: 0.15, RB: 0.3, LB: 0.3, DM: 0.7, CM: 1.4, AM: 1.6, RW: 1.1, LW: 1.1, ST: 0.9 };
const CREATE_WEIGHT: Record<Position, number> = { GK: 0.02, CB: 0.15, RB: 0.9, LB: 0.9, DM: 0.6, CM: 1.3, AM: 2.4, RW: 2.0, LW: 2.0, ST: 0.9 };
const DEFEND_WEIGHT: Record<Position, number> = { GK: 0, CB: 2.2, RB: 1.3, LB: 1.3, DM: 1.8, CM: 0.9, AM: 0.35, RW: 0.4, LW: 0.4, ST: 0.2 };

const MID_KEYS: AttrKey[] = ["passing", "vision", "firstTouch", "positioning", "stamina", "decisions", "workRate"];
const ATT_KEYS: AttrKey[] = ["finishing", "dribbling", "pace", "composure", "firstTouch", "offBall", "technique", "agility"];
const DEF_KEYS: AttrKey[] = ["tackling", "positioning", "strength", "heading", "pace", "marking", "interceptions", "anticipation"];

const PICK_SHOOT: Mix = [["finishing", 0.7], ["offBall", 0.3]];
const PICK_HEADER: Mix = [["heading", 0.55], ["jumping", 0.25], ["offBall", 0.2]];
const PICK_LONG: Mix = [["longShots", 0.75], ["technique", 0.25]];
const PICK_CREATE: Mix = [["vision", 0.4], ["creativity", 0.3], ["passing", 0.15], ["decisions", 0.15]];
const PICK_CROSS: Mix = [["crossing", 0.7], ["technique", 0.3]];
const PICK_TACKLE: Mix = [["tackling", 0.75], ["aggression", 0.25]];
const PICK_INTERCEPT: Mix = [["interceptions", 0.6], ["anticipation", 0.4]];
const PICK_BLOCK: Mix = [["positioning", 0.7], ["anticipation", 0.3]];
const PICK_FOUL: Mix = [["aggression", 0.6], ["tackling", 0.4]];

/*
 * The new attributes act as specialisms: each effect compares an attribute with the player's (or the side's) own overall level, so a
 * better team is not simply "more of everything" twice over. These are the typical excesses in a generated league (an ordinary
 * defender's marking sits about a point under his overall, an ordinary striker's movement a little over it), so an ordinary side is
 * unaffected and only real specialists or real weaknesses move the numbers. Aggression is measured in absolute terms: it is generated relative to a player's level, so it
 * is the same for good and ordinary sides. (scripts/sim/attributes.ts prints the figures these were set from.)
 */
const REF = { mark: 0, air: -3.4, lane: -1.3, press: -5.4, resist: -1.5, aggr: 52, decisions: -5, creativity: 1, offBall: -1.5, anticipation: -1, oneOnOne: -0.5, command: 1.5, sweep: 1, build: 0.2 } as const;
const MID_W: Record<Position, number> = { DM: 1.4, CM: 1.6, AM: 1.3, RW: 0.7, LW: 0.7, RB: 0.5, LB: 0.5, ST: 0.4, CB: 0.4, GK: 0 };
const ATT_W: Record<Position, number> = { ST: 2, RW: 1.6, LW: 1.6, AM: 1.5, CM: 0.6, DM: 0.2, RB: 0.35, LB: 0.35, CB: 0.1, GK: 0 };
const DEF_W: Record<Position, number> = { CB: 2, RB: 1.3, LB: 1.3, DM: 1.5, CM: 0.6, AM: 0.15, RW: 0.2, LW: 0.2, ST: 0.1, GK: 0 };

function conditionFactor(p: MatchPlayerInput): number {
  // Fitness above ~90 is "match fit"; performance tails off below that.
  const fit = 0.84 + 0.16 * Math.min(1, clamp(p.fitness, 0, 100) / 90);
  const morale = 0.95 + 0.07 * clamp(p.morale, 0, 100) / 100;
  const form = 1 + clamp(p.form - 6.6, -1.5, 1.5) * 0.02;
  const sharp = 0.95 + 0.06 * clamp(p.sharpness, 0, 100) / 100;
  return fit * morale * form * sharp;
}

function effective(input: MatchPlayerInput, condition: number): Record<AttrKey, number> {
  const eff = {} as Record<AttrKey, number>;
  // Footedness: the actions that force a weaker foot (cut inside onto the wrong foot, cross from the off flank) cost a little,
  // relative to a typical player in the role. Applied to the effective attributes so every shot, pass and cross sees it.
  const foot = input.foot ? footAttrMultipliers(input.foot, input.weakFoot ?? 60, !!input.ambidextrous, input.slot) : undefined;
  for (const k in input.attrs) eff[k as AttrKey] = input.attrs[k as AttrKey] * condition * (foot?.[k as AttrKey] ?? 1);
  return eff;
}

function zonesOf(eff: Record<AttrKey, number>): [number, number, number] {
  const z = (keys: AttrKey[]) => keys.reduce((s, k) => s + eff[k], 0) / keys.length;
  return [z(MID_KEYS), z(ATT_KEYS), z(DEF_KEYS)];
}

/** Zone strengths including trait effects (small multipliers, already scaled by how well attributes support them). */
function zonesOfFx(eff: Record<AttrKey, number>, fx?: MatchFx): [number, number, number] {
  const z = zonesOf(eff);
  return fx ? [z[0] * (fx.zoneMid ?? 1), z[1] * (fx.zoneAtt ?? 1), z[2] * (fx.zoneDef ?? 1)] : z;
}

export function emptyInv(): Involvement {
  return { touches: 0, passes: 0, passesOk: 0, dribbles: 0, dribblesWon: 0, duels: 0, duelsWon: 0, aerials: 0, aerialsWon: 0, interceptions: 0, clearances: 0, recoveries: 0, possLost: 0, crosses: 0, crossesOk: 0, boxTouches: 0, claims: 0, xg: 0, errors: 0 };
}

function makeLive(input: MatchPlayerInput, side: Side, started: boolean, dayForm: number, detail: boolean): LivePlayer {
  // A good or bad day: it changes how the player actually performs, so it shows in goals and ratings alike.
  const condition = conditionFactor(input) * (1 + dayForm);
  // Bench players get their effective attributes lazily when they come on.
  const eff = started ? effective(input, condition) : (input.attrs as Record<AttrKey, number>);
  const lvl = overallExact(input.attrs, input.slot) * condition;
  return {
    zones: started ? zonesOfFx(eff, input.fx) : [0, 0, 0],
    fx: input.fx,
    input,
    condition,
    eff,
    lvl,
    sp: started ? specials(eff, lvl) : { mark: 0, air: 0, lane: 0, press: 0, resist: 0 },
    energy: clamp(input.fitness, 30, 100),
    onPitch: started,
    dayForm,
    line: {
      id: input.id, side, slot: input.slot, started, minuteOn: started ? 0 : -1, minuteOff: null, rating: 6.0,
      goals: 0, assists: 0, shots: 0, onTarget: 0, keyPasses: 0, tackles: 0, saves: 0, fouls: 0, yellow: 0, red: 0, injured: false, conceded: 0, xgFaced: 0,
      ...(detail ? { inv: emptyInv(), why: {} } : {}),
    },
  };
}

export class MatchEngine {
  readonly input: MatchInput;
  private rng: Rng;
  private teams: Record<Side, LiveTeam>;
  minute = 0;
  private half = 1;
  private stoppage = [0, 0];
  events: MatchEvent[] = [];
  finished = false;
  pending: PendingDecision | null = null;
  private pendingCtx: PendingContext | null = null;
  private lastDecisionMinute = -99;
  private decisionsMade = 0;
  private extraTime = false;
  private penalties?: [number, number];
  private goalsList: MatchResult["goals"] = [];
  private injuries: MatchResult["injuries"] = [];
  private phaseEnd = 90;
  /**
   * A separate stream for the flow of play (touches, passes, duels) and for choosing which moments the user is asked about. It
   * exists only in detailed matches, so every other match in the world draws exactly the numbers it always did, and the
   * football the user's player is part of is not nudged by being watched.
   */
  private irng?: Rng;
  /** Wording and rationing of the user's commentary lines: kept off the flow stream so being the user never changes how a match plays. */
  private crng?: Rng;
  private userId: string | undefined;
  private possHist: Side[] = [];
  private touchHist: number[] = [];
  private ratingHist: number[] = [];
  private lastNoteMinute = -99;
  private lastStatusMinute = -99;
  private statusMade = 0;
  private statusKinds: Record<string, number> = {};
  private duelStreak = 0;

  constructor(input: MatchInput, rng: Rng) {
    this.input = input;
    this.rng = rng;
    if (input.detail || input.interactive) {
      this.irng = rng.fork("flow");
      this.crng = rng.fork("notes");
    }
    this.userId = [...input.home.starters, ...input.home.bench, ...input.away.starters, ...input.away.bench].find((p) => p.isUser)?.id;
    const mk = (t: TeamInput, side: Side): LiveTeam => ({
      input: t,
      side,
      players: t.starters.map((p) => makeLive(p, side, true, rng.normal(0, M.dayFormSd * (p.fx?.variance ?? 1)), input.detail)),
      bench: t.bench.map((p) => makeLive(p, side, false, rng.normal(0, M.dayFormSd * (p.fx?.variance ?? 1)), input.detail)),
      subsUsed: 0,
      subWindows: 0,
      goals: 0, shots: 0, onTarget: 0, xg: 0, corners: 0, fouls: 0, yellows: 0, reds: 0, possessionTicks: 0, flank: [0, 0, 0], passes: 0, passesOk: 0,
    });
    this.teams = { home: mk(input.home, "home"), away: mk(input.away, "away") };
    this.stoppage = [rng.int(1, 3), rng.int(2, 6)];
    this.log({ minute: 0, type: "kickoff", text: `Kick-off! ${input.home.name} v ${input.away.name}.` });
  }

  // ------------------------------------------------------------ helpers
  private log(e: MatchEvent) {
    if (this.input.detail || e.type === "goal" || e.type === "red" || e.type === "injury") {
      this.events.push({ ...e, score: [this.teams.home.goals, this.teams.away.goals] });
    }
  }

  private other(side: Side): Side {
    return side === "home" ? "away" : "home";
  }

  private onPitch(t: LiveTeam): LivePlayer[] {
    return t.players.filter((p) => p.onPitch);
  }

  private name(p: LivePlayer) {
    return p.input.name;
  }

  private val(p: LivePlayer, k: AttrKey): number {
    const fatigue = 0.88 + 0.12 * (p.energy / 100);
    return p.eff[k] * fatigue;
  }

  /** The level a player's specialist attributes are measured against (his overall in this slot, as tired and as fit as he is). */
  private levelOf(p: LivePlayer): number {
    return p.lvl * (0.88 + 0.12 * (p.energy / 100));
  }

  /** How far an attribute (or blend) sits above the player's own overall level. */
  private spec(p: LivePlayer, attr: AttrKey | Mix): number {
    return this.rate(p, attr) - this.levelOf(p);
  }

  /** One attribute, or a weighted blend of several, as the player has it right now. */
  private rate(p: LivePlayer, attr: AttrKey | Mix): number {
    if (typeof attr === "string") return this.val(p, attr);
    let sum = 0;
    for (let i = 0; i < attr.length; i++) sum += this.val(p, attr[i][0]) * attr[i][1];
    return sum;
  }

  /** Zonal strengths; cached and refreshed every few minutes or on changes. */
  private strength(t: LiveTeam) {
    if (t.cache) return t.cache;
    const on = this.onPitch(t);
    const zoneAvg = (zi: 0 | 1 | 2, weights: Record<Position, number>) => {
      let sum = 0;
      let w = 0;
      for (const p of on) {
        const pw = weights[p.input.slot];
        if (pw <= 0) continue;
        const fast = p.fx?.fast && this.minute < 20 ? 1 + p.fx.fast : 1;
        const fresh = this.isFresh(p) ? 1 + (p.fx?.subBoost ?? 0) : 1;
        sum += p.zones[zi] * (0.88 + 0.12 * (p.energy / 100)) * pw * fast * fresh;
        w += pw;
      }
      return w ? sum / w : 40;
    };
    const missing = Math.max(0, 11 - on.length);
    const penalty = 1 - missing * 0.07;
    const homeBoost = !this.input.neutral && t.side === "home" ? M.homeAdvantage : 1;
    const mentality = t.input.mentality;
    const mid = zoneAvg(0, MID_W);
    const att = zoneAvg(1, ATT_W);
    const def = zoneAvg(2, DEF_W);
    const keeper = on.find((p) => p.input.slot === "GK");
    const gk = keeper ? (this.val(keeper, "reflexes") + this.val(keeper, "diving") + this.val(keeper, "handling") + this.val(keeper, "command") * 0.5 + this.val(keeper, "positioning") * 0.6) / 4.1 : 25;
    const sweep = keeper ? this.spec(keeper, [["anticipation", 0.4], ["command", 0.3], ["oneOnOnes", 0.3]]) : REF.sweep;
    const build = keeper ? this.spec(keeper, [["kicking", 0.4], ["decisions", 0.3], ["composure", 0.3]]) : REF.build;
    // The back line's marking, aerial and lane-cutting work, weighted by who does the defending; the whole side's pressing and resistance to it.
    let mark = 0, air = 0, lane = 0, dw = 0, press = 0, resist = 0, aggr = 0, field = 0;
    for (const p of on) {
      if (p.input.slot === "GK") continue;
      const fat = 0.88 + 0.12 * (p.energy / 100);
      const pw = DEFEND_WEIGHT[p.input.slot];
      if (pw > 0) {
        dw += pw;
        mark += pw * p.sp.mark * fat;
        air += pw * p.sp.air * fat;
        lane += pw * p.sp.lane * fat;
      }
      field++;
      press += p.sp.press * fat;
      resist += p.sp.resist * fat;
      aggr += p.eff.aggression * fat;
    }
    let teamMid = 0, teamAtt = 0, teamDef = 0;
    let agg: TeamAgg | undefined;
    let star: LivePlayer | undefined;
    let starQ = -1;
    for (const p of on) {
      if (p.input.slot !== "GK") {
        const q = p.eff.finishing + p.eff.composure;
        if (q > starQ) {
          starQ = q;
          star = p;
        }
      }
      const fx = p.fx;
      if (!fx) continue;
      agg ??= { ...NEUTRAL_AGG };
      teamMid += fx.teamMid ?? 0;
      teamAtt += fx.teamAtt ?? 0;
      teamDef += fx.teamDef ?? 0;
      agg.freqHeader += fx.freqHeader ?? 0;
      agg.freqLong += fx.freqLong ?? 0;
      agg.freq1v1 += fx.freq1v1 ?? 0;
      agg.againstFreqHeader *= fx.againstFreqHeader ?? 1;
      agg.againstFreqLong *= fx.againstFreqLong ?? 1;
      agg.againstFreq1v1 *= fx.againstFreq1v1 ?? 1;
      agg.againstXgOpen *= fx.againstXgOpen ?? 1;
      agg.againstXgHeader *= fx.againstXgHeader ?? 1;
      agg.againstXgLong *= fx.againstXgLong ?? 1;
      agg.againstXg1v1 *= fx.againstXg1v1 ?? 1;
      agg.lapse += fx.lapse ?? 0;
      agg.counter += fx.counter ?? 0;
      agg.againstStar *= fx.againstStar ?? 1;
    }
    if (agg) {
      agg.lapse = Math.min(agg.lapse, MAX_LAPSE);
      agg.counter = Math.min(agg.counter, MAX_COUNTER);
    }
    // Style is bounded and symmetrical about neutral: pressing wins the midfield, tempo and directness open the game up
    // at both ends, and a direct side gives up some control of the ball.
    const st = t.input.style;
    const styleMid = st ? 1 + (st.pressing - 0.5) * 0.04 - (st.directness - 0.5) * 0.03 : 1;
    const styleAtt = st ? 1 + (st.tempo - 0.5) * 0.03 + (st.directness - 0.5) * 0.02 : 1;
    const styleDef = st ? 1 - (st.tempo - 0.5) * 0.02 + (st.pressing - 0.5) * 0.015 : 1;
    t.cache = {
      mid: mid * penalty * homeBoost * styleMid * (1 + clamp(teamMid, -0.05, 0.06)) * (1 + clamp((build - REF.build) / 100, -0.2, 0.2) * 0.04),
      att: att * penalty * homeBoost * styleAtt * (1 + mentality * 0.03) * (1 + clamp(teamAtt, -0.05, 0.06)),
      def: def * penalty * homeBoost * styleDef * (1 - mentality * 0.03) * (1 + clamp(teamDef, -0.05, 0.06)),
      gk,
      agg: agg ?? NEUTRAL_AGG,
      star,
      mark: dw ? mark / dw : REF.mark,
      air: dw ? air / dw : REF.air,
      lane: dw ? lane / dw : REF.lane,
      press: field ? press / field : REF.press,
      resist: field ? resist / field : REF.resist,
      aggr: field ? aggr / field : REF.aggr,
      sweep,
      build,
    };
    return t.cache;
  }

  private invalidate() {
    this.teams.home.cache = undefined;
    this.teams.away.cache = undefined;
  }

  /** A substitute in his first half-hour on the pitch. */
  private isFresh(p: LivePlayer): boolean {
    return p.line.minuteOn > 0 && this.minute - p.line.minuteOn <= SUB_WINDOW;
  }

  /** Preference multiplier from a player's traits for up to two selection keys. */
  private pref(p: LivePlayer, k1?: keyof MatchFx, k2?: keyof MatchFx): number {
    const fx = p.fx;
    if (!fx) return 1;
    // A fresh Super Sub is hungrier for the ball than his rating alone suggests.
    const hungry = fx.subBoost && this.isFresh(p) ? 1 + fx.subBoost * 2 : 1;
    return (k1 ? (fx[k1] ?? 1) : 1) * (k2 ? (fx[k2] ?? 1) : 1) * hungry;
  }

  private pickWeighted(t: LiveTeam, weight: Record<Position, number>, attr: AttrKey | Mix, exclude?: LivePlayer, exp = 1, k1?: keyof MatchFx, k2?: keyof MatchFx): LivePlayer | undefined {
    // Hot path: avoid allocations.
    let total = 0;
    const players = t.players;
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p.onPitch || p === exclude) continue;
      const w = weight[p.input.slot];
      if (w <= 0) continue;
      const rate = this.rate(p, attr);
      const v = (exp === 1 ? rate / 60 : Math.pow(rate / 60, exp)) * (k1 ? this.pref(p, k1, k2) : 1);
      total += w * v;
    }
    if (total <= 0) return undefined;
    let r = this.rng.next() * total;
    let last: LivePlayer | undefined;
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p.onPitch || p === exclude) continue;
      const w = weight[p.input.slot];
      if (w <= 0) continue;
      const rate = this.rate(p, attr);
      const v = (exp === 1 ? rate / 60 : Math.pow(rate / 60, exp)) * (k1 ? this.pref(p, k1, k2) : 1);
      r -= w * v;
      last = p;
      if (r <= 0) return p;
    }
    return last;
  }

  private bump(p: LivePlayer | undefined, delta: number, why?: RatingReason) {
    if (!p) return;
    p.line.rating += delta;
    if (why && p.line.why) p.line.why[why] = (p.line.why[why] ?? 0) + delta;
  }

  /** A small rating nudge for an action that could have gone either way: zero on average, so being involved neither pays nor costs. */
  private dev(p: LivePlayer, k: number, got: boolean, prob: number, why: RatingReason) {
    this.bump(p, k * ((got ? 1 : 0) - prob), why);
  }

  // ------------------------------------------------------------ public API
  /** Advance one minute (or resolve stoppage); returns events produced. */
  step(): MatchEvent[] {
    if (this.finished || this.pending) return [];
    const before = this.events.length;
    this.minute++;
    this.tickEnergy();
    if (this.minute % 6 === 0 || this.minute === 20) this.invalidate();
    this.playPhase();
    if (!this.pending) this.afterPhase();
    if (this.irng) this.watch();
    return this.events.slice(before);
  }

  private afterPhase() {
    const firstHalfEnd = 45 + this.stoppage[0];
    if (this.half === 1 && this.minute >= firstHalfEnd) {
      this.half = 2;
      this.minute = 45;
      this.log({ minute: 45, type: "halftime", text: `Half-time: ${this.teams.home.input.short} ${this.teams.home.goals}-${this.teams.away.goals} ${this.teams.away.input.short}.` });
      for (const side of ["home", "away"] as Side[]) this.halfTimeSubs(this.teams[side]);
      this.invalidate();
      return;
    }
    if (this.half === 2) this.maybeSubs();
    const end = this.phaseEnd + (this.half === 2 ? this.stoppage[1] : 0);
    if (this.half === 2 && this.minute >= end) this.endRegulation();
    if (this.half === 3 && this.minute >= 120) this.endExtraTime();
  }

  private endRegulation() {
    const h = this.teams.home.goals;
    const a = this.teams.away.goals;
    const agg = this.input.aggregate;
    const levelTie = agg ? h + agg[0] === a + agg[1] : h === a;
    if (this.input.knockout && levelTie) {
      this.extraTime = true;
      this.half = 3;
      this.log({ minute: 90, type: "extratime", text: "We're going to extra time!" });
      this.invalidate();
      return;
    }
    this.finish();
  }

  private endExtraTime() {
    const h = this.teams.home.goals;
    const a = this.teams.away.goals;
    const agg = this.input.aggregate;
    const levelTie = agg ? h + agg[0] === a + agg[1] : h === a;
    if (levelTie) this.shootout();
    this.finish();
  }

  runToEnd(): MatchResult {
    let guard = 0;
    while (!this.finished && guard++ < 400) {
      if (this.pending) this.resolve(this.autoChoice());
      this.step();
    }
    return this.result();
  }

  /** Best option by expected value, perturbed by player consistency. */
  autoChoice(): string {
    if (!this.pending) return "";
    const opts = this.pending.options;
    let best = opts[0];
    let bestV = -1;
    for (const o of opts) {
      const v = (this.pendingCtx?.ev?.[o.id] ?? o.odds) + this.rng.normal(0, 0.08);
      if (v > bestV) {
        bestV = v;
        best = o;
      }
    }
    return best.id;
  }

  private tickEnergy() {
    if (this.minute % 3 !== 0) return;
    for (const side of ["home", "away"] as Side[]) {
      for (const p of this.teams[side].players) {
        if (!p.onPitch) continue;
        const stamina = p.input.attrs.stamina;
        // Hard workers run themselves down a little faster; stamina is what lets them keep it up.
        const drain = (0.55 - stamina / 300) * (this.half === 3 ? 1.2 : 1) * (0.94 + p.input.attrs.workRate / 800);
        p.energy = clamp(p.energy - 3 * Math.max(0.12, drain) * (p.fx?.drain ?? 1), 5, 100);
      }
    }
  }

  // ------------------------------------------------------------ phases
  private playPhase() {
    const h = this.teams.home;
    const a = this.teams.away;
    const sh = this.strength(h);
    const sa = this.strength(a);
    // Pressing against composure: a side that hunts the ball in packs wins it more from a team that cannot keep it under pressure,
    // and wins it less from one that can. Bounded and centred, so a side of ordinary players is unaffected.
    const duel = (own: TeamCache, opp: TeamCache) => 1 + clamp((own.resist - REF.resist - (opp.press - REF.press)) * 0.0025, -0.03, 0.03);
    const midH = sh.mid * duel(sh, sa);
    const midA = sa.mid * duel(sa, sh);
    const pHome = Math.pow(midH, M.possessionExponent) / (Math.pow(midH, M.possessionExponent) + Math.pow(midA, M.possessionExponent));
    const attSide: Side = this.rng.chance(pHome) ? "home" : "away";
    const att = this.teams[attSide];
    const def = this.teams[this.other(attSide)];
    att.possessionTicks++;
    const sDef = this.strength(def);
    if (this.irng) {
      this.possHist.push(attSide);
      this.involve(att, def);
    }

    // Foul in midfield / transition
    const sDef0 = this.strength(def);
    // Aggressive sides foul more; passive ones less.
    const foulMul = clamp(1 + (sDef0.aggr - REF.aggr) / 180, 0.8, 1.25);
    if (this.rng.chance(M.foulPerMinute * 0.5 * foulMul)) {
      this.foul(def, att, false);
      return;
    }

    // A defensive lapse (Error Prone, Poor Concentration…) can hand over a chance before the phase is even contested.
    // Only sides with such a player ever draw this random number, so everyone else's matches are untouched.
    if (sDef.agg.lapse > 0 && this.rng.chance(sDef.agg.lapse)) {
      const culprit = this.lapseCulprit(def);
      if (culprit) {
        this.bump(culprit, -0.3, "error");
        if (culprit.line.inv) culprit.line.inv.errors++;
        this.log({ minute: this.minute, side: def.side, type: "foul", text: `${this.name(culprit)} gifts the ball away!` });
      }
      this.createChance(att, def, this.rng.chance(0.45) ? "oneonone" : "open");
      return;
    }

    // A moment for the user's player: the move runs through him, or the attack is coming at him.
    if (this.maybeMoment(att, def)) return;
    this.contest(att, def, 1);
  }

  /**
   * The phase itself: does the attack turn into a chance, or does the defence win it back? `pMul` is how a decision has shifted the
   * attack's odds (1 = the phase as it would have gone anyway); `credit` is who gets the shot or the pass when the move pays off.
   */
  private contest(att: LiveTeam, def: LiveTeam, pMul: number, credit?: { type?: ChanceType; shooter?: LivePlayer; creator?: LivePlayer | null; xgMul?: number }) {
    const sAtt = this.strength(att);
    const sDef = this.strength(def);
    const foulMul = clamp(1 + (sDef.aggr - REF.aggr) / 180, 0.8, 1.25);
    // Soft-limit huge mismatches so cup ties stay believable.
    const gap = sAtt.att - sDef.def;
    const quality = Math.exp((15 * Math.tanh(gap / 15)) / 45);
    // A back line that reads the game cuts passes out before they become chances.
    const laneMul = 1 - clamp((sDef.lane - REF.lane) * 0.0035, -0.05, 0.07);
    const pChance = clamp(M.chanceBase * 2.2 * quality * laneMul * pMul, 0.07, pMul > 1 ? 0.7 : 0.55);
    if (!this.rng.chance(pChance)) {
      // Defensive success — credit a defender occasionally.
      if (this.rng.chance(0.35)) {
        // Winning the ball back: a tackle or a read-the-play interception.
        const inter = this.rng.chance(0.4);
        const d = this.pickWeighted(def, DEFEND_WEIGHT, inter ? PICK_INTERCEPT : PICK_TACKLE, undefined, 1, inter ? "intercept" : "tackle");
        if (d) {
          d.line.tackles++;
          if (inter) this.act(d, "intercept");
          this.bump(d, 0.06, "defence");
          // Winning it back can turn straight into a break (Counter-Attack Threat, Transition Specialist…).
          // Reading where the ball will go next turns a won ball into a break a little more often.
          const counter = sDef.agg.counter + clamp((this.spec(d, [["anticipation", 0.7], ["acceleration", 0.3]]) - REF.anticipation) / 600, 0, 0.02);
          if (counter > 0 && this.rng.chance(counter)) {
            this.createChance(def, att, this.rng.chance(0.4) ? "oneonone" : "open");
            return;
          }
          if (d.input.isUser && this.input.interactive && this.canAsk(0.6) && this.rng.chance(0.22)) {
            this.askDefend(d, att, def);
            return;
          }
        }
      }
      if (this.rng.chance(0.12 * foulMul)) this.foul(def, att, true);
      return;
    }
    this.createChance(att, def, credit?.type, credit?.shooter, credit?.creator, credit?.xgMul ?? 1);
  }

  /** Who is to blame for a lapse: the player most prone to them, weighted by how prone. */
  private lapseCulprit(t: LiveTeam): LivePlayer | undefined {
    const prone = this.onPitch(t).filter((p) => (p.fx?.lapse ?? 0) > 0);
    if (!prone.length) return undefined;
    let total = 0;
    for (const p of prone) total += p.fx?.lapse ?? 0;
    let r = this.rng.next() * total;
    for (const p of prone) {
      r -= p.fx?.lapse ?? 0;
      if (r <= 0) return p;
    }
    return prone[prone.length - 1];
  }

  /** The kind of chance that arises. Both sides' traits tilt the mix: crossers and target men bring headers, a sweeper keeper takes away one-on-ones. */
  private chooseChanceType(att: LiveTeam, def: LiveTeam): ChanceType {
    const a = this.strength(att).agg;
    const d = this.strength(def).agg;
    const hdr = clamp((1 + a.freqHeader) * d.againstFreqHeader, 0.55, 1.5);
    const lng = clamp((1 + a.freqLong) * d.againstFreqLong, 0.55, 1.5);
    // A keeper who reads the through-ball and sweeps up behind the line sees fewer one-on-ones against him.
    const sweepMul = 1 - clamp((this.strength(def).sweep - REF.sweep) / 280, -0.08, 0.12);
    const one = clamp((1 + a.freq1v1) * d.againstFreq1v1 * sweepMul, 0.55, 1.6);
    const r = this.rng.next();
    const pen = M.penaltyPerChance;
    const h = 0.19 * hdr;
    const l = 0.22 * lng;
    const o = 0.09 * one;
    if (r < pen) return "penalty";
    if (r < pen + h) return "header";
    if (r < pen + h + l) return "long";
    if (r < pen + h + l + o) return "oneonone";
    return "open";
  }

  private act(p: LivePlayer | undefined, k: SignalKey, n = 1) {
    if (!p) return;
    const a = (p.line.acts ??= {});
    a[k] = (a[k] ?? 0) + n;
  }

  /** Trait effect on a shot's quality: how well the taker does it, and the defending side's and keeper's traits. */
  private traitXg(att: LiveTeam, def: LiveTeam, shooter: LivePlayer, creator: LivePlayer | null, type: ChanceType): number {
    let m = 1;
    const fx = shooter.fx;
    if (fx) {
      m *= (fx[XG_KEY[type]] as number | undefined) ?? 1;
      const imp = this.input.importance - 1;
      let adj = (fx.bigMatch ?? 0) * 0.05 * imp;
      const diff = att.goals - def.goals;
      if (this.minute >= 75 && Math.abs(diff) <= 1) adj += (fx.clutch ?? 0) * 0.06;
      if (diff < 0) adj += (fx.trailing ?? 0) * 0.06;
      if (type === "oneonone" || type === "penalty") adj += (fx.composure ?? 0) * 0.04;
      m *= clamp(1 + adj, 0.8, 1.25);
    }
    if (creator?.fx?.xgCreated) m *= creator.fx.xgCreated;
    const ag = this.strength(def).agg;
    if (ag.againstStar !== 1 && this.strength(att).star === shooter) m *= ag.againstStar;
    m *= type === "open" ? ag.againstXgOpen : type === "header" ? ag.againstXgHeader : type === "long" ? ag.againstXgLong : type === "oneonone" ? ag.againstXg1v1 : 1;
    const gk = this.onPitch(def).find((p) => p.input.slot === "GK")?.fx;
    if (gk) {
      if (type === "penalty") m *= gk.penSave ?? 1;
      else {
        m *= gk.save ?? 1;
        if (type === "oneonone") m *= gk.save1v1 ?? 1;
        if (type === "header") m *= gk.claim ?? 1;
      }
    }
    return clamp(m, 0.6, 1.5);
  }

  private createChance(att: LiveTeam, def: LiveTeam, forced?: ChanceType, forcedShooter?: LivePlayer, forcedCreator?: LivePlayer | null, xgMul = 1) {
    const type = forced ?? this.chooseChanceType(att, def);
    let shooter: LivePlayer | undefined = forcedShooter;
    if (!shooter) {
      if (type === "header") shooter = this.pickWeighted(att, HEADER_WEIGHT, PICK_HEADER, undefined, M.pickExponent, "shootHeader");
      else if (type === "long" || type === "freekick") shooter = this.pickWeighted(att, LONG_WEIGHT, PICK_LONG, undefined, M.pickExponent, "shootLong");
      else if (type === "penalty") shooter = this.onPitch(att).sort((x, y) => this.val(y, "finishing") + this.val(y, "composure") - this.val(x, "finishing") - this.val(x, "composure"))[0];
      else shooter = this.pickWeighted(att, SHOOT_WEIGHT, PICK_SHOOT, undefined, M.pickExponent, "shoot", type === "oneonone" ? "shoot1v1" : undefined);
    }
    if (!shooter) return;
    let creator: LivePlayer | undefined | null = forcedCreator;
    if (creator === undefined) {
      const assistProb = type === "header" ? 0.92 : type === "oneonone" ? 0.85 : type === "open" ? 0.72 : 0;
      creator = this.rng.chance(assistProb) ? this.pickWeighted(att, CREATE_WEIGHT, type === "header" ? PICK_CROSS : PICK_CREATE, shooter, M.pickExponent, "create", type === "header" ? "createCross" : type === "oneonone" ? "createThrough" : "createOpen") ?? null : null;
    }

    // Key moments for the user's player.
    if (this.input.interactive && this.canAsk() && !forcedShooter) {
      if (shooter.input.isUser && type !== "penalty") return this.askShoot(att, def, shooter, creator ?? null, type);
      if (creator && creator.input.isUser) return this.askCreate(att, def, creator, shooter, type);
      const keeper = this.onPitch(def).find((p) => p.input.slot === "GK");
      if (keeper?.input.isUser && (type === "oneonone" || type === "open") && this.rng.chance(0.5)) return this.askKeep(att, def, shooter, creator ?? null, type, keeper);
      if (keeper?.input.isUser && type === "header" && this.rng.chance(0.5)) return this.askClaim(att, def, shooter, creator ?? null, keeper);
    }
    this.resolveShot(att, def, shooter, creator ?? null, type, xgMul);
  }

  /**
   * Attacks start with the keeper too. Credit is a deterministic share (no rng draw, so seeded matches are unchanged): through-balls
   * over the top count as launches; open-play moves split between launching and building short by the keeper's own bent.
   */
  private creditDistribution(att: LiveTeam, type: ChanceType) {
    if (type !== "open" && type !== "oneonone") return;
    const gk = this.onPitch(att).find((p) => p.input.slot === "GK");
    if (!gk) return;
    const skill = clamp((this.val(gk, "kicking") - 40) / 50, 0.2, 1);
    if (type === "oneonone") return this.act(gk, "launch", 0.5 * skill);
    const longBias = clamp(0.5 + (this.val(gk, "kicking") - this.val(gk, "composure")) / 60, 0.2, 0.8);
    this.act(gk, "launch", 0.25 * skill * longBias);
    this.act(gk, "buildUp", 0.25 * skill * (1 - longBias));
  }

  private shooterQuality(p: LivePlayer, type: ChanceType): number {
    switch (type) {
      case "header": return this.val(p, "heading") * 0.5 + this.val(p, "jumping") * 0.25 + this.val(p, "strength") * 0.25;
      case "long":
      case "freekick": return this.val(p, "longShots") * 0.6 + this.val(p, "technique") * 0.25 + this.val(p, "composure") * 0.15;
      case "penalty": return this.val(p, "finishing") * 0.4 + this.val(p, "composure") * 0.4 + this.val(p, "technique") * 0.2;
      case "oneonone": return this.val(p, "finishing") * 0.5 + this.val(p, "composure") * 0.3 + this.val(p, "technique") * 0.1 + this.val(p, "decisions") * 0.1;
      default: return this.val(p, "finishing") * 0.55 + this.val(p, "composure") * 0.15 + this.val(p, "firstTouch") * 0.1 + this.val(p, "technique") * 0.1 + this.val(p, "decisions") * 0.1;
    }
  }

  /**
   * What the new attributes add to a shot's quality, as one bounded multiplier: the runner's movement against the back line's marking,
   * the aerial contest, the creator's imagination, the taker's choice of moment, and the keeper's particular strengths (one-on-ones, crosses).
   */
  private skillXg(shooter: LivePlayer, creator: LivePlayer | null, def: LiveTeam, type: ChanceType, keeper: LivePlayer | undefined): number {
    if (type === "penalty") return 1;
    const sDef = this.strength(def);
    let m = 1;
    if (type !== "long" && type !== "freekick") m *= Math.exp(clamp((this.spec(shooter, "offBall") - REF.offBall - (sDef.mark - REF.mark)) / 130, -0.1, 0.1));
    if (type === "header") m *= Math.exp(-clamp((sDef.air - REF.air) / 200, -0.08, 0.08));
    if (type === "open" || type === "oneonone" || type === "header") {
      if (creator) m *= 1 + clamp((this.spec(creator, "creativity") - REF.creativity) / 250, -0.03, 0.05);
      m *= 1 + clamp((this.spec(shooter, "decisions") - REF.decisions) / 400, -0.03, 0.04);
    }
    if (keeper) {
      if (type === "oneonone") m *= Math.exp(-clamp((this.spec(keeper, [["oneOnOnes", 0.6], ["anticipation", 0.2], ["reflexes", 0.2]]) - REF.oneOnOne) / 100, -0.12, 0.12));
      else if (type === "header") m *= Math.exp(-clamp((this.spec(keeper, [["command", 0.5], ["handling", 0.3], ["positioning", 0.2]]) - REF.command) / 180, -0.08, 0.08));
    }
    return m;
  }

  private resolveShot(att: LiveTeam, def: LiveTeam, shooter: LivePlayer, creator: LivePlayer | null, type: ChanceType, xgMul = 1, keeperMul = 1) {
    const sDef = this.strength(def);
    const q = this.shooterQuality(shooter, type);
    const pressure = type === "penalty" ? 1 : Math.exp(-(sDef.def - 70) / 120);
    const bigMatch = 1 + ((shooter.input.bigMatch - 50) / 50) * 0.06 * (this.input.importance - 1);
    let xg = XG_BASE[type] * Math.exp((q - Q_CENTRE) / M.xgSlope) * pressure * bigMatch * xgMul;
    xg *= Math.exp(-(sDef.gk - 73) / 70) * keeperMul;
    xg *= this.traitXg(att, def, shooter, creator, type);
    xg *= this.skillXg(shooter, creator, def, type, this.onPitch(def).find((p) => p.input.slot === "GK"));
    xg = clamp(xg, 0.01, type === "penalty" ? 0.92 : 0.8);
    att.shots++;
    att.xg += xg;
    shooter.line.shots++;
    if (shooter.line.inv) shooter.line.inv.xg += xg;
    const shotAct = SHOT_ACT[type];
    if (shotAct) this.act(shooter, shotAct);
    if (creator) {
      creator.line.keyPasses++;
      this.act(creator, type === "header" ? "chanceCross" : type === "oneonone" ? "chanceThrough" : "chanceOpen");
      this.bump(creator, 0.1, "chance");
    }
    this.creditDistribution(att, type);
    const sideTag = att.side;
    const keeper = this.onPitch(def).find((p) => p.input.slot === "GK");
    const desc = this.describeChance(type, shooter, creator);
    if (type === "penalty") this.log({ minute: this.minute, side: sideTag, type: "penalty", text: `Penalty to ${att.input.name}! ${this.name(shooter)} steps up…`, playerId: shooter.input.id, user: shooter.input.isUser });
    const r = this.rng.next();
    if (r < xg) {
      shooter.line.onTarget++;
      att.onTarget++;
      if (keeper) keeper.line.xgFaced = (keeper.line.xgFaced ?? 0) + xg;
      this.scoreGoal(att, def, shooter, creator, type, desc);
      return;
    }
    const onTargetRate = clamp(0.32 + (q - (Q_CENTRE - 3)) / 220, 0.18, 0.62);
    if (r < Math.max(xg + 0.05, onTargetRate)) {
      shooter.line.onTarget++;
      att.onTarget++;
      if (keeper) {
        keeper.line.saves++;
        keeper.line.xgFaced = (keeper.line.xgFaced ?? 0) + Math.max(xg, 0.05);
        if (type === "oneonone") this.act(keeper, "save1v1");
        else if (type === "header") {
          this.act(keeper, "claim");
          if (keeper.line.inv) keeper.line.inv.claims++;
        }
        this.bump(keeper, 0.2, "save");
      }
      this.bump(shooter, 0.04, "shot");
      if (this.rng.chance(0.3)) att.corners++;
      this.log({ minute: this.minute, side: sideTag, type: "save", text: `${desc} — ${keeper ? this.name(keeper) : "the keeper"} saves!`, playerId: shooter.input.id, otherId: keeper?.input.id, user: shooter.input.isUser || keeper?.input.isUser, big: xg >= 0.15 });
      return;
    }
    const miss = this.rng.next();
    if (miss < 0.06) {
      this.log({ minute: this.minute, side: sideTag, type: "woodwork", text: `${desc} — off the woodwork!`, playerId: shooter.input.id, user: shooter.input.isUser });
    } else if (miss < 0.4) {
      const blocker = this.pickWeighted(def, DEFEND_WEIGHT, PICK_BLOCK);
      if (blocker) {
        blocker.line.tackles++;
        this.act(blocker, "block");
        this.bump(blocker, 0.08, "defence");
      }
      att.corners += this.rng.chance(0.5) ? 1 : 0;
      this.log({ minute: this.minute, side: sideTag, type: "blocked", text: `${desc} — blocked by ${blocker ? this.name(blocker) : "a defender"}.`, playerId: shooter.input.id, otherId: blocker?.input.id, user: shooter.input.isUser || blocker?.input.isUser });
    } else {
      if (xg > 0.25) {
        this.bump(shooter, -0.18, "missed");
        if (shooter.line.inv) shooter.line.inv.errors++;
      }
      this.log({ minute: this.minute, side: sideTag, type: "miss", text: `${desc} — ${xg > 0.3 ? "a huge chance wasted!" : "wide of the target."}`, playerId: shooter.input.id, user: shooter.input.isUser, big: xg > 0.25 });
    }
  }

  private describeChance(type: ChanceType, shooter: LivePlayer, creator: LivePlayer | null): string {
    if (!this.input.detail) return "";
    const s = this.name(shooter);
    const c = creator ? this.name(creator) : "";
    switch (type) {
      case "header": return creator ? `${c} whips in a cross, ${s} rises to head` : `${s} meets a corner with a header`;
      case "long": return `${s} lets fly from distance`;
      case "freekick": return `${s} curls the free kick`;
      case "oneonone": return creator ? `${c} slides ${s} through one-on-one` : `${s} breaks clear one-on-one`;
      case "penalty": return `${s}'s penalty`;
      default: return creator ? `${c} picks out ${s} in the box` : `${s} works space in the box and shoots`;
    }
  }

  private scoreGoal(att: LiveTeam, def: LiveTeam, shooter: LivePlayer, creator: LivePlayer | null, type: ChanceType, desc: string) {
    att.goals++;
    shooter.line.goals++;
    const goalAct = GOAL_ACT[type];
    if (goalAct) this.act(shooter, goalAct);
    if (this.minute >= 75 && Math.abs(att.goals - def.goals) <= 1) this.act(shooter, "lateGoal");
    this.bump(shooter, type === "penalty" ? 0.7 : 1.05, "goal");
    if (creator) {
      creator.line.assists++;
      this.bump(creator, 0.6, "assist");
    }
    for (const p of this.onPitch(def)) {
      p.line.conceded++;
      if (p.input.slot === "GK") this.bump(p, -0.3, "conceded");
      else if (["CB", "RB", "LB"].includes(p.input.slot)) this.bump(p, -0.12, "conceded");
    }
    this.goalsList.push({ minute: this.minute, side: att.side, scorer: shooter.input.id, assist: creator?.input.id, penalty: type === "penalty" });
    this.invalidate();
    const score = `${this.teams.home.goals}-${this.teams.away.goals}`;
    this.log({
      minute: this.minute,
      side: att.side,
      type: "goal",
      text: this.input.detail ? `GOAL! ${desc} — ${this.name(shooter)} scores! ${score}` : `${this.name(shooter)} ${score}`,
      playerId: shooter.input.id,
      otherId: creator?.input.id,
      user: shooter.input.isUser || creator?.input.isUser,
    });
  }

  private foul(def: LiveTeam, att: LiveTeam, dangerous: boolean) {
    const fouler = this.pickWeighted(def, DEFEND_WEIGHT, PICK_FOUL, undefined, 1, "foul");
    if (!fouler) return;
    def.fouls++;
    fouler.line.fouls++;
    this.bump(fouler, -0.05, "card");
    const card = this.rng.next();
    // Bookings go to the aggressive and the rash: a clear head (decisions) makes the same challenge a cleaner one.
    const temper = clamp(1 + (this.val(fouler, "aggression") - REF.aggr) / 140 - (this.spec(fouler, "decisions") - REF.decisions) / 200, 0.6, 1.5);
    const cardMul = (fouler.fx?.card ?? 1) * (def.goals < att.goals ? fouler.fx?.cardBehind ?? 1 : 1) * temper;
    const redP = M.redPerFoul * (dangerous ? 2 : 1) * cardMul;
    if (card < redP) this.sendOff(def, fouler, "a reckless challenge");
    else if (card < redP + M.yellowPerFoul * (dangerous ? 1.5 : 1) * cardMul) {
      fouler.line.yellow++;
      def.yellows++;
      this.bump(fouler, -0.35, "card");
      if (fouler.line.yellow >= 2) this.sendOff(def, fouler, "a second yellow card");
      else this.log({ minute: this.minute, side: def.side, type: "yellow", text: `Yellow card for ${this.name(fouler)}.`, playerId: fouler.input.id, user: fouler.input.isUser });
    } else if (this.input.detail && this.rng.chance(0.3)) {
      this.log({ minute: this.minute, side: def.side, type: "foul", text: `Foul by ${this.name(fouler)}.`, playerId: fouler.input.id, user: fouler.input.isUser });
    }
    // Injury from the challenge
    if (this.rng.chance(0.012)) {
      const victim = this.rng.pick(this.onPitch(att).filter((p) => p.input.slot !== "GK"));
      if (victim) this.injure(att, victim);
    }
    if (dangerous && this.rng.chance(0.35)) this.createChance(att, def, "freekick");
  }

  private sendOff(t: LiveTeam, p: LivePlayer, why: string) {
    p.line.red++;
    t.reds++;
    p.onPitch = false;
    p.line.minuteOff = this.minute;
    p.line.offReason = "red";
    this.bump(p, -1.4, "card");
    this.invalidate();
    this.log({ minute: this.minute, side: t.side, type: "red", text: `RED CARD! ${this.name(p)} is sent off for ${why}.`, playerId: p.input.id, user: p.input.isUser });
  }

  private injure(t: LiveTeam, p: LivePlayer) {
    if (p.line.injured) return;
    p.line.injured = true;
    this.injuries.push({ id: p.input.id, side: t.side, minute: this.minute });
    this.log({ minute: this.minute, side: t.side, type: "injury", text: `${this.name(p)} is down injured.`, playerId: p.input.id, user: p.input.isUser });
    if (p.input.isUser && this.input.interactive) {
      this.pending = {
        minute: this.minute,
        kind: "knock",
        prompt: "You've taken a knock. The physio is on — what do you do?",
        options: [
          { id: "off", label: "Come off", detail: "Protect yourself. You'll be substituted.", odds: 0.9 },
          { id: "play", label: "Play through it", detail: "Stay on at reduced sharpness; risk making it worse.", odds: 0.45 },
        ],
      };
      this.pendingCtx = { kind: "knock", team: t, player: p, creator: null, type: "open" };
      return;
    }
    this.substitute(t, p, true);
  }

  private maybeSubs() {
    if (this.minute < 56 || this.minute % 4 !== 0) return;
    for (const side of ["home", "away"] as Side[]) {
      const t = this.teams[side];
      if (t.subsUsed >= M.subsMax || t.subWindows >= 3) continue;
      const tired = this.onPitch(t)
        .filter((p) => p.input.slot !== "GK" && (p.energy < 58 || p.line.rating < 5.6 || (this.minute > 70 && p.energy < 70)))
        .sort((x, y) => x.energy - y.energy);
      if (!tired.length) continue;
      const n = Math.min(tired.length, this.rng.int(1, 3), M.subsMax - t.subsUsed);
      let made = 0;
      for (const p of tired.slice(0, n)) if (this.substitute(t, p, false)) made++;
      if (made) t.subWindows++;
    }
  }

  private halfTimeSubs(t: LiveTeam) {
    const bad = this.onPitch(t).find((p) => p.line.rating < 5.2 && p.input.slot !== "GK");
    if (bad && this.rng.chance(0.5)) {
      if (this.substitute(t, bad, false)) t.subWindows++;
    }
  }

  private substitute(t: LiveTeam, off: LivePlayer, forced: boolean): boolean {
    if (t.subsUsed >= M.subsMax) {
      if (forced) {
        off.onPitch = false;
        off.line.minuteOff = this.minute;
        off.line.offReason = "injury";
        this.invalidate();
      }
      return false;
    }
    const slot = off.input.slot;
    const candidates = t.bench.filter((b) => !b.onPitch && b.line.minuteOn < 0);
    if (!candidates.length) return false;
    const pick = candidates.sort((x, y) => this.subFit(y, slot) - this.subFit(x, slot))[0];
    off.onPitch = false;
    off.line.minuteOff = this.minute;
    off.line.offReason = forced ? "injury" : "sub";
    pick.input = { ...pick.input, slot };
    pick.eff = effective(pick.input, pick.condition);
    pick.lvl = overallExact(pick.input.attrs, slot) * pick.condition;
    pick.sp = specials(pick.eff, pick.lvl);
    pick.zones = zonesOfFx(pick.eff, pick.fx);
    pick.onPitch = true;
    pick.line.slot = slot;
    pick.line.minuteOn = this.minute;
    t.players.push(pick);
    t.subsUsed++;
    this.invalidate();
    this.log({ minute: this.minute, side: t.side, type: "sub", text: `Substitution ${t.input.short}: ${this.name(pick)} on for ${this.name(off)}.`, playerId: pick.input.id, otherId: off.input.id, user: pick.input.isUser || off.input.isUser });
    if (pick.input.isUser && this.input.detail) {
      this.log({ minute: this.minute, side: t.side, type: "info", text: `YOU'RE COMING ON at ${slot}. ${this.subContext(t, off, pick)}`, playerId: pick.input.id, user: true, tag: "involve" });
    }
    return true;
  }

  private subFit(p: LivePlayer, slot: Position): number {
    const same = p.input.slot === slot ? 12 : 0;
    const gkPenalty = (slot === "GK") !== (p.input.slot === "GK") ? -60 : 0;
    const keys: AttrKey[] = slot === "GK" ? ["reflexes", "handling"] : ["passing", "finishing", "tackling", "dribbling", "pace"];
    return keys.reduce((s, k) => s + p.eff[k], 0) / keys.length + same + gkPenalty;
  }

  private shootout() {
    const order = (t: LiveTeam) =>
      this.onPitch(t).sort((x, y) => this.val(y, "finishing") + this.val(y, "composure") - this.val(x, "finishing") - this.val(x, "composure"));
    const hs = order(this.teams.home);
    const as = order(this.teams.away);
    const gkOf = (t: LiveTeam) => this.onPitch(t).find((p) => p.input.slot === "GK");
    let h = 0;
    let a = 0;
    const kick = (shooter: LivePlayer | undefined, keeper: LivePlayer | undefined) => {
      if (!shooter) return false;
      const q = (this.val(shooter, "finishing") + this.val(shooter, "composure")) / 2;
      const g = keeper ? (this.val(keeper, "reflexes") + this.val(keeper, "diving")) / 2 : 40;
      return this.rng.chance(clamp(0.76 + (q - g) / 300, 0.55, 0.92));
    };
    for (let i = 0; i < 5; i++) {
      if (kick(hs[i % hs.length], gkOf(this.teams.away))) h++;
      if (kick(as[i % as.length], gkOf(this.teams.home))) a++;
    }
    let i = 5;
    while (h === a && i < 30) {
      const hk = kick(hs[i % hs.length], gkOf(this.teams.away));
      const ak = kick(as[i % as.length], gkOf(this.teams.home));
      if (hk) h++;
      if (ak) a++;
      i++;
    }
    if (h === a) h++;
    this.penalties = [h, a];
    this.log({ minute: 120, type: "shootout", text: `Penalty shoot-out: ${this.teams.home.input.short} ${h}-${a} ${this.teams.away.input.short}.` });
  }

  private finish() {
    this.finished = true;
    const h = this.teams.home;
    const a = this.teams.away;
    this.log({ minute: this.minute, type: "fulltime", text: `Full-time: ${h.input.name} ${h.goals}-${a.goals} ${a.input.name}${this.penalties ? ` (${this.penalties[0]}-${this.penalties[1]} pens)` : ""}.` });
    const end = this.minute;
    for (const t of [h, a]) {
      const opp = t === h ? a : h;
      const won = t.goals > opp.goals || (t.goals === opp.goals && this.penalties && (t === h ? this.penalties[0] > this.penalties[1] : this.penalties[1] > this.penalties[0]));
      const lost = t.goals < opp.goals || (t.goals === opp.goals && this.penalties && !won);
      const oppStarters = opp.input.starters;
      const oppAvg = oppStarters.reduce((sum, x) => sum + overallFor(x.attrs, x.slot), 0) / Math.max(1, oppStarters.length);
      const R = M.rating;
      for (const p of [...t.players, ...t.bench]) {
        if (p.line.minuteOn < 0) continue;
        if (p.line.minuteOff === null) p.line.minuteOff = end;
        const mins = (p.line.minuteOff ?? end) - p.line.minuteOn;
        const gk = p.line.slot === "GK";
        p.line.rating += won ? 0.3 : lost ? -0.25 : 0;
        // Good players rate higher against the same opposition, not just when events happen to find them.
        const quality = (overallFor(p.input.attrs, p.line.slot) * p.condition - oppAvg) * R.qualityPerPoint;
        p.line.rating += clamp(quality, R.qualityCap[0], R.qualityCap[1]);
        if (gk) {
          // Keepers are judged on clean sheets and goals prevented (expected goals faced minus goals conceded).
          if (opp.goals === 0 && mins >= 60) this.bump(p, R.keeperCleanSheet, "cleanSheet");
          const prevented = clamp(((p.line.xgFaced ?? 0) - p.line.conceded) * R.keeperPrevented, -1, 1.3);
          this.bump(p, prevented, prevented >= 0 ? "save" : "conceded");
        } else {
          // Outfield players share in how well the team controlled the game.
          if (["CB", "RB", "LB"].includes(p.line.slot) && opp.goals === 0 && mins >= 60) this.bump(p, 0.35, "cleanSheet");
          p.line.rating += clamp((t.xg - opp.xg) * R.dominance, -0.45, 0.6) * Math.min(1, mins / 60);
        }
        // Form on the day, plus consistency-scaled noise.
        p.line.rating += p.dayForm * R.dayForm + this.rng.normal(0, 0.28 + (100 - p.input.consistency) / 400);
        // Short cameos regress toward 6.2
        if (mins < 25) p.line.rating = 6.2 + (p.line.rating - 6.2) * (mins / 25);
        p.line.rating = Math.round(clamp(p.line.rating, 3, 10) * 10) / 10;
      }
    }
  }

  result(): MatchResult {
    const h = this.teams.home;
    const a = this.teams.away;
    const lines = [...h.players, ...h.bench, ...a.players, ...a.bench].filter((p) => p.line.minuteOn >= 0).map((p) => p.line);
    const unique = new Map<string, PlayerLine>();
    for (const l of lines) unique.set(l.id, l);
    const all = [...unique.values()];
    const winnerSide: Side | null = h.goals > a.goals ? "home" : a.goals > h.goals ? "away" : null;
    const motm = [...all].sort((x, y) => y.rating - x.rating || Number(y.side === winnerSide) - Number(x.side === winnerSide) || y.goals - x.goals)[0];
    return {
      homeGoals: h.goals,
      awayGoals: a.goals,
      extraTime: this.extraTime,
      penalties: this.penalties,
      goals: this.goalsList,
      lines: all,
      events: this.events,
      stats: this.statsNow(),
      motm: motm?.id ?? "",
      injuries: this.injuries,
    };
  }

  /** Live score + clock for the UI. */
  get score(): [number, number] {
    return [this.teams.home.goals, this.teams.away.goals];
  }

  get liveStats() {
    return this.statsNow();
  }

  private statsNow(): MatchResult["stats"] {
    const h = this.teams.home;
    const a = this.teams.away;
    const total = h.possessionTicks + a.possessionTicks || 1;
    const hp = Math.round((h.possessionTicks / total) * 100);
    return {
      possession: [hp, 100 - hp],
      shots: [h.shots, a.shots],
      onTarget: [h.onTarget, a.onTarget],
      xg: [Math.round(h.xg * 100) / 100, Math.round(a.xg * 100) / 100],
      corners: [h.corners, a.corners],
      fouls: [h.fouls, a.fouls],
      yellows: [h.yellows, a.yellows],
      reds: [h.reds, a.reds],
      ...(this.irng ? { passes: [h.passes, a.passes] as [number, number], passesOk: [h.passesOk, a.passesOk] as [number, number] } : {}),
    };
  }

  lineFor(id: string): PlayerLine | undefined {
    for (const side of ["home", "away"] as Side[]) {
      const t = this.teams[side];
      const p = [...t.players, ...t.bench].find((x) => x.input.id === id);
      if (p) return p.line;
    }
    return undefined;
  }

  /** A player's energy (0–100) as the match has worn it down. */
  energyOf(id: string): number | undefined {
    for (const side of ["home", "away"] as Side[]) {
      const p = [...this.teams[side].players, ...this.teams[side].bench].find((x) => x.input.id === id);
      if (p) return Math.round(p.energy);
    }
    return undefined;
  }

  isOnPitch(id: string): boolean {
    for (const side of ["home", "away"] as Side[]) {
      if (this.onPitch(this.teams[side]).some((p) => p.input.id === id)) return true;
    }
    return false;
  }

  /** Mentality change from the UI (user as captain/leader can't control tactics, but club AI can react). */
  setMentality(side: Side, m: number) {
    this.teams[side].input = { ...this.teams[side].input, mentality: clamp(m, -1, 1) };
    this.invalidate();
  }

  // ------------------------------------------------------------ the flow of play
  private inv(p: LivePlayer): Involvement {
    return (p.line.inv ??= emptyInv());
  }

  /** How much of the ball a player handles at this point of a move: build-up players early, forwards late, and whoever is on the flank the move is using. */
  private flowWeight(p: LivePlayer, zone: number, flank: 0 | 1 | 2): number {
    const slot = p.input.slot;
    const base = BUILD_W[slot] * (1 - zone) + FINAL_W[slot] * zone;
    const side = SIDE_OF[slot];
    const lane = side === 1 ? (flank === 1 ? 1.25 : 0.8) : side === flank ? 2.4 : 0.45;
    // Quality shows in how well a player does things far more than in how often he is on the ball.
    return base * lane * Math.pow(this.rate(p, PASS_MIX) / 60, 0.35) * (zone > 0.5 ? this.pref(p, "create") : 1);
  }

  private pickFlow(t: LiveTeam, zone: number, flank: 0 | 1 | 2, exclude?: LivePlayer): LivePlayer | undefined {
    const r = this.irng as Rng;
    let total = 0;
    for (const p of t.players) if (p.onPitch && p !== exclude) total += this.flowWeight(p, zone, flank);
    if (total <= 0) return undefined;
    let x = r.next() * total;
    let last: LivePlayer | undefined;
    for (const p of t.players) {
      if (!p.onPitch || p === exclude) continue;
      const w = this.flowWeight(p, zone, flank);
      if (w <= 0) continue;
      last = p;
      x -= w;
      if (x <= 0) return p;
    }
    return last;
  }

  /** A defender for a kind of defensive work: who reads passes, who wins ground duels, who wins in the air, who clears. */
  private pickDefFlow(t: LiveTeam, kind: "lane" | "duel" | "air" | "clear"): LivePlayer | undefined {
    const r = this.irng as Rng;
    const mix = kind === "lane" ? PICK_INTERCEPT : kind === "duel" ? PICK_TACKLE : AIR_MIX;
    const weights = kind === "clear" ? CLEAR_WEIGHT : DEFEND_WEIGHT;
    let total = 0;
    for (const p of t.players) if (p.onPitch) total += weights[p.input.slot] * (this.rate(p, mix) / 60);
    if (total <= 0) return undefined;
    let x = r.next() * total;
    let last: LivePlayer | undefined;
    for (const p of t.players) {
      if (!p.onPitch) continue;
      const w = weights[p.input.slot] * (this.rate(p, mix) / 60);
      if (w <= 0) continue;
      last = p;
      x -= w;
      if (x <= 0) return p;
    }
    return last;
  }

  /** The way a move goes: down the left, through the middle, or down the right, tilted by who is on each flank. */
  private chooseFlank(t: LiveTeam): 0 | 1 | 2 {
    const r = this.irng as Rng;
    const lane = (side: 0 | 2) => {
      let s = 0;
      let n = 0;
      for (const p of t.players) {
        if (!p.onPitch || SIDE_OF[p.input.slot] !== side) continue;
        s += this.rate(p, WIDE_MIX);
        n++;
      }
      return n ? 0.29 * Math.exp((s / n - 64) / 90) : 0.1;
    };
    const wl = lane(0);
    const wr = lane(2);
    const x = r.next() * (wl + wr + 0.42);
    return x < wl ? 0 : x < wl + wr ? 2 : 1;
  }

  /**
   * One possession phase as the ball is actually moved: who passes to whom, who carries, who crosses, and who wins or loses each little
   * contest. None of it decides the result of the phase (that stays with the chance model); it is the football around it, drawn from
   * players' positions, the flank the move is on, and their attributes against the opposition's pressing.
   */
  private involve(att: LiveTeam, def: LiveTeam) {
    const r = this.irng as Rng;
    const sA = this.strength(att);
    const sD = this.strength(def);
    const press = clamp((sD.press - REF.press - (sA.resist - REF.resist)) * 0.004, -0.05, 0.08);
    const flank = this.chooseFlank(att);
    att.flank[flank]++;
    const st = att.input.style;
    const n = clamp(r.int(8, 13) + Math.round(((st?.tempo ?? 0.5) - 0.5) * 3), 6, 15);
    let holder = this.pickFlow(att, 0, flank);
    for (let i = 0; i < n && holder; i++) {
      const zone = (i + 1) / n;
      const slot = holder.input.slot;
      if (zone >= 0.7 && flank !== 1 && CROSSERS.has(slot) && SIDE_OF[slot] === flank && r.chance(0.3)) {
        this.flowCross(att, def, holder, press);
        return;
      }
      if (zone > 0.2 && zone < 0.9 && r.chance(CARRY_W[slot] * (flank !== 1 ? 1.3 : 1))) {
        if (!this.flowDribble(def, holder, press)) return;
      }
      const next = this.pickFlow(att, Math.min(1, zone + 1 / n), flank, holder);
      if (!next) break;
      const base = zone < 0.4 ? 0.9 : zone < 0.75 ? 0.82 : 0.7;
      const pOk = clamp(base + (this.rate(holder, PASS_MIX) - 62) / 240 - press, 0.4, 0.97);
      const ok = r.chance(pOk);
      const iv = this.inv(holder);
      iv.touches++;
      iv.passes++;
      att.passes++;
      this.dev(holder, zone > 0.6 ? 0.035 : 0.018, ok, pOk, "pass");
      if (!ok) {
        iv.possLost++;
        const d = this.pickDefFlow(def, "lane");
        if (d) {
          const di = this.inv(d);
          di.recoveries++;
          if (r.chance(0.6)) {
            di.interceptions++;
            this.bump(d, 0.015, "defence");
            this.note(d, "interception");
          } else this.note(d, "recovery");
        }
        this.note(holder, "passLost");
        return;
      }
      iv.passesOk++;
      att.passesOk++;
      if (zone > 0.65 && FINISHERS.has(next.input.slot) && r.chance(0.55)) this.inv(next).boxTouches++;
      holder = next;
    }
    if (holder) this.inv(holder).touches++;
    // The danger passes: a back line clears what the move leaves loose.
    if (r.chance(0.45)) {
      const d = this.pickDefFlow(def, "clear");
      if (d) {
        this.inv(d).clearances++;
        this.bump(d, 0.015, "defence");
        this.note(d, "clearance");
      }
    }
  }

  /** A carry past a defender. Returns whether the carrier keeps the ball. */
  private flowDribble(def: LiveTeam, carrier: LivePlayer, press: number): boolean {
    const r = this.irng as Rng;
    const d = this.pickDefFlow(def, "duel");
    if (!d) return true;
    const iv = this.inv(carrier);
    const di = this.inv(d);
    const p = clamp(0.54 + (this.rate(carrier, DRIB_MIX) - this.rate(d, DUEL_MIX)) / 150 - press * 0.5, 0.2, 0.85);
    const ok = r.chance(p);
    iv.touches++;
    iv.dribbles++;
    iv.duels++;
    di.duels++;
    this.dev(carrier, 0.07, ok, p, "dribble");
    this.dev(d, 0.05, !ok, 1 - p, "duel");
    if (ok) {
      iv.dribblesWon++;
      iv.duelsWon++;
      this.note(carrier, "dribbleWon");
      this.note(d, "beaten");
      this.duelStreakFor(d, false);
      return true;
    }
    di.duelsWon++;
    di.recoveries++;
    iv.possLost++;
    this.note(carrier, "dribbleLost");
    this.note(d, "duelWon");
    this.duelStreakFor(d, true);
    return false;
  }

  private flowCross(att: LiveTeam, def: LiveTeam, crosser: LivePlayer, press: number) {
    const r = this.irng as Rng;
    const iv = this.inv(crosser);
    iv.touches++;
    iv.crosses++;
    const p = clamp(0.3 + (this.rate(crosser, PICK_CROSS) - 62) / 150 - press, 0.12, 0.55);
    const ok = r.chance(p);
    this.dev(crosser, 0.05, ok, p, "cross");
    if (!ok) {
      const d = this.pickDefFlow(def, "clear");
      if (d) {
        this.inv(d).clearances++;
        this.bump(d, 0.015, "defence");
        this.note(d, "clearance");
      }
      this.note(crosser, "crossBlocked");
      return;
    }
    iv.crossesOk++;
    this.note(crosser, "crossOk");
    const target = this.pickFlow(att, 1, 1, crosser);
    const d = this.pickDefFlow(def, "air");
    if (!target || !d) return;
    const ti = this.inv(target);
    const di = this.inv(d);
    ti.touches++;
    ti.boxTouches++;
    ti.aerials++;
    di.aerials++;
    const pa = clamp(0.5 + (this.rate(target, AIR_MIX) - this.rate(d, AIR_MIX)) / 120, 0.2, 0.8);
    const won = r.chance(pa);
    this.dev(target, 0.05, won, pa, "aerial");
    this.dev(d, 0.05, !won, 1 - pa, "aerial");
    if (won) {
      ti.aerialsWon++;
      this.note(target, "aerialWon");
      this.note(d, "aerialLost");
    } else {
      di.aerialsWon++;
      di.clearances++;
      this.note(target, "aerialLost");
      this.note(d, "aerialWon");
    }
  }

  private duelStreakFor(d: LivePlayer, won: boolean) {
    if (!d.input.isUser) return;
    this.duelStreak = won ? this.duelStreak + 1 : 0;
  }

  /** A line of commentary about something small the user's player did. Rationed, and always a true description of a counted action. */
  private note(p: LivePlayer, kind: NoteKind) {
    if (!p.input.isUser || !this.input.detail || this.minute - this.lastNoteMinute < 3) return;
    const r = this.crng as Rng;
    if (!r.chance(NOTE_CHANCE[kind])) return;
    this.lastNoteMinute = this.minute;
    this.log({ minute: this.minute, side: p.line.side, type: "info", text: r.pick(NOTE_TEXT[kind]), playerId: p.input.id, user: true, tag: "involve" });
  }

  private userLive(): LivePlayer | undefined {
    if (!this.userId) return undefined;
    for (const side of ["home", "away"] as Side[]) {
      for (const p of this.teams[side].players) if (p.onPitch && p.input.id === this.userId) return p;
    }
    return undefined;
  }

  /** Once a minute: remember what the user's player has done, and now and then say how his match is going. */
  private watch() {
    const u = this.userLive();
    if (!u) return;
    this.touchHist.push(u.line.inv?.touches ?? 0);
    this.ratingHist.push(u.line.rating);
    if (this.minute % 5 === 0 && this.input.detail) this.statusCheck(u);
  }

  private statusCheck(u: LivePlayer) {
    const iv = this.inv(u);
    const slot = u.input.slot;
    if (this.minute - u.line.minuteOn < 12 || this.minute - this.lastStatusMinute < 12 || this.statusMade >= 6) return;
    const say = (kind: string, text: string) => {
      if (this.minute - (this.statusKinds[kind] ?? -99) < 30) return false;
      this.statusKinds[kind] = this.minute;
      this.lastStatusMinute = this.minute;
      this.statusMade++;
      this.log({ minute: this.minute, side: u.line.side, type: "info", text, playerId: u.input.id, user: true, tag: "status" });
      return true;
    };
    const len = this.touchHist.length;
    const touches10 = len > 10 ? this.touchHist[len - 1] - this.touchHist[len - 11] : 99;
    const ctx = this.userContext();
    if (slot !== "GK" && touches10 <= 3) {
      if (ctx && ctx.recentPossession !== undefined && ctx.recentPossession < 40) return void say("quiet", "Your team is struggling to progress the ball to you.");
      if (ctx && ctx.laneShare !== undefined && ctx.laneShare < 0.22 && ctx.attacks >= 10) return void say("quiet", "Play is going down the other side — you're not seeing much of the ball.");
      return void say("quiet", "You're struggling to get involved.");
    }
    if (this.duelStreak >= 3 && say("duels", `You've won ${this.duelStreak} consecutive defensive duels.`)) {
      this.duelStreak = 0;
      return;
    }
    if (WIDE_SLOTS.has(slot) && iv.dribblesWon >= 2 && iv.dribblesWon / Math.max(1, iv.dribbles) >= 0.6) return void say("space", "You're beginning to find space behind the full-back.");
    if (slot === "ST" && iv.boxTouches >= 3) return void say("space", "You're getting into good positions in the box.");
    const rl = this.ratingHist.length;
    if (rl > 10) {
      const trend = this.ratingHist[rl - 1] - this.ratingHist[rl - 11];
      if (trend >= 0.35) return void say("form", "You're growing into the game.");
      if (trend <= -0.35) return void say("form", "It isn't going your way at the moment.");
    }
  }

  /** What the user's player can see of the match's shape: used by the UI to explain a quiet night. Derived from counted attacks. */
  userContext(): FlowContext | undefined {
    if (!this.userId) return undefined;
    let line: PlayerLine | undefined;
    let side: Side | undefined;
    for (const s of ["home", "away"] as Side[]) {
      const p = [...this.teams[s].players, ...this.teams[s].bench].find((x) => x.input.id === this.userId);
      if (p) {
        line = p.line;
        side = s;
      }
    }
    if (!line || !side) return undefined;
    const t = this.teams[side];
    const slot = line.slot;
    const total = this.teams.home.possessionTicks + this.teams.away.possessionTicks;
    const recent = this.possHist.slice(-10);
    const attacks = t.flank[0] + t.flank[1] + t.flank[2];
    const mine = SIDE_OF[slot];
    return {
      side,
      slot,
      possession: total ? Math.round((t.possessionTicks / total) * 100) : 50,
      recentPossession: recent.length >= 6 ? Math.round((recent.filter((x) => x === side).length / recent.length) * 100) : undefined,
      attacks,
      flanks: [...t.flank] as [number, number, number],
      laneShare: attacks ? t.flank[mine] / attacks : undefined,
      lane: mine === 0 ? "left" : mine === 2 ? "right" : "centre",
      goalsFor: t.goals,
      goalsAgainst: this.teams[this.other(side)].goals,
      style: t.input.style,
      ratingTrend: this.ratingHist.length > 10 ? this.ratingHist[this.ratingHist.length - 1] - this.ratingHist[this.ratingHist.length - 11] : undefined,
    };
  }

  /** Where a player is in the match, for the "You" card. */
  playerState(id: string): PlayerState {
    for (const side of ["home", "away"] as Side[]) {
      const t = this.teams[side];
      const p = [...t.players, ...t.bench].find((x) => x.input.id === id);
      if (!p) continue;
      const l = p.line;
      if (l.minuteOn < 0) {
        if (this.finished) return { phase: "unused" };
        return { phase: this.isWarmingUp(t, p) ? "warming" : "bench" };
      }
      if (p.onPitch) return this.finished ? { phase: "fulltime", minuteOn: l.minuteOn, started: l.started } : { phase: "playing", minuteOn: l.minuteOn, started: l.started };
      return { phase: "off", minuteOn: l.minuteOn, minuteOff: l.minuteOff ?? this.minute, started: l.started, reason: l.offReason ?? "sub" };
    }
    return { phase: "none" };
  }

  /** The starters the manager would take off next: the same test the substitution window uses. */
  private tiredOnes(t: LiveTeam): LivePlayer[] {
    return this.onPitch(t)
      .filter((p) => p.input.slot !== "GK" && (p.energy < 58 || p.line.rating < 5.6 || (this.minute > 70 && p.energy < 70)))
      .sort((x, y) => x.energy - y.energy);
  }

  /** A bench player is warming up when, by the manager's own test, the next window would bring him on. */
  private isWarmingUp(t: LiveTeam, p: LivePlayer): boolean {
    if (this.half !== 2 || this.minute < 52 || t.subsUsed >= M.subsMax || t.subWindows >= 3) return false;
    const first = this.tiredOnes(t)[0];
    if (!first) return false;
    const candidates = t.bench.filter((b) => !b.onPitch && b.line.minuteOn < 0);
    const pick = [...candidates].sort((x, y) => this.subFit(y, first.input.slot) - this.subFit(x, first.input.slot))[0];
    return pick === p;
  }

  /** Why the manager is sending a substitute on: only reasons the score, the clock and the legs actually support. */
  private subContext(t: LiveTeam, off: LivePlayer, on: LivePlayer): string {
    const opp = this.teams[this.other(t.side)];
    const diff = t.goals - opp.goals;
    const slot = on.input.slot;
    const attacker = ["ST", "RW", "LW", "AM"].includes(slot);
    const oppDef = this.onPitch(opp).filter((p) => ["CB", "RB", "LB"].includes(p.input.slot));
    const tired = oppDef.length ? oppDef.reduce((s, p) => s + p.energy, 0) / oppDef.length < 62 : false;
    if (diff > 0 && this.minute >= 70) return attacker ? "Hold the ball up and run the clock down." : slot === "GK" ? "Keep it tight." : "Protect the lead.";
    if (diff < 0 && this.minute >= 60) return attacker ? "Find an equaliser." : "Help push the side forward.";
    if (attacker && tired) return "Attack their tired defenders.";
    if (slot === "RW" || slot === "LW") return "Add width and stretch them.";
    if (slot === "RB" || slot === "LB") return "Support the flank.";
    if (slot === "ST") return `Lead the line in place of ${off.input.name}.`;
    return "Keep possession and tidy things up.";
  }

  // ------------------------------------------------------------ moments the user is asked about
  private optionOdds(p: LivePlayer, o: MomentOpt, opp: LiveTeam): number {
    const wide = clamp((this.strength(opp).def - 70) / 150, -0.1, 0.1);
    const adj = o.defending ? 0 : -wide;
    return clamp(o.base + (this.rate(p, o.mix) - 62) / o.scale + adj + (o.suits ? 0.04 : 0), 0.12, 0.92);
  }

  /** How likely the user's player is to be the one involved at this point of the match, relative to his team-mates. */
  private momentShare(t: LiveTeam, u: LivePlayer, attacking: boolean): number {
    let total = 0;
    let mine = 0;
    for (const p of t.players) {
      if (!p.onPitch) continue;
      const w = attacking ? this.flowWeight(p, 0.5, 1) : DEFEND_WEIGHT[p.input.slot] * (this.rate(p, PICK_TACKLE) / 60);
      total += w;
      if (p === u) mine = w;
    }
    return total ? mine / total : 0;
  }

  private maybeMoment(att: LiveTeam, def: LiveTeam): boolean {
    if (!this.input.interactive || this.pending || !this.irng) return false;
    const u = this.userLive();
    if (!u) return false;
    const attacking = u.line.side === att.side;
    if (!this.canAsk(0.4)) return false;
    const slot = u.input.slot;
    const r = this.irng;
    if (attacking) {
      const p = clamp(this.momentShare(att, u, true) * 0.85 * ATTACK_K[slot], 0, 0.2);
      if (!r.chance(p)) return false;
      this.askProgress(att, def, u);
      return true;
    }
    const p = clamp(this.momentShare(def, u, false) * 1.0 * DEFEND_K[slot], 0, 0.22);
    if (!r.chance(p)) return false;
    this.askHold(att, def, u);
    return true;
  }

  private buildOptions(u: LivePlayer, group: MomentOpt[], opp: LiveTeam): { options: DecisionOption[]; opts: Record<string, MomentOpt>; ev: Record<string, number> } {
    const fx = u.fx;
    const chosen = [...group];
    const has = (id: string) => chosen.some((o) => o.id === id);
    if (fx && !group[0]?.defending) {
      if (isLongShot(fx) && !has("distance") && u.input.slot !== "GK") chosen.splice(chosen.length - 1, 0, MOMENT.distance);
      if (isPlaymaker(fx) && !has("through") && !has("split") && u.input.slot !== "GK" && u.input.slot !== "ST") chosen.splice(chosen.length - 1, 0, MOMENT.split);
      if (isTrickster(fx) && !has("takeOn") && u.input.slot !== "GK" && u.input.slot !== "CB") chosen.splice(chosen.length - 1, 0, MOMENT.takeOn);
      if (isAerial(fx) && u.input.slot === "ST" && !has("attackCross")) chosen.splice(chosen.length - 1, 0, MOMENT.attackCross);
    }
    const out: DecisionOption[] = [];
    const opts: Record<string, MomentOpt> = {};
    const ev: Record<string, number> = {};
    for (const base of chosen.slice(0, 5)) {
      const o: MomentOpt = { ...base };
      if (fx && !o.defending) {
        if (o.id === "distance") o.suits = isLongShot(fx);
        else if (o.id === "through" || o.id === "split") o.suits = isPlaymaker(fx);
        else if (o.id === "takeOn") o.suits = isTrickster(fx);
        else if (o.id === "cross") o.suits = (fx.createCross ?? 1) >= 1.2;
        else if (o.id === "attackCross") o.suits = isAerial(fx);
      }
      const odds = this.optionOdds(u, o, opp);
      out.push({ id: o.id, label: o.label, detail: o.detail, odds, skills: o.mix.map(([k]) => ATTR_LABEL[k]), suits: o.suits });
      opts[o.id] = o;
      ev[o.id] = o.defending ? 1 - (odds * o.pMulOk + (1 - odds) * (o.pMulFail ?? 1.3)) : odds * o.pMulOk - (1 - odds) * (0.3 + o.counter);
    }
    return { options: out, opts, ev };
  }

  private askProgress(att: LiveTeam, def: LiveTeam, u: LivePlayer) {
    const slot = u.input.slot;
    const { options, opts, ev } = this.buildOptions(u, ATTACK_SET[slot], def);
    this.ask(
      { minute: this.minute, kind: "progress", moment: slot === "GK" ? "Goalkeeper" : ["ST", "RW", "LW", "AM"].includes(slot) ? "Final third" : "Build-up", prompt: ATTACK_PROMPT[slot], options },
      { kind: "progress", team: att, opp: def, player: u, creator: null, type: "open", opts, ev },
    );
  }

  private askHold(att: LiveTeam, def: LiveTeam, u: LivePlayer) {
    const slot = u.input.slot;
    const { options, opts, ev } = this.buildOptions(u, DEFEND_SET[slot] ?? DEFEND_SET.CM, att);
    this.ask(
      { minute: this.minute, kind: "hold", moment: "Defending", prompt: DEFEND_PROMPT[slot] ?? DEFEND_PROMPT.CM, options },
      { kind: "hold", team: def, opp: att, player: u, creator: null, type: "open", opts, ev },
    );
  }

  private resolveMoment(ctx: PendingContext, optionId: string) {
    const o = ctx.opts?.[optionId];
    if (!o) return;
    const u = ctx.player;
    const opp = ctx.opp as LiveTeam;
    const team = ctx.team;
    const r = this.rng;
    const odds = this.optionOdds(u, o, opp);
    const ok = r.chance(odds);
    const iv = this.inv(u);
    const say = (text: string) => this.log({ minute: this.minute, side: team.side, type: "info", text, playerId: u.input.id, user: true, tag: "involve" });
    this.dev(u, o.defending ? 0.12 : 0.1, ok, odds, "decision");
    if (o.defending) {
      // Defending: the attack is theirs; what the user chose shifts how dangerous it becomes.
      if (ok) {
        say(o.okText);
        if (o.stat === "duel") {
          iv.duels++;
          iv.duelsWon++;
          iv.recoveries++;
          u.line.tackles++;
          this.duelStreakFor(u, true);
        } else if (o.stat === "lane") {
          iv.interceptions++;
          iv.recoveries++;
          this.act(u, "intercept");
        }
        if (o.counter > 0 && r.chance(o.counter)) return this.createChance(team, opp, "open", undefined, undefined, 0.9);
        return this.contest(opp, team, o.pMulOk);
      }
      say(o.failText);
      if (o.stat === "duel") {
        iv.duels++;
        this.duelStreakFor(u, false);
      }
      return this.contest(opp, team, o.pMulFail ?? 1.3);
    }
    if (ok) {
      say(o.okText);
      if (o.stat === "pass") {
        iv.passes++;
        iv.passesOk++;
        iv.touches++;
        team.passes++;
        team.passesOk++;
      } else if (o.stat === "dribble") {
        iv.dribbles++;
        iv.dribblesWon++;
        iv.duels++;
        iv.duelsWon++;
        iv.touches++;
      } else if (o.stat === "cross") {
        iv.crosses++;
        iv.crossesOk++;
        iv.touches++;
      } else if (o.stat === "aerial") {
        iv.aerials++;
        iv.aerialsWon++;
        iv.boxTouches++;
      } else if (o.stat === "run") iv.boxTouches++;
      if (o.credit === "shot") {
        this.resolveShot(team, opp, u, null, o.type ?? "long", 1);
        return;
      }
      const credit: { type?: ChanceType; shooter?: LivePlayer; creator?: LivePlayer | null; xgMul?: number } = { type: o.type, xgMul: 1.05 };
      if (o.credit === "shooter") {
        credit.shooter = u;
        credit.creator = null;
      } else if (o.credit === "creator") {
        const shooter = this.pickWeighted(team, SHOOT_WEIGHT, PICK_SHOOT, u);
        if (shooter) {
          credit.shooter = shooter;
          credit.creator = u;
        } else credit.type = undefined;
      } else credit.type = undefined;
      return this.contest(team, opp, o.pMulOk, credit);
    }
    say(o.failText);
    iv.possLost++;
    if (o.stat === "pass") {
      iv.passes++;
      iv.touches++;
      team.passes++;
    } else if (o.stat === "dribble") {
      iv.dribbles++;
      iv.duels++;
      iv.touches++;
    } else if (o.stat === "cross") {
      iv.crosses++;
      iv.touches++;
    } else if (o.stat === "aerial") iv.aerials++;
    if (r.chance(o.counter)) this.createChance(opp, team, "open", undefined, undefined, 0.85);
  }

  // ------------------------------------------------------------ decisions
  /**
   * Whether the user can be asked something now. A moment's importance sets how soon after the last one it may come; the ceiling is a
   * density the match can carry (a choice every eight minutes or so), not a number of "first come" slots.
   */
  private canAsk(importance = 1): boolean {
    return this.decisionsMade < MAX_DECISIONS && this.minute - this.lastDecisionMinute >= (importance >= 0.8 ? 3 : 4);
  }

  private ask(d: PendingDecision, ctx: PendingContext) {
    this.pending = d;
    this.pendingCtx = ctx;
    this.lastDecisionMinute = this.minute;
    this.decisionsMade++;
    this.log({ minute: this.minute, side: ctx.team.side, type: "decision", text: d.prompt, playerId: ctx.player.input.id, user: true });
  }

  // The odds of the moments a controlled player can choose, from the attributes each one really asks for.
  private touchOdds(p: LivePlayer): number {
    return clamp(0.5 + (this.rate(p, [["firstTouch", 0.4], ["composure", 0.3], ["balance", 0.15], ["technique", 0.15]]) - 62) / 70, 0.2, 0.92);
  }

  private dribbleOdds(p: LivePlayer, keeperOrDefender: number): number {
    return clamp(0.38 + (this.rate(p, [["dribbling", 0.6], ["agility", 0.25], ["balance", 0.15]]) - keeperOrDefender) / 120, 0.12, 0.8);
  }

  private passOdds(p: LivePlayer): number {
    return clamp(0.55 + (this.rate(p, [["passing", 0.45], ["vision", 0.25], ["decisions", 0.15], ["technique", 0.15]]) - 62) / 80, 0.25, 0.92);
  }

  private throughOdds(p: LivePlayer): number {
    return clamp(0.42 + (this.rate(p, [["vision", 0.35], ["passing", 0.3], ["creativity", 0.2], ["technique", 0.15]]) - 62) / 75, 0.15, 0.9);
  }

  private crossOdds(p: LivePlayer): number {
    return clamp(0.48 + (this.rate(p, PICK_CROSS) - 62) / 80, 0.15, 0.9);
  }

  /** A sliding challenge: tackling (with timing and bite) against the dribbler's skill, agility and balance. */
  private slideOdds(d: LivePlayer, attacker: LivePlayer): number {
    return clamp(0.48 + (this.rate(d, [["tackling", 0.7], ["anticipation", 0.15], ["aggression", 0.15]]) - this.rate(attacker, [["dribbling", 0.6], ["agility", 0.25], ["balance", 0.15]])) / 90, 0.15, 0.9);
  }

  /** Staying on your feet: shape and a quick turn against the attacker's speed. */
  private jockeyOdds(d: LivePlayer, attacker: LivePlayer): number {
    return clamp(0.4 + (this.rate(d, [["positioning", 0.45], ["agility", 0.3], ["anticipation", 0.25]]) - this.rate(attacker, [["pace", 0.6], ["acceleration", 0.4]])) / 110 + 0.15, 0.15, 0.9);
  }

  private rushOdds(keeper: LivePlayer, shooter: LivePlayer): number {
    return clamp(0.45 + (this.rate(keeper, [["command", 0.4], ["oneOnOnes", 0.4], ["anticipation", 0.2]]) - this.val(shooter, "composure")) / 90, 0.15, 0.9);
  }

  private askShoot(att: LiveTeam, def: LiveTeam, shooter: LivePlayer, creator: LivePlayer | null, type: ChanceType) {
    const gk = this.strength(def).gk;
    const touch = this.touchOdds(shooter);
    const mate = this.pickWeighted(att, SHOOT_WEIGHT, PICK_SHOOT, shooter);
    const pass = this.passOdds(shooter);
    const dribble = this.dribbleOdds(shooter, gk);
    const where = type === "header" ? "The cross is coming in — you're unmarked at the back post." : type === "long" ? "The ball sits up for you 25 yards out." : type === "oneonone" ? "You're clean through on goal!" : "The ball drops to you in the box.";
    const options: DecisionOption[] = [
      {
        id: "shoot", label: type === "header" ? "Power header" : "Shoot first time", detail: "Quick strike before the defence recovers.", odds: clamp(XG_BASE[type] * Math.exp((this.shooterQuality(shooter, type) - (Q_CENTRE - 5)) / 20) * 2.2, 0.08, 0.9),
        skills: type === "header" ? skillNames("heading", "jumping", "strength") : type === "long" ? skillNames("longShots", "technique", "composure") : type === "oneonone" ? skillNames("finishing", "composure", "technique") : skillNames("finishing", "composure", "firstTouch"),
      },
    ];
    if (type !== "header") {
      options.push({ id: "touch", label: "Take a touch, pick your spot", detail: "Better angle if your touch is good — risk losing it.", odds: touch * 0.85, skills: skillNames("firstTouch", "composure", "technique") });
      if (type !== "long") options.push({ id: "dribble", label: type === "oneonone" ? "Round the keeper" : "Beat your man", detail: "High risk, high reward.", odds: dribble, skills: skillNames("dribbling", "agility", "balance") });
    }
    if (mate) options.push({ id: "pass", label: `Square it to ${this.name(mate)}`, detail: "Unselfish — set up a teammate.", odds: pass * 0.8, skills: skillNames("passing", "vision", "decisions") });
    this.ask({ minute: this.minute, kind: "shoot", prompt: where, options }, { kind: "shoot", team: att, opp: def, player: shooter, creator, type, mate });
  }

  private askCreate(att: LiveTeam, def: LiveTeam, creator: LivePlayer, shooter: LivePlayer, type: ChanceType) {
    const through = this.throughOdds(creator);
    const cross = this.crossOdds(creator);
    const options: DecisionOption[] = [
      { id: "through", label: `Thread it through to ${this.name(shooter)}`, detail: "Split the defence for a one-on-one.", odds: through, skills: skillNames("vision", "passing", "creativity") },
      { id: "cross", label: "Whip in a cross", detail: "Find a head in the box.", odds: cross, skills: skillNames("crossing", "technique") },
      { id: "self", label: "Have a go yourself", detail: "Shoot from range.", odds: clamp(0.25 + (this.val(creator, "longShots") - 65) / 100, 0.05, 0.6), skills: skillNames("longShots", "technique", "composure") },
      { id: "recycle", label: "Keep possession", detail: "Play it safe and recycle.", odds: 0.95, skills: skillNames("passing", "composure") },
    ];
    this.ask({ minute: this.minute, kind: "create", prompt: "You've got the ball in the final third with options ahead…", options }, { kind: "create", team: att, opp: def, player: creator, creator, type, mate: shooter });
  }

  private askDefend(d: LivePlayer, att: LiveTeam, def: LiveTeam) {
    const attacker = this.pickWeighted(att, SHOOT_WEIGHT, "dribbling");
    if (!attacker) return;
    const slide = this.slideOdds(d, attacker);
    const jockey = this.jockeyOdds(d, attacker);
    const options: DecisionOption[] = [
      { id: "slide", label: "Slide tackle", detail: "Win it cleanly — or concede a foul.", odds: slide, skills: skillNames("tackling", "anticipation", "aggression") },
      { id: "jockey", label: "Stay on your feet", detail: "Shepherd them wide and wait for help.", odds: jockey, skills: skillNames("positioning", "agility", "anticipation") },
      { id: "foul", label: "Take one for the team", detail: "Tactical foul — likely a booking.", odds: 0.9, skills: skillNames("decisions", "aggression") },
    ];
    this.ask({ minute: this.minute, kind: "defend", prompt: `${this.name(attacker)} is running at you on the counter!`, options }, { kind: "defend", team: def, opp: att, player: d, creator: null, type: "open", mate: attacker });
  }

  private askKeep(att: LiveTeam, def: LiveTeam, shooter: LivePlayer, creator: LivePlayer | null, type: ChanceType, keeper: LivePlayer) {
    const rush = this.rushOdds(keeper, shooter);
    const options: DecisionOption[] = [
      { id: "rush", label: "Rush out and smother", detail: "Close the angle fast.", odds: rush, skills: skillNames("command", "oneOnOnes", "anticipation") },
      { id: "stay", label: "Stay big on your line", detail: "React to the shot.", odds: clamp(0.5 + (this.rate(keeper, [["reflexes", 0.6], ["oneOnOnes", 0.4]]) - 65) / 100, 0.2, 0.9), skills: skillNames("reflexes", "oneOnOnes", "positioning") },
    ];
    this.ask({ minute: this.minute, kind: "keep", prompt: `${this.name(shooter)} is bearing down on your goal!`, options }, { kind: "keep", team: def, opp: att, player: keeper, creator, type, mate: shooter });
  }

  /** A cross is coming in and the user is in goal. */
  private askClaim(att: LiveTeam, def: LiveTeam, shooter: LivePlayer, creator: LivePlayer | null, keeper: LivePlayer) {
    const claim = clamp(0.5 + (this.rate(keeper, [["command", 0.5], ["handling", 0.3], ["positioning", 0.2]]) - 62) / 90, 0.2, 0.9);
    const punch = clamp(0.62 + (this.rate(keeper, [["handling", 0.4], ["command", 0.3], ["decisions", 0.3]]) - 62) / 160, 0.4, 0.92);
    const options: DecisionOption[] = [
      { id: "claim", label: "Come and claim it", detail: "Take it at its highest.", odds: claim, skills: [ATTR_LABEL.command, ATTR_LABEL.handling, ATTR_LABEL.positioning] },
      { id: "punch", label: "Punch it clear", detail: "Safe, but you won't keep it.", odds: punch, skills: [ATTR_LABEL.handling, ATTR_LABEL.command, ATTR_LABEL.decisions] },
      { id: "stay", label: "Stay on your line", detail: "Trust the defence and wait for the header.", odds: 0.55, skills: [ATTR_LABEL.positioning, ATTR_LABEL.reflexes] },
    ];
    this.ask({ minute: this.minute, kind: "claim", moment: "Goalkeeper", prompt: `${creator ? this.name(creator) : "A teammate"}'s cross is coming in and ${this.name(shooter)} is waiting at the back post.`, options }, { kind: "claim", team: def, opp: att, player: keeper, creator, type: "header", mate: shooter });
  }

  resolve(optionId: string): MatchEvent[] {
    const d = this.pending;
    const ctx = this.pendingCtx;
    if (!d || !ctx) return [];
    const before = this.events.length;
    this.pending = null;
    this.pendingCtx = null;
    const r = this.rng;
    const p = ctx.player;
    switch (ctx.kind) {
      case "claim": {
        const attTeam = ctx.opp as LiveTeam;
        const shooter = ctx.mate as LivePlayer;
        const claimOdds = optionId === "claim" ? clamp(0.5 + (this.rate(p, [["command", 0.5], ["handling", 0.3], ["positioning", 0.2]]) - 62) / 90, 0.2, 0.9) : optionId === "punch" ? clamp(0.62 + (this.rate(p, [["handling", 0.4], ["command", 0.3], ["decisions", 0.3]]) - 62) / 160, 0.4, 0.92) : 0.55;
        const ok = r.chance(claimOdds);
        this.dev(p, 0.12, ok, claimOdds, "decision");
        if (optionId === "claim" && ok) {
          if (p.line.inv) p.line.inv.claims++;
          this.act(p, "claim");
          this.log({ minute: this.minute, side: ctx.team.side, type: "save", text: "You come out and claim it confidently.", playerId: p.input.id, user: true, tag: "involve" });
        } else if (optionId === "punch" && ok) {
          this.log({ minute: this.minute, side: ctx.team.side, type: "save", text: "You punch it clear under pressure.", playerId: p.input.id, user: true, tag: "involve" });
        } else this.resolveShot(attTeam, ctx.team, shooter, ctx.creator, "header", 1, optionId === "claim" ? 1.4 : optionId === "punch" ? 1.1 : 0.95);
        break;
      }
      case "progress":
      case "hold":
        this.resolveMoment(ctx, optionId);
        break;
      case "knock": {
        if (optionId === "play") {
          for (const k in p.eff) p.eff[k as AttrKey] *= 0.88;
          p.lvl *= 0.88;
          for (const k of Object.keys(p.sp) as (keyof Specials)[]) p.sp[k] *= 0.88;
          p.line.injured = r.chance(0.5); // may aggravate
          this.log({ minute: this.minute, side: ctx.team.side, type: "info", text: "You grit your teeth and play on.", playerId: p.input.id, user: true });
          if (!p.line.injured) this.injuries = this.injuries.filter((i) => i.id !== p.input.id);
        } else this.substitute(ctx.team, p, true);
        break;
      }
      case "shoot": {
        const opp = ctx.opp as LiveTeam;
        if (optionId === "shoot") this.resolveShot(ctx.team, opp, p, ctx.creator, ctx.type, 0.95);
        else if (optionId === "touch") {
          const ok = r.chance(this.touchOdds(p));
          if (ok) this.resolveShot(ctx.team, opp, p, ctx.creator, ctx.type, 1.5);
          else {
            this.bump(p, -0.1);
            this.log({ minute: this.minute, side: ctx.team.side, type: "tackle", text: "Your touch is heavy and the chance is gone.", playerId: p.input.id, user: true });
          }
        } else if (optionId === "dribble") {
          const ok = r.chance(this.dribbleOdds(p, this.strength(opp).gk));
          if (ok) {
            this.bump(p, 0.15);
            this.resolveShot(ctx.team, opp, p, ctx.creator, "oneonone", 1.9);
          } else {
            this.bump(p, -0.12);
            this.log({ minute: this.minute, side: ctx.team.side, type: "tackle", text: "Too ambitious — the ball is snatched away.", playerId: p.input.id, user: true });
          }
        } else if (optionId === "pass" && ctx.mate) {
          const ok = r.chance(this.passOdds(p));
          if (ok) this.resolveShot(ctx.team, opp, ctx.mate, p, "open", 1.35);
          else this.log({ minute: this.minute, side: ctx.team.side, type: "tackle", text: "The pass is cut out.", playerId: p.input.id, user: true });
        }
        break;
      }
      case "create": {
        const opp = ctx.opp as LiveTeam;
        const mate = ctx.mate as LivePlayer;
        if (optionId === "through") {
          const ok = r.chance(this.throughOdds(p));
          if (ok) this.resolveShot(ctx.team, opp, mate, p, "oneonone", 1);
          else this.log({ minute: this.minute, side: ctx.team.side, type: "tackle", text: "Your through ball is intercepted.", playerId: p.input.id, user: true });
        } else if (optionId === "cross") {
          const ok = r.chance(this.crossOdds(p));
          const header = this.pickWeighted(ctx.team, HEADER_WEIGHT, PICK_HEADER, p) ?? mate;
          if (ok) this.resolveShot(ctx.team, opp, header, p, "header", 1.15);
          else this.log({ minute: this.minute, side: ctx.team.side, type: "tackle", text: "The cross is cleared.", playerId: p.input.id, user: true });
        } else if (optionId === "self") this.resolveShot(ctx.team, opp, p, null, "long", 1);
        else {
          this.bump(p, 0.04);
          this.log({ minute: this.minute, side: ctx.team.side, type: "info", text: "You keep it ticking over.", playerId: p.input.id, user: true });
        }
        break;
      }
      case "defend": {
        const attTeam = ctx.opp as LiveTeam;
        const attacker = ctx.mate as LivePlayer;
        if (optionId === "slide") {
          const win = r.chance(this.slideOdds(p, attacker));
          if (win) {
            p.line.tackles++;
            this.bump(p, 0.25);
            this.log({ minute: this.minute, side: ctx.team.side, type: "tackle", text: "Perfectly timed slide tackle!", playerId: p.input.id, user: true });
          } else if (r.chance(0.45)) this.foul(ctx.team, attTeam, true);
          else this.createChance(attTeam, ctx.team, "oneonone", attacker, null, 1.1);
        } else if (optionId === "jockey") {
          const win = r.chance(this.jockeyOdds(p, attacker));
          if (win) {
            p.line.tackles++;
            this.bump(p, 0.15);
            this.log({ minute: this.minute, side: ctx.team.side, type: "tackle", text: "You hold your ground and win it back.", playerId: p.input.id, user: true });
          } else this.createChance(attTeam, ctx.team, "open", attacker, null, 0.8);
        } else {
          ctx.team.fouls++;
          p.line.fouls++;
          if (r.chance(0.75)) {
            p.line.yellow++;
            ctx.team.yellows++;
            if (p.line.yellow >= 2) this.sendOff(ctx.team, p, "a second yellow card");
            else this.log({ minute: this.minute, side: ctx.team.side, type: "yellow", text: "You take the booking to stop the break.", playerId: p.input.id, user: true });
          }
        }
        break;
      }
      case "keep": {
        const attTeam = ctx.opp as LiveTeam;
        const shooter = ctx.mate as LivePlayer;
        if (optionId === "rush") {
          const ok = r.chance(this.rushOdds(p, shooter));
          this.resolveShot(attTeam, ctx.team, shooter, ctx.creator, ctx.type, 1, ok ? 0.45 : 1.35);
        } else this.resolveShot(attTeam, ctx.team, shooter, ctx.creator, ctx.type, 1, 0.92);
        break;
      }
    }
    this.afterPhase();
    return this.events.slice(before);
  }
}

interface PendingContext {
  kind: PendingDecision["kind"];
  team: LiveTeam;
  opp?: LiveTeam;
  player: LivePlayer;
  creator: LivePlayer | null;
  type: ChanceType;
  mate?: LivePlayer;
  /** Moments: the options as set up, and what each is worth to someone choosing for the user. */
  opts?: Record<string, MomentOpt>;
  ev?: Record<string, number>;
}

/** Convenience: simulate a whole match non-interactively. */
export function simulateMatch(input: MatchInput, rng: Rng): MatchResult {
  return new MatchEngine(input, rng).runToEnd();
}
