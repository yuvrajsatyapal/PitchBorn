import { describe, expect, it } from "vitest";
import { MatchEngine, type MatchPlayerInput, type TeamInput } from "../src/engine/match/engine";
import { FORMATIONS, tacticalFit } from "../src/engine/match/lineup";
import { generatePlayer } from "../src/engine/players/generate";
import { Rng } from "../src/engine/rng";
import { initialTraits } from "../src/engine/traits/assign";
import { clubTenure, trackClub } from "../src/engine/traits/tenure";
import { careerProfile, resolveMatchFx, stageOf, traitFit } from "../src/engine/traits/effects";
import { groupTraits, positionTag } from "../src/engine/traits/identity";
import { TRAITS, TRAIT_BY_ID } from "../src/engine/traits/registry";
import { candidateTraits, conflictWith, countTraits, hasRoom, limitsFor, meetsRequirements, positionWeight } from "../src/engine/traits/rules";
import { comebackContributions, gainTrait, recordMatchEvidence, reviewAllTraits, reviewTraits, trainingTick } from "../src/engine/traits/develop";
import { captainScore, defeatSting, moveScoreDelta, negotiationPatience, stayBonus, weeklyPersonality } from "../src/engine/traits/career";
import * as D from "../src/engine/traits/catalogue/derive";
import { HARD_TRAIT_CAP, sanitizeTraits } from "../src/engine/traits/sanitize";
import { STAGE_XP, type DeriveInput } from "../src/engine/traits/types";
import { decodeState, encodeState } from "../src/persistence/codec";
import { migrateState } from "../src/persistence/migrations";
import type { OwnedTrait, Player, Position } from "../src/engine/types";
import { SCHEMA_VERSION, userPlayer } from "../src/engine/world/helpers";
import { newCareer } from "./helpers";

const own = (id: string, xp = 100): OwnedTrait => ({ id, xp, since: 2026 });
const mk = (seed: string, position: Position, ovr: number, age = 26): Player =>
  generatePlayer(Rng.fromSeed(seed), { id: seed, nationality: "ENG", position, age, season: 2026, overall: ovr, potential: ovr + 3, clubId: null });
const ids = (p: Player | undefined) => new Set((p?.traits ?? []).map((t) => t.id));

// ──────────────────────────────────────────────────────────── the catalogue vs the brief

/** Trait names from the brief, mapped to the registry (several existing traits already covered the idea under another id). */
const BRIEF: Record<string, string> = {
  Poacher: "poacher", "First-Time Finisher": "first_time_finisher", "Advanced Runner": "advanced_runner", "Box Predator": "box_predator",
  "Complete Forward": "complete_forward", "Clinical Finisher": "clinical_finisher", "Power Finisher": "power_finisher", "Finesse Finisher": "finesse_finisher",
  "Long-Range Threat": "distance_shooter", "Aerial Threat": "aerial_presence", "Target Forward": "target_forward", "False Nine": "false_nine",
  "Channel Runner": "channel_runner", "Counter-Attack Threat": "counter_attack_threat",
  "Flair Dribbler": "flair", "Close Control": "close_control", "Direct Dribbler": "direct_winger", "Touchline Winger": "touchline_runner",
  "Inside Forward": "inside_threat", "Cut-In Threat": "cut_in_threat", "Byline Runner": "byline_runner", "One-on-One Specialist": "one_on_one_runner",
  "Ball Carrier": "progressive_carrier", "Risk Taker": "risk_taker",
  Playmaker: "playmaker", "Deep-Lying Playmaker": "deep_distributor", "Final-Ball Specialist": "killer_pass", "Through-Ball Specialist": "through_ball_specialist",
  "Long-Pass Specialist": "long_pass_specialist", "Quick Distributor": "quick_distributor", "Tempo Controller": "tempo_controller", "Creative Spark": "creative_spark",
  "Switches Play": "switcher", "Crossing Specialist": "crossing_specialist", "Set-Piece Specialist": "set_piece_specialist", "Dead-Ball Specialist": "dead_ball_specialist",
  "Box-to-Box": "box_to_box", "Midfield Engine": "midfield_engine", "Ball Winner": "ball_hunter", "Deep Controller": "deep_controller", "Half-Space Operator": "half_space",
  "Late Box Runner": "late_box_runner", "Press Resistant": "press_resistant", "Transition Specialist": "transition_specialist", "Defensive Anchor": "anchor",
  "Aggressive Tackler": "aggressive", "Clean Tackler": "clean_tackler", Interceptor: "lane_reader", "Man Marker": "man_marker", "Aerial Dominance": "aerial_dominator",
  "Last-Ditch Defender": "last_line", "Ball-Playing Defender": "ball_progressor", Stopper: "front_foot", "Cover Defender": "cover_defender", "Defensive Leader": "defensive_leader",
  "Recovery Defender": "recovery_defender", "Full-Back Runner": "overlapping_runner", "Inverted Full-Back": "inverted_fullback", "Attacking Full-Back": "attacking_fullback",
  "Shot Stopper": "shot_stopper", "Sweeper Keeper": "sweeper_keeper", "Cross Claimer": "cross_claimer", "Penalty Specialist (keeper)": "penalty_reader",
  "One-on-One Keeper": "one_on_one_specialist", "Reflex Keeper": "reflex_keeper", "Commanding Keeper": "cross_commander", "Ball-Playing Keeper": "build_up_keeper",
  "Long Distributor": "long_distributor", "Safe Hands": "safe_hands",
  "Relentless Runner": "relentless_runner", "Big-Game Player": "big_game_performer", "Comeback Specialist": "comeback_specialist", "Pressing Machine": "pressing_machine",
  "Iron Man": "iron_man", "Super Sub": "super_sub", "Consistent Performer": "consistent", "Clutch Performer": "clutch", Versatile: "versatile", Leader: "leader",
  "Captain Material": "captain_material", Professional: "professional", "Calm Under Pressure": "composed",
  "Media Favourite": "media_favourite", "Fan Favourite": "fan_favourite", "Model Professional": "professional", Ambitious: "ambitious", Loyal: "loyal", Mercenary: "money_motivated",
  "One-Club Minded": "club_oriented", Driven: "driven", Determined: "determined", "Quiet Professional": "quiet_professional", "Dressing-Room Leader": "dressing_room_leader",
  Mentor: "mentor", Confident: "confident", Humble: "humble", Charismatic: "charismatic", "Fiery Personality": "fiery", Competitive: "competitive", Adaptable: "adaptable",
  Homebody: "home_comfort", "Big Personality": "big_personality",
  "Shoots Too Often": "shoots_too_often", Selfish: "selfish", "Wasteful Finisher": "wasteful_finisher", "One-Footed": "one_foot_reliant", "Poor Decision Maker": "poor_decision_maker",
  "Holds Ball Too Long": "holds_ball_too_long", "Overcomplicates Play": "overcomplicates_play", "Avoids Weak Foot": "avoids_weak_foot", Inconsistent: "inconsistent",
  "Slow Starter": "slow_starter", "Disappears in Big Matches": "big_match_nerves", "Easily Frustrated": "easily_frustrated", "Hot Head": "hot_head", "Reckless Tackler": "reckless_tackler",
  "Card Magnet": "card_magnet", "Injury Prone": "injury_prone", "Tires Easily": "tires_easily", "Poor Positioning": "poor_positioning", "Defensive Liability": "defensive_liability",
  "Weak in the Air": "weak_in_the_air", "Vulnerable Under Press": "vulnerable_under_press", "Poor Concentration": "poor_concentration", "Error Prone": "error_prone",
  "Reluctant Shooter": "reluctant_shooter", "Poor Crosser": "poor_crosser", "Poor Distributor": "poor_distributor", "Rushes Off Line": "rushes_off_line",
  "Weak on Crosses": "weak_on_crosses", "Contract Difficulties": "contract_difficulties", "Unsettled Easily": "unsettled_easily", "Training Issues": "poor_trainer", Ego: "ego",
  "Media Controversy": "media_controversy", "Poor Adaptability": "low_adaptability",
};

