/**
 * The situations a controlled player is put in. A scenario is a prompt, the choices that fit it, and (sometimes) the part of the
 * match it belongs to. Each position has a pool of them, so a match deals different football rather than the same screen again.
 * Pure data: the engine owns every dice roll, and the option shapes (attributes, odds, texts) are the ones moments.ts defines.
 */
import type { Position } from "../types";
import { BASE, type MomentOpt } from "./moments";

/** When a scenario may come up. Unconditioned ones are always eligible; matching ones are favoured. */
export type SceneCond = "chasing" | "protect" | "early" | "late";

export interface Scenario {
  prompt: string;
  options: MomentOpt[];
  cond?: SceneCond;
  /** A potentially decisive moment (a chance created, a one-on-one, a last-ditch block) rather than routine play. */
  impact: boolean;
}

export interface SceneContext {
  minute: number;
  /** The user's side's goals minus the opposition's. */
  diff: number;
}

const sceneHolds = (c: SceneCond, x: SceneContext) =>
  c === "chasing" ? x.diff < 0 && x.minute >= 60 : c === "protect" ? x.diff > 0 && x.minute >= 70 : c === "early" ? x.minute <= 20 : x.minute >= 75;

const d = (t: MomentOpt, id: string, label: string, detail: string, okText: string, failText: string, p: Partial<MomentOpt> = {}): MomentOpt => ({
  ...t, id, label, detail, okText, failText, ...p,
});

const B = BASE;

