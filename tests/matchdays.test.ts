import { describe, expect, it } from "vitest";
import { advanceTurn, beginTurn } from "../src/engine/season/advance";
import type { GameState } from "../src/engine/types";
import { newCareer } from "./helpers";

function clashes(s: GameState): string[] {
  const seen = new Map<string, string>();
  const out: string[] = [];
  for (const comp of Object.values(s.competitions)) {
    if (comp.season !== s.season) continue;
    for (const f of comp.fixtures) {
      for (const team of [f.home, f.away]) {
        const key = `${team}:${f.turn}:${f.day}`;
        if (seen.has(key)) out.push(`${team} turn ${f.turn} day ${f.day}: ${seen.get(key)} and ${comp.id}`);
        seen.set(key, comp.id);
      }
    }
  }
  return out;
}

describe("match days", () => {
  it("never puts two games for one team on the same day", () => {
    const s = newCareer();
    expect(clashes(s)).toEqual([]);
    for (let i = 0; i < 49; i++) {
      beginTurn(s);
      advanceTurn(s);
      expect(clashes(s)).toEqual([]);
    }
  });
  it("plays doubled league rounds in round order", () => {
    const s = newCareer();
    for (const comp of Object.values(s.competitions)) {
      if (comp.kind !== "league") continue;
      const byTurn = new Map<number, typeof comp.fixtures>();
      for (const f of comp.fixtures) byTurn.set(f.turn, [...(byTurn.get(f.turn) ?? []), f]);
      for (const fs of byTurn.values()) {
        const days = new Map<number, number>();
        for (const f of fs) days.set(f.round, f.day ?? 0);
        const rounds = [...days.keys()].sort((a, b) => a - b);
        for (let i = 1; i < rounds.length; i++) expect(days.get(rounds[i])!).toBeGreaterThan(days.get(rounds[i - 1])!);
      }
    }
  });
});