describe("the expanded catalogue", () => {
  it("covers every trait in the brief, each one usable", () => {
    for (const [name, id] of Object.entries(BRIEF)) {
      const d = TRAIT_BY_ID.get(id);
      expect(d, `${name} → ${id}`).toBeDefined();
      expect(d!.blurb.length, name).toBeGreaterThan(20);
    }
    expect(TRAITS.length).toBeGreaterThan(150);
  });

  it("every trait does something real: match behaviour, career effect, a derived rule or a visible role", () => {
    const decorative = TRAITS.filter((t) => !t.match && !t.career && !t.derive && t.id !== "versatile" && t.id !== "ambidextrous");
    expect(decorative.map((t) => t.id)).toEqual([]);
  });

  it("ids, conflicts, evolutions and tactics are all valid; flaws and personality are flagged consistently", () => {
    const seen = new Set<string>();
    for (const t of TRAITS) {
      expect(seen.has(t.id), `duplicate ${t.id}`).toBe(false);
      seen.add(t.id);
      for (const c of t.conflicts ?? []) expect(TRAIT_BY_ID.has(c.id), `${t.id} → ${c.id}`).toBe(true);
      for (const e of t.evolves ?? []) expect(TRAIT_BY_ID.has(e.to), `${t.id} → ${e.to}`).toBe(true);
      expect(t.positions.length).toBeGreaterThan(0);
      if (t.career && !t.match) expect(["personality", "mental", "physical", "technical", "playstyle"]).toContain(t.category);
      if (t.category === "personality" && !t.flaw) expect(t.match?.shoot, `${t.id} must not be a football buff`).toBeUndefined();
    }
  });

  it("goalkeeper traits are goalkeeper-only and outfield traits never reach keepers", () => {
    const gkOnly = ["shot_stopper", "sweeper_keeper", "reflex_keeper", "cross_claimer", "safe_hands", "rushes_off_line", "weak_on_crosses", "penalty_reader", "one_on_one_specialist", "cross_commander", "build_up_keeper", "long_distributor"];
    for (const id of gkOnly) expect(TRAIT_BY_ID.get(id)!.positions).toEqual(["GK"]);
    const gk = mk("gk-pool", "GK", 82);
    for (const c of candidateTraits(gk)) expect(c.def.positions).toContain("GK");
    const outfield = TRAITS.filter((t) => !t.positions.includes("GK"));
    expect(outfield.length).toBeGreaterThan(100);
  });

  it("positionTag summarises where a trait belongs", () => {
    expect(positionTag(TRAIT_BY_ID.get("shot_stopper")!)).toBe("GK");
    expect(positionTag(TRAIT_BY_ID.get("inside_threat")!)).toBe("W");
    expect(positionTag(TRAIT_BY_ID.get("poacher")!)).toBe("AM · W · ST");
    expect(positionTag(TRAIT_BY_ID.get("leader")!)).toBe("");
  });
});

// ──────────────────────────────────────────────────────────── eligibility

describe("position, role and attribute eligibility", () => {
  it("Aerial Threat belongs to strikers and centre-backs first, and to others only when the attributes justify it", () => {
    const def = TRAIT_BY_ID.get("aerial_presence")!;
    const st = mk("ae-st", "ST", 80);
    const cb = mk("ae-cb", "CB", 80);
    const w = mk("ae-w", "RW", 80);
    expect(positionWeight(st, def)).toBeGreaterThan(positionWeight(w, def));
    expect(positionWeight(cb, def)).toBeGreaterThan(positionWeight(w, def));
    w.attrs.heading = 50;
    expect(meetsRequirements(def, w.attrs)).toBe(false);
    expect(candidateTraits(w).some((c) => c.def.id === "aerial_presence")).toBe(false);
    const dm = mk("ae-dm", "DM", 80);
    dm.attrs.heading = 80;
    expect(candidateTraits(dm).some((c) => c.def.id === "aerial_presence")).toBe(true);
  });

  it("a secondary position gives half the weight, and opens the trait family of that role", () => {
    const def = TRAIT_BY_ID.get("playmaker")!;
    const am = mk("pm-am", "AM", 82);
    const cm = mk("pm-cm", "CM", 82);
    const dm = mk("pm-dm", "DM", 82);
    expect(positionWeight(am, def)).toBe(1);
    expect(positionWeight(cm, def)).toBe(1);
    expect(positionWeight(dm, def)).toBeCloseTo(0.5, 5);
    const st = mk("pm-st", "ST", 80);
    st.secondary = [];
    expect(positionWeight(st, def)).toBe(0);
    st.secondary = ["AM"];
    expect(positionWeight(st, def)).toBeCloseTo(0.5, 5);
    // The same striker as a secondary AM is now a candidate for the family.
    st.attrs.vision = 84;
    st.attrs.passing = 84;
    st.attrs.firstTouch = 84;
    expect(candidateTraits(st).some((c) => c.def.id === "playmaker")).toBe(true);
  });

  it("Clinical Finisher needs real finishing and composure", () => {
    const def = TRAIT_BY_ID.get("clinical_finisher")!;
    const good = mk("cf-good", "ST", 86);
    good.attrs.finishing = 88;
    good.attrs.composure = 80;
    expect(meetsRequirements(def, good.attrs)).toBe(true);
    const poor = mk("cf-poor", "ST", 66);
    poor.attrs.finishing = 60;
    expect(meetsRequirements(def, poor.attrs)).toBe(false);
    expect(candidateTraits(poor).some((c) => c.def.id === "clinical_finisher")).toBe(false);
  });

  it("flaws respect attribute ceilings: a strong positioner is never Poorly Positioned, a composed finisher never Wasteful", () => {
    const pp = TRAIT_BY_ID.get("poor_positioning")!;
    const wf = TRAIT_BY_ID.get("wasteful_finisher")!;
    const solid = mk("fl-solid", "ST", 84);
    solid.attrs.positioning = 85;
    solid.attrs.composure = 85;
    expect(meetsRequirements(pp, solid.attrs)).toBe(false);
    expect(meetsRequirements(wf, solid.attrs)).toBe(false);
    solid.attrs.positioning = 50;
    solid.attrs.composure = 55;
    expect(meetsRequirements(pp, solid.attrs)).toBe(true);
    expect(meetsRequirements(wf, solid.attrs)).toBe(true);
    // And the flaw fades when the attribute grows past the ceiling.
    expect(candidateTraits({ ...solid, attrs: { ...solid.attrs, composure: 90 } }).some((c) => c.def.id === "wasteful_finisher")).toBe(false);
  });

  it("flaws that need a role are limited to it", () => {
    for (const id of ["rushes_off_line", "weak_on_crosses"]) expect(TRAIT_BY_ID.get(id)!.positions).toEqual(["GK"]);
    expect(TRAIT_BY_ID.get("poor_crosser")!.positions.every((p) => ["RW", "LW", "RB", "LB"].includes(p))).toBe(true);
    expect(TRAIT_BY_ID.get("attacking_fullback")!.positions.every((p) => p === "RB" || p === "LB")).toBe(true);
    expect(TRAIT_BY_ID.get("complete_forward")!.positions).toEqual(["ST"]);
  });

  it("the original traits still apply to the roles they always did", () => {
    expect(TRAIT_BY_ID.get("poacher")!.positions).toContain("ST");
    expect(TRAIT_BY_ID.get("box_predator")!.positions).toContain("ST");
    expect(TRAIT_BY_ID.get("leader")!.positions.length).toBeGreaterThanOrEqual(9);
    expect(TRAIT_BY_ID.get("media_favourite")!.category).toBe("personality");
    expect(TRAIT_BY_ID.get("selfish")!.flaw).toBe(true);
    expect(TRAIT_BY_ID.get("shoots_too_often")!.flaw).toBe(true);
    expect(TRAIT_BY_ID.get("risk_taker")!.positions).toContain("AM");
  });
});

