/** Forwards, wingers and attacking midfielders: finishing, running and dribbling styles added to the original set. */
import type { TraitDef } from "../types";
import { ATTACKERS, FB, W, def, u, x } from "./helpers";

export const ATTACK: TraitDef[] = [
  def("clinical_finisher", "Clinical Finisher", "technical", ATTACKERS, "Picks the right shot and keeps his head: chances are taken more reliably and the side's results are less streaky.", ["finishing", "composure"], 3, {
    req: [{ attr: "finishing", min: 74 }, { attr: "composure", min: 66 }], conflicts: [x("wasteful_finisher"), u("shoots_too_often")], role: "clinical finisher",
    signals: { goalOpen: 0.9, goal1v1: 0.9, goalHeader: 0.4, goals: 0.4 }, trained: ["finishing"],
    match: { shoot: 0.95, xgOpen: 1.04, xg1v1: 1.04, xgHeader: 1.02, variance: 0.88 },
  }),
  def("counter_attack_threat", "Counter-Attack Threat", "playstyle", ATTACKERS, "Lives on the break: when the ball is won, he is away first, so counter-attacks are likelier and more dangerous.", ["pace", "acceleration", "positioning"], 2, {
    req: [{ attr: "pace", min: 68 }], conflicts: [u("target_forward")], role: "counter-attacking forward", tactic: { directness: 0.5, tempo: 0.4, pressing: -0.1 },
    ageOut: 31, signals: { shot1v1: 0.6, goal1v1: 1.0, chanceThrough: 0.4 }, trained: ["pace"],
    match: { counter: 0.012, shoot1v1: 1.2, freq1v1: 0.03 },
  }),
  def("close_control", "Close Control", "technical", ["RW", "LW", "AM", "CM", "ST"], "Glued to the ball in tight spaces: keeps possession under pressure and releases it with a clear head.", ["dribbling", "firstTouch", "composure"], 2, {
    req: [{ attr: "firstTouch", min: 70 }], role: "close-control dribbler",
    signals: { keyPasses: 0.3, full90: 0.2, highRating: 0.3, chanceOpen: 0.3 }, trained: ["dribbling"],
    match: { zoneMid: 1.012, teamMid: 0.004, variance: 0.92 },
  }),
  def("cut_in_threat", "Cut-In Threat", "playstyle", W, "Drifts infield at the first chance: more shots and passes from the half-space, fewer crosses from the byline.", ["dribbling", "finishing", "vision"], 2, {
    conflicts: [x("touchline_runner"), u("inside_threat"), u("byline_creator")], role: "cutting-in winger", tactic: { directness: 0.1 },
    signals: { shotOpen: 0.2, goalOpen: 0.9, chanceOpen: 0.7, shotLong: 0.15 }, trained: ["dribbling"],
    match: { shoot: 1.28, shootLong: 1.15, createOpen: 1.18, createCross: 0.7 },
  }),
  def("one_on_one_runner", "One-on-One Specialist", "playstyle", ["RW", "LW", "ST", "AM"], "Wins his duels with the defender and the keeper: more one-on-ones, and he stays calm when they come.", ["dribbling", "composure", "pace"], 3, {
    conflicts: [u("reluctant_shooter")], role: "one-on-one specialist",
    signals: { shot1v1: 0.6, goal1v1: 1.4 }, trained: ["dribbling", "finishing"],
    match: { shoot1v1: 1.35, freq1v1: 0.04, xg1v1: 1.04, composure: 0.4 },
  }),
];

export const ATTACK_FULLBACK: TraitDef[] = [
  def("attacking_fullback", "Attacking Full-Back", "playstyle", FB, "Plays as an extra winger: far more overlaps and crosses, but the space he leaves behind is there to be used.", ["stamina", "crossing", "pace", "dribbling"], 2, {
    conflicts: [x("defensive_fullback")], role: "attacking full-back", tactic: { tempo: 0.4, pressing: 0.2 },
    signals: { chanceCross: 1.0, chanceOpen: 0.8, assists: 0.8 }, trained: ["pace", "passing"],
    match: { createCross: 1.45, create: 1.25, createOpen: 1.15, freqHeader: 0.04, zoneDef: 0.975, againstXg1v1: 1.05, againstFreq1v1: 1.05, drain: 1.04 },
  }),
];
