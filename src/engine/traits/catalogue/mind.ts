/** Mental and physical traits that are earned from a record: matches, availability, role. */
import type { TraitDef } from "../types";
import { AM, CM, DM, GK, OUT, ST, W, def, u, x } from "./helpers";
import * as D from "./derive";

const ALL = [...GK, ...OUT] as const;

export const MIND: TraitDef[] = [
  def("comeback_specialist", "Comeback Specialist", "mental", ALL, "Gets better when the side is behind: it is his goals and assists that so often turn deficits around.", ["composure", "finishing"], 3, {
    earned: true, minMinutes: D.SAMPLE.bigGames, conflicts: [u("big_match_nerves"), u("easily_frustrated")], role: "comeback specialist",
    signals: { comeback: 1.6, bigGame: 0.3, lateGoal: 0.4 },
    match: { trailing: 1.0, clutch: 0.3 },
  }),
  def("iron_man", "Iron Man", "physical", ALL, "Season after season on the pitch: a body that holds up and a manager who never has to ask if he is fit.", ["stamina", "strength"], 3, {
    earned: true, derive: D.ironMan, conflicts: [x("injury_prone"), u("tires_easily")], role: "ever-present",
    match: { injury: 0.82, drain: 0.97 },
  }),
  def("super_sub", "Super Sub", "mental", [...DM, ...CM, ...AM, ...W, ...ST], "Thrives coming off the bench: fresh legs and a clear head make the first half-hour after he is introduced count.", ["firstTouch", "composure", "pace"], 3, {
    earned: true, derive: D.superSub, role: "super-sub",
    match: { subBoost: 0.06 },
  }),
  def("versatile", "Versatile", "technical", OUT, "Comfortable all over the pitch: asked to fill in elsewhere, he barely loses anything.", ["firstTouch", "positioning", "passing"], 3, {
    earned: true, derive: D.versatile, role: "utility player",
  }),
];

export const CAPTAIN: TraitDef[] = [
  def("captain_material", "Captain Material", "personality", ALL, "Respected for how he plays and how he lives: the armband is his for the taking, and the dressing room follows.", [], 3, {
    earned: true, derive: D.captainMaterial, conflicts: [u("selfish"), u("ego"), u("hot_head")],
    career: { leader: 0.5, team: 0.15, fan: 0.1 },
  }),
];
