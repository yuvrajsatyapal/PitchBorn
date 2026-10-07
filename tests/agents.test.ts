import { describe, expect, it } from "vitest";
import { agentMarket, agentWeeklyFee, canHireAgent, chargeCommission, hireAgent, NO_AGENT, payAgent, releaseAgent } from "../src/engine/career/agents";
import { advanceTurn } from "../src/engine/season/advance";
import { migrateState } from "../src/persistence/migrations";
import { userPlayer } from "../src/engine/world/helpers";
import { newCareer } from "./helpers";

describe("agent market", () => {
  it("is deterministic per career and fees rise with rating", () => {
    const a = agentMarket(newCareer({ seed: "ag-1" }));
    const b = agentMarket(newCareer({ seed: "ag-1" }));
    expect(a.map((x) => x.name)).toEqual(b.map((x) => x.name));
    expect(a.length).toBeGreaterThanOrEqual(12);
    const sorted = [...a].sort((x, y) => x.rating - y.rating);
    expect(sorted[0].weeklyFee).toBeLessThan(sorted[sorted.length - 1].weeklyFee);
    expect(sorted[sorted.length - 1].tier).toBe("super");
    expect(agentWeeklyFee(40, 0.03)).toBeGreaterThan(agentWeeklyFee(40, 0.08));
  });

  it("every agent has a specialty and a weaker side", () => {
    for (const a of agentMarket(newCareer({ seed: "ag-2" }))) {
      const v = Object.values(a.skills);
      expect(Math.max(...v) - Math.min(...v)).toBeGreaterThanOrEqual(8);
    }
  });

  it("a new career starts with the most modest agent and a small bank", () => {
    const s = newCareer({ seed: "ag-3" });
    expect(s.user.agent.id).toBe(agentMarket(s)[0].id);
    expect(s.user.bank).toBeGreaterThan(0);
  });
});

describe("hiring and paying", () => {
  it("top agents demand reputation, money and a once-a-season change", () => {
    const s = newCareer({ seed: "ag-4" });
    const p = userPlayer(s);
    const top = agentMarket(s).find((a) => a.tier === "top")!;
    p.reputation = 10;
    s.user.bank = 10_000_000;
    expect(canHireAgent(s, top).ok).toBe(false);
    p.reputation = 80;
    expect(canHireAgent(s, top).ok).toBe(true);
    s.user.bank = 100;
    expect(canHireAgent(s, top).ok).toBe(false);
    s.user.bank = 10_000_000;
    expect(hireAgent(s, top.id).ok).toBe(true);
    const next = agentMarket(s).find((a) => a.tier === "established")!;
    expect(canHireAgent(s, next).reason).toMatch(/once a season/);
  });

  it("charges the weekly fee and drops an agent after four unpaid weeks", () => {
    const s = newCareer({ seed: "ag-5" });
    const fee = s.user.agent.weeklyFee;
    s.user.bank = fee * 3;
    payAgent(s);
    expect(s.user.bank).toBe(fee * 2);
    s.user.bank = 0;
    for (let i = 0; i < 3; i++) payAgent(s);
    expect(s.user.agent.id).not.toBe("none");
    payAgent(s);
    expect(s.user.agent.id).toBe("none");
    expect(s.user.agent).toMatchObject({ weeklyFee: NO_AGENT.weeklyFee });
  });

  it("takes commission on new contracts but not from yourself", () => {
    const s = newCareer({ seed: "ag-6" });
    s.user.bank = 1_000_000;
    const paid = chargeCommission(s, 10_000, 100_000);
    expect(paid).toBeCloseTo(s.user.agent.commission * (100_000 + 520_000), -2);
    releaseAgent(s);
    s.user.bank = 1_000_000;
    expect(chargeCommission(s, 10_000, 100_000)).toBe(0);
  });

  it("weekly play moves money: wages in, fees out", () => {
    const s = newCareer({ seed: "ag-7" });
    const before = s.user.bank;
    const wage = userPlayer(s).contract!.wage;
    advanceTurn(s);
    expect(s.user.bank).toBe(before + wage - s.user.agent.weeklyFee);
    expect(s.user.earnings).toBeGreaterThanOrEqual(wage);
  });
});

describe("agent effects", () => {
  it("a stronger negotiator gets bigger signing bonuses and more offers than none", () => {
    const best = [...agentMarket(newCareer({ seed: "ag-8" }))].sort((x, y) => y.skills.negotiation - x.skills.negotiation)[0];
    expect(best.skills.negotiation).toBeGreaterThan(NO_AGENT.skills.negotiation + 20);
    expect(best.skills.connections).toBeGreaterThan(NO_AGENT.skills.connections);
  });
});

describe("save migration", () => {
  it("v2 saves get a priced agent and a bank balance", () => {
    const s = newCareer({ seed: "ag-9" }) as unknown as Record<string, unknown> & { user: Record<string, unknown> };
    s.schemaVersion = 2;
    s.user.agent = { name: "Old Agent", quality: 55 };
    delete s.user.bank;
    s.user.earnings = 250_000;
    const m = migrateState(s as never);
    expect(m.user.agent.name).toBe("Old Agent");
    expect(m.user.agent.weeklyFee).toBeGreaterThan(0);
    expect(m.user.bank).toBe(250_000);
    expect(m.schemaVersion).toBe(3);
  });
});
