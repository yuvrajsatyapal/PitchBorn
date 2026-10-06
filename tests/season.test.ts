import { beforeAll, describe, expect, it } from "vitest";
import { BALANCE } from "../src/engine/balance";
import { advanceTurn, simUserMatch } from "../src/engine/season/advance";
import { checkInvariants } from "../src/engine/validate";
import type { GameState } from "../src/engine/types";
import { newCareer } from "./helpers";

describe("season simulation (single-country world)", () => {
  let s: GameState;
  let afterSeason: GameState;
  beforeAll(() => {
    s = newCareer({ seed: "season-test" });
    // Snapshot invariants and capture state at season end.
    for (let i = 0; i < BALANCE.calendar.endOfSeasonTurn; i++) advanceTurn(s);
    afterSeason = s;
  });

  it("completes every league fixture by season end", () => {
    for (const c of Object.values(afterSeason.competitions)) {
      if (c.kind !== "league") continue;
      expect(c.fixtures.every((f) => f.result)).toBe(true);
      const n = c.teams.length;
      expect(c.fixtures.length).toBe(n * (n - 1));
      for (const r of c.table ?? []) expect(r.played).toBe((n - 1) * 2);
      const points = (c.table ?? []).reduce((sum, r) => sum + r.points, 0);
      const draws = c.fixtures.filter((f) => f.result!.hg === f.result!.ag).length;
      expect(points).toBe(c.fixtures.length * 3 - draws);
    }
  });

  it("keeps squads, contracts and fixtures consistent", () => {
    const inv = checkInvariants(afterSeason);
    expect(inv.issues).toEqual([]);
  });

  it("reconciles player stats with match events", () => {
    const comp = Object.values(afterSeason.competitions).find((c) => c.kind === "league" && c.tier === 1)!;
    const goalsByPlayer = new Map<string, number>();
    for (const f of comp.fixtures) for (const g of f.result!.goals) goalsByPlayer.set(g.scorer, (goalsByPlayer.get(g.scorer) ?? 0) + 1);
    for (const [pid, g] of goalsByPlayer) {
      const p = afterSeason.players[pid];
      if (p) expect(p.season[comp.id]?.goals ?? 0).toBe(g);
    }
  });

  it("completes cups with a single winner", () => {
    const cup = Object.values(afterSeason.competitions).find((c) => c.kind === "cup")!;
    expect(cup.complete).toBe(true);
    expect(cup.winner).toBeTruthy();
  });

  it("transitions to a new season with promotion and relegation", () => {
    const top = Object.values(s.competitions).find((c) => c.kind === "league" && c.tier === 1)!;
    const relegated = top.table!.slice(-3).map((r) => r.team);
    const startSeason = s.season;
    while (s.season === startSeason) advanceTurn(s);
    expect(s.turn).toBe(1);
    for (const id of relegated) expect(s.clubs[id].leagueId).not.toBe(top.id.replace(`-${startSeason}`, ""));
    expect(s.archive.length).toBe(1);
    expect(checkInvariants(s).issues).toEqual([]);
    for (const p of Object.values(s.players)) expect(Object.keys(p.season).length).toBe(0);
    // New season fixtures exist
    expect(Object.values(s.competitions).some((c) => c.kind === "league" && c.season === s.season && c.fixtures.length > 0)).toBe(true);
  });
});

describe("determinism", () => {
  it("same seed and inputs reproduce the same world", () => {
    const a = newCareer({ seed: "det" });
    const b = newCareer({ seed: "det" });
    for (let i = 0; i < 12; i++) {
      advanceTurn(a);
      advanceTurn(b);
    }
    expect(JSON.stringify(a.competitions)).toBe(JSON.stringify(b.competitions));
    expect(a.rng).toEqual(b.rng);
  });
});

describe("user matches", () => {
  it("blocks on pending user fixtures and resolves them via sim", () => {
    const s = newCareer({ seed: "pending", path: "late" });
    let found = false;
    for (let i = 0; i < 20 && !found; i++) {
      if (s.pending.length) {
        found = true;
        const id = s.pending[0].fixtureId;
        const res = simUserMatch(s, id);
        expect(res).not.toBeNull();
        expect(s.pending.find((p) => p.fixtureId === id)).toBeUndefined();
      } else advanceTurn(s);
    }
    expect(found).toBe(true);
  });
});
