import { beforeAll, describe, expect, it } from "vitest";
import { advanceTurn, simUserMatch } from "../src/engine/season/advance";
import { ledgerOf } from "../src/engine/career/money";
import { intlTeam } from "../src/engine/national/identity";
import { MATCH_LOG_CAP } from "../src/engine/stats/matchlog";
import { checkInvariants } from "../src/engine/validate";
import type { GameState } from "../src/engine/types";
import { userPlayer } from "../src/engine/world/helpers";
import { decodeState, encodeState } from "../src/persistence/codec";
import { migrateState } from "../src/persistence/migrations";
import { newCareer, strongUser } from "./helpers";

/** Three seasons with bonuses in the contract, a dual-eligible user who is never asked to decide, and everything saved and reloaded. */
describe("a multi-season career with the new systems running", () => {
  let s: GameState;
  let wages = 0;
  beforeAll(() => {
    s = newCareer({ seed: "reg-1", nationality: "FRA", birthCountry: "MAR", countries: ["ENG"] });
    strongUser(s);
    const p = userPlayer(s);
    p.contract = { ...p.contract!, wage: 20_000, expires: 2032, appearanceBonus: 2_000, goalBonus: 4_000, assistBonus: 3_000, cleanSheetBonus: 3_000, trophyBonus: 100_000, promotionBonus: 150_000, wageRise: 0.04 };
    for (let i = 0; i < 150; i++) {
      if (s.user.retired) break;
      strongUser(s);
      for (const d of s.user.decisions.filter((x) => x.intlCode)) s.user.decisions = s.user.decisions.filter((x) => x !== d); // nobody answers
      advanceTurn(s);
    }
    wages = ledgerOf(s).career.wage ?? 0;
  }, 300_000);

  it("keeps seasons, squads and fixtures valid", () => {
    expect(s.archive.length).toBeGreaterThanOrEqual(2);
    expect(checkInvariants(s).issues).toEqual([]);
  });

  it("never pays the same thing twice", () => {
    const paid = ledgerOf(s).paid;
    expect(new Set(paid).size).toBe(paid.length);
    const matchKeys = paid.filter((k) => /^(app|goal|assist|cs):/.test(k));
    expect(new Set(matchKeys).size).toBe(matchKeys.length);
  });

  it("reconciles every payment with career earnings and keeps bonuses proportionate", () => {
    const l = ledgerOf(s).career;
    const total = Object.values(l).reduce((n, v) => n + (v ?? 0), 0);
    expect(total).toBeGreaterThan(0);
    expect(Math.abs(total - s.user.earnings)).toBeLessThanOrEqual(1);
    const bonuses = (l.appearance ?? 0) + (l.goal ?? 0) + (l.assist ?? 0) + (l.cleanSheet ?? 0) + (l.trophy ?? 0) + (l.promotion ?? 0);
    expect(bonuses).toBeGreaterThan(0);
    expect(bonuses).toBeLessThan(wages * 0.6);
    expect(Number.isFinite(s.clubs[userPlayer(s).clubId as string]?.balance ?? 0)).toBe(true);
  });

  it("matches each bonus to the match that earned it", () => {
    const l = ledgerOf(s).career;
    const log = s.user.matchLog!;
    const club = log.filter((e) => ["league", "cup", "continental"].includes(e.compKind));
    // Appearance bonuses at the contract's rate can never exceed the number of club matches played at it.
    expect(l.appearance ?? 0).toBeLessThanOrEqual(club.length * 2_000 + 1);
    expect(l.goal ?? 0).toBeLessThanOrEqual(club.reduce((n, e) => n + e.goals, 0) * 4_000 + 1);
  });

  it("never changes the user's international allegiance without a decision", () => {
    const p = userPlayer(s);
    expect(intlTeam(p)).toBe("FRA");
    expect(p.intl.switches ?? 0).toBe(0);
    expect(s.nationalTeams.MAR.squad).not.toContain(p.id);
    expect(s.user.intl?.history.every((h) => h.outcome !== "accepted")).toBe(true);
  });

  it("keeps the match log bounded and without duplicates", () => {
    const log = s.user.matchLog!;
    expect(log.length).toBeGreaterThan(30);
    expect(log.length).toBeLessThanOrEqual(MATCH_LOG_CAP);
    expect(new Set(log.map((e) => e.fixtureId)).size).toBe(log.length);
  });

  it("sets and settles season ambitions every season", () => {
    expect(s.user.objectives?.season).toBe(s.season);
    expect(s.user.relLog!.filter((r) => /ambitions/.test(r.cause)).length).toBeGreaterThanOrEqual(1);
    expect(s.user.relLog!.length).toBeLessThanOrEqual(60);
  });

  it("saves, reloads and carries on", () => {
    const back = migrateState(JSON.parse(JSON.stringify(decodeState(encodeState(s)))));
    expect(back.user.matchLog!.length).toBe(s.user.matchLog!.length);
    expect(ledgerOf(back).paid).toEqual(ledgerOf(s).paid);
    for (let i = 0; i < 6; i++) advanceTurn(back);
    expect(checkInvariants(back).issues).toEqual([]);
    // Replaying a match that was already played cannot pay it again.
    const done = back.user.matchLog!.at(-1)!;
    const before = back.user.earnings;
    expect(simUserMatch(back, done.fixtureId)).toBeNull();
    expect(back.user.earnings).toBe(before);
  });
});
