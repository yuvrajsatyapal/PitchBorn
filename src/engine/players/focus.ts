/**
 * Development focus: the kind of player someone is trying to become. An aspiration, not a trait.
 *
 * It does four small things, all of them fading as the career writes its own story:
 *  - at creation the user's starting attributes lean a little towards the role (the same total, redistributed);
 *  - monthly growth and match experience favour those attributes slightly (`focusTilt`);
 *  - behaviour that fits the focus counts a little more towards compatible traits, and NPC trait drift leans the same way;
 *  - training recommends the matching work.
 * It never grants a trait, never skips a requirement or a sample size, and has no say once the evidence says otherwise.
 */
import { clamp, r1, Rng } from "../rng";
import type { AttrKey, Attributes, Player, Position, TrainingFocus, TraitId } from "../types";
import { POSITION_WEIGHTS } from "./attributes";

export const NO_FOCUS = "none";

export interface FocusDef {
  id: string;
  name: string;
  /** One short line. */
  blurb: string;
  /** The areas it leans on (display). */
  areas: string[];
  /** Attributes it leans on, 0–1. */
  attrs: Partial<Record<AttrKey, number>>;
  /** Traits this kind of player most naturally grows into, if the play and the attributes back it. */
  traits: readonly TraitId[];
  /** Training that builds the same attributes. */
  training: readonly TrainingFocus[];
}

const none: FocusDef = { id: NO_FOCUS, name: "No preference", blurb: "Let your career shape the player you become.", areas: ["Nothing fixed"], attrs: {}, traits: [], training: [] };

const f = (id: string, name: string, blurb: string, areas: string[], attrs: FocusDef["attrs"], traits: TraitId[], training: TrainingFocus[]): FocusDef => ({ id, name, blurb, areas, attrs, traits, training });

/*
 * Each option leans on a handful of attributes (0–1). The first three `areas` are what the creation card shows; the weights are
 * broader. Attributes the role does not weigh are free colour (they show on the profile and in the match engine but never touch
 * the overall). Options for one position are written to differ in what they ask of the engine, not only in their label.
 */
const ST: FocusDef[] = [
  f("st_goalscorer", "Goalscorer", "Lives for goals.", ["Finishing", "Movement", "Composure"], { finishing: 1, offBall: 0.8, composure: 0.6, anticipation: 0.3 },
    ["poacher", "clinical_finisher", "first_time_finisher", "box_predator", "advanced_runner", "finesse_finisher", "penalty_specialist"], ["finishing"]),
  f("st_complete", "Complete Forward", "Contributes across the entire attack.", ["Finishing", "Technique", "Strength"], { finishing: 0.6, technique: 0.7, firstTouch: 0.7, strength: 0.6, dribbling: 0.5, decisions: 0.4, passing: 0.5 },
    ["complete_forward", "hold_up", "close_control", "false_nine", "power_finisher"], ["finishing", "passing"]),
  f("st_target", "Target Forward", "Wins the aerial duels and holds the ball up.", ["Heading", "Jumping", "Strength"], { heading: 1, jumping: 0.8, strength: 0.9, balance: 0.4, firstTouch: 0.4 },
    ["target_forward", "hold_up", "aerial_presence", "back_post_threat", "power_finisher", "strong_on_ball"], ["physical", "finishing"]),
  f("st_mobile", "Mobile Forward", "Runs the channels and stretches the defence.", ["Pace", "Acceleration", "Movement"], { pace: 1, acceleration: 0.9, offBall: 0.6, agility: 0.3 },
    ["advanced_runner", "channel_runner", "counter_attack_threat", "explosive_starter", "one_on_one_runner"], ["pace"]),
  f("st_creative", "Creative Forward", "Links play and makes chances for others.", ["Passing", "Creativity", "First touch"], { technique: 0.7, firstTouch: 0.7, decisions: 0.5, passing: 0.7, vision: 0.6, creativity: 0.4 },
    ["false_nine", "creative", "close_control", "through_ball_specialist", "flair", "risk_taker"], ["passing", "dribbling"]),
];

