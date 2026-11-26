import { describe, expect, it } from "vitest";
import { acceptCoachOffer, startCoaching } from "../src/engine/career/coaching";
import { childLook, startNextGeneration } from "../src/engine/career/generations";
import { hallOfFameEntry } from "../src/engine/career/hallOfFame";
import { advanceTurn, retireUser, simUserMatch } from "../src/engine/season/advance";
import { checkInvariants } from "../src/engine/validate";
import { ageOf } from "../src/engine/players/generate";
import { newCareer } from "./helpers";

describe("generational saves", () => {
  it("the child starts in the same world with the family name, looks and the parent as agent", () => {
    const s = newCareer({ seed: "gen-1" });
    for (let i = 0; i < 4; i++) advanceTurn(s);
    const parent = s.players[s.user.playerId];
    retireUser(s);
    const parentEntryId = hallOfFameEntry(s)!.saveId;
    const res = startNextGeneration(s, { firstName: "Jamie", position: "CM", foot: "L", height: 176, role: "agent", clubId: "eng-ipswich-town", path: "youth" });
    expect(res.ok).toBe(true);
    const child = s.players[s.user.playerId];
    expect(child.id).not.toBe(parent.id);
    expect(child.lastName).toBe(parent.lastName);
    expect(child.look.skin).toBe(parent.look.skin);
    expect(ageOf(child, s.season)).toBe(15);
    expect(s.user.agent.name).toContain(parent.lastName);
    expect(s.user.agent.commission).toBe(0);
    expect(parent.isUser).toBe(false);
    expect(parent.clubId).toBeNull();
    expect(s.lineage?.[0].name).toContain(parent.lastName);
    expect(s.generation).toBe(2);
    expect(s.user.retired).toBe(false);
    expect(s.user.youth?.stage).toBe("academy");
    for (let i = 0; i < 6; i++) {
      for (const m of [...s.pending]) simUserMatch(s, m.fixtureId);
      advanceTurn(s);
    }
    expect(checkInvariants(s).issues).toEqual([]);
    retireUser(s);
    expect(hallOfFameEntry(s)!.saveId).not.toBe(parentEntryId);
  });

  it("a parent who manages a club can coach the child there", () => {
    const s = newCareer({ seed: "gen-2" });
    advanceTurn(s);
    retireUser(s);
    startCoaching(s);
    const target = Object.values(s.clubs).find((x) => x.id !== s.user.coach!.clubId)!;
    s.user.coach!.offers.push({ id: "co-m", clubId: target.id, role: "manager", expiresIndex: s.turnIndex + 4, note: "" });
    acceptCoachOffer(s, "co-m");
    const res = startNextGeneration(s, { firstName: "Sam", position: "ST", foot: "R", height: 180, role: "coach", clubId: "", path: "academy" });
    expect(res.ok).toBe(true);
    expect(s.players[s.user.playerId].clubId).toBe(target.id);
    expect(s.user.coach).toBeUndefined();
    expect(s.lineage?.[0].coachRole).toBe("manager");
  });

  it("inherited looks are deterministic", () => {
    const s = newCareer();
    const p = s.players[s.user.playerId];
    expect(childLook(p.look, "x")).toEqual(childLook(p.look, "x"));
  });
});