describe("conflicts", () => {
  it("hard opposites are exclusive", () => {
    const pairs: [string, string][] = [
      ["clinical_finisher", "wasteful_finisher"], ["consistent", "inconsistent"], ["composed", "big_match_nerves"], ["clean_tackler", "reckless_tackler"],
      ["clean_tackler", "aggressive"], ["humble", "ego"], ["cross_claimer", "weak_on_crosses"], ["relentless_runner", "tires_easily"], ["club_oriented", "money_motivated"],
      ["professional", "poor_trainer"], ["selfless", "selfish"], ["iron_man", "injury_prone"], ["quiet_professional", "media_controversy"],
    ];
    for (const [a, b] of pairs) expect(conflictWith(TRAIT_BY_ID.get(a)!, [b]), `${a} / ${b}`).toBe("exclusive");
  });

  it("softer opposites are only unlikely, so the concepts can still coexist", () => {
    const pairs: [string, string][] = [["loyal", "money_motivated"], ["composed", "easily_frustrated"], ["determined", "temperamental"], ["determined", "easily_frustrated"]];
    for (const [a, b] of pairs) {
      const k = conflictWith(TRAIT_BY_ID.get(a)!, [b]);
      expect(k === "unlikely" || k === "exclusive", `${a}/${b}`).toBe(true);
    }
    expect(conflictWith(TRAIT_BY_ID.get("loyal")!, ["money_motivated"])).toBe("unlikely");
    expect(conflictWith(TRAIT_BY_ID.get("selfish")!, ["playmaker"])).toBe("unlikely");
  });

  it("an owned trait stops its opposite being gained", () => {
    const s = newCareer({ seed: "tx-conf", position: "ST" });
    const u = userPlayer(s);
    u.traits = [own("clinical_finisher", 100)];
    expect(gainTrait(s, u, "wasteful_finisher", 40)).toBe(false);
    u.traits = [own("clean_tackler", 100)];
    expect(gainTrait(s, u, "reckless_tackler", 40)).toBe(false);
  });
});

describe("limits", () => {
  it("keep a footballer recognisable, not a list: bounded totals at every level", () => {
    for (const [ovr, age, playing] of [[55, 18, 1], [66, 22, 3], [74, 25, 4], [82, 28, 5], [92, 30, 6]] as const) {
      const l = limitsFor(ovr, age);
      expect(l.playing, `${ovr}/${age}`).toBe(playing);
      expect(l.personality).toBeLessThanOrEqual(3);
      expect(l.flaws).toBeLessThanOrEqual(2);
    }
  });

  it("hasRoom enforces the playing cap across style and mind/body together", () => {
    const ovr = 66;
    const owned = [own("poacher"), own("consistent"), own("clutch")];
    expect(countTraits(owned).style + countTraits(owned).mindBody).toBe(3);
    expect(hasRoom(TRAIT_BY_ID.get("target_forward")!, owned, ovr, 25)).toBe(false);
    expect(hasRoom(TRAIT_BY_ID.get("target_forward")!, owned.slice(0, 2), ovr, 25)).toBe(true);
  });

  it("a generated world respects every limit and is not inflated", () => {
    const s = newCareer({ seed: "tx-world" });
    const ps = Object.values(s.players).filter((p) => !p.virtual);
    let total = 0;
    let max = 0;
    for (const p of ps) {
      const n = (p.traits ?? []).filter((t) => stageOf(t.xp)).length;
      total += n;
      max = Math.max(max, n);
      const c = countTraits(p.traits);
      expect(c.flaws).toBeLessThanOrEqual(2);
      expect(c.personality).toBeLessThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(HARD_TRAIT_CAP);
    }
    expect(total / ps.length).toBeLessThan(5);
    expect(total / ps.length).toBeGreaterThan(2.5);
    expect(max).toBeLessThanOrEqual(12);
  });
});

// ──────────────────────────────────────────────────────────── acquisition, sample size, evolution

const base = (over: Partial<DeriveInput> = {}): DeriveInput => {
  const p = mk("derive", "CM", 76);
  return {
    hidden: p.hidden, attrs: p.attrs, age: 28, reputation: 40, weakFoot: 55, tenure: 3, position: "CM", secondary: [], career: p.career, history: [], injuries: 0, ...over,
  };
};
const stat = (o: Partial<Player["career"]> = {}): Player["career"] => ({ ...mk("z", "ST", 60).career, ...o });

describe("sample size: no performance trait from a tiny record", () => {
  it("Card Magnet needs a real disciplinary record, measured against his own position", () => {
    expect(D.cardMagnet(base({ career: stat({ minutes: 900, yellow: 12 }) }))).toBe(-1);
    // 30 matches: a lot of cards for a midfielder (norm ≈ 0.11/90) …
    const mid = base({ position: "CM", career: stat({ minutes: 3000, yellow: 14 }) });
    expect(D.cardMagnet(mid)).toBeGreaterThan(0.35);
    // … but the same record is ordinary for a centre-back (norm ≈ 0.28/90).
    expect(D.cardMagnet({ ...mid, position: "CB" })).toBeLessThan(0.25);
  });

  it("Super Sub needs many bench appearances and real output from them", () => {
    expect(D.superSub(base({ career: stat({ apps: 20, starts: 2, minutes: 500, goals: 8 }) }))).toBe(-1);
    expect(D.superSub(base({ career: stat({ apps: 60, starts: 8, minutes: 1700, goals: 14, assists: 10 }) }))).toBeGreaterThan(0.25);
    expect(D.superSub(base({ career: stat({ apps: 60, starts: 50, minutes: 4800, goals: 20, assists: 10 }) }))).toBeLessThan(0.25);
  });

  it("Iron Man needs several full seasons and a clean injury record", () => {
    const season = (minutes: number, y: number) => ({ season: y, clubId: "c", age: 25, overall: 70, stats: stat({ minutes, apps: 38 }) });
    const four = [2022, 2023, 2024, 2025].map((y) => season(3900, y));
    expect(D.ironMan(base({ history: four.slice(0, 3), career: stat({ minutes: 11000 }) }))).toBe(-1);
    expect(D.ironMan(base({ history: four, injuries: 1, career: stat({ minutes: 16000 }) }))).toBeGreaterThan(0.25);
    expect(D.ironMan(base({ history: four, injuries: 9, career: stat({ minutes: 16000 }) }))).toBeLessThan(0.25);
    const p = base({ history: four, injuries: 0, career: stat({ minutes: 16000 }) });
    p.hidden = { ...p.hidden, injuryProneness: 80 };
    expect(D.ironMan(p)).toBe(-1);
  });

  it("Disappears in Big Matches and Big-Game Player are not read from a youngster with no record", () => {
    const green = base({ career: stat({ minutes: 200, apps: 4 }) });
    green.hidden = { ...green.hidden, bigMatch: 10 };
    expect(D.bigMatchNerves(green)).toBe(-1);
    const seasoned = base({ career: stat({ minutes: 6000, apps: 80 }) });
    seasoned.hidden = { ...seasoned.hidden, bigMatch: 10 };
    expect(D.bigMatchNerves(seasoned)).toBeGreaterThan(0.35);
  });

  it("Consistent Performer reads the match-rating record when there is one", () => {
    const steady = base({ ratings: { n: 30, mean: 7.1, sd: 0.4 } });
    const wild = base({ ratings: { n: 30, mean: 7.1, sd: 1.1 } });
    expect(D.consistentRecord(steady)).toBeGreaterThan(0.25);
    expect(D.consistentRecord(wild)).toBeLessThan(0.25);
    // Too few rated matches: falls back to temperament, not to the handful of ratings.
    expect(D.consistentRecord(base({ ratings: { n: 4, mean: 7.5, sd: 0.1 } }))).toBe(D.consistentRecord(base()));
  });

  it("Captain Material and Dressing-Room Leader need experience and standing", () => {
    expect(D.captainMaterial(base({ career: stat({ apps: 30 }), reputation: 60 }))).toBe(-1);
    expect(D.dressingRoomLeader(base({ career: stat({ apps: 30 }), reputation: 60 }))).toBe(-1);
    const vet = base({ career: stat({ apps: 260 }), reputation: 55, age: 31, captain: true });
    vet.hidden = { ...vet.hidden, professionalism: 70 };
    expect(D.captainMaterial(vet)).toBeGreaterThan(0.25);
    expect(D.dressingRoomLeader(vet)).toBeGreaterThan(0.25);
    expect(D.captainMaterial({ ...vet, reputation: 8, captain: false })).toBeLessThan(0.25);
  });

  it("One-Club Minded is rare: it needs a recorded career of staying, not just years (more in tests/oneClub.test.ts)", () => {
    const stay = { clubId: "c", seasons: 13, minutes: 13 * 2800, renewals: 4, freeStays: 3, declined: 0, wavered: 0 };
    expect(D.oneClub(base({ tenure: 14 }))).toBe(-1);
    const loyal = base({ tenure: 14, stay });
    loyal.hidden = { ...loyal.hidden, loyalty: 85 };
    expect(D.oneClub(loyal)).toBeGreaterThan(0.25);
    const mercenary = base({ tenure: 12, stay });
    mercenary.hidden = { ...mercenary.hidden, loyalty: 20 };
    expect(D.oneClub(mercenary)).toBeLessThan(0.25);
  });
});

