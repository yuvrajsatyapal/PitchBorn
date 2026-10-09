/**
 * The football around the decisive moments, and the moments themselves: who handles the ball where, what the user's player can try
 * when the match runs through him or at him, and the little things worth a line of commentary. Pure data and small predicates; the
 * match engine owns every dice roll.
 */
import type { MatchFx } from "../traits/types";
import type { AttrKey, Position } from "../types";

/** A weighted blend of attributes (weights sum to 1). */
export type Mix = readonly (readonly [AttrKey, number])[];

export type ChanceType = "open" | "header" | "long" | "oneonone" | "penalty" | "freekick";

/** Left (0), centre (1) or right (2): the flank a position works on. */
export const SIDE_OF: Record<Position, 0 | 1 | 2> = { GK: 1, CB: 1, LB: 0, RB: 2, DM: 1, CM: 1, AM: 1, LW: 0, RW: 2, ST: 1 };

/** How much of the ball each position handles while a move is being built, and once it reaches the final third. */
export const BUILD_W: Record<Position, number> = { GK: 3, CB: 1.5, RB: 1.1, LB: 1.1, DM: 1.7, CM: 1.5, AM: 0.8, RW: 0.4, LW: 0.4, ST: 0.25 };
export const FINAL_W: Record<Position, number> = { GK: 0, CB: 0.15, RB: 0.7, LB: 0.7, DM: 0.5, CM: 1.2, AM: 1.8, RW: 1.7, LW: 1.7, ST: 1.4 };
/** Who clears the ball. */
export const CLEAR_WEIGHT: Record<Position, number> = { GK: 0, CB: 3.2, RB: 1, LB: 1, DM: 0.6, CM: 0.25, AM: 0.05, RW: 0.05, LW: 0.05, ST: 0.05 };
/** The chance, per pass, that the man on the ball tries to carry it past someone first. */
export const CARRY_W: Record<Position, number> = { GK: 0, CB: 0.03, RB: 0.1, LB: 0.1, DM: 0.05, CM: 0.1, AM: 0.2, RW: 0.28, LW: 0.28, ST: 0.12 };

export const CROSSERS: ReadonlySet<Position> = new Set<Position>(["RW", "LW", "RB", "LB"]);
export const FINISHERS: ReadonlySet<Position> = new Set<Position>(["ST", "AM", "RW", "LW"]);
export const WIDE_SLOTS: ReadonlySet<Position> = new Set<Position>(["RW", "LW"]);

export const PASS_MIX: Mix = [["passing", 0.5], ["vision", 0.2], ["firstTouch", 0.15], ["technique", 0.15]];
export const WIDE_MIX: Mix = [["dribbling", 0.35], ["crossing", 0.3], ["pace", 0.2], ["stamina", 0.15]];
export const DRIB_MIX: Mix = [["dribbling", 0.5], ["agility", 0.2], ["balance", 0.15], ["acceleration", 0.15]];
export const DUEL_MIX: Mix = [["tackling", 0.5], ["strength", 0.2], ["positioning", 0.2], ["aggression", 0.1]];

// ───────────────────────────── commentary on small actions

export type NoteKind =
  | "passLost" | "dribbleWon" | "dribbleLost" | "interception" | "recovery" | "clearance" | "duelWon" | "beaten"
  | "crossBlocked" | "crossOk" | "aerialWon" | "aerialLost";

/** How often a small action is worth a line (the engine also rations them by the minute). */
export const NOTE_CHANCE: Record<NoteKind, number> = {
  passLost: 0.6, dribbleWon: 0.7, dribbleLost: 0.75, interception: 0.55, recovery: 0.3, clearance: 0.4, duelWon: 0.45, beaten: 0.5,
  crossBlocked: 0.5, crossOk: 0.4, aerialWon: 0.5, aerialLost: 0.5,
};

