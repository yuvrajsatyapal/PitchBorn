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
import { overallFor } from "../players/attributes";
import { footAttrMultipliers, type Foot } from "../players/foot";
import type { MatchFx, SignalKey } from "../traits/types";
import { clamp, type Rng } from "../rng";
import type { Attributes, AttrKey, Position } from "../types";

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
}

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
}

export interface DecisionOption {
  id: string;
  label: string;
  detail: string;
  /** Rough success odds 0-1 shown to the player as a hint. */
  odds: number;
}

export interface PendingDecision {
  minute: number;
  kind: "shoot" | "create" | "defend" | "keep" | "knock";
  prompt: string;
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
  cache?: { mid: number; att: number; def: number; gk: number; agg: TeamAgg; star?: LivePlayer };
}

type ChanceType = "open" | "header" | "long" | "oneonone" | "penalty" | "freekick";

const XG_BASE: Record<ChanceType, number> = { open: 0.12, header: 0.095, long: 0.04, oneonone: 0.34, penalty: 0.76, freekick: 0.065 };

const XG_KEY: Record<ChanceType, keyof MatchFx> = { open: "xgOpen", header: "xgHeader", long: "xgLong", oneonone: "xg1v1", freekick: "xgFree", penalty: "xgPen" };
const SHOT_ACT: Partial<Record<ChanceType, SignalKey>> = { open: "shotOpen", header: "shotHeader", long: "shotLong", oneonone: "shot1v1" };
const GOAL_ACT: Partial<Record<ChanceType, SignalKey>> = { open: "goalOpen", header: "goalHeader", long: "goalLong", oneonone: "goal1v1" };

const SHOOT_WEIGHT: Record<Position, number> = { GK: 0, CB: 0.28, RB: 0.32, LB: 0.32, DM: 0.4, CM: 0.85, AM: 1.5, RW: 1.6, LW: 1.6, ST: 2.7 };
const HEADER_WEIGHT: Record<Position, number> = { GK: 0, CB: 1.1, RB: 0.2, LB: 0.2, DM: 0.5, CM: 0.5, AM: 0.4, RW: 0.6, LW: 0.6, ST: 2.8 };
const LONG_WEIGHT: Record<Position, number> = { GK: 0, CB: 0.15, RB: 0.3, LB: 0.3, DM: 0.7, CM: 1.4, AM: 1.6, RW: 1.1, LW: 1.1, ST: 0.9 };
const CREATE_WEIGHT: Record<Position, number> = { GK: 0.02, CB: 0.15, RB: 0.9, LB: 0.9, DM: 0.6, CM: 1.3, AM: 2.4, RW: 2.0, LW: 2.0, ST: 0.9 };
const DEFEND_WEIGHT: Record<Position, number> = { GK: 0, CB: 2.2, RB: 1.3, LB: 1.3, DM: 1.8, CM: 0.9, AM: 0.35, RW: 0.4, LW: 0.4, ST: 0.2 };

const MID_KEYS: AttrKey[] = ["passing", "vision", "firstTouch", "positioning", "stamina"];
const ATT_KEYS: AttrKey[] = ["finishing", "dribbling", "pace", "composure", "firstTouch"];
const DEF_KEYS: AttrKey[] = ["tackling", "positioning", "strength", "heading", "pace"];
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