function line(over: Record<string, unknown> = {}) {
  return { id: "u", side: "home" as const, slot: "ST" as Position, started: true, minuteOn: 0, minuteOff: null, rating: 7.4, goals: 1, assists: 0, shots: 4, onTarget: 2, keyPasses: 0, tackles: 0, saves: 0, fouls: 0, yellow: 0, red: 0, injured: false, conceded: 0, acts: {} as Record<string, number>, ...over };
}

describe("acquisition", () => {
  it("Comeback Specialist is earned from repeated comebacks and a real minutes sample, never from one night or a click", () => {
    const s = newCareer({ seed: "tx-comeback", position: "ST" });
    const u = userPlayer(s);
    u.traits = [];
    u.attrs.composure = 84;
    u.attrs.finishing = 84;
    // A quiet match line, so that the only thing being counted is the comeback itself.
    const quiet = () => line({ id: u.id, goals: 0, shots: 0, rating: 6.8 }) as never;
    for (let i = 0; i < 4; i++) recordMatchEvidence(s, u, quiet(), { importance: 1, comeback: 1 });
    expect(ids(u).has("comeback_specialist")).toBe(false);
    // Plenty of evidence, but no football behind it yet: still not owned.
    u.career.minutes = 300;
    for (let i = 0; i < 60; i++) recordMatchEvidence(s, u, quiet(), { importance: 1, comeback: 1 });
    expect(ids(u).has("comeback_specialist")).toBe(false);
    u.career.minutes = 4000;
    for (let i = 0; i < 20; i++) recordMatchEvidence(s, u, quiet(), { importance: 1, comeback: 1 });
    expect(ids(u).has("comeback_specialist")).toBe(true);
  });

  it("counts only contributions to goals scored while behind, in matches the side did not lose", () => {
    const goals = [
      { minute: 20, side: "away" as const, scorer: "x" },
      { minute: 50, side: "home" as const, scorer: "u" },
      { minute: 55, side: "away" as const, scorer: "x" },
      { minute: 60, side: "home" as const, scorer: "y", assist: "u" },
      { minute: 80, side: "home" as const, scorer: "u" },
    ];
    // The equaliser (0-1) and the assist at 1-2 came from behind; the go-ahead goal at 2-2 did not.
    expect(comebackContributions(goals, "home", "u", 3, 2)).toBe(2);
    expect(comebackContributions(goals, "home", "u", 2, 2)).toBe(2);
    // The opponent won in the end: not a comeback that came off.
    expect(comebackContributions(goals, "home", "u", 2, 3)).toBe(0);
    expect(comebackContributions(goals, "away", "u", 3, 2)).toBe(0);
  });

  it("training alone never earns a performance trait, and playstyle traits still need the behaviour first", () => {
    const s = newCareer({ seed: "tx-train", position: "CM" });
    const u = userPlayer(s);
    u.traits = [];
    for (let i = 0; i < 80; i++) {
      trainingTick(s, u, "physical" as never, "intense");
      trainingTick(s, u, "passing" as never, "intense");
    }
    for (const bad of ["pressing_machine", "midfield_engine", "playmaker", "comeback_specialist", "iron_man"]) expect(ids(u).has(bad)).toBe(false);
  });

  it("repeated pressing and tackling in matches builds Pressing Machine for a fit forward", () => {
    const s = newCareer({ seed: "tx-press", position: "ST" });
    const u = userPlayer(s);
    u.traits = [];
    u.attrs.stamina = 86;
    u.attrs.acceleration = 82;
    u.attrs.tackling = 66;
    u.career.minutes = 3000;
    for (let i = 0; i < 120; i++) recordMatchEvidence(s, u, line({ id: u.id, tackles: 4, goals: 0, rating: 7, acts: { intercept: 2 } }) as never, { importance: 1 });
    expect(ids(u).has("pressing_machine")).toBe(true);
  });

  it("NPC creation never hands out earned (record-based) traits, and respects the playing cap", () => {
    const earned = new Set(TRAITS.filter((t) => t.earned).map((t) => t.id));
    expect(earned.size).toBeGreaterThanOrEqual(8);
    for (let i = 0; i < 300; i++) {
      const pos = (["GK", "CB", "RB", "DM", "CM", "AM", "RW", "ST"] as Position[])[i % 8];
      const p = mk(`npc-${i}`, pos, 55 + (i % 40), 17 + (i % 20));
      const t = initialTraits(p, 2026);
      for (const x of t) expect(earned.has(x.id) && !TRAIT_BY_ID.get(x.id)!.derive, `${x.id}`).toBe(false);
      expect(initialTraits(p, 2026)).toEqual(t);
    }
  });
});

describe("evolution", () => {
  it("a Recovery Defender who loses his pace can become a Cover Defender instead", () => {
    const s = newCareer({ seed: "tx-evo", position: "CB" });
    const u = userPlayer(s);
    u.birthYear = s.season - 33;
    u.attrs.pace = 52;
    u.attrs.acceleration = 50;
    u.attrs.positioning = 82;
    u.attrs.composure = 80;
    u.traits = [own("recovery_defender", 60)];
    const rng = Rng.fromSeed("evo");
    for (let i = 0; i < 4; i++) reviewTraits(s, u, rng, true);
    expect(ids(u).has("recovery_defender")).toBe(false);
  });

  it("a record-based trait fades only gradually when the record turns", () => {
    const s = newCareer({ seed: "tx-fade", position: "CM" });
    const u = userPlayer(s);
    u.birthYear = s.season - 30;
    u.traits = [own("iron_man", 150)];
    reviewTraits(s, u, Rng.fromSeed("fade"), true);
    const t = u.traits?.find((x) => x.id === "iron_man");
    expect(t, "one season without the record does not remove it").toBeDefined();
    expect(t!.xp).toBeLessThan(150);
    expect(t!.xp).toBeGreaterThan(120);
  });

  it("personality is steadier than playstyle", () => {
    const s = newCareer({ seed: "tx-steady", position: "CM" });
    const u = userPlayer(s);
    u.birthYear = s.season - 30;
    u.hidden.professionalism = 95;
    u.hidden.ambition = 20;
    u.traits = [own("humble", 120), own("box_to_box", 120)];
    reviewTraits(s, u, Rng.fromSeed("steady"), true);
    const humble = u.traits?.find((x) => x.id === "humble");
    const b2b = u.traits?.find((x) => x.id === "box_to_box");
    // The temperament still fits the profile and holds; the playing style with no minutes behind it slips.
    expect(humble!.xp).toBeGreaterThanOrEqual(120);
    expect(b2b!.xp).toBeLessThan(120);
  });

  it("the annual NPC review keeps a squad inside bounds over several seasons and never piles traits up", () => {
    const s = newCareer({ seed: "tx-years" });
    for (let i = 0; i < 6; i++) {
      s.season += 1;
      reviewAllTraits(s);
    }
    for (const p of Object.values(s.players).filter((x) => !x.virtual).slice(0, 700)) {
      const n = (p.traits ?? []).filter((t) => stageOf(t.xp)).length;
      expect(n).toBeLessThanOrEqual(HARD_TRAIT_CAP);
      expect(countTraits(p.traits).flaws).toBeLessThanOrEqual(2);
    }
  });
});

