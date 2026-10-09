/**
 * How the expanded attribute model reaches the trait catalogue, in one place.
 *
 * `core` attributes are what make a trait work: their average sets how well its effects are carried out and whether a player is a
 * natural candidate for it. `req` attributes are a floor to acquire and keep it. Adding the attributes a trait is really made of (work
 * rate for a presser, marking for a man-marker, off-the-ball movement for a poacher) makes the same trait mean something different on
 * different players, without touching the catalogue entries or the evidence rules.
 *
 * None of this grants anything. A trait is still earned by behaviour in matches over a real sample (signals, minimum minutes); the
 * attributes only decide who is eligible and how well the habit is executed. High attributes alone never give a trait.
 */
import type { AttrKey, TraitId } from "../types";
import type { AttrReq, TraitDef } from "./types";

/** Traits whose core is exactly what the trait is made of (replacing the old, broader list), as the design brief states them. */
export const CORE_OF: Record<TraitId, AttrKey[]> = {
  pressing_machine: ["workRate", "stamina", "aggression"],
  man_marker: ["marking", "positioning", "strength"],
  playmaker: ["passing", "vision", "decisions", "creativity"],
  clinical_finisher: ["finishing", "composure", "decisions"],
};

/** Attributes appended to a trait's core. */
export const EXTRA_CORE: Record<TraitId, AttrKey[]> = {
  // pressing, engine and work
  pressing_machine: ["workRate", "aggression"], midfield_engine: ["workRate"], relentless_runner: ["workRate"], box_to_box: ["workRate"],
  transition_specialist: ["anticipation", "workRate"], ball_hunter: ["aggression", "interceptions"], aggressive: ["aggression"],
  // defending
  man_marker: ["marking"], defensive_leader: ["marking", "decisions"], clean_tackler: ["marking"], lane_reader: ["interceptions", "anticipation"],
  anchor: ["interceptions", "marking"], defensive_screen: ["interceptions", "marking"], cover_defender: ["anticipation", "marking"],
  recovery_defender: ["anticipation"], front_foot: ["aggression", "anticipation"], last_line: ["marking"],
  // aerial and physical
  aerial_dominator: ["jumping"], aerial_presence: ["jumping"], target_forward: ["jumping", "balance"], set_piece_threat: ["jumping"],
  hold_up: ["balance"], strong_on_ball: ["balance"], press_resistant: ["balance", "decisions"],
  // dribbling and flair
  close_control: ["agility", "technique"], isolation_dribbler: ["agility", "balance"], direct_winger: ["agility"], flair: ["creativity", "technique"],
  // creation
  creative: ["creativity"], creative_spark: ["creativity"], playmaker: ["decisions", "creativity"], advanced_creator: ["creativity", "technique"],
  killer_pass: ["creativity", "decisions"], through_ball_specialist: ["creativity"], line_breaker: ["creativity", "decisions"],
  tempo_controller: ["decisions", "technique"], metronome: ["decisions", "technique"], deep_distributor: ["technique", "decisions"],
  one_touch_passer: ["technique"], switcher: ["technique"], long_pass_specialist: ["technique"], outside_foot: ["technique", "creativity"],
  false_nine: ["technique", "creativity"], half_space: ["offBall", "creativity"],
  // finishing and movement
  clinical_finisher: ["decisions"], finesse_finisher: ["technique"], dead_ball_specialist: ["technique"], set_piece_specialist: ["technique"],
  crossing_specialist: ["technique"], poacher: ["offBall", "anticipation"], box_predator: ["offBall"], second_striker: ["offBall", "anticipation"],
  late_box_runner: ["offBall"], advanced_runner: ["offBall"], back_post_threat: ["offBall", "jumping"], channel_runner: ["offBall"],
  counter_attack_threat: ["offBall", "anticipation"], one_on_one_runner: ["offBall"], complete_forward: ["technique", "balance"],
  // goalkeepers
  sweeper_keeper: ["anticipation", "oneOnOnes"], one_on_one_specialist: ["oneOnOnes", "anticipation"], build_up_keeper: ["decisions"],
};

/** New floors. Low on purpose: they separate a natural fit from a mismatch, not the good from the great. */
export const EXTRA_REQ: Record<TraitId, AttrReq[]> = {
  pressing_machine: [{ attr: "workRate", min: 60 }], midfield_engine: [{ attr: "workRate", min: 58 }], relentless_runner: [{ attr: "workRate", min: 60 }],
  ball_hunter: [{ attr: "aggression", min: 52 }], aggressive: [{ attr: "aggression", min: 60 }],
  man_marker: [{ attr: "marking", min: 60 }], lane_reader: [{ attr: "interceptions", min: 58 }], anchor: [{ attr: "interceptions", min: 55 }],
  defensive_screen: [{ attr: "interceptions", min: 56 }], cover_defender: [{ attr: "anticipation", min: 58 }],
  aerial_dominator: [{ attr: "jumping", min: 60 }], aerial_presence: [{ attr: "jumping", min: 58 }], target_forward: [{ attr: "jumping", min: 55 }],
  set_piece_threat: [{ attr: "jumping", min: 58 }], hold_up: [{ attr: "balance", min: 55 }], strong_on_ball: [{ attr: "balance", min: 55 }],
  press_resistant: [{ attr: "balance", min: 55 }],
  close_control: [{ attr: "agility", min: 55 }, { attr: "technique", min: 55 }], isolation_dribbler: [{ attr: "agility", min: 58 }],
  flair: [{ attr: "creativity", min: 58 }, { attr: "technique", min: 55 }], creative: [{ attr: "creativity", min: 58 }], creative_spark: [{ attr: "creativity", min: 58 }],
  advanced_creator: [{ attr: "creativity", min: 58 }], killer_pass: [{ attr: "creativity", min: 55 }], playmaker: [{ attr: "decisions", min: 55 }],
  tempo_controller: [{ attr: "decisions", min: 58 }], finesse_finisher: [{ attr: "technique", min: 58 }], outside_foot: [{ attr: "technique", min: 60 }],
  dead_ball_specialist: [{ attr: "technique", min: 62 }], set_piece_specialist: [{ attr: "technique", min: 60 }], clinical_finisher: [{ attr: "decisions", min: 55 }],
  poacher: [{ attr: "offBall", min: 62 }], box_predator: [{ attr: "offBall", min: 62 }], second_striker: [{ attr: "offBall", min: 60 }],
  late_box_runner: [{ attr: "offBall", min: 56 }], advanced_runner: [{ attr: "offBall", min: 60 }],
  one_on_one_specialist: [{ attr: "oneOnOnes", min: 62 }], sweeper_keeper: [{ attr: "anticipation", min: 55 }],
};

export function withAttributeModel(defs: readonly TraitDef[]): TraitDef[] {
  return defs.map((d) => {
    const core = EXTRA_CORE[d.id];
    const req = EXTRA_REQ[d.id];
    const exact = CORE_OF[d.id];
    if (!core && !req && !exact) return d;
    return {
      ...d,
      core: exact ?? (core ? [...d.core, ...core.filter((k) => !d.core.includes(k))] : d.core),
      req: req ? [...(d.req ?? []).filter((r) => !req.some((n) => n.attr === r.attr)), ...req] : d.req,
    };
  });
}
