/**
 * Personality traits. They shape the career (transfers, contracts, morale, media, the dressing room), not the football:
 * none of them carries a match effect beyond what temperament genuinely does on the pitch.
 */
import type { TraitDef } from "../types";
import { GK, OUT, def, u, x } from "./helpers";
import * as D from "./derive";

const ALL = [...GK, ...OUT] as const;

export const PERSONALITY: TraitDef[] = [
  def("fan_favourite", "Fan Favourite", "personality", ALL, "The supporters have taken him to heart: his standing with the stands is hard to shake and he is forgiven the odd bad game.", [], 3, {
    earned: true, derive: D.fanFavourite, career: { fan: 0.4, loyalty: 0.12, media: 1.05 },
  }),
  def("driven", "Driven", "personality", ALL, "Always wants more from himself: trains with purpose and is hungry for the next level.", [], 2, {
    derive: D.driven, conflicts: [u("poor_trainer")], career: { training: 1.06, ambition: 0.2, resilience: 0.2 },
  }),
  def("determined", "Determined", "personality", ALL, "Setbacks make him dig in: a bad run or a defeat stings less and he is back to his level sooner.", [], 2, {
    derive: D.determined, conflicts: [u("easily_frustrated"), u("temperamental"), u("unsettled_easily")], career: { resilience: 0.6, moraleSwing: 0.9 },
  }),
  def("quiet_professional", "Quiet Professional", "personality", ALL, "Does the job and goes home: steady, easy to manage and nowhere near the headlines.", [], 2, {
    derive: D.quietProfessional, conflicts: [x("media_favourite"), x("media_controversy"), u("big_personality"), u("charismatic")],
    career: { training: 1.05, friction: -0.2, media: 0.8, moraleSwing: 0.92 },
  }),
  def("dressing_room_leader", "Dressing-Room Leader", "personality", ALL, "When the mood dips, the squad looks to him: a voice of experience with real standing among his team-mates.", [], 3, {
    earned: true, derive: D.dressingRoomLeader, conflicts: [u("selfish"), u("ego")], career: { leader: 0.6, team: 0.3, mentor: 0.1 },
  }),
  def("confident", "Confident", "personality", ALL, "Backs himself: bounces back from a poor game and enjoys the spotlight, with a touch of swagger.", [], 2, {
    derive: D.confident, career: { resilience: 0.2, moraleSwing: 1.1, media: 1.05, ego: 0.15 },
  }),
  def("humble", "Humble", "personality", ALL, "Puts the team first: no airs, no demands, and the dressing room likes him for it.", [], 2, {
    derive: D.humble, conflicts: [x("ego"), u("big_personality")], career: { ego: -0.4, friction: -0.15, team: 0.15, media: 0.93 },
  }),
  def("charismatic", "Charismatic", "personality", ALL, "People warm to him: supporters, the press and team-mates alike.", [], 3, {
    derive: D.charismatic, career: { media: 1.1, fan: 0.25, team: 0.2, leader: 0.15 },
  }),
  def("fiery", "Fiery Personality", "personality", ALL, "Plays with his heart on his sleeve: big emotions, flashes of temper, and an intensity the dressing room feeds on.", [], 2, {
    derive: D.fiery, conflicts: [u("composed"), u("quiet_professional"), u("temperamental"), u("hot_head")],
    career: { moraleSwing: 1.25, friction: 0.35, fan: 0.1 }, match: { card: 1.12, foul: 1.08, cardBehind: 1.15 },
  }),
  def("big_personality", "Big Personality", "personality", ALL, "Larger than life: every success is amplified, and so is every row.", [], 3, {
    derive: D.bigPersonality, conflicts: [u("quiet_professional"), u("humble")], career: { amp: 0.5, media: 1.12, leader: 0.1 },
  }),
  def("contract_difficulties", "Contract Difficulties", "personality", ALL, "Hard to do business with: talks drag, demands change, and clubs lose patience quickly.", [], 2, {
    flaw: true, derive: D.contractDifficulties, conflicts: [u("loyal"), u("club_oriented")], career: { contract: 0.6 },
  }),
  def("unsettled_easily", "Unsettled Easily", "personality", ALL, "Needs things to be just so: changes of club, manager or city knock his mood and form for weeks.", [], 2, {
    flaw: true, derive: D.unsettledEasily, conflicts: [x("adaptable"), u("low_adaptability"), u("determined")], career: { adapt: -0.35, moraleSwing: 1.2 },
  }),
  def("ego", "Ego", "personality", ALL, "Believes he is worth more than his role: sulks when left out, argues with managers and rubs team-mates up the wrong way.", [], 2, {
    flaw: true, derive: D.ego, conflicts: [x("humble"), u("dressing_room_leader")], career: { ego: 0.6, friction: 0.3, team: -0.2 },
  }),
  def("media_controversy", "Media Controversy", "personality", ALL, "Trouble follows him into the papers: an off-hand comment or a night out can turn into a story when results are poor.", [], 2, {
    flaw: true, derive: D.mediaControversy, conflicts: [x("quiet_professional"), u("humble")], career: { controversy: 0.6, media: 1.08, friction: 0.1 },
  }),
];
