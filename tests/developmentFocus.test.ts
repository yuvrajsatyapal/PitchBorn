import { describe, expect, it } from "vitest";
import { generatePlayer } from "../src/engine/players/generate";
import { applyGrowth, overallFor, POSITION_WEIGHTS } from "../src/engine/players/attributes";
import { runTraining, TRAINING_FOCUS } from "../src/engine/players/development";
import {
  NO_FOCUS, focusFor, focusOf, focusOptions, focusStrength, focusTilt, isValidFocus, leanAttributes, npcFocus,
} from "../src/engine/players/focus";
import { Rng } from "../src/engine/rng";
import { advanceTurn } from "../src/engine/season/advance";
import { recordMatchEvidence } from "../src/engine/traits/develop";
import { focusReading, groupTraits } from "../src/engine/traits/identity";
import { TRAIT_BY_ID } from "../src/engine/traits/registry";
import { candidateTraits } from "../src/engine/traits/rules";
import { sanitizeTraits } from "../src/engine/traits/sanitize";
import { decodeState, encodeState } from "../src/persistence/codec";
import { migrateState } from "../src/persistence/migrations";
import { POSITIONS, type AttrKey, type Player, type Position } from "../src/engine/types";
import { SCHEMA_VERSION, userPlayer } from "../src/engine/world/helpers";
import { newCareer } from "./helpers";

const ovrOf = (p: Player) => overallFor(p.attrs, p.position);
const total = (p: Player) => Object.values(p.attrs).reduce((s, v) => s + v, 0);
const norm = (x: unknown) => JSON.parse(JSON.stringify(x));

function line(over: Record<string, unknown> = {}) {
  return { id: "u", side: "home" as const, slot: "ST" as Position, started: true, minuteOn: 0, minuteOff: null, rating: 7.4, goals: 0, assists: 0, shots: 0, onTarget: 0, keyPasses: 0, tackles: 0, saves: 0, fouls: 0, yellow: 0, red: 0, injured: false, conceded: 0, acts: {} as Record<string, number>, ...over };
}