/** Attacking choices, keyed by id. */
const A: Record<string, MomentOpt> = {
  through: B.through, forward: B.forward, inside: B.insidePass, carry: B.carry, stepOut: B.stepOut, recycle: B.recycle, switch: B.switchPlay,
  takeOn: B.takeOn, cross: B.cross, overlap: { ...B.overlap, id: "overlap" }, cutIn: B.cutIn, distance: B.distance, split: B.split, runBehind: B.runBehind,
  holdUp: B.holdUp, layOff: B.layOff, attackCross: B.attackCross, short: B.short, long: B.long,
  backPass: d(B.recycle, "backPass", "Go back and reset", "Take the pressure off and start again.", "You go back and the team reset.", "The back-pass is slack and they nearly pounce.", { base: 0.9, scale: 230 }),
  quick: d(B.recycle, "quick", "Play it quick and short", "One touch to keep the tempo up.", "A sharp one-touch pass keeps the move flowing.", "The quick pass is under-hit and cut out.", { mix: [["firstTouch", 0.35], ["passing", 0.35], ["decisions", 0.3]], base: 0.78, scale: 170 }),
  oneTwo: d(B.layOff, "oneTwo", "Play a one-two", "Give it and go for the return.", "The one-two slices through the defence.", "The return pass never arrives.", { base: 0.6, scale: 110, pMulOk: 1.55, counter: 0.15, credit: "shooter", mix: [["passing", 0.3], ["offBall", 0.25], ["firstTouch", 0.25], ["decisions", 0.2]] }),
  diagonal: d(B.switchPlay, "diagonal", "Hit the long diagonal", "Pick out the far-side runner.", "The diagonal drops perfectly into the runner's stride.", "The diagonal is overhit and runs out of play.", { base: 0.5, scale: 90, pMulOk: 1.45, counter: 0.2, mix: [["passing", 0.4], ["vision", 0.35], ["technique", 0.25]] }),
  cutback: d(B.cross, "cutback", "Pull it back across goal", "Low and early for a runner.", "A low cutback finds a runner in space.", "The cutback is cleared before anyone reaches it.", { base: 0.5, pMulOk: 1.6, type: "open", mix: [["crossing", 0.45], ["vision", 0.3], ["technique", 0.25]] }),
  lofted: d(B.through, "lofted", "Chip it over the top", "Lift it over their line.", "The lofted pass floats over their line.", "The chip is too strong and the keeper gathers.", { base: 0.4, pMulOk: 1.7, mix: [["passing", 0.35], ["technique", 0.3], ["vision", 0.35]] }),
  wide: d(B.forward, "wide", "Play it out wide", "Stretch them and find the wide man.", "You find the winger with space to run.", "The pass to the flank is cut out.", { base: 0.62, scale: 100, pMulOk: 1.3, counter: 0.12, type: "header" }),
  firstTime: d(B.forward, "firstTime", "Play it first time", "Don't take a touch, move it on.", "A first-time pass catches them out.", "You rush it and the pass goes astray.", { base: 0.58, mix: [["firstTouch", 0.35], ["passing", 0.35], ["decisions", 0.3]], pMulOk: 1.4 }),
  slow: d(B.recycle, "slow", "Slow it down", "Take the sting out and let the team get up.", "You slow it down and the team gets set.", "The slow play invites the press and you lose it.", { base: 0.9, scale: 240, pMulOk: 1.0, mix: [["composure", 0.4], ["decisions", 0.35], ["passing", 0.25]] }),
  drift: d(B.carry, "drift", "Drift infield", "Slide inside and find space.", "You drift inside and the defence loses you.", "You drift into a crowd and it's lost.", { base: 0.55, pMulOk: 1.35, counter: 0.2 }),
  drive: d(B.carry, "drive", "Drive at the centre-backs", "Run straight at them and make them back off.", "You drive at them and they back off.", "A defender steps across and wins it.", { base: 0.44, pMulOk: 1.65, counter: 0.3 }),
  turn: d(B.holdUp, "turn", "Shield it and turn", "Spin off your marker and face goal.", "You spin off your man and turn towards goal!", "You are muscled off the ball.", { base: 0.45, scale: 85, pMulOk: 1.6, counter: 0.22, credit: "shooter", type: "open", stat: "dribble", mix: [["balance", 0.3], ["strength", 0.25], ["dribbling", 0.25], ["agility", 0.2]] }),
  nutmeg: d(B.takeOn, "nutmeg", "Try a nutmeg", "Cheeky, and brilliant if it comes off.", "The nutmeg comes off and the crowd roars!", "He closes his legs and wins it back.", { base: 0.32, pMulOk: 2.0, counter: 0.35, mix: [["dribbling", 0.4], ["technique", 0.3], ["agility", 0.15], ["composure", 0.15]] }),
  byline: d(B.takeOn, "byline", "Go to the byline", "Beat him on the outside and reach the line.", "You get beyond him and to the byline.", "He forces you wide and the ball runs out.", { base: 0.46, pMulOk: 1.5, credit: "creator", type: "header", mix: [["dribbling", 0.35], ["pace", 0.3], ["acceleration", 0.2], ["crossing", 0.15]] }),
  burst: d(B.runBehind, "burst", "Burst past him with pace", "Knock it past and race him.", "You knock it past and leave him for dead.", "He gets there first and clears.", { base: 0.46, pMulOk: 1.55, credit: "creator", type: "header", stat: "dribble", mix: [["pace", 0.4], ["acceleration", 0.35], ["dribbling", 0.25]] }),
  snap: d(B.distance, "snap", "Snap off a shot", "Don't wait, hit it.", "You get a shot away before they close in!", "The shot is blocked.", { base: 0.42, mix: [["longShots", 0.35], ["composure", 0.3], ["technique", 0.35]] }),
  place: d(B.distance, "place", "Pick your spot", "Pass it into the corner.", "You pick your spot and it's on target!", "You scuff it and it drifts wide.", { base: 0.42, type: "open", mix: [["finishing", 0.4], ["composure", 0.35], ["technique", 0.25]] }),
  volley: d(B.distance, "volley", "Hit it on the volley", "Catch it clean as it drops.", "A sweet strike on the volley!", "You get under it and it sails over.", { base: 0.32, pMulOk: 1.6, type: "open", mix: [["technique", 0.35], ["finishing", 0.3], ["firstTouch", 0.2], ["balance", 0.15]] }),
  chip: d(B.distance, "chip", "Chip the keeper", "Lift it over him.", "A delicate chip over the keeper!", "The keeper stays big and smothers it.", { base: 0.35, pMulOk: 1.5, type: "oneonone", mix: [["finishing", 0.3], ["composure", 0.35], ["technique", 0.35] ] }),
  flick: d(B.layOff, "flick", "Flick it on", "Glance it into a runner's path.", "Your flick-on sends a runner clear.", "The flick-on goes to no one.", { base: 0.5, pMulOk: 1.5, credit: "creator", type: "oneonone", mix: [["heading", 0.3], ["firstTouch", 0.3], ["vision", 0.2], ["jumping", 0.2]] }),
  check: d(B.holdUp, "check", "Check to the ball", "Drop short and receive.", "You check in and receive cleanly.", "You check short but the pass never finds you.", { base: 0.66, pMulOk: 1.3, counter: 0.1, mix: [["offBall", 0.3], ["firstTouch", 0.3], ["passing", 0.2], ["vision", 0.2]] }),
  lateRun: d(B.runBehind, "lateRun", "Arrive late in the box", "Time the run from deep.", "You arrive late and unmarked!", "You get there a beat too early and the chance is gone.", { base: 0.42, type: "open", mix: [["offBall", 0.4], ["anticipation", 0.3], ["pace", 0.15], ["stamina", 0.15]] }),
  farPost: d(B.attackCross, "farPost", "Attack the far post", "Lose your marker at the back stick.", "You steal in at the far post!", "The cross is behind you and you can't reach it.", { base: 0.4, mix: [["offBall", 0.35], ["heading", 0.3], ["anticipation", 0.2], ["jumping", 0.15]] }),
  nearPost: d(B.attackCross, "nearPost", "Dart to the near post", "Get across and flick it on.", "You steal the near post and make contact!", "The defender gets there first.", { base: 0.42, mix: [["offBall", 0.3], ["heading", 0.25], ["acceleration", 0.25], ["anticipation", 0.2]] }),
  underlap: d(B.insidePass, "underlap", "Underlap and take the return", "Cut inside off the winger's shoulder.", "You underlap and receive in space.", "The underlapping run is not spotted.", { base: 0.46, pMulOk: 1.55, credit: "shooter", mix: [["offBall", 0.3], ["pace", 0.2], ["passing", 0.25], ["dribbling", 0.25]] }),
  throw: d(B.short, "throw", "Roll it out to a full-back", "Quick and low.", "A neat roll-out starts the move.", "The roll is intercepted.", { base: 0.9, mix: [["handling", 0.3], ["passing", 0.3], ["decisions", 0.4]] }),
  pickout: d(B.long, "pickout", "Pick out the winger", "Find the wide man early.", "Your kick finds the winger in space.", "The kick is too long and goes out.", { base: 0.55, pMulOk: 1.45, credit: "creator", type: "open", mix: [["kicking", 0.5], ["vision", 0.3], ["passing", 0.2]] }),
  splitMid: d(B.short, "splitMid", "Play through the press", "Find a midfielder through the line.", "You find a midfielder through the press!", "The pass through the press is picked off.", { base: 0.5, scale: 90, pMulOk: 1.35, counter: 0.3, mix: [["passing", 0.35], ["vision", 0.3], ["composure", 0.2], ["decisions", 0.15]] }),
  wait: d(B.recycle, "wait", "Take your time", "Draw them on, then go.", "You draw them on and play past the press.", "You wait too long and are closed down.", { base: 0.8, mix: [["composure", 0.4], ["decisions", 0.3], ["kicking", 0.3]] }),
  fast: d(B.short, "fast", "Restart quickly", "Catch them out of shape.", "A quick restart catches them out of shape.", "The quick restart is wasted.", { base: 0.7, pMulOk: 1.35, counter: 0.12, mix: [["decisions", 0.4], ["kicking", 0.3], ["passing", 0.3]] }),
  toST: d(B.long, "toST", "Aim for the big striker", "Put it on his head.", "Your kick finds the striker, who wins the header.", "The target man loses the aerial duel.", { base: 0.5, mix: [["kicking", 0.6], ["vision", 0.2], ["decisions", 0.2]] }),
};

