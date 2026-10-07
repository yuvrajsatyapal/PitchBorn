import { describe, expect, it } from "vitest";
import { Rng } from "../src/engine/rng";
import { hireManager, managerPool, releaseManager } from "../src/engine/world/managers";
import { newCareer } from "./helpers";

describe("manager market", () => {
  it("seeds the pool with real free agents who are not already employed", () => {
    const s = newCareer({ countries: ["ENG"] });
    const names = managerPool(s).map((m) => m.name);
    expect(names).toContain("Pep Guardiola");
    expect(names).not.toContain("Graham Potter"); // coaching Sweden in the snapshot
  });

  it("clubs hire coaches of similar standing and sacked managers become available", () => {
    const s = newCareer({ countries: ["ENG"] });
    const rng = Rng.fromSeed("hire");
    const small = Object.values(s.clubs).sort((a, b) => a.reputation - b.reputation)[0];
    for (let i = 0; i < 20; i++) expect(hireManager(s, rng, small, "ENG").quality).toBeLessThanOrEqual(small.reputation + 8 + 30);
    expect(managerPool(s).some((m) => m.name === "Pep Guardiola")).toBe(true);
    const big = Object.values(s.clubs).sort((a, b) => b.reputation - a.reputation)[0];
    const old = big.manager;
    releaseManager(s, old);
    expect(managerPool(s).some((m) => m.name === old.name)).toBe(true);
  });
});