const W: FocusDef[] = [
  f("w_inside", "Inside Forward", "Cuts in from the flank to shoot.", ["Finishing", "Dribbling", "Movement"], { finishing: 1, dribbling: 0.7, agility: 0.5, offBall: 0.5, composure: 0.4, pace: 0.4 },
    ["inside_threat", "cut_in_threat", "finesse_finisher", "clinical_finisher", "box_predator", "first_time_finisher"], ["finishing", "dribbling"]),
  f("w_traditional", "Traditional Winger", "Hugs the touchline and delivers.", ["Crossing", "Pace", "Stamina"], { crossing: 1, pace: 0.7, stamina: 0.5, acceleration: 0.5, workRate: 0.3 },
    ["touchline_runner", "byline_creator", "byline_runner", "crossing_specialist", "speed_runner"], ["setPieces", "pace"]),
  f("w_creative", "Creative Winger", "Drifts inside to make things happen.", ["Creativity", "Passing", "Vision"], { creativity: 0.9, vision: 1, passing: 0.9, technique: 0.6, firstTouch: 0.5 },
    ["inverted_creator", "creative_spark", "half_space", "killer_pass", "through_ball_specialist", "creative", "playmaker"], ["passing"]),
  f("w_dribbler", "Direct Dribbler", "Takes defenders on, every time.", ["Dribbling", "Agility", "Acceleration"], { dribbling: 1, agility: 0.9, acceleration: 0.7, firstTouch: 0.5, balance: 0.3 },
    ["direct_winger", "isolation_dribbler", "flair", "close_control", "progressive_carrier", "one_on_one_runner"], ["dribbling"]),
  f("w_scorer", "Wide Goalscorer", "Plays wide, scores like a striker.", ["Finishing", "Movement", "Composure"], { finishing: 1, offBall: 0.8, composure: 0.7, pace: 0.5 },
    ["poacher", "advanced_runner", "box_predator", "back_post_threat", "clinical_finisher", "counter_attack_threat"], ["finishing"]),
];

const AM: FocusDef[] = [
  f("am_playmaker", "Playmaker", "Sets the tempo and creates for others.", ["Passing", "Vision", "Decisions"], { passing: 1, vision: 0.8, decisions: 0.7, composure: 0.6, firstTouch: 0.5, technique: 0.5 },
    ["playmaker", "line_breaker", "killer_pass", "through_ball_specialist", "creative", "one_touch_passer"], ["passing"]),
  f("am_scorer", "Goalscoring Midfielder", "Arrives late and scores from midfield.", ["Long shots", "Movement", "Stamina"], { longShots: 1, offBall: 0.8, finishing: 0.6, stamina: 0.7, workRate: 0.6, anticipation: 0.3 },
    ["late_box_runner", "distance_shooter", "second_striker", "clinical_finisher", "finesse_finisher", "power_finisher"], ["finishing"]),
  f("am_dribbler", "Creative Dribbler", "Beats players to open them up.", ["Dribbling", "Agility", "First touch"], { dribbling: 1, agility: 0.9, firstTouch: 0.7, acceleration: 0.6, technique: 0.5 },
    ["free_roamer", "flair", "close_control", "half_space", "creative_spark", "progressive_carrier", "final_third"], ["dribbling"]),
  f("am_creator", "Advanced Creator", "The final ball in the final third.", ["Creativity", "Vision", "Technique"], { creativity: 1, vision: 0.9, passing: 0.7, technique: 0.6, crossing: 0.3 },
    ["advanced_creator", "killer_pass", "through_ball_specialist", "line_breaker", "creative_spark", "set_piece_specialist", "dead_ball_specialist"], ["passing", "setPieces"]),
  f("am_shadow", "Shadow Striker", "Plays off the striker and attacks the box.", ["Finishing", "Movement", "Composure"], { finishing: 1, offBall: 1, acceleration: 0.7, composure: 0.7, anticipation: 0.5, pace: 0.4 },
    ["second_striker", "box_predator", "poacher", "first_time_finisher", "clinical_finisher", "advanced_runner"], ["finishing", "pace"]),
];

