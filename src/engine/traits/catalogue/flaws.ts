/**
 * Flaws that live on the pitch. Each is a genuine weakness: a behaviour the player over- or under-does, or a lapse.
 * `cap` keeps them honest: a flaw only fits a player whose related attribute is not already strong, and it fades as the attribute grows.
 */
import type { TraitDef } from "../types";
import { AM, ATTACKERS, CB, DM, FB, GK, OUT, W, def, u, x } from "./helpers";
import * as D from "./derive";

const ALL = [...GK, ...OUT] as const;
const ALL_OUT = OUT;

export const FLAWS: TraitDef[] = [
  def("wasteful_finisher", "Wasteful Finisher", "technical", ATTACKERS, "Gets into the positions, then wastes them: chances are converted less often than they should be.", [], 1, {
    flaw: true, cap: [{ attr: "composure", max: 68 }], conflicts: [x("clinical_finisher")],
    match: { xgOpen: 0.94, xg1v1: 0.95, xgHeader: 0.97 },
  }),
  def("avoids_weak_foot", "Avoids Weak Foot", "technical", ALL_OUT, "Will not use his other foot if he can help it: takes the extra touch and the worse angle to stay on his strong side.", [], 1, {
    flaw: true, derive: D.avoidsWeakFoot, conflicts: [x("one_foot_reliant"), x("ambidextrous")],
    match: { xgOpen: 0.985, xgLong: 0.985, createOpen: 0.96 },
  }),
  def("poor_decision_maker", "Poor Decision Maker", "mental", ALL_OUT, "Often picks the wrong option: the shot instead of the pass, the dribble into traffic.", [], 1, {
    flaw: true, cap: [{ attr: "vision", max: 62 }, { attr: "composure", max: 66 }], conflicts: [u("consistent")],
    match: { zoneMid: 0.985, variance: 1.15, create: 0.9, xgOpen: 0.985 },
  }),
  def("holds_ball_too_long", "Holds Ball Too Long", "technical", ["CM", ...AM, ...W, "ST"], "Takes one touch too many: attacks slow down and he is dispossessed in dangerous places.", [], 1, {
    flaw: true, cap: [{ attr: "firstTouch", max: 70 }], conflicts: [u("quick_distributor"), u("one_touch_passer")],
    match: { zoneMid: 0.985, create: 0.9, createOpen: 0.92, teamMid: -0.004 },
  }),
  def("overcomplicates_play", "Overcomplicates Play", "technical", ["CM", ...AM, ...W], "Looks for the clever option when the simple one is on: attempts the audacious and gives the ball away.", ["dribbling"], 1, {
    flaw: true, req: [{ attr: "dribbling", min: 64 }], cap: [{ attr: "composure", max: 68 }],
    match: { createOpen: 1.1, createThrough: 1.1, zoneMid: 0.985, variance: 1.2, xgCreated: 0.97 },
  }),
  def("slow_starter", "Slow Starter", "mental", ALL, "Takes a while to get going: the first twenty minutes pass him by.", [], 2, {
    flaw: true, conflicts: [x("explosive_starter")], match: { fast: -0.045 },
  }),
  def("easily_frustrated", "Easily Frustrated", "mental", ALL, "Loses his head when things go wrong: a goal against and he plays worse and picks up cards.", [], 2, {
    flaw: true, derive: D.easilyFrustrated, conflicts: [u("composed"), u("determined"), u("temperamental")],
    match: { trailing: -0.6, cardBehind: 1.3 }, career: { moraleSwing: 1.15, friction: 0.15 },
  }),
  def("reckless_tackler", "Reckless Tackler", "playstyle", ["CB", "DM", "CM", ...FB], "Goes through the man: wins his share of the ball but is forever on the edge of a booking or a red card.", [], 2, {
    flaw: true, cap: [{ attr: "composure", max: 72 }], conflicts: [x("clean_tackler"), x("aggressive")],
    signals: { yellow: 0.8, red: 2.5, tackles: 0.3 },
    match: { tackle: 1.35, intercept: 1.05, foul: 1.5, card: 1.5, againstXg1v1: 1.05 },
  }),
  def("card_magnet", "Card Magnet", "mental", ALL, "Referees know his name: the bookings keep coming, season after season.", [], 2, {
    flaw: true, earned: true, derive: D.cardMagnet, conflicts: [x("clean_tackler")],
    match: { card: 1.25, foul: 1.12 }, career: { friction: 0.1 },
  }),
  def("tires_easily", "Tires Easily", "physical", ALL, "Runs out of steam: the legs go early and he is a passenger in the last half hour.", [], 1, {
    flaw: true, cap: [{ attr: "stamina", max: 62 }], conflicts: [x("relentless_runner"), x("midfield_engine"), x("pressing_machine"), u("iron_man")],
    match: { drain: 1.22 },
  }),
  def("poor_positioning", "Poor Positioning", "mental", ALL_OUT, "In the wrong place at the wrong moment: unmarked runners, missed rebounds, gaps in the line.", [], 1, {
    flaw: true, cap: [{ attr: "positioning", max: 62 }],
    match: { zoneDef: 0.975, zoneAtt: 0.985, againstXgOpen: 1.02 },
  }),
  def("defensive_liability", "Defensive Liability", "playstyle", ["CM", ...AM, ...W, ...FB], "Does not track back: opponents find space on his side and the team has to cover for him.", [], 1, {
    flaw: true, cap: [{ attr: "tackling", max: 55 }], conflicts: [x("pressing_machine"), x("defensive_fullback")],
    match: { zoneDef: 0.96, againstXgOpen: 1.02, tackle: 0.75 },
  }),
  def("weak_in_the_air", "Weak in the Air", "physical", ["CB", "DM", "CM", "ST", ...FB], "Loses the aerial duel: rarely wins a header and is easy to bully at set pieces.", [], 1, {
    flaw: true, cap: [{ attr: "heading", max: 52 }], conflicts: [x("aerial_presence"), x("aerial_dominator"), x("target_forward"), x("set_piece_threat")],
    match: { xgHeader: 0.9, shootHeader: 0.75, againstXgHeader: 1.05 },
  }),
  def("vulnerable_under_press", "Vulnerable Under Press", "mental", ["CB", "DM", "CM", ...FB], "Rattled by a high press: loose passes and heavy touches when the opposition close him down.", [], 2, {
    flaw: true, cap: [{ attr: "composure", max: 62 }, { attr: "firstTouch", max: 66 }], conflicts: [x("press_resistant")],
    match: { lapse: 0.003, zoneMid: 0.985, create: 0.9, teamMid: -0.003 },
  }),
  def("poor_concentration", "Poor Concentration", "mental", [...CB, ...FB, ...DM, ...GK], "Drifts out of games: switches off for a moment and a chance is gifted.", [], 2, {
    flaw: true, cap: [{ attr: "composure", max: 66 }], conflicts: [u("error_prone")],
    match: { lapse: 0.005, variance: 1.1 },
  }),
  def("error_prone", "Error Prone", "mental", [...CB, ...FB, ...DM, ...GK], "The occasional costly mistake: a short back-pass, a misjudged bounce, a spill.", [], 3, {
    flaw: true, cap: [{ attr: "composure", max: 60 }, { attr: "positioning", max: 62 }], conflicts: [x("safe_hands"), u("poor_concentration")],
    match: { lapse: 0.008 },
  }),
  def("reluctant_shooter", "Reluctant Shooter", "mental", ["ST", ...W, ...AM, "CM"], "Passes up shots he should take: looks for one more pass and the chance is gone.", [], 2, {
    flaw: true, req: [{ attr: "finishing", min: 60 }], conflicts: [x("shoots_too_often"), x("selfish"), u("poacher"), u("one_on_one_runner")],
    match: { shoot: 0.65, create: 1.1 },
  }),
  def("poor_crosser", "Poor Crosser", "technical", [...W, ...FB], "Delivery lets him down: crosses are wasted and the side's wide play goes nowhere.", [], 1, {
    flaw: true, cap: [{ attr: "crossing", max: 58 }], conflicts: [x("crossing_specialist"), x("early_crosser")],
    match: { createCross: 0.8, xgCreated: 0.97, freqHeader: -0.03 },
  }),
  def("poor_distributor", "Poor Distributor", "technical", [...GK, ...CB, ...DM], "Wasteful with the ball from the back: hurried clearances and loose passes hand possession away.", [], 1, {
    flaw: true, cap: [{ attr: "passing", max: 58 }], conflicts: [x("long_distributor"), x("build_up_keeper"), x("ball_progressor"), u("quick_distributor"), u("long_pass_specialist")],
    match: { createThrough: 0.8, create: 0.85, teamMid: -0.004 },
  }),
  def("rushes_off_line", "Rushes Off Line", "playstyle", GK, "Charges out at the wrong moment: the keeper is beaten by a chip or a lob and the empty net is there for the taking.", [], 2, {
    flaw: true, cap: [{ attr: "positioning", max: 68 }], conflicts: [u("sweeper_keeper")],
    match: { lapse: 0.004, againstXgLong: 1.12, againstFreq1v1: 1.06 },
  }),
  def("weak_on_crosses", "Weak on Crosses", "playstyle", GK, "Does not command his area: crosses hang in the air and are punched weakly or missed.", [], 1, {
    flaw: true, cap: [{ attr: "command", max: 66 }], conflicts: [x("cross_claimer"), x("cross_commander")],
    match: { claim: 1.07, againstFreqHeader: 1.08, againstXgHeader: 1.05 },
  }),
];