function makeLive(input: MatchPlayerInput, side: Side, started: boolean, dayForm: number): LivePlayer {
  // A good or bad day: it changes how the player actually performs, so it shows in goals and ratings alike.
  const condition = conditionFactor(input) * (1 + dayForm);
  // Bench players get their effective attributes lazily when they come on.
  const eff = started ? effective(input, condition) : (input.attrs as Record<AttrKey, number>);
  return {
    zones: started ? zonesOfFx(eff, input.fx) : [0, 0, 0],
    fx: input.fx,
    input,
    condition,
    eff,
    energy: clamp(input.fitness, 30, 100),
    onPitch: started,
    dayForm,
    line: {
      id: input.id, side, slot: input.slot, started, minuteOn: started ? 0 : -1, minuteOff: null, rating: 6.0,
      goals: 0, assists: 0, shots: 0, onTarget: 0, keyPasses: 0, tackles: 0, saves: 0, fouls: 0, yellow: 0, red: 0, injured: false, conceded: 0, xgFaced: 0,
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

  constructor(input: MatchInput, rng: Rng) {
    this.input = input;
    this.rng = rng;
    const mk = (t: TeamInput, side: Side): LiveTeam => ({
      input: t,
      side,
      players: t.starters.map((p) => makeLive(p, side, true, rng.normal(0, M.dayFormSd * (p.fx?.variance ?? 1)))),
      bench: t.bench.map((p) => makeLive(p, side, false, rng.normal(0, M.dayFormSd * (p.fx?.variance ?? 1)))),
      subsUsed: 0,
      subWindows: 0,
      goals: 0, shots: 0, onTarget: 0, xg: 0, corners: 0, fouls: 0, yellows: 0, reds: 0, possessionTicks: 0,
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
    const gk = keeper ? (this.val(keeper, "reflexes") + this.val(keeper, "diving") + this.val(keeper, "handling") + this.val(keeper, "command") * 0.5) / 3.5 : 25;
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
      mid: mid * penalty * homeBoost * styleMid * (1 + clamp(teamMid, -0.05, 0.06)),
      att: att * penalty * homeBoost * styleAtt * (1 + mentality * 0.03) * (1 + clamp(teamAtt, -0.05, 0.06)),
      def: def * penalty * homeBoost * styleDef * (1 - mentality * 0.03) * (1 + clamp(teamDef, -0.05, 0.06)),
      gk,
      agg: agg ?? NEUTRAL_AGG,
      star,
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

  private pickWeighted(t: LiveTeam, weight: Record<Position, number>, attr: AttrKey, exclude?: LivePlayer, exp = 1, k1?: keyof MatchFx, k2?: keyof MatchFx): LivePlayer | undefined {
    // Hot path: avoid allocations.
    let total = 0;
    const players = t.players;
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p.onPitch || p === exclude) continue;
      const w = weight[p.input.slot];
      if (w <= 0) continue;
      const v = (exp === 1 ? this.val(p, attr) / 60 : Math.pow(this.val(p, attr) / 60, exp)) * (k1 ? this.pref(p, k1, k2) : 1);
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
      const v = (exp === 1 ? this.val(p, attr) / 60 : Math.pow(this.val(p, attr) / 60, exp)) * (k1 ? this.pref(p, k1, k2) : 1);
      r -= w * v;
      last = p;
      if (r <= 0) return p;
    }
    return last;
  }

  private bump(p: LivePlayer | undefined, delta: number) {
    if (p) p.line.rating += delta;
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
      const v = o.odds + this.rng.normal(0, 0.08);
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
        const drain = (0.55 - stamina / 300) * (this.half === 3 ? 1.2 : 1);
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
    const pHome = Math.pow(sh.mid, M.possessionExponent) / (Math.pow(sh.mid, M.possessionExponent) + Math.pow(sa.mid, M.possessionExponent));
    const attSide: Side = this.rng.chance(pHome) ? "home" : "away";
    const att = this.teams[attSide];
    const def = this.teams[this.other(attSide)];
    att.possessionTicks++;
    const sAtt = this.strength(att);
    const sDef = this.strength(def);

    // Foul in midfield / transition
    if (this.rng.chance(M.foulPerMinute * 0.5)) {
      this.foul(def, att, false);
      return;
    }

    // A defensive lapse (Error Prone, Poor Concentration…) can hand over a chance before the phase is even contested.
    // Only sides with such a player ever draw this random number, so everyone else's matches are untouched.
    if (sDef.agg.lapse > 0 && this.rng.chance(sDef.agg.lapse)) {
      const culprit = this.lapseCulprit(def);
      if (culprit) {
        this.bump(culprit, -0.3);
        this.log({ minute: this.minute, side: def.side, type: "foul", text: `${this.name(culprit)} gifts the ball away!` });
      }
      this.createChance(att, def, this.rng.chance(0.45) ? "oneonone" : "open");
      return;
    }

    // Soft-limit huge mismatches so cup ties stay believable.
    const gap = sAtt.att - sDef.def;
    const quality = Math.exp((15 * Math.tanh(gap / 15)) / 45);
    const pChance = clamp(M.chanceBase * 2.2 * quality, 0.07, 0.55);
    if (!this.rng.chance(pChance)) {
      // Defensive success — credit a defender occasionally.
      if (this.rng.chance(0.35)) {
        // Winning the ball back: a tackle or a read-the-play interception.
        const inter = this.rng.chance(0.4);
        const d = this.pickWeighted(def, DEFEND_WEIGHT, inter ? "positioning" : "tackling", undefined, 1, inter ? "intercept" : "tackle");
        if (d) {
          d.line.tackles++;
          if (inter) this.act(d, "intercept");
          this.bump(d, 0.06);
          // Winning it back can turn straight into a break (Counter-Attack Threat, Transition Specialist…).
          if (sDef.agg.counter > 0 && this.rng.chance(sDef.agg.counter)) {
            this.createChance(def, att, this.rng.chance(0.4) ? "oneonone" : "open");
            return;
          }
          if (d.input.isUser && this.input.interactive && this.canAsk() && this.rng.chance(0.22)) {
            this.askDefend(d, att, def);
            return;
          }
        }
      }
      if (this.rng.chance(0.12)) this.foul(def, att, true);
      return;
    }
    this.createChance(att, def);
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
    const one = clamp((1 + a.freq1v1) * d.againstFreq1v1, 0.55, 1.6);
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
      if (type === "header") shooter = this.pickWeighted(att, HEADER_WEIGHT, "heading", undefined, M.pickExponent, "shootHeader");
      else if (type === "long" || type === "freekick") shooter = this.pickWeighted(att, LONG_WEIGHT, "longShots", undefined, M.pickExponent, "shootLong");
      else if (type === "penalty") shooter = this.onPitch(att).sort((x, y) => this.val(y, "finishing") + this.val(y, "composure") - this.val(x, "finishing") - this.val(x, "composure"))[0];
      else shooter = this.pickWeighted(att, SHOOT_WEIGHT, "finishing", undefined, M.pickExponent, "shoot", type === "oneonone" ? "shoot1v1" : undefined);
    }
    if (!shooter) return;
    let creator: LivePlayer | undefined | null = forcedCreator;
    if (creator === undefined) {
      const assistProb = type === "header" ? 0.92 : type === "oneonone" ? 0.85 : type === "open" ? 0.72 : 0;
      creator = this.rng.chance(assistProb) ? this.pickWeighted(att, CREATE_WEIGHT, type === "header" ? "crossing" : "vision", shooter, M.pickExponent, "create", type === "header" ? "createCross" : type === "oneonone" ? "createThrough" : "createOpen") ?? null : null;
    }

    // Key moments for the user's player.
    if (this.input.interactive && this.canAsk() && !forcedShooter) {
      if (shooter.input.isUser && type !== "penalty") return this.askShoot(att, def, shooter, creator ?? null, type);
      if (creator && creator.input.isUser) return this.askCreate(att, def, creator, shooter, type);
      const keeper = this.onPitch(def).find((p) => p.input.slot === "GK");
      if (keeper?.input.isUser && (type === "oneonone" || type === "open") && this.rng.chance(0.5)) return this.askKeep(att, def, shooter, creator ?? null, type, keeper);
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
      case "header": return this.val(p, "heading") * 0.75 + this.val(p, "strength") * 0.25;
      case "long":
      case "freekick": return this.val(p, "longShots") * 0.8 + this.val(p, "composure") * 0.2;
      case "penalty": return this.val(p, "finishing") * 0.5 + this.val(p, "composure") * 0.5;
      case "oneonone": return this.val(p, "finishing") * 0.6 + this.val(p, "composure") * 0.4;
      default: return this.val(p, "finishing") * 0.7 + this.val(p, "composure") * 0.15 + this.val(p, "firstTouch") * 0.15;
    }
  }

  private resolveShot(att: LiveTeam, def: LiveTeam, shooter: LivePlayer, creator: LivePlayer | null, type: ChanceType, xgMul = 1, keeperMul = 1) {
    const sDef = this.strength(def);
    const q = this.shooterQuality(shooter, type);
    const pressure = type === "penalty" ? 1 : Math.exp(-(sDef.def - 70) / 120);
    const bigMatch = 1 + ((shooter.input.bigMatch - 50) / 50) * 0.06 * (this.input.importance - 1);
    let xg = XG_BASE[type] * Math.exp((q - 73) / M.xgSlope) * pressure * bigMatch * xgMul;
    xg *= Math.exp(-(sDef.gk - 73) / 70) * keeperMul;
    xg *= this.traitXg(att, def, shooter, creator, type);
    xg = clamp(xg, 0.01, type === "penalty" ? 0.92 : 0.8);
    att.shots++;
    att.xg += xg;
    shooter.line.shots++;
    const shotAct = SHOT_ACT[type];
    if (shotAct) this.act(shooter, shotAct);
    if (creator) {
      creator.line.keyPasses++;
      this.act(creator, type === "header" ? "chanceCross" : type === "oneonone" ? "chanceThrough" : "chanceOpen");
      this.bump(creator, 0.1);
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
    const onTargetRate = clamp(0.32 + (q - 70) / 220, 0.18, 0.62);
    if (r < Math.max(xg + 0.05, onTargetRate)) {
      shooter.line.onTarget++;
      att.onTarget++;
      if (keeper) {
        keeper.line.saves++;
        keeper.line.xgFaced = (keeper.line.xgFaced ?? 0) + Math.max(xg, 0.05);
        if (type === "oneonone") this.act(keeper, "save1v1");
        else if (type === "header") this.act(keeper, "claim");
        this.bump(keeper, 0.2);
      }
      this.bump(shooter, 0.04);
      if (this.rng.chance(0.3)) att.corners++;
      this.log({ minute: this.minute, side: sideTag, type: "save", text: `${desc} — ${keeper ? this.name(keeper) : "the keeper"} saves!`, playerId: shooter.input.id, otherId: keeper?.input.id, user: shooter.input.isUser || keeper?.input.isUser });
      return;
    }
    const miss = this.rng.next();
    if (miss < 0.06) {
      this.log({ minute: this.minute, side: sideTag, type: "woodwork", text: `${desc} — off the woodwork!`, playerId: shooter.input.id, user: shooter.input.isUser });
    } else if (miss < 0.4) {
      const blocker = this.pickWeighted(def, DEFEND_WEIGHT, "positioning");
      if (blocker) {
        blocker.line.tackles++;
        this.act(blocker, "block");
        this.bump(blocker, 0.08);
      }
      att.corners += this.rng.chance(0.5) ? 1 : 0;
      this.log({ minute: this.minute, side: sideTag, type: "blocked", text: `${desc} — blocked by ${blocker ? this.name(blocker) : "a defender"}.`, playerId: shooter.input.id, otherId: blocker?.input.id, user: shooter.input.isUser || blocker?.input.isUser });
    } else {
      if (xg > 0.25) this.bump(shooter, -0.18);
      this.log({ minute: this.minute, side: sideTag, type: "miss", text: `${desc} — ${xg > 0.3 ? "a huge chance wasted!" : "wide of the target."}`, playerId: shooter.input.id, user: shooter.input.isUser });
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
    this.bump(shooter, type === "penalty" ? 0.7 : 1.05);
    if (creator) {
      creator.line.assists++;
      this.bump(creator, 0.6);
    }
    for (const p of this.onPitch(def)) {
      p.line.conceded++;
      if (p.input.slot === "GK") this.bump(p, -0.3);
      else if (["CB", "RB", "LB"].includes(p.input.slot)) this.bump(p, -0.12);
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
    const fouler = this.pickWeighted(def, DEFEND_WEIGHT, "tackling", undefined, 1, "foul");
    if (!fouler) return;
    def.fouls++;
    fouler.line.fouls++;
    this.bump(fouler, -0.05);
    const card = this.rng.next();
    const cardMul = (fouler.fx?.card ?? 1) * (def.goals < att.goals ? fouler.fx?.cardBehind ?? 1 : 1);
    const redP = M.redPerFoul * (dangerous ? 2 : 1) * cardMul;
    if (card < redP) this.sendOff(def, fouler, "a reckless challenge");
    else if (card < redP + M.yellowPerFoul * (dangerous ? 1.5 : 1) * cardMul) {
      fouler.line.yellow++;
      def.yellows++;
      this.bump(fouler, -0.35);
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
    this.bump(p, -1.4);
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
    pick.input = { ...pick.input, slot };
    pick.eff = effective(pick.input, pick.condition);
    pick.zones = zonesOfFx(pick.eff, pick.fx);
    pick.onPitch = true;
    pick.line.slot = slot;
    pick.line.minuteOn = this.minute;
    t.players.push(pick);
    t.subsUsed++;
    this.invalidate();
    this.log({ minute: this.minute, side: t.side, type: "sub", text: `Substitution ${t.input.short}: ${this.name(pick)} on for ${this.name(off)}.`, playerId: pick.input.id, otherId: off.input.id, user: pick.input.isUser || off.input.isUser });
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
          if (opp.goals === 0 && mins >= 60) p.line.rating += R.keeperCleanSheet;
          p.line.rating += clamp(((p.line.xgFaced ?? 0) - p.line.conceded) * R.keeperPrevented, -1, 1.3);
        } else {
          // Outfield players share in how well the team controlled the game.
          if (["CB", "RB", "LB"].includes(p.line.slot) && opp.goals === 0 && mins >= 60) p.line.rating += 0.35;
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
    const total = h.possessionTicks + a.possessionTicks || 1;
    return {
      homeGoals: h.goals,
      awayGoals: a.goals,
      extraTime: this.extraTime,
      penalties: this.penalties,
      goals: this.goalsList,
      lines: all,
      events: this.events,
      stats: {
        possession: [Math.round((h.possessionTicks / total) * 100), 100 - Math.round((h.possessionTicks / total) * 100)],
        shots: [h.shots, a.shots],
        onTarget: [h.onTarget, a.onTarget],
        xg: [Math.round(h.xg * 100) / 100, Math.round(a.xg * 100) / 100],
        corners: [h.corners, a.corners],
        fouls: [h.fouls, a.fouls],
        yellows: [h.yellows, a.yellows],
        reds: [h.reds, a.reds],
      },
      motm: motm?.id ?? "",
      injuries: this.injuries,
    };
  }

  /** Live score + clock for the UI. */
  get score(): [number, number] {
    return [this.teams.home.goals, this.teams.away.goals];
  }

  get liveStats() {
    return this.result().stats;
  }

  lineFor(id: string): PlayerLine | undefined {
    for (const side of ["home", "away"] as Side[]) {
      const t = this.teams[side];
      const p = [...t.players, ...t.bench].find((x) => x.input.id === id);
      if (p) return p.line;
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

  // ------------------------------------------------------------ decisions
  private canAsk(): boolean {
    return this.decisionsMade < 7 && this.minute - this.lastDecisionMinute >= 4;
  }

  private ask(d: PendingDecision, ctx: PendingContext) {
    this.pending = d;
    this.pendingCtx = ctx;
    this.lastDecisionMinute = this.minute;
    this.decisionsMade++;
    this.log({ minute: this.minute, side: ctx.team.side, type: "decision", text: d.prompt, playerId: ctx.player.input.id, user: true });
  }

  private askShoot(att: LiveTeam, def: LiveTeam, shooter: LivePlayer, creator: LivePlayer | null, type: ChanceType) {
    const gk = this.strength(def).gk;
    const touch = clamp(0.5 + ((this.val(shooter, "firstTouch") + this.val(shooter, "composure")) / 2 - 62) / 70, 0.2, 0.92);
    const mate = this.pickWeighted(att, SHOOT_WEIGHT, "finishing", shooter);
    const pass = clamp(0.55 + ((this.val(shooter, "passing") + this.val(shooter, "vision")) / 2 - 62) / 80, 0.25, 0.92);
    const dribble = clamp(0.38 + (this.val(shooter, "dribbling") - gk) / 120, 0.12, 0.8);
    const where = type === "header" ? "The cross is coming in — you're unmarked at the back post." : type === "long" ? "The ball sits up for you 25 yards out." : type === "oneonone" ? "You're clean through on goal!" : "The ball drops to you in the box.";
    const options: DecisionOption[] = [
      { id: "shoot", label: type === "header" ? "Power header" : "Shoot first time", detail: "Quick strike before the defence recovers.", odds: clamp(XG_BASE[type] * Math.exp((this.shooterQuality(shooter, type) - 68) / 20) * 2.2, 0.08, 0.9) },
    ];
    if (type !== "header") {
      options.push({ id: "touch", label: "Take a touch, pick your spot", detail: "Better angle if your touch is good — risk losing it.", odds: touch * 0.85 });
      if (type !== "long") options.push({ id: "dribble", label: type === "oneonone" ? "Round the keeper" : "Beat your man", detail: "High risk, high reward.", odds: dribble });
    }
    if (mate) options.push({ id: "pass", label: `Square it to ${this.name(mate)}`, detail: "Unselfish — set up a teammate.", odds: pass * 0.8 });
    this.ask({ minute: this.minute, kind: "shoot", prompt: where, options }, { kind: "shoot", team: att, opp: def, player: shooter, creator, type, mate });
  }

  private askCreate(att: LiveTeam, def: LiveTeam, creator: LivePlayer, shooter: LivePlayer, type: ChanceType) {
    const through = clamp(0.42 + ((this.val(creator, "vision") + this.val(creator, "passing")) / 2 - 62) / 75, 0.15, 0.9);
    const cross = clamp(0.48 + (this.val(creator, "crossing") - 62) / 80, 0.15, 0.9);
    const options: DecisionOption[] = [
      { id: "through", label: `Thread it through to ${this.name(shooter)}`, detail: "Split the defence for a one-on-one.", odds: through },
      { id: "cross", label: "Whip in a cross", detail: "Find a head in the box.", odds: cross },
      { id: "self", label: "Have a go yourself", detail: "Shoot from range.", odds: clamp(0.25 + (this.val(creator, "longShots") - 65) / 100, 0.05, 0.6) },
      { id: "recycle", label: "Keep possession", detail: "Play it safe and recycle.", odds: 0.95 },
    ];
    this.ask({ minute: this.minute, kind: "create", prompt: "You've got the ball in the final third with options ahead…", options }, { kind: "create", team: att, opp: def, player: creator, creator, type, mate: shooter });
  }

  private askDefend(d: LivePlayer, att: LiveTeam, def: LiveTeam) {
    const attacker = this.pickWeighted(att, SHOOT_WEIGHT, "dribbling");
    if (!attacker) return;
    const slide = clamp(0.48 + (this.val(d, "tackling") - this.val(attacker, "dribbling")) / 90, 0.15, 0.9);
    const jockey = clamp(0.4 + (this.val(d, "positioning") - this.val(attacker, "pace")) / 110 + 0.15, 0.15, 0.9);
    const options: DecisionOption[] = [
      { id: "slide", label: "Slide tackle", detail: "Win it cleanly — or concede a foul.", odds: slide },
      { id: "jockey", label: "Stay on your feet", detail: "Shepherd them wide and wait for help.", odds: jockey },
      { id: "foul", label: "Take one for the team", detail: "Tactical foul — likely a booking.", odds: 0.9 },
    ];
    this.ask({ minute: this.minute, kind: "defend", prompt: `${this.name(attacker)} is running at you on the counter!`, options }, { kind: "defend", team: def, opp: att, player: d, creator: null, type: "open", mate: attacker });
  }

  private askKeep(att: LiveTeam, def: LiveTeam, shooter: LivePlayer, creator: LivePlayer | null, type: ChanceType, keeper: LivePlayer) {
    const rush = clamp(0.45 + (this.val(keeper, "command") - this.val(shooter, "composure")) / 90, 0.15, 0.9);
    const options: DecisionOption[] = [
      { id: "rush", label: "Rush out and smother", detail: "Close the angle fast.", odds: rush },
      { id: "stay", label: "Stay big on your line", detail: "React to the shot.", odds: clamp(0.5 + (this.val(keeper, "reflexes") - 65) / 100, 0.2, 0.9) },
    ];
    this.ask({ minute: this.minute, kind: "keep", prompt: `${this.name(shooter)} is bearing down on your goal!`, options }, { kind: "keep", team: def, opp: att, player: keeper, creator, type, mate: shooter });
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
      case "knock": {
        if (optionId === "play") {
          for (const k in p.eff) p.eff[k as AttrKey] *= 0.88;
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
          const ok = r.chance(clamp(0.5 + ((this.val(p, "firstTouch") + this.val(p, "composure")) / 2 - 62) / 70, 0.2, 0.92));
          if (ok) this.resolveShot(ctx.team, opp, p, ctx.creator, ctx.type, 1.5);
          else {
            this.bump(p, -0.1);
            this.log({ minute: this.minute, side: ctx.team.side, type: "tackle", text: "Your touch is heavy and the chance is gone.", playerId: p.input.id, user: true });
          }
        } else if (optionId === "dribble") {
          const ok = r.chance(clamp(0.38 + (this.val(p, "dribbling") - this.strength(opp).gk) / 120, 0.12, 0.8));
          if (ok) {
            this.bump(p, 0.15);
            this.resolveShot(ctx.team, opp, p, ctx.creator, "oneonone", 1.9);
          } else {
            this.bump(p, -0.12);
            this.log({ minute: this.minute, side: ctx.team.side, type: "tackle", text: "Too ambitious — the ball is snatched away.", playerId: p.input.id, user: true });
          }
        } else if (optionId === "pass" && ctx.mate) {
          const ok = r.chance(clamp(0.55 + ((this.val(p, "passing") + this.val(p, "vision")) / 2 - 62) / 80, 0.25, 0.92));
          if (ok) this.resolveShot(ctx.team, opp, ctx.mate, p, "open", 1.35);
          else this.log({ minute: this.minute, side: ctx.team.side, type: "tackle", text: "The pass is cut out.", playerId: p.input.id, user: true });
        }
        break;
      }
      case "create": {
        const opp = ctx.opp as LiveTeam;
        const mate = ctx.mate as LivePlayer;
        if (optionId === "through") {
          const ok = r.chance(clamp(0.42 + ((this.val(p, "vision") + this.val(p, "passing")) / 2 - 62) / 75, 0.15, 0.9));
          if (ok) this.resolveShot(ctx.team, opp, mate, p, "oneonone", 1);
          else this.log({ minute: this.minute, side: ctx.team.side, type: "tackle", text: "Your through ball is intercepted.", playerId: p.input.id, user: true });
        } else if (optionId === "cross") {
          const ok = r.chance(clamp(0.48 + (this.val(p, "crossing") - 62) / 80, 0.15, 0.9));
          const header = this.pickWeighted(ctx.team, HEADER_WEIGHT, "heading", p) ?? mate;
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
          const win = r.chance(clamp(0.48 + (this.val(p, "tackling") - this.val(attacker, "dribbling")) / 90, 0.15, 0.9));
          if (win) {
            p.line.tackles++;
            this.bump(p, 0.25);
            this.log({ minute: this.minute, side: ctx.team.side, type: "tackle", text: "Perfectly timed slide tackle!", playerId: p.input.id, user: true });
          } else if (r.chance(0.45)) this.foul(ctx.team, attTeam, true);
          else this.createChance(attTeam, ctx.team, "oneonone", attacker, null, 1.1);
        } else if (optionId === "jockey") {
          const win = r.chance(clamp(0.4 + (this.val(p, "positioning") - this.val(attacker, "pace")) / 110 + 0.15, 0.15, 0.9));
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
          const ok = r.chance(clamp(0.45 + (this.val(p, "command") - this.val(shooter, "composure")) / 90, 0.15, 0.9));
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
}

/** Convenience: simulate a whole match non-interactively. */
export function simulateMatch(input: MatchInput, rng: Rng): MatchResult {
  return new MatchEngine(input, rng).runToEnd();
}