export const NOTE_TEXT: Record<NoteKind, readonly string[]> = {
  passLost: ["Misplaced pass — possession lost.", "Pass cut out.", "Heavy touch — possession lost."],
  dribbleWon: ["Beat your marker and drove forward.", "A change of pace takes you past your man."],
  dribbleLost: ["Tried to take him on but lost it.", "Couldn't bring the ball under control."],
  interception: ["Read the pass and cut it out.", "Important interception."],
  recovery: ["Won the ball back."],
  clearance: ["Cleared the danger."],
  duelWon: ["Won the duel.", "A strong challenge — came away with it."],
  beaten: ["Beaten by your man.", "Beaten in the duel."],
  crossBlocked: ["Cross blocked.", "The cross is cleared."],
  crossOk: ["Cross finds a teammate in the box."],
  aerialWon: ["Won the header.", "Strong in the air."],
  aerialLost: ["Lost the aerial duel."],
};

// ───────────────────────────── the user's moments

export interface MomentOpt {
  id: string;
  label: string;
  detail: string;
  mix: Mix;
  base: number;
  scale: number;
  /** Multiplier on how dangerous the attack becomes if it comes off. */
  pMulOk: number;
  /** Defending moments: multiplier on the opposition's attack if it goes wrong. */
  pMulFail?: number;
  /** Chance of a break the other way: when an attack is lost (attacking moments) or the ball is won (defending ones). */
  counter: number;
  /** Who gets the shot or the pass if the move turns into a chance. */
  credit: "creator" | "shooter" | "shot" | "none";
  type?: ChanceType;
  stat: "pass" | "dribble" | "cross" | "aerial" | "run" | "duel" | "lane" | "none";
  okText: string;
  failText: string;
  defending?: boolean;
  suits?: boolean;
}

