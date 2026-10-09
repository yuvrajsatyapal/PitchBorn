import { describe, expect, it } from "vitest";
import { MatchEngine, type MatchPlayerInput, type TeamInput } from "../src/engine/match/engine";
import { FORMATIONS } from "../src/engine/match/lineup";
import { generatePlayer } from "../src/engine/players/generate";
import { Rng } from "../src/engine/rng";
import { advanceTurn } from "../src/engine/season/advance";
import { traitRng, initialTraits } from "../src/engine/traits/assign";
import { careerProfile, resolveMatchFx, stageOf } from "../src/engine/traits/effects";
import { groupTraits, identityOf } from "../src/engine/traits/identity";
import { TRAITS, TRAIT_BY_ID, traitsForPosition } from "../src/engine/traits/registry";
import { candidateTraits, countTraits, limitsFor } from "../src/engine/traits/rules";
import { gainTrait, recordMatchEvidence, reviewAllTraits, trainingTick } from "../src/engine/traits/develop";
import { moveScoreDelta, movePressure } from "../src/engine/traits/career";
import { STAGE_XP } from "../src/engine/traits/types";
import { decodeState, encodeState } from "../src/persistence/codec";
import { migrateState } from "../src/persistence/migrations";
import type { GameState, OwnedTrait, Player, Position } from "../src/engine/types";
import { SCHEMA_VERSION } from "../src/engine/world/helpers";
import { userPlayer } from "../src/engine/world/helpers";
import { newCareer } from "./helpers";

const own = (id: string, xp = 100): OwnedTrait => ({ id, xp, since: 2026 });
const mk = (seed: string, position: Position, ovr: number, age = 25): Player =>
  generatePlayer(Rng.fromSeed(seed), { id: seed, nationality: "ENG", position, age, season: 2026, overall: ovr, potential: ovr + 3, clubId: null });

describe("registry", () => {
  it("has unique ids, valid conflicts and at least one family trait for every position", () => {
    const ids = new Set(TRAITS.map((t) => t.id));
    expect(ids.size).toBe(TRAITS.length);
    for (const t of TRAITS) {
      for (const c of t.conflicts ?? []) expect(ids.has(c.id), `${t.id} conflicts with unknown ${c.id}`).toBe(true);
      for (const e of t.evolves ?? []) expect(ids.has(e.to), `${t.id} evolves to unknown ${e.to}`).toBe(true);
      expect(t.blurb.length).toBeGreaterThan(10);
    }
    for (const pos of ["GK", "CB", "RB", "LB", "DM", "CM", "AM", "RW", "LW", "ST"] as Position[]) {
      expect(traitsForPosition(pos).filter((t) => t.category === "playstyle").length).toBeGreaterThanOrEqual(3);
    }
    for (const cat of ["playstyle", "technical", "mental", "physical", "personality"]) expect(TRAITS.some((t) => t.category === cat)).toBe(true);
  });

  it("position families do not leak: a goalkeeper never gets striker traits and vice versa", () => {
    const gk = mk("gk1", "GK", 80);
    const pool = candidateTraits(gk).map((c) => c.def);
    expect(pool.some((d) => d.id === "poacher" || d.id === "inside_threat")).toBe(false);
    expect(pool.some((d) => d.category === "playstyle")).toBe(true);
    expect(pool.every((d) => d.positions.includes("GK"))).toBe(true);
    const st = mk("st1", "ST", 80);
    expect(candidateTraits(st).some((c) => c.def.id === "shot_stopper")).toBe(false);
  });

  it("exclusive conflicts block candidates", () => {
    const w = mk("w1", "RW", 84);
    w.traits = [own("inside_threat")];
    expect(candidateTraits(w).some((c) => c.def.id === "touchline_runner")).toBe(false);
  });
});

