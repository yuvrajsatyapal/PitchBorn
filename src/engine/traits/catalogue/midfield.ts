/** Passing, creativity and midfield-engine styles. */
import type { TraitDef } from "../types";
import { OUT, def, u, x } from "./helpers";

export const MIDFIELD_TRAITS: TraitDef[] = [
  def("playmaker", "Playmaker", "playstyle", ["CM", "AM", "DM", "RW", "LW"], "The side plays through him: more of the chances come from his passing, and the team keeps the ball better with him on it.", ["vision", "passing", "firstTouch"], 3, {
    req: [{ attr: "vision", min: 70 }, { attr: "passing", min: 68 }], affinity: { DM: 0.5, RW: 0.4, LW: 0.4 }, conflicts: [u("selfish"), u("reluctant_shooter")], role: "playmaker",
    signals: { keyPasses: 0.8, assists: 1.2, chanceOpen: 0.8, chanceThrough: 0.6 }, trained: ["passing"],
    match: { create: 1.5, createOpen: 1.25, createThrough: 1.15, teamMid: 0.006, xgCreated: 1.03 },
  }),
  def("long_pass_specialist", "Long-Pass Specialist", "technical", ["DM", "CM", "CB"], "Spots the runner and hits the diagonal or the ball over the top: quick switches into the attack.", ["passing", "vision", "longShots"], 2, {
    req: [{ attr: "passing", min: 64 }], affinity: { CB: 0.8 }, conflicts: [u("poor_distributor")],
    signals: { chanceThrough: 1.0, assists: 0.8, keyPasses: 0.4 }, trained: ["passing"],
    match: { createThrough: 1.3, create: 1.12, teamAtt: 0.004, counter: 0.004 },
  }),
  def("quick_distributor", "Quick Distributor", "playstyle", ["DM", "CM", "CB", "GK"], "Moves the ball on without a second touch: the side breaks quickly after winning it.", ["passing", "firstTouch", "composure"], 2, {
    conflicts: [u("holds_ball_too_long"), u("poor_distributor")], role: "quick distributor", tactic: { tempo: 0.5 },
    signals: { keyPasses: 0.6, full90: 0.2, chanceThrough: 0.6 }, trained: ["passing"],
    match: { teamMid: 0.005, counter: 0.008, createOpen: 1.12 },
  }),
  def("creative_spark", "Creative Spark", "playstyle", ["AM", "RW", "LW", "CM"], "Unpredictable in the final third: more inventive passes and moments of magic, but not every one comes off.", ["dribbling", "vision", "firstTouch"], 3, {
    conflicts: [u("consistent")], role: "creative spark",
    signals: { chanceOpen: 1.0, assists: 0.9, keyPasses: 0.5 }, trained: ["dribbling", "passing"],
    match: { create: 1.3, createOpen: 1.25, xgCreated: 1.02, variance: 1.2 },
  }),
  def("dead_ball_specialist", "Dead-Ball Specialist", "technical", OUT, "A free kick is a shooting chance: takes them himself and bends them at the target, and delivers dangerous corners.", ["longShots", "crossing", "vision"], 3, {
    req: [{ attr: "longShots", min: 66 }, { attr: "crossing", min: 60 }], conflicts: [],
    signals: { goalLong: 0.9, chanceCross: 0.5, assists: 0.5 }, trained: ["setPieces"],
    match: { xgFree: 1.18, shootLong: 1.2, createCross: 1.12, freqHeader: 0.02 },
  }),
  def("midfield_engine", "Midfield Engine", "physical", ["CM", "DM"], "Covers every blade of grass: in every phase of the game, at a cost to his energy.", ["stamina", "tackling", "passing"], 2, {
    req: [{ attr: "stamina", min: 72 }], conflicts: [x("tires_easily")], role: "midfield engine", tactic: { pressing: 0.3, tempo: 0.3 },
    signals: { full90: 0.5, tackles: 0.3, keyPasses: 0.3 }, trained: ["physical"],
    match: { teamMid: 0.008, zoneMid: 1.01, tackle: 1.1, create: 1.05, drain: 1.06 },
  }),
  def("deep_controller", "Deep Controller", "playstyle", ["DM", "CM"], "Sits deep and builds from there: safe, tidy circulation of the ball, shielding the defence.", ["positioning", "passing", "composure"], 2, {
    conflicts: [u("late_box_runner")], role: "deep-lying controller", tactic: { directness: -0.3 },
    signals: { full90: 0.3, keyPasses: 0.5, intercept: 0.3 }, trained: ["passing"],
    match: { teamMid: 0.007, createOpen: 1.18, againstXgOpen: 0.98, shoot: 0.7, create: 1.1 },
  }),
  def("transition_specialist", "Transition Specialist", "playstyle", ["CM", "DM", "AM"], "Reacts first when the ball changes hands: wins it back and sets the side away on the break.", ["stamina", "tackling", "passing"], 3, {
    role: "transition specialist", tactic: { pressing: 0.3, directness: 0.2 },
    signals: { intercept: 0.6, tackles: 0.3, chanceThrough: 0.5 }, trained: ["physical", "defending"],
    match: { counter: 0.012, intercept: 1.1, tackle: 1.08, freq1v1: 0.03, drain: 1.03 },
  }),
  def("pressing_machine", "Pressing Machine", "physical", ["ST", "RW", "LW", "AM", "CM", "DM"], "Harries the opponent from the first whistle: wins the ball high up, at the price of his own energy.", ["stamina", "acceleration", "tackling"], 3, {
    req: [{ attr: "stamina", min: 72 }], conflicts: [x("tires_easily"), u("defensive_liability")], role: "pressing forward", tactic: { pressing: 1 },
    signals: { tackles: 0.4, full90: 0.3, intercept: 0.4 }, trained: ["physical"],
    match: { zoneMid: 1.012, teamMid: 0.004, tackle: 1.2, intercept: 1.12, foul: 1.05, drain: 1.14 },
  }),
];