const through: MomentOpt = {
  id: "through", label: "Slip the striker through", detail: "A pass that splits the defence.", mix: [["passing", 0.35], ["vision", 0.3], ["creativity", 0.2], ["decisions", 0.15]],
  base: 0.42, scale: 75, pMulOk: 1.8, counter: 0.3, credit: "creator", type: "oneonone", stat: "pass", okText: "Your pass splits the defence!", failText: "The through ball is cut out.",
};
const forward: MomentOpt = { ...through, id: "forward", label: "Break the line with a pass", detail: "Play it beyond their midfield.", base: 0.46, pMulOk: 1.6, type: "open" };
const insidePass: MomentOpt = { ...through, id: "inside", label: "Play it inside", detail: "Find a teammate between the lines.", base: 0.5, pMulOk: 1.5, type: "open", counter: 0.22 };
const carry: MomentOpt = {
  id: "carry", label: "Carry it forward", detail: "Drive at them and take them out of the game.", mix: [["dribbling", 0.4], ["technique", 0.2], ["agility", 0.2], ["balance", 0.1], ["firstTouch", 0.1]],
  base: 0.5, scale: 85, pMulOk: 1.5, counter: 0.28, credit: "none", stat: "dribble", okText: "You carry it into the final third.", failText: "You lose it trying to drive forward.",
};
const stepOut: MomentOpt = { ...carry, id: "stepOut", label: "Step out with the ball", detail: "Leave the line and bring it forward.", mix: [["dribbling", 0.3], ["composure", 0.3], ["balance", 0.2], ["decisions", 0.2]], base: 0.52, pMulOk: 1.35, counter: 0.35 };
const recycle: MomentOpt = {
  id: "recycle", label: "Recycle possession", detail: "Keep it moving and wait for the gap.", mix: [["passing", 0.4], ["composure", 0.3], ["decisions", 0.3]],
  base: 0.86, scale: 220, pMulOk: 1.05, counter: 0.05, credit: "none", stat: "pass", okText: "You keep it ticking over.", failText: "A sloppy pass gives it away.",
};
const switchPlay: MomentOpt = {
  id: "switch", label: "Switch the play", detail: "Move it quickly to the other flank.", mix: [["passing", 0.4], ["vision", 0.3], ["technique", 0.3]],
  base: 0.58, scale: 90, pMulOk: 1.3, counter: 0.18, credit: "creator", type: "open", stat: "pass", okText: "A good switch opens up the other side.", failText: "The switch is cut out.",
};
const takeOn: MomentOpt = {
  id: "takeOn", label: "Take him on", detail: "Beat your man one-on-one.", mix: [["dribbling", 0.4], ["agility", 0.25], ["technique", 0.15], ["acceleration", 0.2]],
  base: 0.45, scale: 85, pMulOk: 1.7, counter: 0.32, credit: "shooter", type: "open", stat: "dribble", okText: "You get past your man!", failText: "He wins the ball back off you.",
};
const cross: MomentOpt = {
  id: "cross", label: "Whip in a cross", detail: "Find a head in the box.", mix: [["crossing", 0.6], ["technique", 0.2], ["vision", 0.2]],
  base: 0.45, scale: 85, pMulOk: 1.55, counter: 0.12, credit: "creator", type: "header", stat: "cross", okText: "A dangerous cross into the box.", failText: "The cross is cleared.",
};
const overlap: MomentOpt = { ...cross, id: "cross", label: "Overlap and cross", detail: "Get beyond the winger and deliver.", mix: [["crossing", 0.5], ["pace", 0.2], ["stamina", 0.15], ["technique", 0.15]] };
const cutIn: MomentOpt = {
  id: "cutIn", label: "Cut inside and shoot", detail: "Drift in onto your stronger foot.", mix: [["dribbling", 0.3], ["technique", 0.25], ["longShots", 0.25], ["composure", 0.2]],
  base: 0.4, scale: 80, pMulOk: 1.5, counter: 0.25, credit: "shooter", type: "long", stat: "dribble", okText: "You cut inside and get a shot away.", failText: "You cut inside into traffic.",
};
const distance: MomentOpt = {
  id: "distance", label: "Try from distance", detail: "Hit it from outside the box.", mix: [["longShots", 0.6], ["technique", 0.25], ["composure", 0.15]],
  base: 0.45, scale: 80, pMulOk: 1.4, counter: 0.15, credit: "shot", type: "long", stat: "none", okText: "You let fly!", failText: "You can't get the shot away cleanly.",
};
const split: MomentOpt = { ...through, id: "split", label: "Attempt a defence-splitting pass", detail: "Look for the pass nobody else sees.", mix: [["creativity", 0.3], ["vision", 0.3], ["passing", 0.25], ["decisions", 0.15]], base: 0.4, pMulOk: 1.9 };
const runBehind: MomentOpt = {
  id: "runBehind", label: "Run in behind", detail: "Attack the space over the top.", mix: [["offBall", 0.4], ["pace", 0.2], ["acceleration", 0.2], ["anticipation", 0.2]],
  base: 0.42, scale: 80, pMulOk: 1.75, counter: 0.2, credit: "shooter", type: "oneonone", stat: "run", okText: "You spin in behind the line!", failText: "You mistime the run and are flagged offside.",
};
const holdUp: MomentOpt = {
  id: "holdUp", label: "Hold it up", detail: "Shield it and bring others into play.", mix: [["strength", 0.35], ["firstTouch", 0.3], ["balance", 0.2], ["decisions", 0.15]],
  base: 0.55, scale: 90, pMulOk: 1.4, counter: 0.15, credit: "creator", type: "open", stat: "none", okText: "You hold it up and bring the others into play.", failText: "You can't hold off the defender.",
};
const layOff: MomentOpt = {
  id: "layOff", label: "Lay it off", detail: "A quick one-two to a teammate.", mix: [["passing", 0.35], ["firstTouch", 0.25], ["decisions", 0.2], ["composure", 0.2]],
  base: 0.75, scale: 150, pMulOk: 1.15, counter: 0.08, credit: "creator", type: "open", stat: "pass", okText: "A neat lay-off keeps the move alive.", failText: "Your lay-off goes astray.",
};
const attackCross: MomentOpt = {
  id: "attackCross", label: "Attack the cross", detail: "Get across your man and win the header.", mix: [["heading", 0.4], ["jumping", 0.25], ["offBall", 0.2], ["strength", 0.15]],
  base: 0.4, scale: 80, pMulOk: 1.55, counter: 0.15, credit: "shooter", type: "header", stat: "aerial", okText: "You rise highest in the box!", failText: "You lose the aerial duel.",
};
const short: MomentOpt = {
  id: "short", label: "Play it short", detail: "Roll it out and build from the back.", mix: [["kicking", 0.3], ["passing", 0.3], ["composure", 0.25], ["decisions", 0.15]],
  base: 0.85, scale: 200, pMulOk: 1.0, counter: 0.06, credit: "none", stat: "pass", okText: "You play out from the back.", failText: "The short pass is closed down and lost.",
};
const long: MomentOpt = {
  id: "long", label: "Launch it long", detail: "Go direct over the press.", mix: [["kicking", 0.7], ["passing", 0.15], ["decisions", 0.15]],
  base: 0.5, scale: 90, pMulOk: 1.4, counter: 0.2, credit: "none", stat: "none", okText: "Your long ball puts them under pressure.", failText: "The long ball goes straight to the defence.",
};