// ──────────────────────────────────────────────────────────── match behaviour

let uid = 0;
function mate(rng: Rng, slot: Position, ovr: number): MatchPlayerInput {
  const p = generatePlayer(rng, { id: `x${uid++}`, nationality: "ENG", position: slot, age: 26, season: 2026, overall: ovr + rng.normal(0, 2), potential: ovr, clubId: null });
  return { id: p.id, name: p.lastName, slot, attrs: p.attrs, fitness: 95, morale: 70, form: 6.6, sharpness: 80, bigMatch: 50, consistency: 55 };
}
function team(rng: Rng, ovr: number, star?: MatchPlayerInput): TeamInput {
  // 4-2-3-1 is the only shape with a number ten.
  const shape = star?.slot === "AM" ? "4-2-3-1" : "4-3-3";
  return {
    id: "T", name: "T", short: "T", mentality: 0, color: "#000",
    starters: FORMATIONS[shape].map((slot) => (star && slot === star.slot ? star : mate(rng, slot, ovr))),
    bench: (["GK", "CB", "CM", "ST", "RW", "LB", "DM"] as const).map((s) => mate(rng, s, ovr)),
  };
}

interface Profile {
  shots: number; goals: number; assists: number; keyPasses: number; tackles: number; fouls: number; yellow: number;
  cross: number; longShots: number; shot1v1: number; headers: number; ratingSd: number;
  /** The star's side: chances it made and chances it faced. */
  shotsFor: number; shotsAgainst: number; xgAgainst: number; oneOnOnesAgainst: number; goalsAgainst: number;
}

function profile(starBase: MatchPlayerInput, traits: OwnedTrait[], N = 260, seed = "xp-match", opts: { oppStar?: MatchPlayerInput } = {}): Profile {
  const rng = Rng.fromSeed(seed);
  const opp = team(rng, 76, opts.oppStar);
  const star = { ...starBase, id: "STAR", fx: resolveMatchFx(traits, starBase.attrs) };
  const acc: Profile = { shots: 0, goals: 0, assists: 0, keyPasses: 0, tackles: 0, fouls: 0, yellow: 0, cross: 0, longShots: 0, shot1v1: 0, headers: 0, ratingSd: 0, shotsFor: 0, shotsAgainst: 0, xgAgainst: 0, oneOnOnesAgainst: 0, goalsAgainst: 0 };
  const ratings: number[] = [];
  for (let i = 0; i < N; i++) {
    const r = new MatchEngine({ home: team(rng, 76, star), away: opp, importance: 1, detail: false }, rng.fork(i)).runToEnd();
    const l = r.lines.find((x) => x.id === "STAR")!;
    acc.shots += l.shots; acc.goals += l.goals; acc.assists += l.assists; acc.keyPasses += l.keyPasses; acc.tackles += l.tackles; acc.fouls += l.fouls; acc.yellow += l.yellow;
    acc.cross += l.acts?.chanceCross ?? 0; acc.longShots += l.acts?.shotLong ?? 0; acc.shot1v1 += l.acts?.shot1v1 ?? 0; acc.headers += l.acts?.shotHeader ?? 0;
    acc.shotsFor += r.stats.shots[0]; acc.shotsAgainst += r.stats.shots[1]; acc.xgAgainst += r.stats.xg[1]; acc.goalsAgainst += r.awayGoals;
    acc.oneOnOnesAgainst += r.lines.filter((x) => x.side === "away").reduce((s, x) => s + (x.acts?.shot1v1 ?? 0), 0);
    ratings.push(l.rating);
  }
  const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  acc.ratingSd = Math.sqrt(ratings.reduce((a, b) => a + (b - mean) ** 2, 0) / ratings.length);
  for (const k of Object.keys(acc) as (keyof Profile)[]) if (k !== "ratingSd") acc[k] /= N;
  return acc;
}

const star = (slot: Position, ovr = 80, seed = "xp-star") => mate(Rng.fromSeed(seed), slot, ovr);