/** Defending choices, keyed by id. */
const D: Record<string, MomentOpt> = {
  hold: B.hold, screen: B.dropScreen, step: B.stepIn, track: B.trackRunner, cutPass: B.cutPass, challenge: B.challenge, pressWide: B.pressWinger, recover: B.recoverShape,
  jockey: d(B.hold, "jockey", "Show him wide", "Jockey and force him to the touchline.", "You show him outside and he has nowhere to go.", "He drops a shoulder and is past you.", { base: 0.56, pMulOk: 0.65, pMulFail: 1.3, mix: [["positioning", 0.3], ["agility", 0.3], ["anticipation", 0.2], ["marking", 0.2]] }),
  block: d(B.challenge, "block", "Block the shot", "Get your body in the way.", "You throw yourself in front of it.", "The shot comes through and your attempt misses.", { base: 0.5, pMulOk: 0.5, pMulFail: 1.5, stat: "none", mix: [["positioning", 0.3], ["anticipation", 0.3], ["aggression", 0.2], ["balance", 0.2]] }),
  claimCross: d(B.cutPass, "claimCross", "Attack the cross", "Win the first header.", "You rise and head it clear!", "You are beaten to the cross.", { base: 0.48, pMulOk: 0.5, pMulFail: 1.55, stat: "none", mix: [["heading", 0.4], ["jumping", 0.25], ["strength", 0.2], ["positioning", 0.15]] }),
  double: d(B.stepIn, "double", "Double up with a teammate", "Squeeze him between two.", "You squeeze him and win it back.", "He rides both challenges and gets past.", { base: 0.55, pMulOk: 0.55, pMulFail: 1.35, mix: [["positioning", 0.3], ["workRate", 0.3], ["decisions", 0.2], ["marking", 0.2]] }),
  slide: d(B.challenge, "slide", "Go to ground", "A slide tackle: win it or concede space.", "A perfectly timed slide takes it cleanly!", "You go to ground and miss, and he's through.", { base: 0.42, pMulOk: 0.45, pMulFail: 1.9, counter: 0.2, mix: [["tackling", 0.6], ["anticipation", 0.2], ["aggression", 0.2]] }),
  delay: d(B.hold, "delay", "Delay him", "Buy time for the team to recover.", "You buy time and the team gets back.", "You back off and he's got room to pick a pass.", { base: 0.65, pMulOk: 0.8, pMulFail: 1.15, mix: [["positioning", 0.3], ["anticipation", 0.3], ["decisions", 0.2], ["workRate", 0.2]] }),
  cover: d(B.hold, "cover", "Cover the space behind", "Drop off and cover the runner.", "You cover and the runner is closed down.", "You leave a gap behind and they use it.", { base: 0.6, pMulOk: 0.7, pMulFail: 1.3, mix: [["positioning", 0.4], ["anticipation", 0.3], ["marking", 0.2], ["pace", 0.1]] }),
  trap: d(B.hold, "trap", "Step up to catch him offside", "Push the line up together.", "You step up in unison and the flag goes up!", "You step up alone and play him onside.", { base: 0.45, pMulOk: 0.35, pMulFail: 2.0, mix: [["positioning", 0.3], ["decisions", 0.3], ["anticipation", 0.3], ["marking", 0.1]] }),
  clear: d(B.challenge, "clear", "Clear it hard", "Get it out of the area.", "You clear it a long way.", "Your clearance is scuffed and stays in danger.", { base: 0.6, pMulOk: 0.6, pMulFail: 1.3, counter: 0, stat: "none", mix: [["heading", 0.25], ["strength", 0.3], ["decisions", 0.25], ["composure", 0.2]] }),
  shadow: d(B.hold, "shadow", "Screen the passing lane", "Stay goalside and cover the pass.", "You screen the pass and it goes nowhere.", "You are too far off and the pass gets through.", { base: 0.58, pMulOk: 0.7, pMulFail: 1.25, mix: [["positioning", 0.4], ["interceptions", 0.3], ["anticipation", 0.3]] }),
  squeeze: d(B.stepIn, "squeeze", "Squeeze the play", "Push up and shrink the pitch.", "You squeeze up and they are forced backwards.", "You squeeze but they play behind you.", { base: 0.5, pMulOk: 0.55, pMulFail: 1.6, mix: [["workRate", 0.3], ["positioning", 0.3], ["aggression", 0.2], ["anticipation", 0.2]] }),
  closeDown: d(B.stepIn, "closeDown", "Close him down", "Get tight before he can pick a pass.", "You close him down and he fluffs it.", "He plays out of the press with ease.", { base: 0.5, pMulOk: 0.5, pMulFail: 1.6, mix: [["pace", 0.25], ["aggression", 0.25], ["workRate", 0.25], ["anticipation", 0.25]] }),
  tuck: d(B.hold, "tuck", "Tuck inside", "Close the gap to the centre-backs.", "You tuck in and the middle is shut.", "You tuck in and the flank is left open.", { base: 0.6, pMulOk: 0.7, pMulFail: 1.3, mix: [["positioning", 0.4], ["marking", 0.3], ["decisions", 0.3]] }),
  trackBack: d(B.trackRunner, "trackBack", "Sprint back", "Get goalside of him.", "You sprint back and get goalside.", "You can't get back in time.", { base: 0.5, mix: [["pace", 0.3], ["stamina", 0.2], ["workRate", 0.25], ["acceleration", 0.25]] }),
  pressCB: d(B.stepIn, "pressCB", "Press the centre-back", "Force a hurried pass.", "You rush him into a hurried pass.", "He plays it round the press.", { base: 0.5, mix: [["workRate", 0.35], ["aggression", 0.25], ["pace", 0.2], ["anticipation", 0.2]] }),
  cutDM: d(B.hold, "cutDM", "Screen the holding midfielder", "Cut the passing lane in.", "You cut the lane and they have to go sideways.", "The pass goes through the lane you left.", { base: 0.56, pMulOk: 0.7, pMulFail: 1.3, mix: [["positioning", 0.3], ["interceptions", 0.3], ["workRate", 0.2], ["decisions", 0.2]] }),
};