const hold: MomentOpt = {
  id: "hold", label: "Hold your line", detail: "Stay compact and keep your shape.", mix: [["positioning", 0.4], ["marking", 0.3], ["anticipation", 0.2], ["decisions", 0.1]],
  base: 0.6, scale: 110, pMulOk: 0.72, pMulFail: 1.25, counter: 0, credit: "none", stat: "none", okText: "You keep your shape and the move goes nowhere.", failText: "You're caught out of position.", defending: true,
};
const dropScreen: MomentOpt = { ...hold, id: "hold", label: "Drop and screen", detail: "Protect the space in front of the back four." };
const stepIn: MomentOpt = {
  id: "step", label: "Step out and press", detail: "Close him down before he can turn.", mix: [["workRate", 0.3], ["aggression", 0.25], ["anticipation", 0.25], ["stamina", 0.1], ["tackling", 0.1]],
  base: 0.5, scale: 85, pMulOk: 0.5, pMulFail: 1.7, counter: 0.2, credit: "none", stat: "duel", okText: "You close him down and win it back.", failText: "You're bypassed and the space opens up.", defending: true,
};
const trackRunner: MomentOpt = {
  id: "track", label: "Track the runner", detail: "Stay with the man making the run.", mix: [["marking", 0.4], ["pace", 0.2], ["acceleration", 0.15], ["anticipation", 0.25]],
  base: 0.52, scale: 90, pMulOk: 0.75, pMulFail: 1.35, counter: 0, credit: "none", stat: "none", okText: "You stay with the runner.", failText: "You're late to the runner.", defending: true,
};
const cutPass: MomentOpt = {
  id: "cutPass", label: "Cut out the pass", detail: "Read it and step into the lane.", mix: [["interceptions", 0.5], ["anticipation", 0.3], ["positioning", 0.2]],
  base: 0.5, scale: 90, pMulOk: 0.55, pMulFail: 1.4, counter: 0.15, credit: "none", stat: "lane", okText: "You step in and cut the pass out.", failText: "You miss the pass and he's through the gap.", defending: true,
};
const challenge: MomentOpt = {
  id: "challenge", label: "Win the duel", detail: "Go in strong for the ball.", mix: [["tackling", 0.45], ["strength", 0.25], ["decisions", 0.2], ["aggression", 0.1]],
  base: 0.5, scale: 90, pMulOk: 0.55, pMulFail: 1.5, counter: 0.15, credit: "none", stat: "duel", okText: "You win the duel cleanly.", failText: "You're beaten in the duel.", defending: true,
};
const pressWinger: MomentOpt = { ...stepIn, id: "step", label: "Press the winger", detail: "Get tight and force him backwards." };
const recoverShape: MomentOpt = { ...trackRunner, id: "track", label: "Recover your position", detail: "Get back goalside before the cross comes." };

export const MOMENT = { distance, split, takeOn, attackCross };

export const ATTACK_SET: Record<Position, MomentOpt[]> = {
  GK: [short, long],
  CB: [forward, stepOut, recycle],
  RB: [overlap, insidePass, recycle],
  LB: [overlap, insidePass, recycle],
  DM: [forward, switchPlay, recycle],
  CM: [through, carry, recycle],
  AM: [through, takeOn, distance, recycle],
  RW: [takeOn, cross, cutIn, { ...recycle, label: "Pass it back", detail: "Keep it and look again." }],
  LW: [takeOn, cross, cutIn, { ...recycle, label: "Pass it back", detail: "Keep it and look again." }],
  ST: [runBehind, holdUp, layOff],
};