const CM: FocusDef[] = [
  f("cm_box", "Box-to-Box", "Covers every blade of grass.", ["Stamina", "Work rate", "Tackling"], { stamina: 1, workRate: 0.8, tackling: 0.6, strength: 0.5, offBall: 0.3, longShots: 0.3, pace: 0.3 },
    ["box_to_box", "midfield_engine", "relentless_runner", "transition_specialist", "late_box_runner", "pressing_machine"], ["physical"]),
  f("cm_playmaker", "Playmaker", "Dictates the game with the ball.", ["Passing", "Vision", "Technique"], { passing: 1, vision: 0.9, technique: 0.7, decisions: 0.6, firstTouch: 0.6 },
    ["playmaker", "line_breaker", "killer_pass", "through_ball_specialist", "long_pass_specialist", "switcher", "one_touch_passer"], ["passing"]),
  f("cm_tempo", "Tempo Controller", "Sets the rhythm of the match.", ["Decisions", "Composure", "Passing"], { decisions: 1, composure: 0.9, passing: 0.7, positioning: 0.5, firstTouch: 0.5, technique: 0.4 },
    ["tempo_controller", "metronome", "deep_controller", "one_touch_passer", "composed", "press_resistant"], ["passing"]),
  f("cm_winner", "Ball Winner", "Wins it back, and wins it early.", ["Tackling", "Work rate", "Interceptions"], { tackling: 1, interceptions: 0.6, stamina: 0.7, workRate: 0.7, anticipation: 0.5, aggression: 0.6 },
    ["ball_hunter", "aggressive", "clean_tackler", "pressing_machine", "lane_reader", "midfield_engine"], ["defending", "physical"]),
  f("cm_eight", "Advanced No. 8", "Drives forward into attacking space and links midfield to attack.", ["Movement", "Technique", "Dribbling"], { offBall: 1, technique: 0.8, dribbling: 0.8, passing: 0.7, stamina: 0.7, creativity: 0.7 },
    ["late_box_runner", "box_to_box", "progressive_carrier", "half_space", "transition_specialist", "distance_shooter"], ["dribbling", "passing"]),
];

const DM: FocusDef[] = [
  f("dm_anchor", "Defensive Anchor", "Shields the back four.", ["Positioning", "Marking", "Interceptions"], { positioning: 1, marking: 0.8, interceptions: 0.7, strength: 0.6, tackling: 0.6, anticipation: 0.5 },
    ["anchor", "defensive_screen", "aerial_dominator", "clean_tackler", "man_marker", "deep_controller"], ["defending"]),
  f("dm_winner", "Ball Winner", "Breaks up play and wins it back.", ["Tackling", "Aggression", "Work rate"], { tackling: 1, aggression: 0.8, workRate: 0.7, stamina: 0.7, strength: 0.5 },
    ["ball_hunter", "aggressive", "pressing_machine", "lane_reader", "midfield_engine", "transition_specialist"], ["defending", "physical"]),
  f("dm_dlp", "Deep-Lying Playmaker", "Starts the attack from deep.", ["Passing", "Vision", "Technique"], { passing: 1, vision: 0.9, technique: 0.7, composure: 0.6, firstTouch: 0.5 },
    ["deep_distributor", "metronome", "tempo_controller", "long_pass_specialist", "quick_distributor", "switcher"], ["passing"]),
  f("dm_controller", "Defensive Controller", "Reads the game and keeps it under control.", ["Interceptions", "Anticipation", "Decisions"], { interceptions: 1, anticipation: 0.9, decisions: 0.9, composure: 0.5, tackling: 0.4, positioning: 0.4 },
    ["deep_controller", "lane_reader", "anchor", "composed", "press_resistant", "tempo_controller"], ["defending", "passing"]),
  f("dm_halfback", "Half-Back", "Drops between the centre-backs to build, and protects the defence.", ["Positioning", "Passing", "Composure"], { positioning: 1, passing: 0.9, composure: 0.8, decisions: 0.7, anticipation: 0.6, marking: 0.4 },
    ["deep_controller", "lane_reader", "anchor", "deep_distributor", "composed", "press_resistant"], ["defending", "passing"]),
];

