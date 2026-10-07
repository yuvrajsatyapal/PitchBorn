import { describe, expect, it } from "vitest";
import { DatasetSchema, validateDataset } from "../src/engine/data/schema";
import { WORLD } from "../src/engine/data/world";
import { cleanManagerName } from "../scripts/data/lib/managers";
import { newCareer } from "./helpers";

describe("bundled football dataset", () => {
  it("matches the schema and passes cross-reference validation", () => {
    expect(DatasetSchema.safeParse(WORLD).success).toBe(true);
    expect(validateDataset(WORLD).filter((i) => i.level === "error")).toEqual([]);
  });
  it("covers the five core countries with three tiers each", () => {
    for (const cc of ["ENG", "ESP", "GER", "ITA", "FRA"]) {
      expect(WORLD.leagues.filter((l) => l.countryCode === cc).map((l) => l.tier).sort()).toEqual([1, 2, 3]);
    }
  });
  it("has unique club ids and records provenance for every club", () => {
    const ids = WORLD.clubs.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of WORLD.clubs) expect(c.sources.length).toBeGreaterThan(0);
    for (const s of WORLD.sources) expect(s.license.length).toBeGreaterThan(0);
  });
  it("detects broken references", () => {
    const broken = { ...WORLD, clubs: [{ ...WORLD.clubs[0], stadiumId: "nope" }, ...WORLD.clubs.slice(1)] };
    expect(validateDataset(broken).some((i) => i.message.includes("missing stadium"))).toBe(true);
  });
});

describe("real managers", () => {
  it("most clubs and national teams start with a real head coach", () => {
    const withMgr = WORLD.clubs.filter((c) => c.manager).length;
    expect(withMgr / WORLD.clubs.length).toBeGreaterThan(0.75);
    expect(WORLD.countries.filter((c) => c.manager).length).toBeGreaterThan(30);
    for (const c of [...WORLD.clubs, ...WORLD.countries]) if (c.manager) expect(cleanManagerName(undefined, c.manager.name)).toBe(c.manager.name);
  });

  it("rejects vacancies and vandalised labels", () => {
    expect(cleanManagerName("Veljko Paunović", "Veljko Paunovićhshsjs")).toBe("Veljko Paunović");
    expect(cleanManagerName(undefined, "Veljko Paunovićhshsjs")).toBeUndefined();
    expect(cleanManagerName(undefined, "position not filled")).toBeUndefined();
    expect(cleanManagerName("Xavi (footballer, born 1980)", "Xavi Hernández")).toBe("Xavi");
  });

  it("new worlds use them for clubs and national teams", () => {
    const s = newCareer({ countries: ["ENG"] });
    const real = WORLD.clubs.find((c) => c.manager && s.clubs[c.id]);
    expect(real && s.clubs[real.id].manager.name).toBe(real?.manager?.name);
    expect(s.nationalTeams.ENG.manager).toBe(WORLD.countries.find((c) => c.code === "ENG")?.manager?.name);
  });
});