export const DEFEND_SET: Record<Position, MomentOpt[]> = {
  GK: [hold],
  CB: [hold, trackRunner, challenge],
  RB: [recoverShape, pressWinger, hold],
  LB: [recoverShape, pressWinger, hold],
  DM: [cutPass, stepIn, dropScreen],
  CM: [stepIn, cutPass, hold],
  AM: [stepIn, hold],
  RW: [recoverShape, stepIn],
  LW: [recoverShape, stepIn],
  ST: [stepIn, hold],
};

export const ATTACK_PROMPT: Record<Position, string> = {
  GK: "The press is on as you collect the ball. How do you start the attack?",
  CB: "Space opens up in front of you with the ball at your feet.",
  RB: "You have room on the flank to push on.",
  LB: "You have room on the flank to push on.",
  DM: "You pick the ball up in front of the back four.",
  CM: "You receive the ball between the lines.",
  AM: "You find a pocket of space behind their midfield.",
  RW: "You're isolated against the full-back.",
  LW: "You're isolated against the full-back.",
  ST: "The ball comes up to you with the defence stepping up.",
};

export const DEFEND_PROMPT: Record<Position, string> = {
  GK: "They're pushing forward.",
  CB: "Their move is building towards your box. How do you deal with it?",
  RB: "Their winger is coming at you.",
  LB: "Their winger is coming at you.",
  DM: "They break through midfield and you're the screen.",
  CM: "The attack is coming through the middle.",
  AM: "They're building from the back.",
  RW: "Their full-back is overlapping.",
  LW: "Their full-back is overlapping.",
  ST: "Their centre-backs have the ball.",
};

/** How much of a say each position has in the build-up (scales how often a moment comes), and in defending. */
export const ATTACK_K: Record<Position, number> = { GK: 0.45, CB: 0.7, RB: 0.9, LB: 0.9, DM: 1, CM: 1.05, AM: 1.1, RW: 1.15, LW: 1.15, ST: 0.85 };
export const DEFEND_K: Record<Position, number> = { GK: 0, CB: 1.2, RB: 1, LB: 1, DM: 1, CM: 0.6, AM: 0.12, RW: 0.15, LW: 0.15, ST: 0.1 };

// ───────────────────────────── trait reads: a trait makes a choice the natural thing to try; it never makes it work by itself

export const isLongShot = (fx: MatchFx) => (fx.shootLong ?? 1) >= 1.12 || (fx.xgLong ?? 1) >= 1.03;
export const isPlaymaker = (fx: MatchFx) => (fx.createThrough ?? 1) >= 1.15 || (fx.create ?? 1) >= 1.3 || (fx.xgCreated ?? 1) >= 1.03;
export const isTrickster = (fx: MatchFx) => (fx.shoot1v1 ?? 1) >= 1.15 || (fx.freq1v1 ?? 0) >= 0.03 || (fx.counter ?? 0) >= 0.01;
export const isAerial = (fx: MatchFx) => (fx.shootHeader ?? 1) >= 1.15 || (fx.xgHeader ?? 1) >= 1.03;

// ───────────────────────────── what the UI is told

/** The user's player's place in the match. */
export type PlayerState =
  | { phase: "none" }
  | { phase: "bench" | "warming" | "unused" }
  | { phase: "playing" | "fulltime"; minuteOn: number; started: boolean }
  | { phase: "off"; minuteOn: number; minuteOff: number; started: boolean; reason: "sub" | "injury" | "red" };

/** The shape of the match as the user's player sees it. Every figure is counted from the match so far. */
export interface FlowContext {
  side: "home" | "away";
  slot: Position;
  possession: number;
  /** The share of the last ten phases the user's side had the ball (undefined until there are enough). */
  recentPossession?: number;
  attacks: number;
  /** The side's attacks by flank: left, centre, right. */
  flanks: [number, number, number];
  /** The share of the side's attacks that used the user's flank. */
  laneShare?: number;
  lane: "left" | "centre" | "right";
  goalsFor: number;
  goalsAgainst: number;
  style?: { pressing: number; tempo: number; directness: number };
  ratingTrend?: number;
}

/** What the player is told about a choice instead of a probability. */
export type Risk = "Safe" | "Balanced" | "Risky";
export function riskOf(odds: number): Risk {
  return odds >= 0.65 ? "Safe" : odds >= 0.4 ? "Balanced" : "Risky";
}