const CB: FocusDef[] = [
  f("cb_stopper", "Stopper", "Quick off the mark: steps out early and recovers behind.", ["Tackling", "Pace", "Anticipation"], { tackling: 1, pace: 0.8, acceleration: 0.7, anticipation: 0.7, interceptions: 0.4 },
    ["front_foot", "last_line", "man_marker", "clean_tackler"], ["defending", "pace"]),
  f("cb_aggressive", "Aggressive Stopper", "Steps forward to win duels and break attacks up early, at the price of bookings and space behind.", ["Aggression", "Strength", "Tackling"], { aggression: 1, strength: 0.9, tackling: 0.8, heading: 0.6, jumping: 0.5, anticipation: 0.5 },
    ["front_foot", "aggressive", "man_marker", "no_nonsense", "aerial_dominator"], ["defending", "physical"]),
  f("cb_ballplaying", "Ball-Playing Defender", "Builds the attack from the back.", ["Passing", "Composure", "Decisions"], { passing: 1, composure: 0.8, technique: 0.6, decisions: 0.6, firstTouch: 0.5, vision: 0.5 },
    ["ball_progressor", "long_pass_specialist", "quick_distributor", "composed", "one_touch_passer", "switcher", "press_resistant"], ["passing"]),
  f("cb_cover", "Cover Defender", "Reads danger and covers the space.", ["Positioning", "Anticipation", "Pace"], { positioning: 1, anticipation: 0.8, pace: 0.7, acceleration: 0.6, marking: 0.5, interceptions: 0.5 },
    ["cover_defender", "recovery_defender", "lane_reader", "last_line", "clean_tackler"], ["defending", "pace"]),
  f("cb_aerial", "Aerial Defender", "Rules the air at both ends.", ["Heading", "Jumping", "Strength"], { heading: 1, jumping: 0.9, strength: 0.8, marking: 0.4 },
    ["aerial_dominator", "set_piece_threat", "aerial_presence", "no_nonsense", "man_marker"], ["defending", "physical"]),
];

const FB: FocusDef[] = [
  f("fb_defensive", "Defensive Full-Back", "Defends first.", ["Tackling", "Marking", "Positioning"], { tackling: 1, marking: 0.8, positioning: 0.8, strength: 0.4, interceptions: 0.5 },
    ["defensive_fullback", "last_line", "man_marker", "clean_tackler", "aggressive", "recovery_defender", "lane_reader"], ["defending"]),
  f("fb_attacking", "Attacking Full-Back", "A winger in all but name.", ["Crossing", "Dribbling", "Stamina"], { crossing: 0.8, dribbling: 0.9, passing: 0.6, stamina: 0.6, technique: 0.6, agility: 0.4 },
    ["attacking_fullback", "early_crosser", "crossing_specialist", "progressive_carrier", "byline_runner", "relentless_runner"], ["dribbling", "setPieces"]),
  f("fb_inverted", "Inverted Full-Back", "Steps into midfield to build play.", ["Passing", "Decisions", "Technique"], { passing: 1, positioning: 0.6, decisions: 0.8, firstTouch: 0.6, technique: 0.6, vision: 0.7, composure: 0.5 },
    ["inverted_fullback", "one_touch_passer", "switcher", "composed", "press_resistant"], ["passing"]),
  f("fb_overlap", "Overlapping Full-Back", "Goes outside, goes past, delivers.", ["Pace", "Stamina", "Crossing"], { pace: 1, acceleration: 0.8, stamina: 0.9, crossing: 0.7, workRate: 0.6 },
    ["overlapping_runner", "byline_runner", "touchline_runner", "early_crosser", "relentless_runner", "explosive_starter"], ["pace", "physical"]),
  f("fb_complete", "Complete Full-Back", "Does a bit of everything: defends, progresses, supports attacks and recovers.", ["Stamina", "Positioning", "Crossing"], { stamina: 0.8, workRate: 0.7, tackling: 0.6, positioning: 0.6, crossing: 0.6, passing: 0.6, technique: 0.5, decisions: 0.5, anticipation: 0.4 },
    ["attacking_fullback", "defensive_fullback", "relentless_runner", "recovery_defender", "early_crosser", "lane_reader"], ["physical", "defending", "passing"]),
];