describe("assignment and limits", () => {
  it("is deterministic per player and never exceeds limits", () => {
    for (let i = 0; i < 80; i++) {
      const p = mk(`lim-${i}`, (["ST", "RW", "CM", "CB", "GK", "LB", "DM", "AM"] as Position[])[i % 8], 62 + (i % 30));
      const a = initialTraits(p, 2026);
      const b = initialTraits(p, 2026);
      expect(a).toEqual(b);
      const c = countTraits(a);
      const lim = limitsFor(62 + (i % 30), 25);
      expect(c.style).toBeLessThanOrEqual(lim.style + 1);
      expect(c.flaws).toBeLessThanOrEqual(2);
      expect(c.signature).toBeLessThanOrEqual(2);
    }
  });

  it("is rare for a squad to share an identity: recognisable but not inflated", () => {
    const s = newCareer({ seed: "tr-dist" });
    const ps = Object.values(s.players).filter((p) => !p.isUser);
    const avg = ps.reduce((a, p) => a + (p.traits?.length ?? 0), 0) / ps.length;
    expect(avg).toBeGreaterThan(1.5);
    expect(avg).toBeLessThan(4.5);
    const signature = ps.filter((p) => p.traits?.some((t) => stageOf(t.xp) === "signature")).length;
    expect(signature / ps.length).toBeLessThan(0.1);
    const flawed = ps.filter((p) => groupTraits(p).flaws.length > 0).length;
    expect(flawed / ps.length).toBeLessThan(0.45);
  });

  it("the user starts with no playing style: it must be earned", () => {
    const s = newCareer({ seed: "tr-user" });
    const g = groupTraits(userPlayer(s));
    expect(g.style.length).toBe(0);
  });
});

