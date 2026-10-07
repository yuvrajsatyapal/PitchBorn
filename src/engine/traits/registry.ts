/**
 * The trait catalogue. Adding a trait means adding one entry here: position eligibility, the
 * attributes it relies on, conflicts, the behaviour that earns it, and its match/career effects.
 * Nothing else in the engine branches on trait ids.
 */
import type { Position, TraitId } from "../types";
import type { TraitDef } from "./types";

const GK = ["GK"] as const;
const CB = ["CB"] as const;
const FB = ["RB", "LB"] as const;
const DM = ["DM"] as const;
const CM = ["CM"] as const;
const AM = ["AM"] as const;
const W = ["RW", "LW"] as const;
const ST = ["ST"] as const;
const OUT = ["RB", "CB", "LB", "DM", "CM", "AM", "RW", "LW", "ST"] as const;
const ATTACKERS = ["AM", "RW", "LW", "ST"] as const;
const MIDFIELD = ["DM", "CM", "AM"] as const;

type Base = Omit<TraitDef, "id" | "name" | "blurb" | "category" | "positions" | "core" | "rarity">;
const def = (
  id: TraitId, name: string, category: TraitDef["category"], positions: TraitDef["positions"], blurb: string,
  core: TraitDef["core"], rarity: number, rest: Base = {},
): TraitDef => ({ id, name, blurb, category, positions, core, rarity, ...rest });
const u = (a: TraitId) => ({ id: a, kind: "unlikely" as const });