const GK: FocusDef[] = [
  f("gk_shot_stopper", "Shot Stopper", "Lives on the line and on reflexes.", ["Reflexes", "Diving", "One-on-ones"], { reflexes: 1, diving: 0.9, oneOnOnes: 0.6, handling: 0.5 },
    ["shot_stopper", "reflex_keeper", "one_on_one_specialist", "penalty_reader", "safe_hands"], ["goalkeeping"]),
  f("gk_sweeper", "Sweeper Keeper", "Plays as an eleventh outfield player.", ["Anticipation", "Command", "Kicking"], { anticipation: 1, command: 0.8, oneOnOnes: 0.7, kicking: 0.6, decisions: 0.5 },
    ["sweeper_keeper", "one_on_one_specialist", "quick_distributor", "cross_claimer"], ["goalkeeping"]),
  f("gk_ballplaying", "Ball-Playing Keeper", "Starts attacks with the ball at their feet.", ["Kicking", "Composure", "Decisions"], { kicking: 1, composure: 0.9, decisions: 0.7, anticipation: 0.3 },
    ["build_up_keeper", "quick_distributor", "long_distributor", "safe_hands", "composed"], ["goalkeeping", "passing"]),
  f("gk_commanding", "Commanding Keeper", "Rules the box and the back line.", ["Command", "Handling", "Decisions"], { command: 1, handling: 0.8, decisions: 0.5, positioning: 0.4 },
    ["cross_commander", "cross_claimer", "safe_hands"], ["goalkeeping"]),
  f("gk_line", "Line Keeper", "Traditional and conservative: stays on the line, reads the shot and protects the goal.", ["Positioning", "Handling", "Reflexes"], { positioning: 1, handling: 0.9, reflexes: 0.7, diving: 0.5, composure: 0.4 },
    ["safe_hands", "shot_stopper", "reflex_keeper", "penalty_reader"], ["goalkeeping"]),
];

const BY_POSITION: Record<Position, FocusDef[]> = { ST, RW: W, LW: W, AM, CM, DM, CB, RB: FB, LB: FB, GK };

/** Everything a position can choose, with No preference first. */
export function focusOptions(position: Position): readonly FocusDef[] {
  return [none, ...BY_POSITION[position]];
}

const ALL = new Map<string, FocusDef>([[NO_FOCUS, none], ...Object.values(BY_POSITION).flat().map((d): [string, FocusDef] => [d.id, d])]);

/** The definition of a focus for a position, or null if the position cannot choose it. */
export function focusFor(position: Position, id: string | undefined): FocusDef | null {
  if (!id || id === NO_FOCUS) return none;
  const def = ALL.get(id);
  return def && BY_POSITION[position].includes(def) ? def : null;
}

export const isValidFocus = (position: Position, id: unknown): id is string => typeof id === "string" && focusFor(position, id) !== null;

/** The focus a player really has: invalid or missing means No preference. */
export function focusOf(p: Pick<Player, "position" | "focus">): FocusDef {
  return focusFor(p.position, p.focus) ?? none;
}

/** Display name, for any id (used where the position is not to hand). */
export const focusName = (id: string | undefined): string => ALL.get(id ?? NO_FOCUS)?.name ?? none.name;

// ─────────────────────────────────────────────────────────────── how strongly it pulls

/** Age → how much of the aspiration is still alive: fully at 19 and under, a faint memory by 25. */
const AGE_PULL: Record<number, number> = { 20: 0.75, 21: 0.55, 22: 0.38, 23: 0.22, 24: 0.14, 25: 0.1 };
/** Minutes of senior football after which the record has all but replaced the aspiration. */
const EVIDENCE_MINUTES = 16000;

/**
 * 0–1: how much the focus still matters to this player. It halves within three seasons and, whatever the age, shrinks with every
 * minute played, so a player whose game has taken shape is judged by it and nothing else.
 */
export function focusStrength(p: Pick<Player, "birthYear" | "career" | "focus" | "position">, season: number): number {
  if (!p.focus || p.focus === NO_FOCUS) return 0;
  const age = season - p.birthYear;
  const byAge = age <= 19 ? 1 : (AGE_PULL[age] ?? 0);
  const byRecord = clamp(1 - p.career.minutes / EVIDENCE_MINUTES, 0.08, 1);
  return r1(byAge * byRecord * 100) / 100;
}

/** Below this the focus is ignored altogether. */
const NEGLIGIBLE = 0.03;

export interface FocusTilt {
  weights: Readonly<Partial<Record<AttrKey, number>>>;
  /** Scale: weight added to an attribute's chance of receiving a growth step (the role's own weights are 0.05–0.3). */
  k: number;
}

const TILT_SCALE = 0.09;

/** The nudge to monthly growth and match experience, or undefined for no preference / a faded focus. */
export function focusTilt(p: Pick<Player, "birthYear" | "career" | "focus" | "position">, season: number): FocusTilt | undefined {
  const s = focusStrength(p, season);
  if (s < NEGLIGIBLE) return undefined;
  const def = focusFor(p.position, p.focus);
  return def && def.id !== NO_FOCUS ? { weights: def.attrs, k: TILT_SCALE * s } : undefined;
}