const scene = (lib: Record<string, MomentOpt>, prompt: string, ids: string, cond?: SceneCond): Scenario => {
  const options = ids.split(" ").map((id) => {
    const o = lib[id];
    if (!o) throw new Error(`Unknown scenario option "${id}" in "${prompt}"`);
    return o;
  });
  // Decisive when the whole menu is about creating a chance (attacking) or the wrong call would concede one (defending), not when it is a safe option among riskier ones.
  const mean = (f: (o: MomentOpt) => number) => options.reduce((t, o) => t + f(o), 0) / options.length;
  const impact = options[0].defending ? mean((o) => o.pMulFail ?? 1) >= 1.4 : mean((o) => (o.credit === "none" ? 1 : o.pMulOk)) >= 1.45;
  return { prompt, options, cond, impact };
};
const a = (prompt: string, ids: string, cond?: SceneCond) => scene(A, prompt, ids, cond);
const f = (prompt: string, ids: string, cond?: SceneCond) => scene(D, prompt, ids, cond);

const GK_ATTACK = [
  a("The press is on as you collect the ball. How do you start the attack?", "short long splitMid"),
  a("Their striker is closing you down fast.", "short long pickout"),
  a("You gather a shot and the break is on.", "fast throw pickout long"),
  a("Goal kick. They're pushing everyone up.", "short long toST"),
  a("Your defenders are screaming for the ball.", "short wait splitMid stepOut"),
  a("You smother a cross and the pitch opens up ahead.", "fast throw pickout long"),
  a("You're ahead and the clock is running down.", "wait short long", "protect"),
  a("You need a goal. Get the ball forward quickly!", "fast long toST pickout", "chasing"),
  a("An early goal kick and the crowd is loud.", "short wait long", "early"),
  a("Their wingers are tight on your full-backs.", "throw long pickout splitMid"),
  a("A back-pass leaves you with a forward charging at you.", "long short wait"),
  a("The press has switched off and you have time.", "wait short splitMid pickout stepOut"),
  a("Their line is high and the striker has space behind.", "long toST pickout"),
  a("Your centre-backs split wide, inviting a pass.", "short splitMid throw"),
  a("You collect a loose ball and spot the counter.", "fast throw pickout long"),
  a("The pitch is wet and the ball is heavy.", "short long wait"),
];

const CB_ATTACK = [
  a("Space opens up in front of you with the ball at your feet.", "forward stepOut recycle"),
  a("They've dropped off and left you free.", "stepOut diagonal recycle"),
  a("Their striker is pressing you hard.", "recycle backPass long"),
  a("Your full-back is calling for it down the line.", "wide recycle stepOut"),
  a("You can see a runner in behind.", "lofted forward recycle"),
  a("A quick free-kick and their line is out of shape.", "forward lofted quick"),
  a("You're protecting a lead.", "recycle backPass long", "protect"),
  a("You need a goal and the manager wants you to push up.", "stepOut forward diagonal", "chasing"),
  a("Your midfielder is open between the lines.", "inside forward recycle"),
  a("They're pressing high and the ball is at your feet.", "diagonal long backPass"),
  a("The far-side winger is free.", "diagonal switch recycle"),
  a("A header drops loose and you take control.", "forward quick recycle"),
  a("Your striker is dropping short to receive.", "inside recycle forward"),
  a("Their forwards are splitting the two of you.", "stepOut backPass forward"),
  a("Early nerves: the first few passes of the game.", "recycle backPass forward", "early"),
  a("The midfield is crowded and nobody is free.", "long lofted recycle"),
];

const FB_ATTACK = [
  a("You have room on the flank to push on.", "overlap inside recycle"),
  a("Your winger has the ball and is isolated.", "overlap underlap recycle"),
  a("Their winger has been left behind.", "burst cross recycle"),
  a("Their defence is narrow.", "cross cutback recycle"),
  a("The ball is switched to you with space ahead.", "burst cross inside"),
  a("Their full-back is pinned back.", "overlap inside cutback recycle"),
  a("You're up against a tired winger.", "burst cross drift recycle", "late"),
  a("You're chasing the game and need to get forward.", "overlap cross cutback", "chasing"),
  a("You're protecting a lead.", "recycle backPass inside", "protect"),
  a("The midfield is crowded but the flank is empty.", "forward inside recycle"),
  a("You and the winger can double up.", "oneTwo overlap inside"),
  a("You pick the ball up deep with their press on.", "backPass forward recycle quick"),
  a("It's two against one down the wing.", "oneTwo burst cross"),
  a("A loose ball falls to you on the halfway line.", "burst forward recycle"),
  a("Their midfield is shuffling across.", "switch cross recycle"),
  a("You've got to the byline.", "cutback cross recycle"),
];

