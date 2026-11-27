import { describe, expect, it } from "vitest";
import { continentalQualifiers, CONTINENTAL_SLOTS } from "../src/engine/competitions/setup";
import { continentalSlots } from "../src/engine/club/standing";
import { LEAGUE_COUNTRIES, WORLD, clubName, leaguesInPlay, stadium, staticClub, staticLeague } from "../src/engine/data/world";
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

  it("league members follow the 2025-26 seasons: full Eredivisie and Liga MX, a US-only MLS", () => {
    const members = (id: string) => WORLD.clubs.filter((c) => c.leagueId === id);
    expect(members("ned-1")).toHaveLength(18);
    expect(members("mex-1")).toHaveLength(18);
    expect(members("mex-1").some((c) => c.id === "mex-toluca")).toBe(true);
    for (const id of ["ned-heracles-almelo", "ned-nac-breda", "ned-volendam"]) expect(staticClub(id)?.leagueId).toBe("ned-1");
    expect(staticClub("ned-willem-ii")?.leagueId).toBe("ned-2");
    expect(members("usa-1").every((c) => c.countryCode === "USA")).toBe(true);
    expect(members("usa-1").some((c) => c.id === "usa-inter-miami")).toBe(true);
    expect(members("usa-1").some((c) => c.id === "usa-toronto" || c.id === "usa-vancouver-whitecaps")).toBe(false);
  });

  it("clubs that left the dataset stay readable for older saves but are never in a new world", () => {
    expect(clubName("usa-toronto")).toMatch(/^Toronto/);
    expect(stadium(staticClub("usa-vancouver-whitecaps")?.stadiumId ?? "")).toBeTruthy();
    const s = newCareer({ countries: ["USA"], clubId: "usa-seattle-sounders" });
    expect(s.clubs["usa-toronto"]).toBeUndefined();
    expect(Object.keys(s.clubs).filter((id) => id.startsWith("usa-")).length).toBe(40);
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