// ─────────────────────────────────────────────────────────────── traits

const TRAIT_SETS = new Map<string, ReadonlySet<TraitId>>(Object.values(BY_POSITION).flat().map((d) => [d.id, new Set(d.traits)]));

/** Whether a trait is one this focus naturally grows into (a hint for weighting, never a reason to grant it). */
export function favours(focus: string | undefined, trait: TraitId): boolean {
  return !!focus && (TRAIT_SETS.get(focus)?.has(trait) ?? false);
}

/** Evidence of compatible behaviour counts this much more at full strength. */
export const EVIDENCE_LIFT = 0.25;
/** Weight lift for a compatible trait when an NPC picks up a habit. */
export const DRAW_LIFT = 0.5;

// ─────────────────────────────────────────────────────────────── attributes at creation

/** Gain for the most emphasised attribute at creation, in attribute points. */
const START_LEAN = 3.2;
/** Most any one attribute gives up to pay for the lean, so a role with a few heavy attributes (a keeper) is not hollowed out. */
const MAX_GIVE = 2.5;

/**
 * Leans the starting attributes towards the focus without adding quality. The attributes it favours go up; the same amount
 * (measured in role overall) is taken evenly from the role's other attributes, so the overall is unchanged. Deterministic: no draws.
 */
export function leanAttributes(attrs: Attributes, position: Position, focusId: string | undefined): void {
  const def = focusFor(position, focusId);
  if (!def || def.id === NO_FOCUS) return;
  const weights = POSITION_WEIGHTS[position];
  const rest = (Object.keys(weights) as AttrKey[]).filter((k) => def.attrs[k] === undefined);
  const restWeight = rest.reduce((s, k) => s + (weights[k] ?? 0), 0);
  if (restWeight <= 0) return;
  const entries = Object.entries(def.attrs) as [AttrKey, number][];
  // What the lean is worth in role overall, and so what the rest of the role has to give up to pay for it.
  const worth = entries.reduce((s, [k, e]) => s + (weights[k] ?? 0) * Math.min(START_LEAN * e, 99 - attrs[k]), 0);
  const lean = Math.min(1, (MAX_GIVE * restWeight) / Math.max(worth, 1e-9));
  let gained = 0;
  for (const [k, e] of entries) {
    const before = attrs[k];
    attrs[k] = Math.min(99, before + START_LEAN * e * lean);
    gained += (weights[k] ?? 0) * (attrs[k] - before);
  }
  const take = gained / restWeight;
  for (const k of rest) attrs[k] = Math.max(1, attrs[k] - take);
  for (const k of Object.keys(attrs) as AttrKey[]) attrs[k] = r1(attrs[k]);
}

// ─────────────────────────────────────────────────────────────── NPCs

/** Share of NPCs who set out with no particular idea of the player they want to be. */
const NPC_NO_PREFERENCE = 0.2;
/** Past this age an NPC's aspiration has long since faded and is not stored. */
const NPC_MAX_AGE = 26;

/**
 * The aspiration of a generated player: the option his attributes already lean towards (most of the time), or none. Seeded by
 * the player, so it is stable, costs nothing at runtime, and never touches the world's random stream.
 */
export function npcFocus(p: Pick<Player, "id" | "birthYear" | "position" | "attrs">, season: number): string | undefined {
  if (season - p.birthYear > NPC_MAX_AGE) return undefined;
  const rng = Rng.fromSeed(`focus:${p.id}:${p.birthYear}`);
  if (rng.chance(NPC_NO_PREFERENCE)) return undefined;
  const keys = Object.keys(POSITION_WEIGHTS[p.position]) as AttrKey[];
  const mean = keys.reduce((s, k) => s + p.attrs[k], 0) / keys.length;
  const options = BY_POSITION[p.position];
  const lean = (d: FocusDef) => {
    const es = Object.entries(d.attrs) as [AttrKey, number][];
    return es.reduce((s, [k, e]) => s + e * (p.attrs[k] - mean), 0) / es.reduce((s, [, e]) => s + e, 0);
  };
  return rng.weighted(options, (d) => Math.exp(lean(d) / 5)).id;
}
