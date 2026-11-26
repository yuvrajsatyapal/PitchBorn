import { describe, expect, it } from "vitest";
import { clinicCost, onUserInjury, recoveryRiskFactor, resolveRecovery } from "../src/engine/career/recovery";
import { resolveDecision } from "../src/engine/career/events";
import type { Injury } from "../src/engine/types";
import { newCareer } from "./helpers";

const hurt = (s: ReturnType<typeof newCareer>, inj: Injury) => {
  const p = s.players[s.user.playerId];
  p.injury = { ...inj };
  onUserInjury(s, p.injury);
  return p;
};
const moderate: Injury = { type: "Torn hamstring", area: "hamstring", severity: "moderate", weeksLeft: 6, totalWeeks: 6 };
const serious: Injury = { type: "Knee ligament damage", area: "knee", severity: "serious", weeksLeft: 12, totalWeeks: 12 };

describe("injury and recovery choices", () => {
  it("asks how to handle a moderate injury and rushing shortens it but raises the risk", () => {
    const s = newCareer();
    const p = hurt(s, moderate);
    const d = s.user.decisions.find((x) => x.handler === "recovery");
    expect(d?.options.map((o) => o.id)).toEqual(["rush", "plan", "rest", "clinic"]);
    resolveDecision(s, d!.id, "rush");
    expect(p.injury!.weeksLeft).toBeLessThan(6);
    s.turnIndex += p.injury!.weeksLeft + 1;
    expect(recoveryRiskFactor(s)).toBeGreaterThan(2);
  });

  it("offers surgery for serious injuries and the clinic only charges when affordable", () => {
    const s = newCareer();
    s.user.bank = 0;
    const p = hurt(s, serious);
    const d = s.user.decisions.find((x) => x.handler === "recovery")!;
    expect(d.options.map((o) => o.id)).toContain("surgery");
    const before = p.injury!.weeksLeft;
    const out = resolveRecovery(s, d, "clinic");
    expect(s.user.bank).toBe(0);
    expect(out.msg).toMatch(/Surgery/);
    expect(p.injury!.weeksLeft).toBeGreaterThan(before);
    s.user.bank = clinicCost(s) * 2;
    p.injury = { ...serious };
    resolveRecovery(s, d, "clinic");
    expect(s.user.bank).toBe(clinicCost(s));
    expect(p.injury!.weeksLeft).toBeLessThan(12);
  });

  it("repeat injuries to one area raise the risk, and a third severe one late on can end the career", () => {
    const s = newCareer();
    const p = s.players[s.user.playerId];
    p.birthYear = s.season - 33;
    const severe: Injury = { type: "Ruptured ACL", area: "knee", severity: "severe", weeksLeft: 30, totalWeeks: 30 };
    s.user.recovery = { areas: { knee: 2 }, clinics: 0, clinicSpent: 0 };
    let threatened = false;
    for (let i = 0; i < 12 && !threatened; i++) {
      s.turnIndex = i;
      s.user.decisions = [];
      s.user.recovery.areas.knee = 2;
      hurt(s, severe);
      threatened = s.user.decisions.some((d) => d.options.some((o) => o.id === "retire"));
    }
    expect(threatened).toBe(true);
    expect(recoveryRiskFactor(s)).toBeGreaterThan(1.3);
    const d = s.user.decisions.find((x) => x.handler === "recovery")!;
    resolveDecision(s, d.id, "retire");
    expect(s.user.retireRequested).toBeTruthy();
  });

  it("knocks and minor injuries never ask", () => {
    const s = newCareer();
    hurt(s, { type: "Dead leg", area: "thigh", severity: "knock", weeksLeft: 1, totalWeeks: 1 });
    expect(s.user.decisions.some((d) => d.handler === "recovery")).toBe(false);
    expect(s.user.recovery?.areas.thigh).toBe(1);
  });
});