export const TRAITS: TraitDef[] = [
  // ───────────────────────────── GOALKEEPER ─────────────────────────────
  def("sweeper_keeper", "Sweeper Keeper", "playstyle", GK, "Comes off the line to cut out balls over the top, so the opposition get fewer one-on-ones; chips and long shots are a little more dangerous against them.", ["command", "kicking", "acceleration"], 2, {
    req: [{ attr: "command", min: 60 }], conflicts: [u("shot_stopper")], role: "sweeper-keeper",
    signals: { save1v1: 1.2, saves: 0.1, cleanSheet: 0.5, full90: 0.12 }, trained: ["goalkeeping"],
    match: { againstFreq1v1: 0.82, againstXg1v1: 0.96, againstXgLong: 1.07 },
  }),
  def("shot_stopper", "Shot Stopper", "playstyle", GK, "Lives on the line and on reflexes: shots on target are saved more often.", ["reflexes", "diving", "handling"], 2, {
    req: [{ attr: "reflexes", min: 62 }], conflicts: [u("sweeper_keeper")], role: "shot-stopper",
    signals: { saves: 0.3, save1v1: 0.6, cleanSheet: 0.4 }, trained: ["goalkeeping"],
    match: { save: 0.94, claim: 1.03 },
  }),
  def("cross_commander", "Cross Commander", "playstyle", GK, "Dominates the area: fewer crosses and corners become headed chances, and those that do are claimed more often.", ["handling", "command", "strength"], 2, {
    req: [{ attr: "command", min: 62 }], role: "commanding keeper",
    signals: { claim: 1.2, cleanSheet: 0.4 }, trained: ["goalkeeping"],
    match: { againstFreqHeader: 0.88, againstXgHeader: 0.95, claim: 0.93 },
  }),
  def("penalty_reader", "Penalty Reader", "playstyle", GK, "Studies takers and guesses right: penalties against them are saved more often.", ["reflexes", "diving", "composure"], 3, {
    signals: { saves: 0.15, bigGame: 0.8, highRating: 0.3 }, trained: ["goalkeeping"],
    match: { penSave: 0.86 }, role: "penalty-saver",
  }),
  def("long_distributor", "Long Distributor", "playstyle", GK, "Launches quick, accurate long throws and kicks: more balls over the top for the forwards.", ["kicking", "vision", "passing"], 2, {
    req: [{ attr: "kicking", min: 62 }], conflicts: [u("build_up_keeper")],
    signals: { assists: 1.5, keyPasses: 0.8, chanceThrough: 1.0 }, trained: ["goalkeeping", "passing"],
    match: { freq1v1: 0.05, teamAtt: 0.006, create: 8 },
  }),
  def("build_up_keeper", "Build-Up Keeper", "playstyle", GK, "Plays short and calm under pressure, helping the side keep the ball and control midfield.", ["passing", "composure", "kicking"], 2, {
    req: [{ attr: "passing", min: 55 }], conflicts: [u("long_distributor")],
    signals: { full90: 0.3, cleanSheet: 0.3, keyPasses: 1.0 }, trained: ["goalkeeping", "passing"],
    match: { teamMid: 0.012, againstXgOpen: 1.02 },
  }),
  def("one_on_one_specialist", "One-on-One Specialist", "playstyle", GK, "Stands tall and spreads wide: one-on-ones against them are far less likely to end in goals.", ["reflexes", "composure", "positioning"], 3, {
    signals: { save1v1: 1.8, cleanSheet: 0.2 }, trained: ["goalkeeping"],
    match: { save1v1: 0.9 },
  }),

  // ───────────────────────────── CENTRE-BACK ─────────────────────────────
  def("ball_progressor", "Ball Progressor", "playstyle", CB, "Steps out with the ball and splits lines with passes, creating chances from deep.", ["passing", "vision", "composure"], 2, {
    req: [{ attr: "passing", min: 62 }], conflicts: [{ id: "no_nonsense", kind: "exclusive" }], role: "ball-playing centre-back",
    signals: { keyPasses: 1.0, assists: 1.6, chanceThrough: 1.0, chanceOpen: 0.8 }, trained: ["passing"],
    match: { create: 2.2, createThrough: 1.3, freq1v1: 0.03, againstXgOpen: 1.02 },
  }),
  def("no_nonsense", "No-Nonsense Defender", "playstyle", CB, "Clears first, asks questions later: rarely tries anything fancy and makes the safe choice.", ["tackling", "positioning", "heading"], 1, {
    conflicts: [{ id: "ball_progressor", kind: "exclusive" }], role: "no-nonsense centre-back",
    signals: { cleanSheet: 0.5, block: 0.8, intercept: 0.5, tackles: 0.25 }, trained: ["defending"],
    match: { create: 0.45, againstXgOpen: 0.97, zoneDef: 1.012 },
  }),
  def("aerial_dominator", "Aerial Dominator", "playstyle", CB, "Wins nearly everything in the air, at both ends: fewer headed chances against the side and more threat from set pieces.", ["heading", "strength", "positioning"], 2, {
    req: [{ attr: "heading", min: 68 }],
    signals: { block: 0.5, goalHeader: 1.4, shotHeader: 0.4, cleanSheet: 0.3 }, trained: ["defending", "physical"],
    match: { againstFreqHeader: 0.94, againstXgHeader: 0.93, shootHeader: 1.7, xgHeader: 1.04 }, role: "commanding aerial centre-back",
  }),
  def("front_foot", "Front-Foot Defender", "playstyle", CB, "Steps up to win the ball early, breaking up attacks, but can be left exposed behind.", ["tackling", "pace", "acceleration"], 2, {
    conflicts: [{ id: "cover_defender", kind: "exclusive" }], role: "front-foot centre-back",
    signals: { tackles: 0.5, intercept: 0.9 }, trained: ["defending"],
    match: { tackle: 1.35, intercept: 1.2, foul: 1.15, againstXgOpen: 0.96, againstXg1v1: 1.08 },
  }),
  def("cover_defender", "Cover Defender", "playstyle", CB, "Reads danger and recovers: stays goalside, so runs in behind produce fewer one-on-ones.", ["positioning", "pace", "composure"], 2, {
    conflicts: [{ id: "front_foot", kind: "exclusive" }], role: "covering centre-back",
    signals: { cleanSheet: 0.5, block: 0.7 }, trained: ["defending", "pace"],
    match: { againstXg1v1: 0.9, againstFreq1v1: 0.9, tackle: 0.85, foul: 0.85 },
  }),
  def("last_line", "Last-Line Defender", "playstyle", CB, "Throws the body in front of everything in the box: shots against the side are blocked and softened.", ["tackling", "positioning", "strength"], 3, {
    signals: { block: 1.3, cleanSheet: 0.4 }, trained: ["defending"],
    match: { intercept: 1.2, againstXgOpen: 0.95, againstXgLong: 0.97 }, role: "last-ditch defender",
  }),
  def("set_piece_threat", "Set-Piece Threat", "playstyle", CB, "Rises at corners and free kicks: far more likely to take the header.", ["heading", "strength", "positioning"], 2, {
    signals: { goalHeader: 1.8, shotHeader: 0.5 }, trained: ["setPieces", "defending"],
    match: { shootHeader: 2.0, xgHeader: 1.03, freqHeader: 0.03 }, role: "set-piece threat from defence",
  }),

  // ───────────────────────────── FULL-BACK / WING-BACK ─────────────────────────────
  def("overlapping_runner", "Overlapping Runner", "playstyle", FB, "Gallops past the winger and whips balls in: more crossing chances, a little less defensive cover.", ["pace", "stamina", "crossing"], 2, {
    conflicts: [{ id: "inverted_fullback", kind: "exclusive" }], role: "overlapping full-back",
    signals: { chanceCross: 1.2, assists: 1.0, keyPasses: 0.5 }, trained: ["pace", "passing"],
    match: { createCross: 1.7, create: 1.25, freqHeader: 0.06, zoneDef: 0.985, drain: 1.03 },
  }),
  def("inverted_fullback", "Inverted Fullback", "playstyle", FB, "Tucks into midfield to build play: more central passing and better control of the middle, fewer crosses.", ["passing", "vision", "positioning"], 3, {
    conflicts: [{ id: "overlapping_runner", kind: "exclusive" }], role: "inverted full-back",
    signals: { chanceThrough: 1.0, chanceOpen: 0.9, keyPasses: 0.8 }, trained: ["passing"],
    match: { createOpen: 1.6, createThrough: 1.4, createCross: 0.6, teamMid: 0.008 },
  }),
  def("early_crosser", "Early Crosser", "playstyle", FB, "Delivers first-time from deep: lots of balls into the area, so more headed chances.", ["crossing", "vision", "firstTouch"], 2, {
    signals: { chanceCross: 1.4, assists: 0.9 }, trained: ["setPieces", "passing"],
    match: { createCross: 1.6, freqHeader: 0.08 }, role: "crossing full-back",
  }),
  def("defensive_fullback", "Defensive Fullback", "playstyle", FB, "Stays back and does the basics: wins duels and protects the box, rarely joins in.", ["tackling", "positioning", "strength"], 1, {
    role: "defensive full-back", signals: { tackles: 0.5, intercept: 0.7, cleanSheet: 0.5 }, trained: ["defending"],
    match: { tackle: 1.2, intercept: 1.15, againstXgOpen: 0.97, create: 0.6, zoneDef: 1.015 },
  }),
  def("byline_runner", "Byline Runner", "playstyle", FB, "Drives to the goal line and cuts the ball back.", ["pace", "dribbling", "crossing"], 2, {
    role: "attacking full-back", signals: { chanceOpen: 1.2, assists: 1.0 }, trained: ["pace", "dribbling"],
    match: { createOpen: 1.45, createCross: 1.2, drain: 1.03 },
  }),

  // ───────────────────────────── DEFENSIVE MIDFIELDER ─────────────────────────────
  def("anchor", "Anchor", "playstyle", DM, "Holds the position and shields the back line: fewer central shots against, rarely advances.", ["positioning", "tackling", "composure"], 2, {
    conflicts: [{ id: "late_box_runner", kind: "exclusive" }], role: "holding midfielder",
    signals: { cleanSheet: 0.5, tackles: 0.3, intercept: 0.6, full90: 0.15 }, trained: ["defending"],
    match: { againstXgOpen: 0.96, zoneDef: 1.02, teamDef: 0.008, create: 0.7, shoot: 0.5 },
  }),
  def("ball_hunter", "Ball Hunter", "playstyle", DM, "Chases the ball relentlessly: lots of tackles and interceptions, and more fouls and bookings.", ["tackling", "stamina", "strength"], 2, {
    role: "ball-winning midfielder", signals: { tackles: 0.7, intercept: 0.8, yellow: 0.2 }, trained: ["defending", "physical"],
    match: { tackle: 1.4, intercept: 1.1, foul: 1.25, card: 1.2, drain: 1.04 },
  }),
  def("deep_distributor", "Deep Distributor", "playstyle", DM, "Starts attacks from deep with long, accurate passes behind the defence.", ["passing", "vision", "composure"], 2, {
    role: "deep-lying playmaker", signals: { chanceThrough: 1.3, keyPasses: 0.6, assists: 1.0 }, trained: ["passing"],
    match: { createThrough: 1.5, createOpen: 1.25, freq1v1: 0.05 },
  }),
  def("lane_reader", "Passing-Lane Reader", "playstyle", DM, "Sees the pass before it is played: cuts out through-balls and breaks up attacks before they develop.", ["vision", "positioning", "tackling"], 3, {
    role: "interceptor", signals: { intercept: 1.4, cleanSheet: 0.3 }, trained: ["defending"],
    match: { intercept: 1.5, againstFreq1v1: 0.92, againstXg1v1: 0.95 },
  }),
  def("tempo_controller", "Tempo Controller", "playstyle", ["DM", "CM"], "Sets the rhythm of the game: the side keeps the ball better and plays calmly.", ["passing", "vision", "composure"], 3, {
    role: "tempo-setting midfielder", signals: { full90: 0.2, keyPasses: 0.6, highRating: 0.4 }, trained: ["passing"],
    match: { teamMid: 0.012, create: 1.15, foul: 0.9, drain: 0.97 },
    conflicts: [u("box_to_box")],
  }),
  def("defensive_screen", "Defensive Screen", "playstyle", DM, "Sits in front of the centre-backs: opponents take fewer long shots and central chances.", ["positioning", "tackling", "strength"], 2, {
    role: "screening midfielder", signals: { block: 0.8, intercept: 0.6, cleanSheet: 0.4 }, trained: ["defending"],
    match: { againstXgOpen: 0.94, againstFreqLong: 0.93, zoneDef: 1.02, create: 0.6 },
  }),

  // ───────────────────────────── CENTRAL MIDFIELDER ─────────────────────────────
  def("box_to_box", "Box-to-Box Runner", "playstyle", CM, "Covers the whole pitch: tackles at one end, arrives in the box at the other.", ["stamina", "tackling", "finishing"], 2, {
    conflicts: [u("tempo_controller"), u("metronome")], role: "box-to-box midfielder",
    signals: { tackles: 0.4, shots: 0.3, goals: 0.8, full90: 0.25 }, trained: ["physical"],
    match: { shoot: 1.25, tackle: 1.15, create: 1.1, drain: 1.05, teamMid: 0.005 },
  }),
  def("progressive_carrier", "Progressive Carrier", "playstyle", ["RB", "LB", "CM", "DM", "AM"], "Drives forward with the ball at the feet, pulling defenders out of shape.", ["dribbling", "pace", "vision"], 2, {
    role: "ball-carrying midfielder", signals: { chanceOpen: 1.0, chanceThrough: 0.8, keyPasses: 0.5 }, trained: ["dribbling"],
    match: { createOpen: 1.35, createThrough: 1.25, shoot: 1.1 },
  }),
  def("late_box_runner", "Late Box Runner", "playstyle", CM, "Arrives in the area late, unmarked: far more shots and headers than a normal midfielder.", ["stamina", "finishing", "positioning"], 2, {
    conflicts: [{ id: "anchor", kind: "exclusive" }, u("metronome")], role: "goalscoring midfielder",
    signals: { goalOpen: 1.3, shotOpen: 0.25, goalHeader: 0.8, goals: 0.5 }, trained: ["finishing"],
    match: { shoot: 1.9, shoot1v1: 1.3, shootHeader: 1.3, create: 0.8, zoneDef: 0.985 },
  }),
  def("metronome", "Metronome", "playstyle", ["CM", "DM"], "Plays the simple pass, over and over, accurately: steadies the side and shifts the ball efficiently.", ["passing", "composure", "vision"], 2, {
    conflicts: [u("late_box_runner"), u("box_to_box")], role: "metronomic midfielder",
    signals: { full90: 0.3, keyPasses: 0.5, assists: 0.7 }, trained: ["passing"],
    match: { teamMid: 0.015, create: 1.1, createOpen: 1.3, shoot: 0.7 },
  }),
  def("line_breaker", "Line Breaker", "playstyle", ["CM", "AM"], "Looks for the pass that splits the defence: more one-on-ones for the forwards.", ["vision", "passing", "firstTouch"], 2, {
    role: "line-breaking playmaker", signals: { chanceThrough: 1.4, keyPasses: 0.6 }, trained: ["passing"],
    match: { createThrough: 1.6, freq1v1: 0.08 },
  }),

  // ───────────────────────────── ATTACKING MIDFIELDER ─────────────────────────────
  def("advanced_creator", "Advanced Creator", "playstyle", AM, "The side's chief chance-maker: far more of the final passes come from here.", ["vision", "passing", "dribbling"], 2, {
    conflicts: [u("second_striker")], role: "creative playmaker",
    signals: { chanceOpen: 1.1, assists: 1.4, keyPasses: 0.7 }, trained: ["passing"],
    match: { create: 1.6, createOpen: 1.4, shoot: 0.85 },
  }),
  def("free_roamer", "Free Roamer", "playstyle", AM, "Drifts wherever the game is, popping up for shots and passes alike, at some cost to shape.", ["dribbling", "vision", "stamina"], 3, {
    role: "free-roaming attacker", signals: { shots: 0.25, keyPasses: 0.5, goals: 0.5, assists: 0.7 }, trained: ["dribbling"],
    match: { shoot: 1.2, create: 1.25, zoneMid: 1.01, zoneAtt: 1.01, zoneDef: 0.97 },
  }),
  def("killer_pass", "Killer Pass", "playstyle", AM, "Finds the final pass that opens a goal: the chances created are better chances.", ["vision", "passing", "composure"], 3, {
    role: "creator of chances", signals: { assists: 1.6, chanceThrough: 1.0, chanceOpen: 0.8 }, trained: ["passing"],
    match: { createThrough: 1.7, createOpen: 1.2, xgCreated: 1.06 },
  }),
  def("half_space", "Half-Space Operator", "playstyle", AM, "Lives between the lines: shoots and combines from the channels beside the striker.", ["dribbling", "firstTouch", "vision"], 2, {
    role: "half-space playmaker", signals: { shotOpen: 0.25, goalOpen: 0.9, chanceOpen: 0.8 }, trained: ["dribbling", "passing"],
    match: { shoot: 1.25, create: 1.3, shoot1v1: 1.2, xgOpen: 1.03 },
  }),
  def("second_striker", "Second Striker", "playstyle", AM, "Plays off the front man and finishes: far more shots than a creator.", ["finishing", "positioning", "pace"], 3, {
    conflicts: [u("advanced_creator")], role: "second striker",
    signals: { goalOpen: 1.2, goal1v1: 1.0, shotOpen: 0.25, goals: 0.5 }, trained: ["finishing"],
    match: { shoot: 1.55, shoot1v1: 1.3, create: 1.1 },
  }),
  def("final_third", "Final-Third Specialist", "playstyle", AM, "Sharpest where it matters: dribbles, creates and finishes in and around the box.", ["dribbling", "finishing", "vision"], 3, {
    role: "final-third specialist", signals: { goals: 0.6, assists: 0.8, chanceOpen: 0.8, goalOpen: 0.7 }, trained: ["dribbling", "finishing"],
    match: { xgOpen: 1.04, createOpen: 1.2, shoot: 1.15, xgCreated: 1.03 },
  }),

  // ───────────────────────────── WINGER / WIDE FORWARD ─────────────────────────────
  def("touchline_runner", "Touchline Runner", "playstyle", W, "Hugs the line, beats the full-back on the outside and delivers: more crosses, fewer shots.", ["pace", "dribbling", "crossing"], 2, {
    conflicts: [{ id: "inside_threat", kind: "exclusive" }, u("inverted_creator")], role: "traditional winger",
    signals: { chanceCross: 1.5, assists: 1.0, keyPasses: 0.5 }, trained: ["pace", "dribbling"],
    match: { createCross: 1.7, create: 1.1, shoot: 0.75, freqHeader: 0.07 },
  }),
  def("inside_threat", "Inside Threat", "playstyle", W, "Cuts in from the wing towards goal: takes more shots and attacks the box rather than the byline.", ["finishing", "dribbling", "pace"], 2, {
    conflicts: [{ id: "touchline_runner", kind: "exclusive" }, u("byline_creator")], role: "inside forward",
    signals: { shotOpen: 0.25, goalOpen: 1.3, shotLong: 0.2, shot1v1: 0.3, goals: 0.4 }, trained: ["finishing", "dribbling"],
    match: { shoot: 1.55, shootLong: 1.3, shoot1v1: 1.2, xgOpen: 1.03, createCross: 0.6 },
  }),
  def("inverted_creator", "Inverted Creator", "playstyle", W, "Comes inside to pull the strings: central passes and cut-ins that create for others.", ["vision", "passing", "dribbling"], 3, {
    conflicts: [u("touchline_runner")], role: "inverted playmaker",
    signals: { chanceOpen: 1.2, chanceThrough: 1.0, assists: 1.2 }, trained: ["passing"],
    match: { createOpen: 1.5, createThrough: 1.3, create: 1.3 },
  }),
  def("speed_runner", "Speed Runner", "playstyle", W, "Runs in behind on raw pace: more through-balls and one-on-ones.", ["pace", "acceleration", "firstTouch"], 2, {
    req: [{ attr: "pace", min: 78 }], ageOut: 29, evolves: [{ to: "inverted_creator", minAge: 28 }, { to: "inside_threat", minAge: 28 }], role: "pacey winger",
    signals: { shot1v1: 0.6, goal1v1: 1.2, chanceThrough: 0.5 }, trained: ["pace"],
    match: { shoot1v1: 1.5, freq1v1: 0.09, shoot: 1.1 },
  }),
  def("isolation_dribbler", "Isolation Dribbler", "playstyle", W, "Takes the defender on, again and again: more one-on-ones and shots, at the cost of slower build-up.", ["dribbling", "firstTouch", "strength"], 2, {
    role: "one-on-one dribbler", signals: { shot1v1: 0.5, goal1v1: 1.0, goals: 0.4, assists: 0.5 }, trained: ["dribbling"],
    match: { shoot: 1.2, shoot1v1: 1.3, freq1v1: 0.06, create: 0.9, teamMid: -0.003 },
  }),
  def("byline_creator", "Byline Creator", "playstyle", W, "Gets to the goal line and cuts it back: the chances created are good ones.", ["crossing", "dribbling", "pace"], 2, {
    conflicts: [u("inside_threat")], role: "chance-creating winger",
    signals: { chanceOpen: 1.3, chanceCross: 0.8, assists: 1.2 }, trained: ["dribbling", "setPieces"],
    match: { createOpen: 1.55, createCross: 1.3, xgCreated: 1.04, shoot: 0.8 },
  }),
  def("back_post_threat", "Back-Post Threat", "playstyle", [...W, "ST"], "Arrives at the far post: more headers and tap-ins when the ball comes in from the other side.", ["heading", "positioning", "finishing"], 3, {
    role: "back-post finisher", signals: { goalHeader: 1.4, shotHeader: 0.4 }, trained: ["finishing"],
    match: { shootHeader: 1.9, freqHeader: 0.05, xgHeader: 1.05 },
  }),
  def("direct_winger", "Direct Winger", "playstyle", W, "Plays at pace towards goal: more shots and one-on-ones, less patient build-up.", ["pace", "dribbling", "finishing"], 2, {
    conflicts: [u("inverted_creator")], role: "direct winger",
    signals: { shot1v1: 0.4, goal1v1: 1.0, goals: 0.5, shotOpen: 0.2 }, trained: ["pace", "finishing"],
    match: { shoot: 1.35, shoot1v1: 1.25, freq1v1: 0.05, create: 0.9 },
  }),

  // ───────────────────────────── STRIKER ─────────────────────────────
  def("poacher", "Poacher", "playstyle", ST, "Lives in the six-yard box: more of the team's shots and one-on-ones fall to the striker, and rarely does the striker create for others.", ["finishing", "positioning", "composure"], 2, {
    conflicts: [{ id: "false_nine", kind: "exclusive" }], role: "poacher",
    signals: { goalOpen: 1.4, goal1v1: 1.0, shotOpen: 0.25, goals: 0.4 }, trained: ["finishing"],
    match: { shoot: 1.5, shoot1v1: 1.35, xgOpen: 1.04, create: 0.55, zoneMid: 0.98 },
  }),
  def("target_forward", "Target Forward", "playstyle", ST, "A focal point for crosses: wins and attacks headers and holds the ball up for others.", ["heading", "strength", "firstTouch"], 2, {
    conflicts: [u("advanced_runner"), u("channel_runner")], role: "target man",
    signals: { goalHeader: 1.5, shotHeader: 0.4, assists: 0.7 }, trained: ["physical", "finishing"],
    match: { shootHeader: 1.7, freqHeader: 0.1, xgHeader: 1.05, create: 0.8, teamAtt: 0.005 },
  }),
  def("false_nine", "False Nine", "playstyle", ST, "Drops off the front line to link play: creates far more, shoots less.", ["vision", "passing", "dribbling"], 3, {
    conflicts: [{ id: "poacher", kind: "exclusive" }, u("box_predator")], role: "false nine",
    signals: { chanceOpen: 1.2, chanceThrough: 1.0, assists: 1.5, keyPasses: 0.6 }, trained: ["passing"],
    match: { create: 2.1, createOpen: 1.5, shoot: 0.7, teamMid: 0.01 },
  }),
  def("advanced_runner", "Advanced Runner", "playstyle", ST, "Stretches the defence, running onto balls over the top: lots of one-on-ones.", ["pace", "positioning", "acceleration"], 2, {
    req: [{ attr: "pace", min: 72 }], ageOut: 30, evolves: [{ to: "box_predator", minAge: 29 }], conflicts: [u("target_forward")], role: "runner in behind",
    signals: { shot1v1: 0.6, goal1v1: 1.3 }, trained: ["pace", "finishing"],
    match: { shoot1v1: 1.6, freq1v1: 0.1 },
  }),
  def("complete_forward", "Complete Forward", "playstyle", ST, "Does a bit of everything well: finishes, creates and holds the ball up.", ["finishing", "passing", "dribbling", "strength"], 4, {
    role: "complete forward", signals: { goals: 0.6, assists: 0.9, keyPasses: 0.4, highRating: 0.5 }, trained: ["finishing", "passing"],
    match: { shoot: 1.2, create: 1.3, xgOpen: 1.02 },
  }),
  def("box_predator", "Box Predator", "playstyle", ST, "A clinical box striker: shots, headers and tap-ins all gravitate to the striker.", ["finishing", "positioning", "heading"], 3, {
    conflicts: [u("false_nine")], role: "box striker",
    signals: { goalOpen: 1.2, goalHeader: 0.8, goals: 0.5 }, trained: ["finishing"],
    match: { shoot: 1.45, shootHeader: 1.35, xgOpen: 1.03, xgHeader: 1.03 },
  }),
  def("channel_runner", "Channel Runner", "playstyle", ST, "Pulls wide into the channels: drags defenders out and crosses from the flank.", ["pace", "stamina", "dribbling"], 2, {
    conflicts: [u("target_forward")], role: "wide-running forward",
    signals: { chanceCross: 0.9, shot1v1: 0.4, assists: 0.8 }, trained: ["pace"],
    match: { shoot1v1: 1.3, create: 1.2, createCross: 1.3, shoot: 0.9, drain: 1.03 },
  }),
  def("hold_up", "Hold-Up Specialist", "playstyle", ST, "Shields the ball and brings others into play: the side's attacks stick.", ["strength", "firstTouch", "composure"], 2, {
    role: "link-up striker", signals: { assists: 1.2, keyPasses: 0.7, highRating: 0.4 }, trained: ["physical", "passing"],
    match: { create: 1.5, teamAtt: 0.008, xgCreated: 1.03 },
  }),

  // ───────────────────────────── UNIVERSAL TECHNICAL ─────────────────────────────
  def("finesse_finisher", "Finesse Finisher", "technical", [...ATTACKERS, "CM"], "Places it rather than blasts it: a touch more accurate when one-on-one or curling into the corner.", ["finishing", "composure", "firstTouch"], 2, {
    signals: { goalOpen: 0.8, goal1v1: 0.8, goalLong: 0.5 }, trained: ["finishing"], conflicts: [u("power_finisher")],
    match: { xg1v1: 1.05, xgOpen: 1.03, xgLong: 1.03, shoot: 1.05 },
  }),
  def("power_finisher", "Power Finisher", "technical", [...ATTACKERS, "CM"], "Hits it hard from range and in the box: dangerous from distance, less delicate one-on-one.", ["finishing", "longShots", "strength"], 2, {
    signals: { goalLong: 1.0, goalOpen: 0.6, shotLong: 0.2 }, trained: ["finishing"], conflicts: [u("finesse_finisher")],
    match: { xgLong: 1.05, xgOpen: 1.02, shoot: 1.1, shootLong: 1.15, xg1v1: 0.98 },
  }),
  def("outside_foot", "Outside-Foot Specialist", "technical", [...MIDFIELD, ...W, "ST"], "Plays the audacious outside-of-the-boot pass: more openings, more risk.", ["firstTouch", "passing", "dribbling"], 3, {
    signals: { chanceOpen: 1.0, assists: 0.8, keyPasses: 0.5 }, trained: ["passing", "dribbling"],
    match: { createOpen: 1.25, xgCreated: 1.03, variance: 1.15 },
  }),
  def("first_time_finisher", "First-Time Finisher", "technical", [...ATTACKERS, "CM"], "Shoots without the extra touch: gets shots away in tight spaces.", ["finishing", "firstTouch", "composure"], 2, {
    signals: { goalOpen: 0.9, shotOpen: 0.2 }, trained: ["finishing"],
    match: { shoot: 1.15, xgOpen: 1.02 },
  }),
  def("distance_shooter", "Distance Shooter", "technical", [...MIDFIELD, ...W, "ST", "RB", "LB"], "Backs the shot from range: far more long shots. Whether they go in still depends on long-shot ability.", ["longShots", "composure", "strength"], 2, {
    req: [{ attr: "longShots", min: 55 }], affinity: { CM: 1.3, AM: 1.3, DM: 1.1 },
    signals: { shotLong: 0.35, goalLong: 1.6 }, trained: ["finishing"],
    match: { shootLong: 1.8, freqLong: 0.12, xgLong: 1.05 },
  }),
  def("flair", "Flair", "technical", [...MIDFIELD, ...W, "ST"], "Does the unexpected: a streaky, entertaining player who beats people with tricks.", ["dribbling", "firstTouch", "vision"], 3, {
    signals: { shot1v1: 0.4, chanceOpen: 0.6, goals: 0.4, assists: 0.5 }, trained: ["dribbling"],
    match: { shoot1v1: 1.15, createOpen: 1.2, variance: 1.2 }, career: { media: 1.12 },
  }),
  def("one_touch_passer", "One-Touch Passer", "technical", [...MIDFIELD, "CB", "RB", "LB", "ST"], "Moves it on first time: quick combinations keep the side flowing.", ["passing", "firstTouch", "vision"], 2, {
    signals: { keyPasses: 0.7, full90: 0.2, assists: 0.7 }, trained: ["passing"],
    match: { teamMid: 0.008, createOpen: 1.2, create: 1.1 },
  }),
  def("switcher", "Switches Play", "technical", [...MIDFIELD, "CB", "RB", "LB"], "Spots the opposite flank and hits long diagonals: more balls out wide and into the box.", ["vision", "passing", "crossing"], 2, {
    signals: { chanceCross: 0.9, assists: 0.7, keyPasses: 0.4 }, trained: ["passing"],
    match: { createCross: 1.2, freqHeader: 0.04, teamAtt: 0.004 },
  }),
  def("set_piece_specialist", "Set-Piece Specialist", "technical", [...MIDFIELD, ...W, "RB", "LB"], "Takes the dead balls: better free kicks, and corners that find a head.", ["crossing", "longShots", "vision"], 3, {
    signals: { chanceCross: 0.8, goalLong: 0.8, assists: 0.8 }, trained: ["setPieces"],
    match: { xgFree: 1.1, createCross: 1.25, freqHeader: 0.03 },
  }),
  def("penalty_specialist", "Penalty Specialist", "technical", [...MIDFIELD, ...ATTACKERS], "Calm from twelve yards: penalties taken are more reliably scored.", ["finishing", "composure"], 3, {
    signals: { bigGame: 0.6, goals: 0.3 }, trained: ["finishing", "setPieces"],
    match: { xgPen: 1.07, composure: 0.6 },
  }),
  def("crossing_specialist", "Crossing Specialist", "technical", [...FB, ...MIDFIELD, ...W], "Puts the ball on a plate: crosses are plentiful and dangerous.", ["crossing", "vision", "firstTouch"], 2, {
    signals: { chanceCross: 1.5, assists: 0.9 }, trained: ["setPieces", "passing"],
    match: { createCross: 1.5, freqHeader: 0.05, xgCreated: 1.02 },
  }),
  def("through_ball_specialist", "Through-Ball Specialist", "technical", [...MIDFIELD, ...W, "ST"], "Threads the ball through the line: the one-on-ones set up are good ones.", ["vision", "passing", "firstTouch"], 3, {
    signals: { chanceThrough: 1.6, assists: 0.8 }, trained: ["passing"],
    match: { createThrough: 1.7, xgCreated: 1.04, freq1v1: 0.04 },
  }),

  // ───────────────────────────── MENTAL ─────────────────────────────
  def("big_game_performer", "Big-Game Performer", "mental", OUT, "Rises for finals, derbies, knockouts and decisive league matches; no different in ordinary games.", ["composure", "finishing"], 3, {
    conflicts: [{ id: "big_match_nerves", kind: "exclusive" }], role: "big-game player", signals: { bigGame: 1.5 },
    derive: (p) => (p.hidden.bigMatch - 72) / 22,
    match: { bigMatch: 1.2 },
  }),
  def("clutch", "Clutch", "mental", OUT, "Delivers in the closing stages of tight games.", ["composure", "finishing"], 3, {
    role: "clutch performer", signals: { lateGoal: 1.8, bigGame: 0.5 },
    match: { clutch: 1.2 },
  }),
  def("consistent", "Consistent", "mental", [...GK, ...OUT], "Rarely has a bad game, rarely has a brilliant one: steady, reliable performances.", ["composure"], 2, {
    conflicts: [{ id: "inconsistent", kind: "exclusive" }, u("flair")], role: "reliable performer", signals: { highRating: 0.2, full90: 0.2 },
    derive: (p) => (p.hidden.consistency - 72) / 22,
    match: { variance: 0.55 },
  }),
  def("composed", "Composed", "mental", [...GK, ...OUT], "Unflappable in front of goal and in one-on-ones.", ["composure", "firstTouch"], 2, {
    conflicts: [{ id: "big_match_nerves", kind: "exclusive" }, u("hot_head")], signals: { goal1v1: 0.8, bigGame: 0.4 },
    match: { composure: 1, bigMatch: 0.25 },
  }),
  def("aggressive", "Aggressive", "mental", OUT, "Plays on the edge: wins more tackles, picks up more fouls.", ["tackling", "strength"], 2, {
    signals: { tackles: 0.5, yellow: 0.3 }, trained: ["defending"],
    match: { tackle: 1.2, foul: 1.2, card: 1.1, zoneDef: 1.008 },
  }),
  def("risk_taker", "Risk Taker", "mental", [...MIDFIELD, ...W, "ST", "RB", "LB"], "Goes for the ambitious pass or shot: more chance-creation, more wasted possession.", ["vision", "passing", "dribbling"], 2, {
    conflicts: [u("consistent")], signals: { chanceThrough: 0.7, keyPasses: 0.5, shots: 0.15 },
    match: { variance: 1.25, createThrough: 1.25, shoot: 1.1, againstXgOpen: 1.02 },
  }),
  def("selfless", "Selfless", "mental", [...MIDFIELD, ...W, "ST"], "Looks for the pass before the shot: more assists, fewer goals of their own.", ["vision", "passing"], 2, {
    conflicts: [{ id: "selfish", kind: "exclusive" }, u("shoots_too_often")], signals: { assists: 1.0, keyPasses: 0.6 },
    match: { shoot: 0.8, create: 1.35, xgCreated: 1.02 }, career: { team: 0.3 },
  }),
  def("creative", "Creative", "mental", [...MIDFIELD, ...W, "ST"], "Sees things others don't: finds openings with imaginative passes.", ["vision", "passing", "firstTouch"], 2, {
    signals: { chanceOpen: 0.9, chanceThrough: 0.8, assists: 0.8 }, trained: ["passing"],
    match: { createOpen: 1.2, createThrough: 1.2, xgCreated: 1.02 },
  }),
  def("press_resistant", "Press Resistant", "mental", ["CB", "DM", "CM", "AM", "RW", "LW", "RB", "LB"], "Keeps a cool head with opponents swarming: the side keeps the ball in tight spaces.", ["composure", "firstTouch", "strength"], 2, {
    signals: { full90: 0.2, highRating: 0.3, keyPasses: 0.4 },
    match: { zoneMid: 1.015, teamMid: 0.005, composure: 0.4 },
  }),
  def("leader", "Leader", "mental", OUT, "Organises, encourages, demands: the side plays a little better around them, and the dressing room listens.", ["composure", "positioning"], 3, {
    role: "natural leader", signals: { bigGame: 0.8, highRating: 0.3 },
    derive: (p) => (p.reputation - 48) / 50 + (p.hidden.professionalism - 60) / 150,
    match: { teamMid: 0.004, teamAtt: 0.003, teamDef: 0.004 }, career: { leader: 0.6, team: 0.2 },
  }),

  // ───────────────────────────── PHYSICAL ─────────────────────────────
  def("explosive_starter", "Explosive Starter", "physical", OUT, "Flies out of the blocks and sets the tempo, but tires earlier.", ["acceleration", "pace", "stamina"], 2, {
    req: [{ attr: "acceleration", min: 70 }], ageOut: 31, signals: { goals: 0.3, full90: 0.1 },
    match: { fast: 0.04, drain: 1.05 },
  }),
  def("relentless_runner", "Relentless Runner", "physical", OUT, "Keeps running when others tire: stays effective deep into the second half.", ["stamina", "strength"], 2, {
    req: [{ attr: "stamina", min: 74 }], ageOut: 33, signals: { full90: 0.5 }, trained: ["physical"],
    match: { drain: 0.86 },
  }),
  def("aerial_presence", "Aerial Presence", "physical", OUT, "Strong in the air at both ends: more headers at one end, fewer won against them at the other.", ["heading", "strength"], 2, {
    req: [{ attr: "heading", min: 66 }], signals: { goalHeader: 0.9, shotHeader: 0.3, block: 0.3 }, trained: ["physical"],
    match: { shootHeader: 1.35, xgHeader: 1.03, againstXgHeader: 0.97 },
  }),
  def("strong_on_ball", "Strong on the Ball", "physical", OUT, "Hard to knock off the ball: holds possession under challenge.", ["strength", "firstTouch"], 2, {
    req: [{ attr: "strength", min: 68 }], signals: { full90: 0.2, keyPasses: 0.3 }, trained: ["physical"],
    match: { zoneMid: 1.012, create: 1.1 },
  }),
  def("durable", "Durable", "physical", [...GK, ...OUT], "Rarely injured: the body holds up season after season.", ["stamina", "strength"], 2, {
    conflicts: [{ id: "injury_prone", kind: "exclusive" }], derive: (p) => (20 - p.hidden.injuryProneness) / 20,
    match: { injury: 0.78 },
  }),

  // ───────────────────────────── PERSONALITY / CAREER ─────────────────────────────
  def("loyal", "Loyal", "personality", [...GK, ...OUT], "Bonds with the club: reluctant to leave, and the fans never forget it. Not unconditional: a collapsing club, a broken relationship or no playing time can still send them away.", [], 2, {
    conflicts: [u("money_motivated"), u("big_club_ambition")], derive: (p) => (p.hidden.loyalty - 70) / 25, career: { loyalty: 0.6 },
  }),
  def("ambitious", "Ambitious", "personality", [...GK, ...OUT], "Wants trophies and the biggest stage: ready to move up, restless when the club stands still.", [], 2, {
    conflicts: [u("club_oriented")], derive: (p) => (p.hidden.ambition - 70) / 25, career: { ambition: 0.5 },
  }),
  def("professional", "Professional", "personality", [...GK, ...OUT], "Does everything right off the pitch: trains well, keeps the manager onside.", [], 2, {
    conflicts: [{ id: "poor_trainer", kind: "exclusive" }], derive: (p) => (p.hidden.professionalism - 72) / 22, career: { training: 1.1, friction: -0.25 },
  }),
  def("temperamental", "Temperamental", "personality", [...GK, ...OUT], "Runs hot and cold: results swing the mood far more, and rows with managers come easily.", [], 2, {
    conflicts: [u("composed"), u("hot_head")], derive: (p) => (48 - (p.hidden.professionalism + p.hidden.consistency) / 2) / 30, career: { moraleSwing: 1.5, friction: 0.5 },
  }),
  def("mentor", "Mentor", "personality", OUT, "Takes younger teammates under their wing: they develop faster around them.", [], 3, {
    derive: (p) => (p.age < 29 ? -1 : (p.age - 28) / 8 + (p.reputation - 55) / 60 + (p.hidden.professionalism - 70) / 100), career: { mentor: 0.6, team: 0.2 },
  }),
  def("adaptable", "Adaptable", "personality", [...GK, ...OUT], "Settles anywhere: a new club or country barely dents form.", [], 2, {
    conflicts: [{ id: "low_adaptability", kind: "exclusive" }, u("home_comfort")], derive: (p) => (p.hidden.adaptability - 74) / 22, career: { adapt: 0.6 },
  }),
  def("media_favourite", "Media Favourite", "personality", OUT, "The cameras love them: reputation grows faster and sponsors pay more.", [], 3, {
    derive: (p) => (p.reputation - 58) / 30, career: { media: 1.3 },
  }),
  def("money_motivated", "Money Motivated", "personality", [...GK, ...OUT], "Follows the wage: the biggest offer is hard to turn down.", [], 2, {
    conflicts: [u("loyal"), u("club_oriented")], derive: (p) => Math.min((p.hidden.ambition - 62) / 20, (40 - p.hidden.loyalty) / 20), career: { money: 0.6 },
  }),
  def("club_oriented", "Club-Oriented", "personality", [...GK, ...OUT], "Lives for the badge: gets more attached the longer they stay.", [], 3, {
    conflicts: [u("ambitious"), u("money_motivated")], derive: (p) => (p.tenure >= 5 ? (p.tenure - 4) / 6 + (p.hidden.loyalty - 55) / 80 : -1), career: { loyalty: 0.4, team: 0.2 },
  }),
  def("big_club_ambition", "Big-Club Ambition", "personality", [...GK, ...OUT], "Dreams of the giants: moves to the biggest clubs are far more tempting, and a small club is never enough.", [], 3, {
    conflicts: [u("loyal"), u("club_oriented")], derive: (p) => (p.hidden.ambition - 78) / 20, career: { ambition: 0.7 },
  }),
  def("home_comfort", "Home Comfort", "personality", [...GK, ...OUT], "Happiest at home: reluctant to move abroad, and takes longer to settle if they do.", [], 2, {
    conflicts: [u("adaptable")], derive: (p) => (36 - p.hidden.adaptability) / 20, career: { home: 0.6, adapt: -0.3 },
  }),
  def("competitive", "Competitive", "personality", [...GK, ...OUT], "Hates losing: trains harder and rises in big matches, but sulks when benched.", [], 2, {
    derive: (p) => (p.hidden.ambition + p.hidden.bigMatch - 140) / 40, career: { training: 1.05, moraleSwing: 1.15, friction: 0.2 }, match: { bigMatch: 0.3 },
  }),

  // ───────────────────────────── FLAWS ─────────────────────────────
  def("hot_head", "Hot Head", "personality", [...GK, ...OUT], "Plays with fire: more tackles and intimidation, but more cards, red mist and rows with managers.", ["tackling", "strength"], 2, {
    flaw: true, conflicts: [u("composed"), u("temperamental")], derive: (p) => (40 - (p.hidden.professionalism + p.hidden.consistency) / 2) / 14,
    signals: { yellow: 1.0, red: 2.5 }, match: { card: 1.55, foul: 1.35, tackle: 1.25 }, career: { friction: 0.5, moraleSwing: 1.15 },
  }),
  def("inconsistent", "Inconsistent", "mental", [...GK, ...OUT], "Brilliant one week, anonymous the next: form swings wildly.", ["composure"], 2, {
    flaw: true, conflicts: [{ id: "consistent", kind: "exclusive" }], derive: (p) => (34 - p.hidden.consistency) / 20,
    match: { variance: 1.7 },
  }),
  def("injury_prone", "Injury Prone", "physical", [...GK, ...OUT], "Breaks down more often than most.", ["stamina"], 2, {
    flaw: true, conflicts: [{ id: "durable", kind: "exclusive" }], derive: (p) => (p.hidden.injuryProneness - 62) / 30,
    match: { injury: 1.38 },
  }),
  def("one_foot_reliant", "One-Foot Reliant", "technical", [...MIDFIELD, ...W, "ST", "RB", "LB"], "Predictable with one foot: a little less dangerous when forced onto the other.", ["firstTouch"], 1, {
    flaw: true, match: { xgOpen: 0.96, xgLong: 0.96, xg1v1: 0.97, createOpen: 0.92 },
  }),
  def("shoots_too_often", "Shoots Too Often", "technical", [...MIDFIELD, ...W, "ST"], "Fires from anywhere: more shots, but poorer ones.", ["longShots"], 1, {
    flaw: true, conflicts: [u("selfless")], signals: { shots: 0.4, shotLong: 0.4 },
    match: { shoot: 1.4, shootLong: 1.25, xgOpen: 0.96, create: 0.8 },
  }),
  def("big_match_nerves", "Big-Match Nerves", "mental", [...GK, ...OUT], "Tightens up when it matters: weaker in finals, derbies and knockouts.", ["composure"], 2, {
    flaw: true, conflicts: [{ id: "big_game_performer", kind: "exclusive" }, { id: "composed", kind: "exclusive" }], derive: (p) => (34 - p.hidden.bigMatch) / 20,
    match: { bigMatch: -1.2, clutch: -0.5 },
  }),
  def("poor_trainer", "Poor Trainer", "personality", [...GK, ...OUT], "Doesn't commit on the training pitch: slower to improve.", [], 2, {
    flaw: true, conflicts: [{ id: "professional", kind: "exclusive" }], derive: (p) => (34 - p.hidden.professionalism) / 20, career: { training: 0.85, friction: 0.15 },
  }),
  def("risky_defender", "Risky Defender", "playstyle", ["CB", "RB", "LB", "DM"], "Always going for the ball: wins it more, but gets beaten more often too.", ["tackling", "pace"], 1, {
    flaw: true, signals: { tackles: 0.4, intercept: 0.6 }, conflicts: [u("cover_defender")],
    match: { tackle: 1.25, intercept: 1.2, foul: 1.2, againstXg1v1: 1.07, againstXgOpen: 1.03 },
  }),
  def("selfish", "Selfish", "mental", [...MIDFIELD, ...W, "ST"], "Wants the glory: shoots when passing is better, and teammates notice.", ["finishing"], 1, {
    flaw: true, conflicts: [{ id: "selfless", kind: "exclusive" }], signals: { shots: 0.3 },
    match: { shoot: 1.25, create: 0.65, shoot1v1: 1.15 }, career: { team: -0.4 },
  }),
  def("low_adaptability", "Low Adaptability", "personality", [...GK, ...OUT], "Struggles with change: new clubs, new countries and new managers hit hard.", [], 1, {
    flaw: true, conflicts: [{ id: "adaptable", kind: "exclusive" }], derive: (p) => (34 - p.hidden.adaptability) / 20, career: { adapt: -0.5 },
  }),
];

export const TRAIT_BY_ID: ReadonlyMap<TraitId, TraitDef> = new Map(TRAITS.map((t) => [t.id, t]));

export function traitDef(id: TraitId): TraitDef | undefined {
  return TRAIT_BY_ID.get(id);
}

const BY_POSITION = new Map<Position, TraitDef[]>();
for (const pos of ["GK", "RB", "CB", "LB", "DM", "CM", "AM", "RW", "LW", "ST"] as Position[]) {
  BY_POSITION.set(pos, TRAITS.filter((t) => t.positions.includes(pos)));
}

/** Traits a position can naturally develop (cached). */
export function traitsForPosition(pos: Position): readonly TraitDef[] {
  return BY_POSITION.get(pos) ?? [];
}

export const isPersonalityLike = (t: TraitDef) => t.category === "personality" || !!t.derive;
export const isStyleTrait = (t: TraitDef) => t.category === "playstyle" || t.category === "technical";
