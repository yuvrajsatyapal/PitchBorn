import { describe, expect, it } from "vitest";
import { autopilotStep } from "../src/engine/career/autopilot";
import { Factors } from "../src/engine/memory/score";
import { currentVault, recallText } from "../src/engine/memory/recall";
import { refreshRecall } from "../src/engine/memory/recall";
import { recordMemory } from "../src/engine/memory/store";
import { Rng } from "../src/engine/rng";
import { advanceTurn } from "../src/engine/season/advance";
import type { GameState, Memory, MemoryKind } from "../src/engine/types";
import { userPlayer } from "../src/engine/world/helpers";
import { newCareer } from "./helpers";

function addMemory(s: GameState, kind: MemoryKind, over: Partial<Memory> & { importance?: number } = {}): Memory {
  const m = recordMemory(s, { kind, tags: [], factors: new Factors().add("x", 80), raw: true, key: `t-${Math.random()}`, keepAlways: true, ...over } as never)!;
  Object.assign(m, over);
  return m;
}

describe("anniversaries", () => {
  it("brings back a big memory on a round-number anniversary, in the news and the vault", () => {
    const s = newCareer({ seed: "rec-1" });
    const m = addMemory(s, "derby-winner", { season: s.season - 5, turn: s.turn, importance: 85, opponentId: "eng-reading" });
    refreshRecall(s);
    const v = currentVault(s)!;
    expect(v.reason).toBe("anniversary");
    expect(v.memoryId).toBe(m.id);
    const t = recallText(s, v);
    expect(t.headline).toBe("Five years since that derby winner");
    expect(s.news.some((n) => n.kind === "memory" && n.memoryId === m.id)).toBe(true);
  });

  it("ignores small memories and odd anniversaries", () => {
    const s = newCareer({ seed: "rec-2" });
    addMemory(s, "winner-goal", { season: s.season - 5, turn: s.turn, importance: 41 });
    addMemory(s, "hat-trick", { season: s.season - 4, turn: s.turn, importance: 90 });
    refreshRecall(s);
    expect(currentVault(s)).toBeUndefined();
  });

  it("does not repeat the same memory within a year or flood the feed", () => {
    const s = newCareer({ seed: "rec-3" });
    const m = addMemory(s, "hat-trick", { season: s.season - 5, turn: s.turn, importance: 90 });
    addMemory(s, "late-winner", { season: s.season - 10, turn: s.turn + 1, importance: 88 });
    refreshRecall(s);
    const firstNews = s.news.filter((n) => n.kind === "memory").length;
    s.turnIndex += 1;
    s.turn += 1;
    refreshRecall(s); // second anniversary a week later: too soon
    expect(s.news.filter((n) => n.kind === "memory").length).toBe(firstNews);
    expect(currentVault(s)).toBeUndefined();
    s.turnIndex += 20;
    refreshRecall(s);
    expect(m.recall?.shown).toBe(1);
  });
});

describe("match context", () => {
  it("recalls a former club when you face it", () => {
    const s = newCareer({ seed: "rec-4" });
    for (let i = 0; i < 12 && !s.pending.length; i++) advanceTurn(s);
    expect(s.pending.length).toBeGreaterThan(0);
    const fx = Object.values(s.competitions).flatMap((c) => c.fixtures).find((f) => f.id === s.pending[0].fixtureId)!;
    const me = userPlayer(s).clubId!;
    const opp = fx.home === me ? fx.away : fx.home;
    const m = addMemory(s, "trophy", { clubId: opp, season: s.season - 3, importance: 80, compName: "League Cup" });
    s.user.startClubId = opp;
    userPlayer(s).history.push({ season: s.season - 3, clubId: opp, age: 20, overall: 70, stats: { apps: 30 } } as never);
    refreshRecall(s);
    const v = currentVault(s)!;
    expect(["former-club", "origin", "opponent-history"]).toContain(v.reason);
    expect(v.fixtureId).toBe(fx.id);
    expect(recallText(s, v).headline).toMatch(/Back against|History with|Facing/);
    expect(m.recall?.shown).toBe(1);
  });
});

describe("restraint over a whole career", () => {
  it("surfaces memories rarely across 8 seasons of play", () => {
    const s = newCareer({ seed: "rec-5", clubId: "eng-ipswich-town" });
    const p = userPlayer(s);
    for (const k in p.attrs) p.attrs[k as keyof typeof p.attrs] = Math.max(p.attrs[k as keyof typeof p.attrs], 80);
    const rng = Rng.fromSeed("rec-5-run");
    const turns = 50 * 8;
    let vaultWeeks = 0;
    for (let i = 0; i < turns && !s.user.retired; i++) {
      autopilotStep(s, rng);
      advanceTurn(s);
      if (currentVault(s)) vaultWeeks++;
    }
    const memoryNews = s.news.filter((n) => n.kind === "memory").length;
    expect(s.user.memories.length).toBeGreaterThan(5);
    expect(vaultWeeks).toBeLessThanOrEqual(turns * 0.2);
    expect(memoryNews).toBeLessThanOrEqual(8 * 4);
  });
});