const DM_ATTACK = [
  a("You pick the ball up in front of the back four.", "forward switch recycle"),
  a("They've left the middle open.", "carry forward quick"),
  a("Their press is high and you have little time.", "quick backPass forward"),
  a("The full-back is free on the flank.", "wide switch recycle"),
  a("You can see a runner in behind.", "lofted forward recycle"),
  a("You win it back and the break is on.", "forward carry through"),
  a("You're protecting a lead.", "slow recycle backPass", "protect"),
  a("You need a goal and the team is stuck.", "diagonal forward lofted switch", "chasing"),
  a("An early moment of calm in the game.", "recycle slow forward", "early"),
  a("Their midfield is dragged to one side.", "diagonal switch recycle"),
  a("You have time and space to look up.", "forward diagonal carry recycle"),
  a("The striker is dropping short.", "inside forward recycle"),
  a("They are pressing you man-to-man.", "backPass quick recycle"),
  a("You drop between the centre-backs.", "diagonal forward recycle"),
  a("A second ball drops in front of you.", "forward quick recycle snap"),
  a("The winger is demanding the ball.", "wide diagonal recycle"),
];

const CM_ATTACK = [
  a("You receive the ball between the lines.", "through carry recycle"),
  a("Their midfield has been stretched.", "through drive forward recycle"),
  a("You're being pressed from behind.", "turn quick recycle"),
  a("A runner is making a gap in behind.", "through lofted recycle"),
  a("You pick up the ball on the edge of their box.", "oneTwo through snap recycle"),
  a("The winger is isolated and wants help.", "wide overlap recycle"),
  a("You're protecting a lead.", "slow recycle backPass", "protect"),
  a("You're chasing the game.", "through lofted drive forward", "chasing"),
  a("An early chance to set the tempo.", "recycle quick forward", "early"),
  a("A loose ball falls to you outside the area.", "snap volley recycle forward"),
  a("The striker is checking short.", "inside through recycle"),
  a("You've got time to pick a pass.", "diagonal through forward recycle"),
  a("Their holding midfielder is drawn out.", "through carry forward"),
  a("There's an overload on the left.", "oneTwo wide recycle"),
  a("You win a second ball in the middle.", "firstTime through recycle"),
  a("They're sitting deep and compact.", "snap oneTwo recycle switch"),
];

const AM_ATTACK = [
  a("You find a pocket of space behind their midfield.", "through takeOn distance recycle"),
  a("The striker is in behind the line.", "through lofted recycle"),
  a("Two markers close you down in the pocket.", "turn quick recycle takeOn"),
  a("The ball drops on the edge of the area.", "snap volley place recycle"),
  a("A winger is overlapping.", "wide oneTwo recycle"),
  a("They are sitting in a low block.", "through takeOn snap switch"),
  a("You're protecting a lead.", "slow recycle backPass", "protect"),
  a("You're chasing the game and every ball counts.", "through lofted takeOn snap", "chasing"),
  a("Early in the game and you're finding your range.", "through recycle snap", "early"),
  a("You've turned and the defence is backing off.", "through drive snap takeOn"),
  a("The full-back has gone forward and left space.", "wide diagonal through"),
  a("A knockdown falls to your feet.", "volley place through recycle"),
  a("There's a hole in front of the centre-backs.", "carry through oneTwo"),
  a("The striker has pulled a defender wide.", "through inside takeOn"),
  a("You win a loose ball in midfield.", "firstTime through carry recycle"),
  a("The keeper is slightly off his line.", "chip snap through place"),
];

const WING_ATTACK = [
  a("You're isolated against the full-back.", "takeOn cross cutIn recycle"),
  a("The ball is switched to you with space ahead.", "burst cross cutIn recycle"),
  a("The full-back is backing off.", "takeOn cutIn cross recycle"),
  a("The striker is making a run at the near post.", "cross cutback recycle"),
  a("You've got a two-on-one on the flank.", "oneTwo takeOn cross"),
  a("There's space inside for the shot.", "cutIn snap drift recycle"),
  a("You're protecting a lead and the corner flag is near.", "recycle backPass drift", "protect"),
  a("You're chasing the game and need an equaliser.", "takeOn cross cutIn snap", "chasing"),
  a("A quiet start and the crowd wants to see something.", "takeOn cross recycle", "early"),
  a("You've got to the byline.", "cutback cross recycle"),
  a("Their full-back is tired.", "burst takeOn cross", "late"),
  a("A defender is covering the full-back, so you have a decision to make.", "takeOn nutmeg cross recycle"),
  a("You can see the keeper has strayed from his line.", "cutIn chip snap cross"),
  a("A pass is played over the top for you.", "burst cross chip place"),
  a("You receive it in the half-space.", "drift through cutIn recycle"),
  a("Their centre-back has stepped out.", "drive through cutIn recycle"),
];

const ST_ATTACK = [
  a("The ball comes up to you with the defence stepping up.", "runBehind holdUp layOff"),
  a("A cross is coming in from the right.", "attackCross nearPost farPost"),
  a("You've got your back to goal with a defender on you.", "turn holdUp layOff flick"),
  a("The midfielder has time to pick a pass.", "runBehind check lateRun"),
  a("The ball drops on the edge of the area.", "volley snap place layOff"),
  a("Their line is high.", "runBehind lateRun check"),
  a("You're protecting a lead.", "holdUp layOff check", "protect"),
  a("You're chasing the game and need a goal.", "runBehind attackCross snap turn", "chasing"),
  a("An early ball up to you.", "holdUp check layOff", "early"),
  a("A knockdown falls to your feet.", "volley place turn layOff"),
  a("Their centre-back is tight on you.", "turn flick layOff holdUp"),
  a("A through ball is on and you're running onto it.", "runBehind chip place"),
  a("You win a header from a long ball.", "flick layOff holdUp"),
  a("There's a gap between the centre-backs.", "runBehind check oneTwo"),
  a("A second ball is loose in the box.", "snap place volley attackCross"),
  a("A cutback is coming across the six-yard box.", "nearPost farPost place"),
];

