/** Defenders and holding players: tackling, marking and recovery styles. */
import type { TraitDef } from "../types";
import { def, u, x } from "./helpers";
import * as D from "./derive";

export const DEFENCE: TraitDef[] = [
  def("clean_tackler", "Clean Tackler", "playstyle", ["CB", "DM", "CM", "RB", "LB"], "Times the challenge and wins it fairly: few fouls, rarely booked, and the ball stays in play for his side.", ["tackling", "positioning", "composure"], 2, {
    req: [{ attr: "tackling", min: 66 }, { attr: "positioning", min: 62 }], conflicts: [x("aggressive"), x("reckless_tackler"), u("hot_head")], role: "clean tackler",
    signals: { tackles: 0.5, intercept: 0.3, cleanSheet: 0.2 }, trained: ["defending"],
    match: { tackle: 1.1, foul: 0.7, card: 0.65, zoneDef: 1.006 },
  }),
  def("man_marker", "Man Marker", "playstyle", ["CB", "DM", "RB", "LB"], "Picks up the other side's best attacker and stays with him: their star sees less of the ball and shoots from worse positions.", ["tackling", "positioning", "strength", "pace"], 3, {
    conflicts: [u("cover_defender")], role: "man-marking defender",
    signals: { tackles: 0.4, block: 0.4, cleanSheet: 0.3 }, trained: ["defending"],
    match: { againstStar: 0.88, tackle: 1.1, foul: 1.1, create: 0.8 },
  }),
  def("defensive_leader", "Defensive Leader", "mental", ["CB", "DM"], "Organises the line and talks the back four through the game: the side defends a little better around him.", ["positioning", "composure"], 3, {
    derive: D.captainMaterial, earned: true, role: "defensive organiser", conflicts: [u("error_prone")],
    match: { teamDef: 0.007 }, career: { leader: 0.5, team: 0.15 },
  }),
  def("recovery_defender", "Recovery Defender", "playstyle", ["CB", "RB", "LB"], "Beaten once, never beaten twice: sprints back to cut out the runner, so runs in behind produce fewer clean chances.", ["pace", "acceleration", "positioning"], 2, {
    req: [{ attr: "pace", min: 72 }, { attr: "acceleration", min: 68 }], ageOut: 31, evolves: [{ to: "cover_defender", minAge: 30 }], role: "recovery defender",
    signals: { block: 0.4, intercept: 0.5, cleanSheet: 0.3 }, trained: ["pace", "defending"],
    match: { againstXg1v1: 0.9, againstFreq1v1: 0.94, drain: 1.02 },
  }),
];