describe("match behaviour: traits shift tendencies in the intended direction", () => {
  it("Poacher: the striker takes more shots and creates less", () => {
    const st = star("ST");
    const plain = profile(st, []);
    const t = profile(st, [own("poacher", 200)]);
    expect(t.shots).toBeGreaterThan(plain.shots * 1.1);
    expect(t.keyPasses).toBeLessThan(plain.keyPasses);
  });

  it("Risk Taker: more ambitious chance-making and a wider spread of performances", () => {
    const am = star("AM");
    const plain = profile(am, [], 400);
    const t = profile(am, [own("risk_taker", 200), own("creative_spark", 100)], 400);
    expect(t.keyPasses).toBeGreaterThan(plain.keyPasses);
    expect(t.ratingSd).toBeGreaterThan(plain.ratingSd * 0.98);
    expect(resolveMatchFx([own("risk_taker", 200)], am.attrs)!.variance).toBeGreaterThan(1);
  });

  it("Shoots Too Often: more shots, worse ones", () => {
    const cm = star("CM");
    const plain = profile(cm, []);
    const t = profile(cm, [own("shoots_too_often", 200)]);
    expect(t.shots).toBeGreaterThan(plain.shots * 1.15);
    expect(t.goals / Math.max(0.01, t.shots)).toBeLessThan(plain.goals / Math.max(0.01, plain.shots) + 0.015);
  });

  it("Selfish: shoots more and creates less than the same player", () => {
    const am = star("AM");
    const plain = profile(am, []);
    const t = profile(am, [own("selfish", 200)]);
    expect(t.shots).toBeGreaterThan(plain.shots);
    expect(t.keyPasses).toBeLessThan(plain.keyPasses);
  });

  it("Reluctant Shooter: passes up shots for passes", () => {
    const w = star("RW");
    const plain = profile(w, []);
    const t = profile(w, [own("reluctant_shooter", 200)]);
    expect(t.shots).toBeLessThan(plain.shots * 0.92);
  });

  it("Playmaker: the chances come through him", () => {
    const cm = star("CM", 82);
    const plain = profile(cm, [], 360);
    const t = profile(cm, [own("playmaker", 200)], 360);
    expect(t.keyPasses + t.assists).toBeGreaterThan((plain.keyPasses + plain.assists) * 1.15);
  });

  it("Advanced Runner: more one-on-ones for the runner", () => {
    const st = star("ST");
    const plain = profile(st, []);
    const t = profile(st, [own("advanced_runner", 200)]);
    expect(t.shot1v1).toBeGreaterThan(plain.shot1v1 * 1.2);
  });

  it("Late Box Runner: a midfielder who gets into the box shoots far more", () => {
    const cm = star("CM");
    const plain = profile(cm, []);
    const t = profile(cm, [own("late_box_runner", 200)]);
    expect(t.shots).toBeGreaterThan(plain.shots * 1.2);
  });

  it("Ball Winner: more tackles and interceptions", () => {
    const dm = star("DM");
    const plain = profile(dm, []);
    const t = profile(dm, [own("ball_hunter", 200)]);
    expect(t.tackles).toBeGreaterThan(plain.tackles * 1.05);
  });

  it("Aggressive Tackler: more tackles and more fouls and cards; Clean Tackler: fewer fouls", () => {
    const cb = star("CB");
    const plain = profile(cb, [], 420);
    const agg = profile(cb, [own("aggressive", 200)], 420);
    const clean = profile(cb, [own("clean_tackler", 200)], 420);
    expect(agg.tackles).toBeGreaterThan(plain.tackles);
    expect(agg.fouls).toBeGreaterThan(plain.fouls);
    expect(agg.yellow).toBeGreaterThan(plain.yellow);
    expect(clean.fouls).toBeLessThan(plain.fouls);
    expect(clean.yellow).toBeLessThan(plain.yellow);
  });

  it("Reckless Tackler is a bigger risk than Aggressive Tackler", () => {
    const cb = star("CB");
    const agg = profile(cb, [own("aggressive", 200)], 420);
    const reckless = profile(cb, [own("reckless_tackler", 200)], 420);
    expect(reckless.fouls).toBeGreaterThan(agg.fouls * 0.95);
    expect(reckless.yellow).toBeGreaterThan(agg.yellow * 0.95);
  });

  it("Attacking Full-Back: more crossing, but the space he leaves is paid for at the other end", () => {
    const rb = star("RB");
    const plain = profile(rb, [], 420);
    const t = profile(rb, [own("attacking_fullback", 200)], 420);
    expect(t.cross + t.keyPasses).toBeGreaterThan(plain.cross + plain.keyPasses);
    const fx = resolveMatchFx([own("attacking_fullback", 200)], rb.attrs)!;
    expect(fx.zoneDef!).toBeLessThan(1);
    expect(fx.againstXg1v1!).toBeGreaterThan(1);
    expect(t.oneOnOnesAgainst).toBeGreaterThanOrEqual(plain.oneOnOnesAgainst * 0.97);
  });

  it("Pressing Machine: wins the ball more and pays for it in energy", () => {
    const st = star("ST");
    const plain = profile(st, []);
    const t = profile(st, [own("pressing_machine", 200)]);
    expect(t.tackles).toBeGreaterThan(plain.tackles);
    expect(resolveMatchFx([own("pressing_machine", 200)], st.attrs)!.drain).toBeGreaterThan(1.05);
    expect(resolveMatchFx([own("tires_easily", 200)], st.attrs)!.drain).toBeGreaterThan(1.1);
  });

  it("False Nine: creates far more and shoots less", () => {
    const st = star("ST", 82);
    const plain = profile(st, [], 360);
    const t = profile(st, [own("false_nine", 200)], 360);
    expect(t.keyPasses).toBeGreaterThan(plain.keyPasses * 1.25);
    expect(t.shots).toBeLessThan(plain.shots);
  });

  it("Sweeper Keeper: fewer one-on-ones for the opposition", () => {
    const gk = star("GK", 82);
    gk.attrs.command = 80;
    const plain = profile(gk, [], 420);
    const t = profile(gk, [own("sweeper_keeper", 200)], 420);
    expect(t.oneOnOnesAgainst).toBeLessThan(plain.oneOnOnesAgainst);
  });

  it("Error Prone and Poor Concentration hand the opposition more chances", () => {
    const cb = star("CB");
    const plain = profile(cb, [], 520);
    const bad = profile(cb, [own("error_prone", 200), own("poor_concentration", 200)], 520);
    expect(bad.shotsAgainst).toBeGreaterThan(plain.shotsAgainst * 1.02);
  });

  it("Man Marker softens the opposition's best finisher", () => {
    const cb = star("CB");
    const threat = star("ST", 90, "threat");
    const plain = profile(cb, [], 520, "xp-mark", { oppStar: threat });
    const t = profile(cb, [own("man_marker", 200)], 520, "xp-mark", { oppStar: threat });
    expect(t.goalsAgainst).toBeLessThan(plain.goalsAgainst * 1.02);
    expect(resolveMatchFx([own("man_marker", 200)], cb.attrs)!.againstStar!).toBeLessThan(1);
  });

  it("Counter-Attack Threat and Transition Specialist turn won balls into chances", () => {
    const st = star("ST");
    const plain = profile(st, [], 420);
    const t = profile(st, [own("counter_attack_threat", 200)], 420);
    expect(t.shot1v1).toBeGreaterThan(plain.shot1v1 * 1.1);
    expect(resolveMatchFx([own("counter_attack_threat", 200)], st.attrs)!.counter!).toBeGreaterThan(0);
    expect(resolveMatchFx([own("transition_specialist", 200)], st.attrs)!.counter!).toBeGreaterThan(0);
  });

  it("Wasteful Finisher converts worse than the same player; Clinical Finisher better (small, scaled by the attributes behind it)", () => {
    const st = star("ST", 84);
    const w = resolveMatchFx([own("wasteful_finisher", 200)], st.attrs)!;
    const c = resolveMatchFx([own("clinical_finisher", 200)], st.attrs)!;
    expect(w.xgOpen!).toBeLessThan(1);
    expect(c.xgOpen!).toBeGreaterThan(1);
    expect(c.xgOpen!).toBeLessThan(1.1);
    expect(w.xg1v1!).toBeLessThan(c.xg1v1!);
    // A clinical finisher chooses his shots: slightly fewer, better ones.
    expect(c.shoot!).toBeLessThan(1);
    const plain = profile(st, [], 500);
    const wasteful = profile(st, [own("wasteful_finisher", 200)], 500);
    expect(wasteful.goals).toBeLessThan(plain.goals);
  });

  it("Slow Starter plays worse early; Super Sub is hungrier after coming on", () => {
    const st = star("ST");
    expect(resolveMatchFx([own("slow_starter", 200)], st.attrs)!.fast!).toBeLessThan(0);
    expect(resolveMatchFx([own("super_sub", 200)], st.attrs)!.subBoost!).toBeGreaterThan(0);
  });

  it("is deterministic with the same seed, new levers included", () => {
    const cb = star("CB");
    const traits = [own("error_prone", 150), own("man_marker", 150), own("counter_attack_threat", 150)];
    expect(profile(cb, traits, 40)).toEqual(profile(cb, traits, 40));
  });

  it("no new trait turns a poor player into an elite one", () => {
    const weak = star("ST", 62, "weak-st");
    const elite = star("ST", 88, "elite-st");
    const all = ["poacher", "clinical_finisher", "finesse_finisher", "first_time_finisher", "box_predator"].map((id) => own(id, 240));
    expect(profile(weak, all, 260).goals).toBeLessThan(profile(elite, [], 260).goals * 0.85);
  });
});

describe("a trait changes tendencies, not stats: combined effects stay within a sane band", () => {
  it("even a pile of traits stays inside the engine's clamps", () => {
    const st = mk("pile", "ST", 85);
    const fx = resolveMatchFx(["poacher", "clinical_finisher", "box_predator", "first_time_finisher", "power_finisher", "complete_forward", "target_forward"].map((i) => own(i, 240)), st.attrs)!;
    expect(fx.xgOpen!).toBeLessThanOrEqual(1.2);
    expect(fx.shoot!).toBeLessThanOrEqual(2.8);
    const gk = resolveMatchFx(["error_prone", "poor_concentration", "rushes_off_line", "vulnerable_under_press"].map((i) => own(i, 240)), st.attrs)!;
    expect(gk.lapse!).toBeLessThanOrEqual(0.06);
  });
});

// ──────────────────────────────────────────────────────────── managers