const CB_DEFEND = [
  f("Their move is building towards your box. How do you deal with it?", "hold track challenge"),
  f("Their striker is making a run in behind.", "track trap cover"),
  f("A cross is about to come in.", "claimCross clear hold"),
  f("The striker has his back to goal and a teammate is closing.", "challenge step double"),
  f("A long ball is played over the top.", "cover trackBack clear"),
  f("They are pressing in numbers.", "squeeze hold clear"),
  f("You're protecting a lead.", "clear hold cover", "protect"),
  f("You're chasing the game and they're breaking.", "step trackBack double", "chasing"),
  f("An early attack and they're testing you.", "hold challenge track", "early"),
  f("Their winger is cutting inside.", "jockey hold block"),
  f("A shot is coming in.", "block clear hold"),
  f("The ball is played between you and the full-back.", "cover track clear"),
  f("They've got a two-on-two in the box.", "hold challenge double"),
  f("A free-kick is about to be taken.", "trap hold clear"),
  f("A loose ball in the area.", "clear block step"),
];

const FB_DEFEND = [
  f("Their winger is coming at you.", "recover pressWide hold"),
  f("Their full-back is overlapping.", "recover track hold"),
  f("The winger is trying to cut inside.", "jockey tuck closeDown"),
  f("A ball is played over the top of you.", "trackBack cover clear"),
  f("A cross is coming in.", "claimCross clear block"),
  f("They're two against one on your flank.", "double delay jockey"),
  f("You're protecting a lead.", "delay jockey clear", "protect"),
  f("You're caught high up the pitch.", "trackBack recover delay", "chasing"),
  f("Early on, their winger is testing you.", "jockey pressWide hold", "early"),
  f("The winger is going to the byline.", "block jockey delay"),
  f("A quick throw-in catches you out of position.", "closeDown trackBack hold"),
  f("The winger is receiving between you and the centre-back.", "tuck recover hold"),
  f("A diagonal ball is switched to the far side.", "cover trackBack recover"),
  f("You win a duel but the ball is loose.", "clear block closeDown"),
  f("The winger is taking you on at pace.", "delay jockey slide"),
];

const DM_DEFEND = [
  f("They break through midfield and you're the screen.", "cutPass step screen"),
  f("The playmaker has the ball in front of you.", "shadow step challenge"),
  f("Their midfielder is carrying it forward.", "challenge closeDown hold"),
  f("The striker is checking short.", "shadow cutPass step"),
  f("A diagonal ball is on.", "cutPass cover hold"),
  f("A second ball drops in front of you.", "challenge clear closeDown"),
  f("You're protecting a lead.", "screen hold cover", "protect"),
  f("You're chasing the game and they're countering.", "step squeeze trackBack", "chasing"),
  f("Early on, their midfield is probing.", "hold shadow cutPass", "early"),
  f("They're overloading the middle.", "double screen hold"),
  f("A through ball is coming for the runner.", "cutPass cover track"),
  f("A shot is coming in from the edge.", "block closeDown screen"),
  f("They switch play and your side is stretched.", "cover tuck screen"),
  f("A quick break is on.", "slide delay screen"),
  f("The ball is played into the feet of their number ten.", "challenge double shadow"),
];

const CM_DEFEND = [
  f("The attack is coming through the middle.", "step cutPass hold"),
  f("Their midfielder is receiving between the lines.", "closeDown shadow challenge"),
  f("They're building down your flank.", "cover pressWide hold"),
  f("A counter-attack is being launched.", "delay trackBack step"),
  f("A loose ball falls to their midfielder.", "challenge closeDown block"),
  f("They're passing it around your midfield.", "squeeze cutPass shadow"),
  f("You're protecting a lead.", "hold screen cover", "protect"),
  f("You're chasing the game and trying to win it back.", "step squeeze challenge", "chasing"),
  f("Early on, they're trying to dominate the middle.", "hold step cutPass", "early"),
  f("Their striker is dropping into midfield.", "shadow double hold"),
  f("They're about to shoot from range.", "block closeDown hold"),
  f("A long ball is dropping behind you.", "trackBack cover clear"),
  f("They've got a numerical advantage in the middle.", "double delay hold"),
  f("They've won a throw-in in your half.", "closeDown hold shadow"),
  f("The ball is played to their wide player.", "cover pressWide delay"),
];

const AM_DEFEND = [
  f("They're building from the back.", "step hold pressCB"),
  f("Their defensive midfielder has the ball.", "cutDM step shadow"),
  f("They're playing it out of defence.", "pressCB squeeze hold"),
  f("The keeper has the ball at his feet.", "pressCB closeDown hold"),
  f("Their centre-back is stepping out.", "step closeDown shadow"),
  f("They're switching play across the back.", "squeeze cutDM hold"),
  f("You're protecting a lead.", "hold shadow cutDM", "protect"),
  f("You're chasing the game and need the ball back.", "step pressCB closeDown", "chasing"),
  f("A new phase early in the game.", "hold step shadow", "early"),
  f("Their full-back is on the ball.", "pressWide shadow hold"),
  f("Their holding midfielder is free.", "cutDM shadow hold"),
  f("They play a short goal kick.", "pressCB squeeze closeDown"),
  f("They're trying to play through the middle.", "shadow cutPass step"),
  f("A loose pass puts them under pressure.", "closeDown step challenge"),
  f("They're going long.", "hold trackBack cover"),
];