describe("the options", () => {
  it("every position can choose among valid options, and No preference is always one of them", () => {
    for (const pos of POSITIONS) {
      const opts = focusOptions(pos);
      expect(opts[0].id, pos).toBe(NO_FOCUS);
      expect(opts.length, pos).toBeGreaterThanOrEqual(4);
      expect(new Set(opts.map((o) => o.id)).size, pos).toBe(opts.length);
      for (const o of opts) {
        expect(isValidFocus(pos, o.id), `${pos} ${o.id}`).toBe(true);
        expect(o.name.length).toBeGreaterThan(0);
        expect(o.blurb.length).toBeGreaterThan(0);
        expect(o.areas.length).toBeGreaterThan(0);
        if (o.id === NO_FOCUS) {
          expect(Object.keys(o.attrs)).toHaveLength(0);
          expect(o.traits).toHaveLength(0);
        }
      }
    }
  });

  it("each option leans on attributes the role actually uses, and names real, position-eligible traits", () => {
    for (const pos of POSITIONS) {
      const role = Object.keys(POSITION_WEIGHTS[pos]) as AttrKey[];
      for (const o of focusOptions(pos).filter((x) => x.id !== NO_FOCUS)) {
        // At least two role attributes can actually be developed towards it.
        expect(Object.keys(o.attrs).filter((k) => role.includes(k as AttrKey)).length, `${pos} ${o.id}`).toBeGreaterThanOrEqual(2);
        expect(o.traits.length, o.id).toBeGreaterThan(0);
        for (const t of o.traits) {
          const def = TRAIT_BY_ID.get(t);
          expect(def, `${o.id} → ${t}`).toBeDefined();
          expect(def?.flaw, `${o.id} → ${t} is not a flaw`).toBeFalsy();
          expect(def?.derive, `${o.id} → ${t} is not a temperament`).toBeUndefined();
          expect(def?.positions.includes(pos), `${o.id} → ${t} fits ${pos}`).toBe(true);
        }
        expect(o.training.length).toBeGreaterThan(0);
      }
    }
  });

  it("the brief's options exist under the brief's names", () => {
    const names = (pos: Position) => focusOptions(pos).map((o) => o.name);
    expect(names("ST")).toEqual(expect.arrayContaining(["Goalscorer", "Complete Forward", "Target Forward", "Mobile Forward", "Creative Forward", "No preference"]));
    expect(names("LW")).toEqual(names("RW"));
    expect(names("RW")).toEqual(expect.arrayContaining(["Inside Forward", "Traditional Winger", "Creative Winger", "Direct Dribbler", "Wide Goalscorer"]));
    expect(names("AM")).toEqual(expect.arrayContaining(["Playmaker", "Goalscoring Midfielder", "Creative Dribbler", "Advanced Creator"]));
    expect(names("CM")).toEqual(expect.arrayContaining(["Box-to-Box", "Playmaker", "Tempo Controller", "Ball Winner"]));
    expect(names("DM")).toEqual(expect.arrayContaining(["Defensive Anchor", "Ball Winner", "Deep-Lying Playmaker", "Defensive Controller"]));
    expect(names("CB")).toEqual(expect.arrayContaining(["Stopper", "Ball-Playing Defender", "Cover Defender", "Aerial Defender"]));
    expect(names("LB")).toEqual(names("RB"));
    expect(names("RB")).toEqual(expect.arrayContaining(["Defensive Full-Back", "Attacking Full-Back", "Inverted Full-Back", "Overlapping Full-Back"]));
    expect(names("GK")).toEqual(expect.arrayContaining(["Shot Stopper", "Sweeper Keeper", "Ball-Playing Keeper", "Commanding Keeper"]));
  });

  it("a focus from another position is rejected and treated as no preference", () => {
    expect(isValidFocus("CB", "st_goalscorer")).toBe(false);
    expect(isValidFocus("ST", "cb_stopper")).toBe(false);
    expect(isValidFocus("ST", "made_up")).toBe(false);
    expect(isValidFocus("ST", 4)).toBe(false);
    expect(focusFor("GK", "st_goalscorer")).toBeNull();
    const wrong = newCareer({ seed: "focus-wrong", position: "CB", focus: "st_goalscorer" });
    const plain = newCareer({ seed: "focus-wrong", position: "CB" });
    expect(userPlayer(wrong).focus).toBe(NO_FOCUS);
    expect(userPlayer(wrong).attrs).toEqual(userPlayer(plain).attrs);
    expect(focusOf({ position: "CB", focus: "st_goalscorer" }).id).toBe(NO_FOCUS);
  });
});