describe("manager integration", () => {
  it("a pressing side values a Pressing Machine a little, and never more than a few fit points", () => {
    const st = mk("fit-st", "ST", 80);
    st.traits = [];
    const hi = { pressing: 0.9, tempo: 0.5, directness: 0.5 };
    const lo = { pressing: 0.1, tempo: 0.5, directness: 0.5 };
    const plain = tacticalFit(st, hi);
    st.traits = [own("pressing_machine", 200)];
    const pm = tacticalFit(st, hi);
    expect(pm).toBeGreaterThan(plain);
    expect(pm - plain).toBeLessThanOrEqual(6.01);
    expect(traitFit(st, lo)).toBeLessThan(0);
    expect(traitFit(st, { pressing: 0.5, tempo: 0.5, directness: 0.5 })).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────── career systems

describe("career: personality shifts probabilities, never dictates", () => {
  const setup = (seed: string) => {
    const s = newCareer({ seed });
    const u = userPlayer(s);
    const cur = s.clubs[u.clubId!];
    const bigger = Object.values(s.clubs).filter((c) => c.id !== cur.id).sort((a, b) => b.reputation - a.reputation)[0];
    return { s, u, cur, bigger };
  };

  it("Ambitious is likelier to move up; Loyal likelier to stay; neither is absolute", () => {
    const { s, u, bigger } = setup("tx-amb");
    u.traits = [];
    const neutral = moveScoreDelta(s, u, bigger, 1.1);
    u.traits = [own("ambitious", 120)];
    const amb = moveScoreDelta(s, u, bigger, 1.1);
    u.traits = [own("big_club_ambition", 120)];
    const big = moveScoreDelta(s, u, bigger, 1.1);
    u.traits = [own("loyal", 120)];
    const loyal = moveScoreDelta(s, u, bigger, 1.1);
    expect(amb).toBeGreaterThan(neutral);
    expect(big).toBeGreaterThan(amb);
    expect(loyal).toBeLessThan(neutral);
    expect(Math.abs(loyal - neutral)).toBeLessThan(25);
  });

  it("Mercenary weighs the wage more than a neutral player or a loyal one", () => {
    const { s, u, cur } = setup("tx-merc");
    const rich = Object.values(s.clubs).find((c) => c.id !== cur.id && c.reputation <= cur.reputation) ?? cur;
    u.traits = [];
    const gain = (wage: number) => moveScoreDelta(s, u, rich, wage) - moveScoreDelta(s, u, rich, 1);
    const neutral = gain(1.6);
    u.traits = [own("money_motivated", 120)];
    const merc = gain(1.6);
    u.traits = [own("loyal", 120)];
    expect(merc).toBeGreaterThan(neutral);
    expect(gain(1.6)).toBeLessThanOrEqual(neutral + 1e-9);
    expect(stayBonus(s, { ...u, traits: [own("money_motivated", 120)] } as Player)).toBeLessThan(stayBonus(s, { ...u, traits: [] } as Player));
  });

  it("Homebody finds a foreign move harder", () => {
    const { s, u, cur } = setup("tx-home");
    const foreign = Object.values(s.clubs).find((c) => c.leagueId.slice(0, 3) !== cur.leagueId.slice(0, 3));
    if (!foreign) return;
    u.traits = [];
    const neutral = moveScoreDelta(s, u, foreign, 1.2);
    u.traits = [own("home_comfort", 120)];
    expect(moveScoreDelta(s, u, foreign, 1.2)).toBeLessThan(neutral);
  });

  it("Leader and Captain Material tilt the captaincy, but reputation still matters more", () => {
    const a = mk("cap-a", "CM", 74);
    const b = mk("cap-b", "CM", 74);
    a.reputation = 40;
    b.reputation = 40;
    expect(captainScore(a)).toBe(captainScore(b));
    a.traits = [own("leader", 160), own("captain_material", 160)];
    expect(captainScore(a)).toBeGreaterThan(captainScore(b));
    b.reputation = 70;
    expect(captainScore(a)).toBeLessThan(captainScore(b));
  });

  it("Professional traits help training; Training Issues hurt it; all within a narrow band", () => {
    const base = careerProfile({ traits: [] }).training;
    expect(careerProfile({ traits: [own("professional", 120)] }).training).toBeGreaterThan(base);
    expect(careerProfile({ traits: [own("driven", 120)] }).training).toBeGreaterThan(base);
    expect(careerProfile({ traits: [own("quiet_professional", 120)] }).training).toBeGreaterThan(base);
    expect(careerProfile({ traits: [own("poor_trainer", 120)] }).training).toBeLessThan(base);
    const stack = careerProfile({ traits: ["professional", "driven", "quiet_professional", "competitive"].map((i) => own(i, 240)) }).training;
    expect(stack).toBeLessThanOrEqual(1.25);
  });

  it("Determined softens defeats; Easily Frustrated and Fiery sharpen the swings", () => {
    expect(defeatSting({ traits: [] })).toBe(1);
    expect(defeatSting({ traits: [own("determined", 120)] })).toBeLessThan(1);
    expect(careerProfile({ traits: [own("fiery", 120)] }).moraleSwing).toBeGreaterThan(1);
    expect(careerProfile({ traits: [own("easily_frustrated", 120)] }).moraleSwing).toBeGreaterThan(1);
  });

  it("Ego sulks when the role is below his level, Humble does not", () => {
    const { s, u } = setup("tx-ego");
    u.contract!.role = "backup";
    u.attrs = Object.fromEntries(Object.keys(u.attrs).map((k) => [k, 90])) as typeof u.attrs;
    u.morale = 70;
    s.user.relationships.manager = 60;
    u.traits = [own("humble", 120)];
    weeklyPersonality(s);
    expect(u.morale).toBe(70);
    u.traits = [own("ego", 120)];
    weeklyPersonality(s);
    expect(u.morale).toBeLessThan(70);
    expect(s.user.relationships.manager).toBeLessThan(60);
  });

  it("Contract Difficulties cost the player a round of the club's patience, never below one", () => {
    expect(negotiationPatience({ traits: [] }, 3)).toBe(3);
    expect(negotiationPatience({ traits: [own("contract_difficulties", 120)] }, 3)).toBe(2);
    expect(negotiationPatience({ traits: [own("contract_difficulties", 120)] }, 1)).toBe(1);
  });

  it("Fan Favourite and Charismatic warm the stands; Media Favourite and Big Personality amplify the press", () => {
    const { s, u } = setup("tx-fan");
    s.user.relationships.supporters = 50;
    u.traits = [own("fan_favourite", 120), own("charismatic", 120)];
    weeklyPersonality(s);
    expect(s.user.relationships.supporters).toBeGreaterThan(50);
    expect(careerProfile({ traits: [own("media_favourite", 120)] }).media).toBeGreaterThan(1);
    expect(careerProfile({ traits: [own("big_personality", 120)] }).amp).toBeGreaterThan(1);
    expect(careerProfile({ traits: [own("quiet_professional", 120)] }).media).toBeLessThan(1);
    expect(careerProfile({ traits: [own("media_controversy", 120)] }).controversy).toBeGreaterThan(0);
  });

  it("Unsettled Easily and Poor Adaptability make settling in harder; Adaptable easier", () => {
    expect(careerProfile({ traits: [own("unsettled_easily", 120)] }).adapt).toBeLessThan(0);
    expect(careerProfile({ traits: [own("low_adaptability", 120)] }).adapt).toBeLessThan(0);
    expect(careerProfile({ traits: [own("adaptable", 120)] }).adapt).toBeGreaterThan(0);
  });

  it("personality traits carry no football buffs", () => {
    for (const t of TRAITS.filter((d) => d.category === "personality" && !d.flaw)) {
      for (const k of ["shoot", "xgOpen", "xg1v1", "xgHeader", "xgLong", "create", "tackle", "save"] as const) expect(t.match?.[k], `${t.id}.${k}`).toBeUndefined();
    }
  });
});

describe("the profile", () => {
  it("shows only the traits a player owns, grouped, with a description each", () => {
    const p = mk("ui", "ST", 80);
    p.traits = [own("poacher", 100), own("humble", 100), own("wasteful_finisher", 100), own("iron_man", 5)];
    const g = groupTraits(p);
    expect(g.style.map((r) => r.def.id)).toEqual(["poacher"]);
    expect(g.personality.map((r) => r.def.id)).toEqual(["humble"]);
    expect(g.flaws.map((r) => r.def.id)).toEqual(["wasteful_finisher"]);
    expect([...g.style, ...g.personality, ...g.flaws].every((r) => r.def.blurb.length > 10)).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────── persistence and old saves

describe("persistence and old saves", () => {
  it("round-trips new traits and the club-join season", () => {
    const s = newCareer({ seed: "tx-codec", position: "ST" });
    const u = userPlayer(s);
    u.traits = [own("clinical_finisher", 133.4), own("humble", 50), own("wasteful_finisher", 31)];
    trackClub(u, s.season);
    const back = decodeState(JSON.parse(JSON.stringify(encodeState(s))));
    expect(userPlayer(back).traits).toEqual(u.traits);
    expect(userPlayer(back).clubSince).toEqual(u.clubSince);
  });

  it("a v12 save loads, keeps established traits exactly and only gains traits implied by the record", () => {
    const s = newCareer({ seed: "tx-v12", position: "CM" });
    const before = Object.fromEntries(Object.values(s.players).map((p) => [p.id, JSON.stringify(p.traits ?? [])]));
    const old = JSON.parse(JSON.stringify(s));
    old.schemaVersion = 12;
    for (const p of Object.values(old.players) as Player[]) delete p.clubSince;
    const a = migrateState(JSON.parse(JSON.stringify(old)));
    const b = migrateState(JSON.parse(JSON.stringify(old)));
    expect(a.schemaVersion).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(13);
    expect(JSON.stringify(a.players)).toBe(JSON.stringify(b.players));
    let kept = 0;
    for (const p of Object.values(a.players).filter((x) => !x.isUser && !x.virtual)) {
      const prev = JSON.parse(before[p.id]) as OwnedTrait[];
      for (const t of prev) {
        expect(p.traits?.find((x) => x.id === t.id), `${p.id} keeps ${t.id}`).toEqual(t);
        kept++;
      }
    }
    expect(kept).toBeGreaterThan(500);
  });

  it("loading never re-rolls a trait: migrating twice is the same as once", () => {
    const s = newCareer({ seed: "tx-twice", position: "CM" });
    const once = migrateState(JSON.parse(JSON.stringify(s)));
    const twice = migrateState(JSON.parse(JSON.stringify(once)));
    expect(JSON.stringify(twice.players)).toBe(JSON.stringify(once.players));
  });

  it("repairs unknown, duplicate, impossible and out-of-range traits on load", () => {
    const s = newCareer({ seed: "tx-bad", position: "CM" });
    const npc = Object.values(s.players).find((p) => !p.isUser && !p.virtual)!;
    npc.traits = [own("humble", 120), own("humble", 60), { id: "removed_trait", xp: 90, since: 2020 }, { id: "ego", xp: Number.NaN, since: 2020 }, own("ego", 100), own("poacher", 9999)];
    npc.traitProgress = { removed_trait: 20, poacher: Number.NaN, playmaker: 12 };
    sanitizeTraits(s);
    const got = npc.traits ?? [];
    expect(got.filter((t) => t.id === "humble")).toHaveLength(1);
    expect(got.find((t) => t.id === "removed_trait")).toBeUndefined();
    expect(got.some((t) => t.id === "humble") && got.some((t) => t.id === "ego")).toBe(false);
    expect(Math.max(...got.map((t) => t.xp))).toBeLessThanOrEqual(STAGE_XP.max);
    expect(npc.traitProgress).toEqual({ playmaker: 12 });
  });

  it("dates a stay from history on a first look and follows club changes after that", () => {
    const p = mk("stay", "CM", 70, 29);
    p.clubId = "A";
    p.history = [2023, 2024, 2025].map((y) => ({ season: y, clubId: "A", age: 25, overall: 70, stats: p.career }));
    expect(clubTenure(p, 2026)).toBe(4);
    trackClub(p, 2026);
    expect(p.clubSince).toEqual({ clubId: "A", season: 2023 });
    p.clubId = "B";
    expect(clubTenure(p, 2026)).toBe(1);
    trackClub(p, 2026);
    expect(p.clubSince).toEqual({ clubId: "B", season: 2026 });
    p.clubId = null;
    trackClub(p, 2027);
    expect(p.clubSince).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────── whole-world sanity

describe("simulation sanity", () => {
  const s = newCareer({ seed: "tx-sanity" });
  const ps = Object.values(s.players).filter((p) => !p.virtual);
  const owned = (p: Player) => (p.traits ?? []).filter((t) => stageOf(t.xp));

  it("does not make every striker a Poacher or every midfielder a Playmaker", () => {
    const sts = ps.filter((p) => p.position === "ST");
    const cms = ps.filter((p) => p.position === "CM" || p.position === "AM");
    expect(sts.filter((p) => ids(p).has("poacher")).length / sts.length).toBeLessThan(0.3);
    expect(cms.filter((p) => ids(p).has("playmaker")).length / cms.length).toBeLessThan(0.3);
  });

  it("no keeper has outfield traits and no outfield player has keeper traits", () => {
    for (const p of ps) {
      for (const t of owned(p)) {
        const d = TRAIT_BY_ID.get(t.id)!;
        const ok = d.positions.includes(p.position) || p.secondary.some((x) => d.positions.includes(x));
        expect(ok, `${t.id} on a ${p.position}`).toBe(true);
        if (p.position === "GK") expect(d.positions).toContain("GK");
        else expect(d.positions.every((x) => x === "GK")).toBe(false);
      }
    }
  });

  it("flaws and rare traits stay uncommon; nothing is held by nearly everybody", () => {
    const flawed = ps.filter((p) => owned(p).some((t) => TRAIT_BY_ID.get(t.id)!.flaw)).length / ps.length;
    expect(flawed).toBeLessThan(0.45);
    const counts = new Map<string, number>();
    for (const p of ps) for (const t of owned(p)) counts.set(t.id, (counts.get(t.id) ?? 0) + 1);
    for (const [id, n] of counts) expect(n / ps.length, id).toBeLessThan(0.3);
    const cap = Math.max(...ps.map((p) => owned(p).length));
    expect(cap).toBeLessThanOrEqual(12);
  });

  it("elite players carry roughly five to eight traits, not more", () => {
    const elite = ps.filter((p) => owned(p).length > 0).filter((p) => p.reputation > 0).sort((a, b) => b.hidden.potential - a.hidden.potential).slice(0, 150);
    const avg = elite.reduce((a, p) => a + owned(p).length, 0) / elite.length;
    expect(avg).toBeGreaterThan(3);
    expect(avg).toBeLessThan(8.5);
  });
});

describe("goalkeeper distribution is earnable by the user's own keeper", () => {
  function seasonOfEvidence(kicking: number, composure: number) {
    const s = newCareer({ seed: `tx-gk-${kicking}-${composure}`, position: "GK" });
    const u = userPlayer(s);
    u.traits = [];
    u.career.minutes = 4000;
    Object.assign(u.attrs, { kicking, composure, command: 76, handling: 74, reflexes: 74 });
    const rng = Rng.fromSeed(`gk-evidence-${kicking}`);
    const keeper = { ...mate(rng, "GK", 76), id: "KEEP", attrs: { ...u.attrs } };
    for (let i = 0; i < 38; i++) {
      const home = team(rng, 76);
      home.starters = home.starters.map((p) => (p.slot === "GK" ? keeper : p));
      const r = new MatchEngine({ home, away: team(rng, 76), importance: 1, detail: false }, rng.fork(i)).runToEnd();
      const l = r.lines.find((x) => x.id === "KEEP")!;
      recordMatchEvidence(s, u, { ...l, id: u.id } as never, { importance: 1 });
    }
    return ids(u);
  }

  it("a long-kicking keeper earns Long Distributor within a season; a composed one builds short", () => {
    expect(seasonOfEvidence(84, 60).has("long_distributor")).toBe(true);
    expect(seasonOfEvidence(70, 88).has("build_up_keeper")).toBe(true);
  });

  it("a keeper below the kicking requirement earns neither", () => {
    const got = seasonOfEvidence(45, 60);
    expect(got.has("long_distributor")).toBe(false);
    expect(got.has("build_up_keeper")).toBe(false);
  });
});