const WING_DEFEND = [
  f("Their full-back is overlapping.", "recover step hold"),
  f("Their full-back is on the ball.", "pressWide closeDown hold"),
  f("You've got to track back.", "trackBack recover tuck"),
  f("They're building down your side.", "pressWide shadow hold"),
  f("Their full-back is carrying it forward.", "jockey closeDown step"),
  f("A switch of play is on.", "recover tuck hold"),
  f("You're protecting a lead.", "hold tuck recover", "protect"),
  f("You're chasing the game and need to press.", "step pressWide closeDown", "chasing"),
  f("Early on, their full-back is advancing.", "hold pressWide recover", "early"),
  f("Their winger is cutting inside.", "tuck recover shadow"),
  f("A long ball is coming down your side.", "trackBack cover recover"),
  f("They've got an overload on your flank.", "double recover hold"),
  f("A throw-in on your flank.", "closeDown shadow hold"),
  f("They're playing it round you.", "pressWide step shadow"),
  f("Their full-back is crossing it.", "block recover closeDown"),
];

const ST_DEFEND = [
  f("Their centre-backs have the ball.", "step hold pressCB"),
  f("Their keeper is about to play it short.", "pressCB closeDown hold"),
  f("Their holding midfielder is free.", "cutDM shadow hold"),
  f("They're building from the back.", "squeeze pressCB step"),
  f("A centre-back is bringing it out.", "step closeDown shadow"),
  f("They're passing it across the back.", "pressCB squeeze hold"),
  f("You're protecting a lead.", "hold shadow cutDM", "protect"),
  f("You're chasing the game and need the ball back.", "step pressCB closeDown", "chasing"),
  f("Early on, they're trying to play out.", "hold step pressCB", "early"),
  f("Their full-back is dropping deep.", "pressWide shadow hold"),
  f("They go long to avoid your press.", "hold trackBack cover"),
  f("A pass is played to their holding midfielder.", "cutDM closeDown shadow"),
  f("A loose ball falls near their centre-back.", "closeDown step challenge"),
  f("They're passing out of the press.", "squeeze cutDM pressCB"),
  f("Their centre-back is hesitating.", "closeDown pressCB step"),
];

export const ATTACK_SCENES: Record<Position, Scenario[]> = {
  GK: GK_ATTACK, CB: CB_ATTACK, RB: FB_ATTACK, LB: FB_ATTACK, DM: DM_ATTACK, CM: CM_ATTACK, AM: AM_ATTACK, RW: WING_ATTACK, LW: WING_ATTACK, ST: ST_ATTACK,
};
export const DEFEND_SCENES: Record<Position, Scenario[]> = {
  GK: [], CB: CB_DEFEND, RB: FB_DEFEND, LB: FB_DEFEND, DM: DM_DEFEND, CM: CM_DEFEND, AM: AM_DEFEND, RW: WING_DEFEND, LW: WING_DEFEND, ST: ST_DEFEND,
};

/**
 * One scenario from a pool: never one already used in this match (until the pool runs out), and the ones that suit the state of
 * the match (chasing a goal, protecting a lead, the opening minutes) count for more. Decisive scenarios are favoured by `impactBias`
 * (above 1 for a player in the thick of it, below 1 for one on the fringe). `roll` is a draw in [0, 1).
 */
export function pickScenario(pool: Scenario[], x: SceneContext, used: Set<string>, roll: number, impactBias = 1): Scenario {
  let fresh = pool.filter((s) => !used.has(s.prompt) && (!s.cond || sceneHolds(s.cond, x)));
  if (!fresh.length) fresh = pool.filter((s) => !s.cond || sceneHolds(s.cond, x));
  const weights = fresh.map((s) => (s.cond ? 3 : 1) * (s.impact ? impactBias : 1));
  let r = roll * weights.reduce((t, w) => t + w, 0);
  for (let i = 0; i < fresh.length; i++) {
    r -= weights[i];
    if (r < 0) return fresh[i];
  }
  return fresh[fresh.length - 1];
}

// ───────────────────────────── the chances that come to the user: wording for the shot, the pass, the cross and the save

/** Where the user is when a chance falls to him, by kind of chance. */
export const SHOOT_SCENES: Record<"open" | "header" | "long" | "oneonone", readonly string[]> = {
  open: [
    "The ball drops to you in the box.",
    "A teammate lays it back and you're on the penalty spot.",
    "A cutback comes across the six-yard box.",
    "A rebound falls invitingly at your feet.",
    "You've got half a yard inside the area.",
    "A defender's slip leaves you with the ball at the edge of the six-yard box.",
    "The ball breaks loose and you reach it first.",
    "A quick one-two puts you clear in the box.",
    "A low cross skips through to you at the near post.",
    "You take a pass on the turn in the penalty area.",
    "A knockdown drops perfectly for you.",
    "The keeper parries and it comes back out to you.",
    "A defender's clearance falls straight to you.",
    "You find space between two defenders.",
    "A flick-on drops into your path inside the area.",
    "There's a gap and the ball is at your feet.",
  ],
  header: [
    "The cross is coming in. You're unmarked at the back post.",
    "A corner swings in and you're rising.",
    "A whipped cross drops between the keeper and the defence.",
    "A free-kick is floated into the area for you.",
    "You lose your marker as the cross comes in.",
    "A deep cross is hanging in the air for you.",
    "A lofted ball lands in the six-yard box.",
    "The winger crosses early and you're on the move.",
    "A flick-on drops towards you at the far post.",
    "A cross from the byline is coming to you.",
    "You steal a yard on the defender at the near post.",
    "The ball is swung in and you're the tallest in the box.",
    "A teammate heads it across goal to you.",
    "The cross is low and fast at head height.",
    "You are on your own at the back stick.",
    "A late run into the box meets the cross.",
  ],
  long: [
    "The ball sits up for you 25 yards out.",
    "The ball falls to you at the edge of the area.",
    "The defence backs off and gives you space to shoot.",
    "A loose ball bounces up on the edge of the box.",
    "A clearance drops to you 25 yards out.",
    "A short free-kick leaves you with a sight of goal.",
    "You have time on the ball at the top of the box.",
    "A teammate rolls it into your path outside the area.",
    "The ball sits up nicely on the edge of the area.",
    "You get a sight of goal from distance.",
    "A defender stops you from going any further, but the shot is on.",
    "The ball spins up off a block, right in front of you.",
    "You pick the ball up with the keeper off his line.",
    "A pass is knocked back to you at the top of the area.",
    "A scramble leaves you with the ball outside the box.",
    "There's a gap in the wall of defenders in front of you.",
  ],
  oneonone: [
    "You're clean through on goal!",
    "A through ball splits the defence and you're away!",
    "You've outpaced the last defender and it's you against the keeper.",
    "The offside flag stays down and you're through!",
    "You intercept a loose pass and have only the keeper to beat.",
    "A mistake at the back leaves you through on goal.",
    "A defender slips and you're free.",
    "A long ball over the top puts you in on goal.",
    "A flick-on sets you through.",
    "A cheeky backheel puts you clear.",
    "The keeper is stranded and you're through.",
    "The defence has gone to sleep and you're in!",
    "A pass from the wing leaves you one-on-one.",
    "You break the offside trap and it's just you and the keeper.",
    "A loose touch from the defender falls to you with only the keeper ahead.",
    "You're racing in on goal with a defender trailing.",
  ],
};