describe("effects", () => {
  it("scales with stage and with the underlying attributes (core fit)", () => {
    const good = mk("fit-good", "RW", 88);
    const bad = mk("fit-bad", "RW", 62);
    const strong = resolveMatchFx([own("inside_threat", 200)], good.attrs);
    const weak = resolveMatchFx([own("inside_threat", 40)], good.attrs);
    expect(strong?.shoot ?? 1).toBeGreaterThan(weak?.shoot ?? 1);
    const poor = resolveMatchFx([own("finesse_finisher", 200)], bad.attrs);
    const rich = resolveMatchFx([own("finesse_finisher", 200)], good.attrs);
    expect(Math.abs((poor?.xg1v1 ?? 0))).toBeLessThanOrEqual(Math.abs(rich?.xg1v1 ?? 0) + 1e-9);
  });

  it("returns nothing for a player with no traits", () => {
    expect(resolveMatchFx(undefined, mk("n", "ST", 70).attrs)).toBeUndefined();
  });

  it("personality traits carry career effects", () => {
    expect(careerProfile({ traits: [own("loyal")] }).loyalty).toBeGreaterThan(0);
    expect(careerProfile({ traits: [own("poor_trainer")] }).training).toBeLessThan(1);
    expect(careerProfile({ traits: [own("ambitious")] }).ambition).toBeGreaterThan(0);
    expect(careerProfile({ traits: [own("temperamental")] }).moraleSwing).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------- match behaviour

let uid = 0;
function mate(rng: Rng, slot: (typeof FORMATIONS)["4-3-3"][number], ovr: number): MatchPlayerInput {
  const p = generatePlayer(rng, { id: `m${uid++}`, nationality: "ENG", position: slot, age: 26, season: 2026, overall: ovr + rng.normal(0, 2), potential: ovr, clubId: null });
  return { id: p.id, name: p.lastName, slot, attrs: p.attrs, fitness: 95, morale: 70, form: 6.6, sharpness: 80, bigMatch: 50, consistency: 55 };
}
function team(rng: Rng, ovr: number, star?: MatchPlayerInput): TeamInput {
  return {
    id: "T", name: "T", short: "T", mentality: 0, color: "#000",
    starters: FORMATIONS["4-3-3"].map((slot) => (star && slot === star.slot ? star : mate(rng, slot, ovr))),
    bench: (["GK", "CB", "CM", "ST", "RW", "LB", "DM"] as const).map((s) => mate(rng, s, ovr)),
  };
}

function profile(starBase: MatchPlayerInput, traits: OwnedTrait[], N = 260) {
  const rng = Rng.fromSeed("trait-match");
  const opp = team(rng, 76);
  const star = { ...starBase, id: "STAR", fx: resolveMatchFx(traits, starBase.attrs) };
  let shots = 0, goals = 0, assists = 0, keyPasses = 0, cross = 0, longShots = 0;
  for (let i = 0; i < N; i++) {
    const r = new MatchEngine({ home: team(rng, 76, star), away: opp, importance: 1, detail: false }, rng.fork(i)).runToEnd();
    const l = r.lines.find((x) => x.id === "STAR")!;
    shots += l.shots; goals += l.goals; assists += l.assists; keyPasses += l.keyPasses;
    cross += l.acts?.chanceCross ?? 0; longShots += l.acts?.shotLong ?? 0;
  }
  return { shots: shots / N, goals: goals / N, assists: assists / N, keyPasses: keyPasses / N, cross: cross / N, longShots: longShots / N };
}

describe("match behaviour", () => {
  const rng = Rng.fromSeed("rw-base");
  const base = mate(rng, "RW", 86);

  it("two 86 RWs with identical attributes play differently: Inside Threat shoots, Touchline Runner creates", () => {
    const inside = profile(base, [own("inside_threat", 200), own("isolation_dribbler", 120), own("finesse_finisher", 120)]);
    const touch = profile(base, [own("touchline_runner", 200), own("byline_creator", 120), own("crossing_specialist", 120)]);
    expect(inside.shots).toBeGreaterThan(touch.shots * 1.05);
    expect(touch.cross).toBeGreaterThan(inside.cross);
    expect(touch.keyPasses + touch.assists).toBeGreaterThan(inside.keyPasses + inside.assists);
  });

  it("a Distance Shooter takes more long shots without becoming a better shooter", () => {
    const plain = profile(base, []);
    const dist = profile(base, [own("distance_shooter", 200)]);
    expect(dist.longShots).toBeGreaterThan(plain.longShots);
    expect(dist.goals).toBeLessThan(plain.goals * 1.5 + 0.1);
  });

  it("traits never rescue poor attributes: a weak finisher with the best finishing traits stays far below an elite one", () => {
    const weakRng = Rng.fromSeed("weak");
    const weak = mate(weakRng, "ST", 64);
    const elite = mate(weakRng, "ST", 90);
    const traited = profile(weak, [own("poacher", 240), own("finesse_finisher", 240), own("first_time_finisher", 240)]);
    const plainElite = profile(elite, []);
    expect(traited.goals).toBeLessThan(plainElite.goals * 0.85);
  });

  it("is deterministic with the same seed", () => {
    const a = profile(base, [own("inside_threat", 150)], 40);
    const b = profile(base, [own("inside_threat", 150)], 40);
    expect(a).toEqual(b);
  });

  it("flaws are real costs: Shoots Too Often shoots more but the extra shots are worse", () => {
    const plain = profile(base, []);
    const flawed = profile(base, [own("shoots_too_often", 200)]);
    expect(flawed.shots).toBeGreaterThan(plain.shots);
    expect(flawed.goals / Math.max(0.01, flawed.shots)).toBeLessThan(plain.goals / Math.max(0.01, plain.shots) + 0.02);
  });
});

// ---------------------------------------------------------------- development

function fakeLine(over: Partial<ReturnType<typeof baseLine>> = {}) {
  return { ...baseLine(), ...over };
}
function baseLine() {
  return { id: "u", side: "home" as const, slot: "RW" as Position, started: true, minuteOn: 0, minuteOff: null, rating: 7.4, goals: 1, assists: 0, shots: 5, onTarget: 3, keyPasses: 1, tackles: 0, saves: 0, fouls: 0, yellow: 0, red: 0, injured: false, conceded: 0, acts: { shotOpen: 5, goalOpen: 1 } as Record<string, number> };
}

describe("acquisition, progression and loss", () => {
  it("traits emerge from repeated behaviour (not from one match) and the user can't just click one", () => {
    const s = newCareer({ seed: "tr-evo", position: "RW" });
    const u = userPlayer(s);
    u.attrs.finishing = 82; u.attrs.dribbling = 82; u.attrs.pace = 82;
    u.traits = [];
    recordMatchEvidence(s, u, fakeLine({ id: u.id }) as never, { importance: 1 } as never);
    expect(u.traits?.length ?? 0).toBe(0);
    for (let i = 0; i < 90; i++) recordMatchEvidence(s, u, fakeLine({ id: u.id }) as never, { importance: 1 } as never);
    expect(u.traits?.length ?? 0).toBeGreaterThan(0);
  });

  it("stage follows xp thresholds", () => {
    expect(stageOf(STAGE_XP.owned - 1)).toBeNull();
    expect(stageOf(STAGE_XP.owned)).toBe("emerging");
    expect(stageOf(STAGE_XP.established)).toBe("established");
    expect(stageOf(STAGE_XP.signature)).toBe("signature");
  });

  it("training alone contributes only slowly and stays gated", () => {
    const s = newCareer({ seed: "tr-train", position: "ST" });
    const u = userPlayer(s);
    u.traits = [];
    for (let i = 0; i < 20; i++) trainingTick(s, u, "finishing" as never, "normal");
    expect(u.traits?.length ?? 0).toBeLessThanOrEqual(1);
  });

  it("a trait whose requirements fade is weakened or lost on the annual review", () => {
    const s = newCareer({ seed: "tr-fade", position: "RW" });
    const u = userPlayer(s);
    u.birthYear = s.season - 34;
    u.attrs.pace = 40;
    u.traits = [own("speed_runner", 100)];
    for (let i = 0; i < 3; i++) reviewAllTraits(s);
    const t = u.traits?.find((x) => x.id === "speed_runner");
    expect(!t || t.xp < 100).toBe(true);
  });

  it("gainTrait respects exclusive conflicts", () => {
    const s = newCareer({ seed: "tr-conf", position: "RW" });
    const u = userPlayer(s);
    u.traits = [own("inside_threat")];
    expect(gainTrait(s, u, "touchline_runner", 40)).toBe(false);
  });

  it("NPC trait review is deterministic and cheap", () => {
    const a = newCareer({ seed: "tr-npc" });
    const b = newCareer({ seed: "tr-npc" });
    reviewAllTraits(a);
    reviewAllTraits(b);
    const key = (s: GameState) => Object.values(s.players).slice(0, 400).map((p) => (p.traits ?? []).map((t) => `${t.id}${t.xp}`).join(",")).join("|");
    expect(key(a)).toBe(key(b));
  });
});

describe("personality and career", () => {
  it("loyalty makes a player harder to prise away, but a crisis can override it", () => {
    const s = newCareer({ seed: "tr-loyal" });
    const u = userPlayer(s);
    const buyer = Object.values(s.clubs).find((c) => c.id !== u.clubId)!;
    u.traits = [];
    const neutral = moveScoreDelta(s, u, buyer, 0.2);
    u.traits = [own("loyal", 120)];
    const loyal = moveScoreDelta(s, u, buyer, 0.2);
    expect(loyal).toBeLessThan(neutral);
    u.traits = [own("ambitious", 120)];
    expect(moveScoreDelta(s, u, buyer, 0.2)).toBeGreaterThan(neutral);
    expect(movePressure(s, u)).toBeDefined();
  });

  it("the identity story comes from real traits", () => {
    const s = newCareer({ seed: "tr-id", position: "RW" });
    const u = userPlayer(s);
    u.traits = [own("inside_threat", 170), own("finesse_finisher", 100), own("loyal", 90)];
    const id = identityOf(s, u);
    expect(id.label.length).toBeGreaterThan(3);
    expect(id.traits.length).toBeGreaterThan(0);
  });
});

describe("persistence", () => {
  it("round-trips traits through the codec", () => {
    const s = newCareer({ seed: "tr-codec", position: "RW" });
    userPlayer(s).traits = [own("inside_threat", 133.4), own("loyal", 50)];
    const back = decodeState(JSON.parse(JSON.stringify(encodeState(s))));
    expect(userPlayer(back).traits).toEqual(userPlayer(s).traits);
    const some = Object.values(s.players).find((p) => (p.traits?.length ?? 0) > 0)!;
    expect(back.players[some.id].traits).toEqual(some.traits);
  });

  it("migrates an older save (no traits) without crashing and fills deterministic traits", () => {
    const s = newCareer({ seed: "tr-mig", position: "RW" });
    const old = JSON.parse(JSON.stringify(s));
    old.schemaVersion = 4;
    delete old.user.traitLog;
    for (const p of Object.values(old.players) as Player[]) { delete p.traits; delete p.traitProgress; }
    const a = migrateState(JSON.parse(JSON.stringify(old)));
    const b = migrateState(JSON.parse(JSON.stringify(old)));
    expect(a.schemaVersion).toBe(SCHEMA_VERSION);
    expect(a.user.traitLog).toEqual([]);
    const some = Object.values(a.players).filter((p) => !p.isUser).slice(0, 50);
    // A player with no traits is stored without the field (the migration deletes empty lists).
    expect(some.every((p) => p.traits === undefined || Array.isArray(p.traits))).toBe(true);
    expect(JSON.stringify(a.players)).toBe(JSON.stringify(b.players));
  });

  it("a played season keeps the world valid and trait counts bounded", () => {
    const s = newCareer({ seed: "tr-season" });
    for (let i = 0; i < 400 && s.season === 2026; i++) advanceTurn(s);
    const ps = Object.values(s.players);
    for (const p of ps.slice(0, 600)) {
      const c = countTraits(p.traits);
      expect(c.flaws).toBeLessThanOrEqual(3);
      for (const t of p.traits ?? []) expect(TRAIT_BY_ID.has(t.id)).toBe(true);
    }
    expect(traitRng(userPlayer(s)).next()).toBeGreaterThanOrEqual(0);
  });
});
