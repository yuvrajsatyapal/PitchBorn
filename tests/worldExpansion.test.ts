import { describe, expect, it } from "vitest";
import { continentalQualifiers, CONTINENTAL_SLOTS } from "../src/engine/competitions/setup";
import { continentalSlots } from "../src/engine/club/standing";
import { LEAGUE_COUNTRIES, WORLD, leaguesInPlay, staticLeague } from "../src/engine/data/world";
import { pinWorldCountries } from "../src/persistence/migrations";
import { newCareer } from "./helpers";

describe("eleven-country world", () => {
  it("has the new leagues, closed systems and cups", () => {
    for (const cc of ["POR", "NED", "BRA", "ARG", "USA", "MEX"]) expect(LEAGUE_COUNTRIES).toContain(cc);
    expect(staticLeague("usa-1")?.relegated).toBe(0);
    expect(staticLeague("usa-2")?.promoted).toBe(0);
    expect(staticLeague("mex-1")?.relegated).toBe(0);
    expect(staticLeague("bra-1")?.relegated).toBe(3);
    for (const cc of LEAGUE_COUNTRIES) expect(CONTINENTAL_SLOTS[cc]).toBeTruthy();
    expect(WORLD.clubs.some((c) => c.name === "Boca Juniors" && c.leagueId === "arg-1")).toBe(true);
  });

  it("an old save without stored countries is pinned to the leagues it has clubs for", () => {
    const s = newCareer({ countries: ["ENG", "ESP"] });
    s.settings.countries = undefined;
    pinWorldCountries(s);
    expect([...((s.settings as { countries?: string[] }).countries ?? [])].sort()).toEqual(["ENG", "ESP"]);
    expect(leaguesInPlay(s).every((l) => ["ENG", "ESP"].includes(l.countryCode))).toBe(true);
  });

  it("an Americas world fills the Americas Cup and no European cup", () => {
    const s = newCareer({ countries: ["BRA", "ARG", "MEX", "USA"], clubId: WORLD.clubs.find((c) => c.leagueId === "bra-1")!.id, nationality: "BRA", birthCountry: "BRA" });
    const q = continentalQualifiers(s);
    expect(q.americas).toHaveLength(16);
    expect(q.champions).toHaveLength(0);
    expect(Object.values(s.competitions).some((c) => c.id.startsWith("acup-"))).toBe(true);
    expect(continentalSlots("BRA", 1).champions).toBe(5);
  });
});