describe("creation: an identity, not a power-up", () => {
  const ST = focusOptions("ST");
  const made = (id: string, seed = "focus-start") => userPlayer(newCareer({ seed, position: "ST", focus: id }));

  it("the overall stays the same whichever focus is chosen, and the total attribute budget barely moves", () => {
    for (const pos of POSITIONS) {
      const base = userPlayer(newCareer({ seed: `focus-budget-${pos}`, position: pos }));
      for (const o of focusOptions(pos)) {
        const p = userPlayer(newCareer({ seed: `focus-budget-${pos}`, position: pos, focus: o.id }));
        expect(Math.abs(ovrOf(p) - ovrOf(base)), `${pos} ${o.id} overall`).toBeLessThanOrEqual(1);
        // A few attribute points moved around. The overall (what the role is worth) is what must not change; the raw sum can drift a little either way.
        // (A role whose lean falls on low-weight attributes, such as the Creative Forward's touch and vision, adds a few raw points: the role overall is what is held.)
        expect(total(p) - total(base), `${pos} ${o.id} total`).toBeLessThanOrEqual(10);
        expect(total(base) - total(p), `${pos} ${o.id} total`).toBeLessThanOrEqual(16);
      }
    }
  });

  it("different focuses give different attribute emphasis", () => {
    const none = made(NO_FOCUS);
    const scorer = made("st_goalscorer");
    const target = made("st_target");
    const mobile = made("st_mobile");
    const creative = made("st_creative");
    expect(scorer.attrs.finishing).toBeGreaterThan(none.attrs.finishing + 1.5);
    expect(scorer.attrs.offBall).toBeGreaterThan(none.attrs.offBall);
    expect(target.attrs.heading).toBeGreaterThan(none.attrs.heading + 1.5);
    expect(target.attrs.strength).toBeGreaterThan(none.attrs.strength + 1.5);
    expect(mobile.attrs.pace).toBeGreaterThan(none.attrs.pace + 1.5);
    expect(mobile.attrs.acceleration).toBeGreaterThan(none.attrs.acceleration + 1.5);
    expect(creative.attrs.passing).toBeGreaterThan(none.attrs.passing + 1.5);
    expect(creative.attrs.vision).toBeGreaterThan(none.attrs.vision + 1.5);
    // What it gives is small: no attribute moves by more than the lean allows.
    for (const o of ST) {
      const p = made(o.id);
      for (const k of Object.keys(none.attrs) as AttrKey[]) expect(Math.abs(p.attrs[k] - none.attrs[k]), `${o.id} ${k}`).toBeLessThanOrEqual(4);
    }
  });

  it("No preference changes nothing at all", () => {
    for (const pos of POSITIONS) {
      const a = userPlayer(newCareer({ seed: `focus-none-${pos}`, position: pos }));
      const b = userPlayer(newCareer({ seed: `focus-none-${pos}`, position: pos, focus: NO_FOCUS }));
      expect(b.attrs).toEqual(a.attrs);
      expect(b.hidden).toEqual(a.hidden);
      expect(focusTilt(b, 2026)).toBeUndefined();
      expect(focusStrength(b, 2026)).toBe(0);
    }
  });

  it("is deterministic: the same seed and focus give the same player", () => {
    const a = made("st_creative", "focus-det");
    const b = made("st_creative", "focus-det");
    expect(norm(a)).toEqual(norm(b));
  });

  it("choosing a focus grants no trait: Goalscorer does not start as a Poacher", () => {
    for (const pos of POSITIONS) {
      for (const o of focusOptions(pos)) {
        const base = userPlayer(newCareer({ seed: `focus-notrait-${pos}`, position: pos }));
        const p = userPlayer(newCareer({ seed: `focus-notrait-${pos}`, position: pos, focus: o.id }));
        const g = groupTraits(p);
        expect(g.style, `${pos} ${o.id}`).toHaveLength(0);
        // Whatever temperament the player has, the choice of focus added nothing to it.
        expect(norm(p.traits ?? []), `${pos} ${o.id}`).toEqual(norm(base.traits ?? []));
        expect(p.traitProgress ?? {}, `${pos} ${o.id}`).toEqual({});
        const favoured = new Set(o.traits);
        expect((p.traits ?? []).filter((t) => favoured.has(t.id)), `${pos} ${o.id}`).toHaveLength(0);
      }
    }
  });

  it("leanAttributes keeps the role overall unchanged", () => {
    for (const pos of POSITIONS) {
      const p = generatePlayer(Rng.fromSeed(`lean-${pos}`), { id: `lean-${pos}`, nationality: "ENG", position: pos, age: 18, season: 2026, overall: 66, potential: 80, clubId: null });
      for (const o of focusOptions(pos)) {
        const attrs = { ...p.attrs };
        leanAttributes(attrs, pos, o.id);
        expect(Math.abs(overallFor(attrs, pos) - overallFor(p.attrs, pos)), `${pos} ${o.id}`).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("how it fades", () => {
  const mkP = (age: number, minutes: number, focus: string | undefined | null = "st_goalscorer") =>
    ({ birthYear: 2026 - age, position: "ST" as Position, focus: focus ?? undefined, career: { ...generatePlayer(Rng.fromSeed("fade"), { id: "fade", nationality: "ENG", position: "ST", age: 17, season: 2026, overall: 60, potential: 80, clubId: null }).career, minutes } });

  it("matters most while young and new, and is gone for an established career", () => {
    const at = (age: number, minutes = 0) => focusStrength(mkP(age, minutes), 2026);
    expect(at(17)).toBe(1);
    expect(at(19)).toBe(1);
    expect(at(20)).toBeLessThan(at(19));
    expect(at(21)).toBeLessThan(at(20));
    expect(at(22)).toBeLessThan(at(21));
    expect(at(23)).toBeLessThan(at(22));
    expect(at(25)).toBeLessThanOrEqual(0.1);
    expect(at(27)).toBe(0);
    // And with the record: the same 18-year-old, once he has played a lot.
    expect(at(18, 4000)).toBeLessThan(at(18, 0));
    expect(at(18, 12000)).toBeLessThan(0.3);
    expect(at(18, 40000)).toBeLessThan(0.1);
  });

  it("no preference has no strength, and a faded focus has no tilt", () => {
    expect(focusStrength(mkP(18, 0, NO_FOCUS), 2026)).toBe(0);
    expect(focusStrength(mkP(18, 0, null), 2026)).toBe(0);
    expect(focusTilt(mkP(30, 0), 2026)).toBeUndefined();
    expect(focusTilt(mkP(18, 0), 2026)).toBeDefined();
  });

  it("tilts growth towards the focus a little, never exclusively", () => {
    const base = generatePlayer(Rng.fromSeed("tilt"), { id: "tilt", nationality: "ENG", position: "ST", age: 18, season: 2026, overall: 62, potential: 85, clubId: null });
    const run = (focus: string | undefined) => {
      const attrs = { ...base.attrs };
      const rng = Rng.fromSeed("tilt-growth");
      const tilt = focusTilt({ birthYear: 2008, position: "ST", focus, career: base.career }, 2026);
      for (let i = 0; i < 100; i++) applyGrowth(rng, attrs, "ST", 0.2, undefined, 0, [], tilt);
      return attrs;
    };
    const plain = run(undefined);
    const scorer = run("st_goalscorer");
    const gainPlain = plain.finishing - base.attrs.finishing;
    const gainScorer = scorer.finishing - base.attrs.finishing;
    expect(gainScorer).toBeGreaterThan(gainPlain * 1.05);
    expect(gainScorer).toBeLessThan(gainPlain * 1.8);
    // Everything else still grows.
    expect(scorer.pace).toBeGreaterThan(base.attrs.pace);
  });

  it("a faded focus leaves growth exactly as it would have been", () => {
    const base = generatePlayer(Rng.fromSeed("tilt2"), { id: "tilt2", nationality: "ENG", position: "ST", age: 30, season: 2026, overall: 70, potential: 72, clubId: null });
    const grow = (tilt: ReturnType<typeof focusTilt>) => {
      const attrs = { ...base.attrs };
      const rng = Rng.fromSeed("same");
      for (let i = 0; i < 50; i++) applyGrowth(rng, attrs, "ST", 0.1, undefined, 0, [], tilt);
      return attrs;
    };
    expect(grow(focusTilt({ birthYear: 1996, position: "ST", focus: "st_goalscorer", career: base.career }, 2026))).toEqual(grow(undefined));
  });
});

describe("a focus never grants, skips or overrides", () => {
  const scorer = () => {
    const s = newCareer({ seed: "focus-evidence", position: "ST", focus: "st_goalscorer" });
    return { s, u: userPlayer(s) };
  };

  it("a run of matches with no relevant action builds none of the traits the focus favours, however strong it is", () => {
    const { s, u } = scorer();
    for (let i = 0; i < 200; i++) recordMatchEvidence(s, u, line({ id: u.id }) as never, { importance: 1 } as never);
    const favoured = new Set(focusFor("ST", "st_goalscorer")?.traits);
    expect(groupTraits(u).style.filter((r) => favoured.has(r.def.id))).toHaveLength(0);
    for (const t of favoured) expect(u.traitProgress?.[t] ?? 0, t).toBeLessThan(1);
  });

  it("an aspiration lifts compatible evidence by a small, bounded amount", () => {
    const a = scorer();
    const b = { s: newCareer({ seed: "focus-evidence", position: "ST" }) };
    const ub = userPlayer(b.s);
    for (let i = 0; i < 6; i++) {
      recordMatchEvidence(a.s, a.u, line({ id: a.u.id, goals: 1, shots: 4, acts: { shotOpen: 3, goalOpen: 1 } }) as never, { importance: 1 } as never);
      recordMatchEvidence(b.s, ub, line({ id: ub.id, goals: 1, shots: 4, acts: { shotOpen: 3, goalOpen: 1 } }) as never, { importance: 1 } as never);
    }
    const key = Object.keys(a.u.traitProgress ?? {}).find((k) => a.u.focus && focusFor("ST", a.u.focus)?.traits.includes(k));
    expect(key, "some compatible trait is building").toBeDefined();
    const withFocus = a.u.traitProgress?.[key as string] ?? 0;
    const without = ub.traitProgress?.[key as string] ?? 0;
    expect(withFocus).toBeGreaterThan(without);
    expect(withFocus).toBeLessThanOrEqual(without * 1.3);
  });

  it("attribute requirements still apply: a Goalscorer who cannot finish is never a candidate for finishing traits", () => {
    const { s, u } = scorer();
    u.attrs = { ...u.attrs, finishing: 30, composure: 30, positioning: 30 };
    const ids = candidateTraits({ position: u.position, secondary: u.secondary, attrs: u.attrs, traits: u.traits }).map((c) => c.def.id);
    for (const t of ["poacher", "clinical_finisher", "box_predator"]) expect(ids, t).not.toContain(t);
    for (let i = 0; i < 120; i++) recordMatchEvidence(s, u, line({ id: u.id, goals: 2, shots: 6, acts: { shotOpen: 5, goalOpen: 2 } }) as never, { importance: 1 } as never);
    const owned = (u.traits ?? []).map((t) => t.id);
    for (const t of ["poacher", "clinical_finisher", "box_predator"]) expect(owned, t).not.toContain(t);
  });

  it("sample-size rules still apply to record-based traits", () => {
    const { s, u } = scorer();
    // A hot streak of two matches is not a record: nothing is awarded, whatever the aspiration.
    recordMatchEvidence(s, u, line({ id: u.id, goals: 4, shots: 8, acts: { shotOpen: 6, goalOpen: 4 } }) as never, { importance: 3 } as never);
    recordMatchEvidence(s, u, line({ id: u.id, goals: 3, shots: 7, acts: { shotOpen: 6, goalOpen: 3 } }) as never, { importance: 3 } as never);
    expect(groupTraits(u).style.length).toBe(0);
  });

  it("a Goalscorer whose career says playmaker becomes a playmaker, not a Poacher", () => {
    const { s, u } = scorer();
    u.attrs = { ...u.attrs, finishing: 62, positioning: 60, offBall: 60, passing: 80, vision: 82, creativity: 78, technique: 76, decisions: 74, firstTouch: 76, dribbling: 72, composure: 72 };
    for (let i = 0; i < 160; i++) {
      recordMatchEvidence(s, u, line({ id: u.id, goals: 0, assists: 1, keyPasses: 4, shots: 1, acts: { chanceThrough: 3, chanceOpen: 2 } }) as never, { importance: 1 } as never);
    }
    const owned = groupTraits(u).style.map((r) => r.def.id);
    expect(owned.length).toBeGreaterThan(0);
    const favoured = new Set(focusFor("ST", "st_goalscorer")?.traits);
    // What the career produced is unrelated to what he set out to be…
    expect(owned.some((id) => !favoured.has(id)), owned.join(",")).toBe(true);
    for (const t of ["poacher", "box_predator", "clinical_finisher", "first_time_finisher"]) expect(owned, t).not.toContain(t);
    expect(focusReading(u, s.season).verdict).toMatch(/diverged|mixed/);
  });
});

describe("NPCs", () => {
  it("are generated with an aspiration that fits the position, deterministically, and old players have none stored", () => {
    const s = newCareer({ seed: "focus-npc", position: "CM" });
    const npcs = Object.values(s.players).filter((p) => !p.isUser && !p.virtual);
    const young = npcs.filter((p) => s.season - p.birthYear <= 26);
    const withFocus = young.filter((p) => p.focus);
    expect(withFocus.length / young.length).toBeGreaterThan(0.6);
    expect(withFocus.length / young.length).toBeLessThan(0.95);
    for (const p of npcs) {
      if (p.focus) expect(isValidFocus(p.position, p.focus), `${p.id} ${p.position} ${p.focus}`).toBe(true);
      expect(p.focus).not.toBe(NO_FOCUS);
    }
    for (const p of npcs.filter((x) => s.season - x.birthYear > 26)) expect(p.focus).toBeUndefined();
    const again = newCareer({ seed: "focus-npc", position: "CM" });
    expect(Object.fromEntries(Object.values(again.players).map((p) => [p.id, p.focus]))).toEqual(Object.fromEntries(Object.values(s.players).map((p) => [p.id, p.focus])));
    // Not one big pile: a position's players spread over its options.
    const strikers = withFocus.filter((p) => p.position === "ST");
    expect(new Set(strikers.map((p) => p.focus)).size).toBeGreaterThanOrEqual(3);
  });

  it("an NPC leans towards the option his attributes already favour, and npcFocus is a pure function", () => {
    const p = generatePlayer(Rng.fromSeed("npc-lean"), { id: "npc-lean", nationality: "ENG", position: "ST", age: 19, season: 2026, overall: 66, potential: 78, clubId: null });
    expect(npcFocus(p, 2026)).toBe(npcFocus(p, 2026));
    expect(npcFocus({ ...p, birthYear: 1990 }, 2026)).toBeUndefined();
    let tallA = 0;
    for (let i = 0; i < 200; i++) {
      const q = generatePlayer(Rng.fromSeed(`npc-t-${i}`), { id: `npc-t-${i}`, nationality: "ENG", position: "ST", age: 19, season: 2026, overall: 66, potential: 78, clubId: null });
      q.attrs = { ...q.attrs, heading: 88, strength: 86, pace: 55, acceleration: 55 };
      if (npcFocus(q, 2026) === "st_target") tallA++;
    }
    expect(tallA).toBeGreaterThan(200 * 0.25);
  });
});

describe("training", () => {
  it("recommends real work for the position and never trains anything by itself", () => {
    for (const pos of POSITIONS) {
      for (const o of focusOptions(pos).filter((x) => x.id !== NO_FOCUS)) {
        for (const tf of o.training) {
          expect(Object.keys(TRAINING_FOCUS), `${o.id} → ${tf}`).toContain(tf);
          // The Training page hides finishing for keepers and goalkeeping for everyone else.
          if (pos === "GK") expect(tf, o.id).not.toBe("finishing");
          else expect(tf, o.id).not.toBe("goalkeeping");
        }
      }
    }
    const a = newCareer({ seed: "focus-train", position: "ST", focus: "st_goalscorer" });
    expect(focusOf(userPlayer(a)).training).toContain("finishing");
    expect(a.user.training.focus).toBe("balanced");
    // Choosing a focus does not change what a week of training does.
    const b = newCareer({ seed: "focus-train", position: "ST" });
    const pa = userPlayer(a);
    const pb = userPlayer(b);
    pb.attrs = { ...pa.attrs };
    runTraining(a, Rng.fromSeed("t"), pa, { focus: "finishing", intensity: "normal" });
    runTraining(b, Rng.fromSeed("t"), pb, { focus: "finishing", intensity: "normal" });
    expect(pa.attrs).toEqual(pb.attrs);
  });
});

describe("persistence", () => {
  it("survives save, encode and load, and is kept when the season rolls over", () => {
    const s = newCareer({ seed: "focus-save", position: "AM", focus: "am_creator" });
    const back = decodeState(JSON.parse(JSON.stringify(encodeState(s))));
    expect(userPlayer(back).focus).toBe("am_creator");
    expect(norm(back.players)).toEqual(norm(s.players));
    const loaded = migrateState(JSON.parse(JSON.stringify(s)));
    expect(userPlayer(loaded).focus).toBe("am_creator");
    for (let i = 0; i < 60; i++) advanceTurn(s);
    expect(userPlayer(s).focus).toBe("am_creator");
  });

  it("an old save loads with no preference, and nothing else about the player changes", () => {
    const s = newCareer({ seed: "focus-old", position: "ST", focus: "st_target" });
    const old = JSON.parse(JSON.stringify(s));
    old.schemaVersion = 13;
    for (const p of Object.values(old.players) as Player[]) delete p.focus;
    const traitsBefore = Object.fromEntries(Object.values(old.players as Record<string, Player>).map((p) => [p.id, JSON.stringify(p.traits ?? null)]));
    const m = migrateState(old);
    expect(m.schemaVersion).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(14);
    expect(userPlayer(m).focus).toBe(NO_FOCUS);
    for (const p of Object.values(m.players)) {
      if (!p.isUser) expect(p.focus).toBeUndefined();
      // Loading may tidy the order of a player's traits (strongest first); it never adds, removes or changes one.
      const key = (v: unknown) => JSON.stringify([...((v as { id: string }[]) ?? [])].map((x) => JSON.stringify(x)).sort());
      expect(key(p.traits)).toBe(key(JSON.parse(traitsBefore[p.id])));
    }
    // And again: loading twice changes nothing.
    expect(norm(migrateState(JSON.parse(JSON.stringify(m))).players)).toEqual(norm(m.players));
  });

  it("repairs an impossible focus on load", () => {
    const s = newCareer({ seed: "focus-bad", position: "ST", focus: "st_target" });
    const u = userPlayer(s);
    u.focus = "gk_sweeper";
    const npc = Object.values(s.players).find((p) => !p.isUser && !p.virtual && p.position === "CB")!;
    npc.focus = "st_goalscorer";
    const npc2 = Object.values(s.players).find((p) => !p.isUser && !p.virtual && p.position === "CM" && p.id !== npc.id)!;
    npc2.focus = NO_FOCUS;
    sanitizeTraits(s);
    expect(u.focus).toBe(NO_FOCUS);
    expect(npc.focus).toBeUndefined();
    expect(npc2.focus).toBeUndefined();
  });
});

describe("what the player sees", () => {
  it("compares the aspiration with the record", () => {
    const s = newCareer({ seed: "focus-read", position: "ST", focus: "st_goalscorer" });
    const u = userPlayer(s);
    u.traits = [];
    expect(focusReading(u, s.season).verdict).toBe("early");
    expect(focusReading(u, s.season).influence).toBe("shaping");
    u.traits = [{ id: "poacher", xp: 90, since: 2026 }, { id: "box_predator", xp: 40, since: 2026 }];
    expect(focusReading(u, s.season).verdict).toBe("aligned");
    u.traits = [{ id: "poacher", xp: 90, since: 2026 }, { id: "false_nine", xp: 90, since: 2026 }, { id: "creative", xp: 90, since: 2026 }];
    expect(focusReading(u, s.season).verdict).toBe("mixed");
    u.traits = [{ id: "false_nine", xp: 90, since: 2026 }, { id: "creative", xp: 90, since: 2026 }];
    expect(focusReading(u, s.season).verdict).toBe("diverged");
    const open = newCareer({ seed: "focus-read", position: "ST" });
    expect(focusReading(userPlayer(open), open.season).verdict).toBe("open");
    u.birthYear = 1995;
    expect(focusReading(u, s.season).influence).toBe("settled");
  });
});
