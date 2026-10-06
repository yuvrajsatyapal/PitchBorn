import { describe, expect, it } from "vitest";
import { roundRobin } from "../src/engine/competitions/fixtures";
import { applyResult, buildTable, emptyRow, sortTable } from "../src/engine/competitions/table";
import { roundTurns } from "../src/engine/calendar";
import { Rng } from "../src/engine/rng";
import type { Fixture } from "../src/engine/types";

describe("fixtures and tables", () => {
  it("double round-robin: everyone plays everyone home and away once", () => {
    const teams = Array.from({ length: 20 }, (_, i) => `t${i}`);
    const rounds = roundRobin(teams, Rng.fromSeed("rr"));
    expect(rounds.length).toBe(38);
    const pairs = new Set<string>();
    for (const r of rounds) {
      const playing = new Set<string>();
      for (const [h, a] of r) {
        expect(playing.has(h) || playing.has(a)).toBe(false);
        playing.add(h);
        playing.add(a);
        pairs.add(`${h}>${a}`);
      }
      expect(r.length).toBe(10);
    }
    expect(pairs.size).toBe(380);
  });
  it("handles odd team counts", () => {
    const rounds = roundRobin(["a", "b", "c", "d", "e"], Rng.fromSeed(1));
    expect(rounds.flat().length).toBe(20);
  });
  it("awards points correctly and sorts by points, GD, GF", () => {
    const mk = (home: string, away: string, hg: number, ag: number): Fixture => ({ id: `${home}${away}`, compId: "c", round: 1, turn: 4, home, away, result: { hg, ag, goals: [] } });
    const t = buildTable(["a", "b", "c"], [mk("a", "b", 2, 0), mk("b", "c", 1, 1), mk("c", "a", 3, 1)]);
    const pts = Object.fromEntries(t.map((r) => [r.team, r.points]));
    expect(pts).toEqual({ a: 3, b: 1, c: 4 });
    expect(t.map((r) => r.team)).toEqual(["c", "a", "b"]);
    const total = t.reduce((s, r) => s + r.points, 0);
    expect(total).toBe(3 + 2 + 3);
    for (const r of t) expect(r.won + r.drawn + r.lost).toBe(r.played);
  });
  it("tie-breaks deterministically", () => {
    const table = [emptyRow("z"), emptyRow("y")];
    applyResult(table, { id: "1", compId: "c", round: 1, turn: 4, home: "z", away: "y", result: { hg: 1, ag: 1, goals: [] } });
    expect(sortTable(table).map((r) => r.team)).toEqual(["y", "z"]);
  });
  it("fits long seasons into the calendar with midweek rounds", () => {
    const turns = roundTurns(46);
    expect(turns.length).toBe(46);
    for (let i = 1; i < turns.length; i++) expect(turns[i]).toBeGreaterThanOrEqual(turns[i - 1]);
    expect(Math.max(...turns)).toBeLessThanOrEqual(43);
  });
});
