import { describe, expect, it } from "vitest";
import { MatchEngine, type MatchPlayerInput, type TeamInput } from "../src/engine/match/engine";
import { FORMATIONS } from "../src/engine/match/lineup";
import { momentNote } from "../src/engine/match/momentNotes";
import { generatePlayer } from "../src/engine/players/generate";
import { Rng } from "../src/engine/rng";
import type { MatchConditions } from "../src/engine/types";

const gen = Rng.fromSeed("mn-teams");
let n = 0;
function team(name: string, withUser: boolean): TeamInput {
  const mk = (slot: MatchPlayerInput["slot"], user = false): MatchPlayerInput => {
    const p = generatePlayer(gen, { id: user ? "USER" : `m${n++}`, nationality: "ENG", position: slot, age: 26, season: 2026, overall: 74, potential: 74, clubId: null });
    return { id: p.id, name: p.lastName, slot, attrs: p.attrs, fitness: 95, morale: 70, form: 6.6, sharpness: 80, bigMatch: 50, consistency: 55, isUser: user };
  };
  let placed = false;
  const starters = FORMATIONS["4-3-3"].map((slot) => (slot === "RW" && withUser && !placed ? ((placed = true), mk(slot, true)) : mk(slot)));
  return { id: name, name, short: name, starters, bench: [mk("GK")], mentality: 0, color: "#000" };
}

const rain: MatchConditions = { weather: "heavy-rain", pitch: "heavy", tempC: 8 } as MatchConditions;

/** Average odds of every option the user was offered, and the notes seen, across interactive matches. */
function play(conditions?: MatchConditions) {
  const H = team("H", true);
  const A = team("A", false);
  let sum = 0;
  let count = 0;
  const notes = new Set<string>();
  for (let i = 0; i < 12; i++) {
    const eng = new MatchEngine({ home: H, away: A, importance: 1, detail: true, interactive: true, conditions }, Rng.fromSeed(`mn-${i}`));
    while (!eng.finished) {
      if (eng.pending) {
        for (const o of eng.pending.options) {
          if (o.skills?.includes("Dribbling") || o.skills?.includes("First Touch")) {
            sum += o.odds;
            count++;
          }
          if (o.note) notes.add(o.note);
        }
        eng.resolve(eng.pending.options[0].id);
      } else eng.step();
    }
  }
  return { avg: count ? sum / count : 0, notes };
}

describe("open-play key moments and the weather", () => {
  it("notes say when the surface or the wind works against an option", () => {
    expect(momentNote(["Dribbling", "Agility"], rain, 20, 90)).toMatch(/heavy pitch/);
    expect(momentNote(["Crossing"], { weather: "wind", pitch: "good", tempC: 12 } as MatchConditions, 20, 90)).toMatch(/wind/);
    expect(momentNote(["Pace"], undefined, 80, 30)).toMatch(/tiring/);
    expect(momentNote(["Finishing"], undefined, 20, 90)).toBeUndefined();
  });

  it("a heavy, wet pitch lowers the odds of touch and dribbling moments and says so", () => {
    const dry = play();
    const wet = play(rain);
    expect(wet.avg).toBeLessThan(dry.avg);
    expect([...wet.notes].some((t) => /pitch|surface/.test(t))).toBe(true);
  });
});