/** The creator's view: the final-third pass or cross. `{s}` is the player he can find. */
export const CREATE_SCENES: readonly string[] = [
  "You've got the ball in the final third with options ahead...",
  "{s} is making a run and you have the ball on the edge of the box.",
  "You've got time on the ball and {s} is moving into space.",
  "The defence is stretched and {s} is lurking in the box.",
  "You pick up the ball in the half-space and {s} is calling for it.",
  "The full-back has gone and there's space to deliver.",
  "A loose ball falls to you with {s} on the shoulder of the last defender.",
  "The attack is breaking and you're the man on the ball.",
  "A throw-in puts you in a good crossing position.",
  "You win it in midfield and {s} is already running.",
  "There's an overlap on and {s} is in the area.",
  "You've got your head up and spaces are opening in the box.",
  "{s} is waving his arms in the box.",
  "A short corner leaves you with space.",
  "A rebound is yours on the edge of the area.",
  "A pass back puts you in space on the right.",
];

/** The keeper's one-on-ones. `{a}` is the attacker. */
export const KEEP_SCENES: readonly string[] = [
  "{a} is bearing down on your goal!",
  "{a} is through and it's you against him!",
  "{a} has beaten the offside trap!",
  "{a} breaks clear of the defence!",
  "A mistake at the back leaves {a} with only you to beat.",
  "{a} is racing in on goal.",
  "{a} is clean through!",
  "{a} controls it in the area with only you ahead.",
  "{a} is racing through with a defender chasing.",
  "{a} runs on to a ball over the top.",
  "The back line is split and {a} is in on you.",
  "{a} has a one-on-one against you.",
  "{a} has a sight of goal inside the box.",
  "A through ball finds {a} in the box.",
  "{a} cuts inside and faces you.",
  "{a} is sprinting towards you with the ball.",
];

/** A cross the keeper has to deal with. `{c}` is the crosser and `{s}` is the man at the back post. */
export const CLAIM_SCENES: readonly string[] = [
  "{c}'s cross is coming in and {s} is waiting at the back post.",
  "A corner is swung in and {s} is rising at the far post.",
  "{c} whips in a cross and {s} is running on to it.",
  "A free-kick is floated in towards {s}.",
  "A deep cross is hanging up for {s}.",
  "{c} delivers an early cross and {s} is making his move.",
  "A cross is flashed across the six-yard box for {s}.",
  "The ball is lofted over the defence towards {s}.",
  "{c} sends a dangerous ball towards the penalty spot, where {s} is waiting.",
  "A cross comes from the byline and {s} is there to meet it.",
  "A looping cross drops towards the back post, where {s} is lurking.",
  "{s} peels away from his marker as the cross comes in.",
  "A low cross is on its way towards {s}.",
  "The cross is on its way and {s} is unmarked.",
  "{c} crosses from the right and {s} is on the move.",
  "Another cross is coming in and {s} is rising.",
];

/** The defender's lone duel against a runner. `{a}` is the attacker. */
export const DUEL_SCENES: readonly string[] = [
  "{a} is running at you on the counter!",
  "{a} has the ball and is running at the defence.",
  "{a} is racing through the middle!",
  "{a} breaks away down the flank.",
  "{a} has taken the ball past your midfielder and is coming at you.",
  "{a} picks up the ball and runs at you.",
  "{a} is advancing and there's no cover.",
  "A turnover and {a} is on the attack.",
  "{a} is running at your back line.",
  "{a} carries it forward with pace.",
  "{a} has space and is charging forward.",
  "{a} receives it on the halfway line and is running at you.",
  "{a} spins away from a challenge and bears down on you.",
  "{a} is one-on-one against you.",
  "{a} goes past a teammate and is coming straight at you.",
  "{a} is breaking and you're the last man.",
];

/** Picks wording for a chance, avoiding what this match has already used. */
export function pickLine(lines: readonly string[], used: Set<string>, roll: number): string {
  const fresh = lines.filter((l) => !used.has(l));
  const pool = fresh.length ? fresh : lines;
  return pool[Math.min(pool.length - 1, Math.floor(roll * pool.length))];
}
