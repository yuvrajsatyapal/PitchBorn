import { beforeAll, describe, expect, it } from "vitest";
import { acceptCoachOffer, applyCoaching, canStartCoaching, coachClub, coaching, resignCoachJob, sanitizeCoaching, setTactics, startCoaching, XP_FOR } from "../src/engine/career/coaching";
import type { MatchPlayerInput } from "../src/engine/match/engine";
import { advanceTurn, retireUser } from "../src/engine/season/advance";
import type { GameState } from "../src/engine/types";
import { checkInvariants } from "../src/engine/validate";
import { userPlayer } from "../src/engine/world/helpers";
import { decodeState, encodeState } from "../src/persistence/codec";
import { migrateState } from "../src/persistence/migrations";
import { newCareer, strongUser } from "./helpers";

function retiredCareer(seed: string): GameState {
  const s = newCareer({ seed });
  for (let i = 0; i < 6; i++) {
    strongUser(s);
    advanceTurn(s);
  }
  retireUser(s);
  return s;
}

describe("starting a coaching career", () => {
  it("is only possible after retiring, and takes the player out of every squad", () => {
    const s = newCareer({ seed: "coach-0" });
    expect(canStartCoaching(s)).toBe(false);
    expect(startCoaching(s)).toContain("retired");
    const r = retiredCareer("coach-1");
    const club = userPlayer(r).clubId as string;
    expect(canStartCoaching(r)).toBe(true);
    startCoaching(r);
    const c = coaching(r);
    expect(c?.role).toBe("youth");
    expect(c?.clubId).toBe(club);
    expect(userPlayer(r).clubId).toBeNull();
    expect(Object.values(r.clubs).some((x) => x.squad.includes(r.user.playerId))).toBe(false);
    expect(r.managers?.[c?.managerId as string]).toBeDefined();
    expect(canStartCoaching(r)).toBe(false);
    expect(r.user.achievements?.some((a) => a.id === "dugout") ?? false).toBe(false); // unlocked on the next weekly check
  });

  it("keeps the world advancing after retirement only once coaching has begun", () => {
    const r = retiredCareer("coach-2");
    const t = r.turnIndex;
    advanceTurn(r);
    expect(r.turnIndex).toBe(t);
    startCoaching(r);
    advanceTurn(r);
    expect(r.turnIndex).toBe(t + 1);
    expect(r.pending).toEqual([]);
    expect(r.user.achievements?.some((a) => a.id === "dugout")).toBe(true);
  });
});

describe("managing a club", () => {
  it("takes charge, sets tactics that survive, and lifts the team on match day", () => {
    const r = retiredCareer("coach-3");
    startCoaching(r);
    const c = coaching(r);
    if (!c) throw new Error("no coach");
    const target = Object.values(r.clubs).find((x) => x.id !== c.clubId) as GameState["clubs"][string];
    c.offers.push({ id: "co-test", clubId: target.id, role: "manager", expiresIndex: r.turnIndex + 4, note: "test" });
    acceptCoachOffer(r, "co-test");
    expect(c.role).toBe("manager");
    expect(target.manager.id).toBe(c.managerId);
    expect(setTactics(r, { formation: "3-5-2", style: { pressing: 0.9 } })).toBe("Tactics updated.");
    expect(target.formation).toBe("3-5-2");
    expect(target.style.pressing).toBe(0.9);
    c.rating = 90;
    const input = { id: "x", attrs: { ...userPlayer(r).attrs } } as MatchPlayerInput;
    const before = input.attrs.decisions;
    applyCoaching(r, target.id, [input]);
    expect(input.attrs.decisions).toBeGreaterThan(before);
    // A whole season: the AI never sacks or poaches him, and the chosen shape holds at the rollover.
    for (let i = 0; i < 60 && coachClub(r)?.id === target.id; i++) {
      c.confidence = Math.max(c.confidence, 60);
      advanceTurn(r);
    }
    expect(coachClub(r)?.id).toBe(target.id);
    expect(target.manager.id).toBe(c.managerId);
    expect(target.formation).toBe("3-5-2");
    expect(c.stints.at(-1)?.games).toBeGreaterThan(20);
    expect(checkInvariants(r).issues).toEqual([]);
  }, 300_000);

  it("can be sacked by the board, and the club appoints someone else", () => {
    const r = retiredCareer("coach-4");
    startCoaching(r);
    const c = coaching(r) as NonNullable<ReturnType<typeof coaching>>;
    const target = Object.values(r.clubs).find((x) => x.id !== c.clubId) as GameState["clubs"][string];
    c.offers.push({ id: "co-x", clubId: target.id, role: "manager", expiresIndex: r.turnIndex + 4, note: "" });
    acceptCoachOffer(r, "co-x");
    let sacked = false;
    for (let i = 0; i < 50 && !sacked; i++) {
      c.confidence = 0;
      if (c.stints.at(-1)) (c.stints.at(-1) as { from: { season: number; turn: number } }).from = { season: r.season - 1, turn: 1 };
      advanceTurn(r);
      sacked = c.clubId === null;
    }
    expect(sacked).toBe(true);
    expect(target.manager.id).not.toBe(c.managerId);
    expect(c.stints.at(-1)?.reason).toBe("sacked");
  }, 300_000);

  it("resigns cleanly and survives a save round trip", () => {
    const r = retiredCareer("coach-5");
    startCoaching(r);
    expect(resignCoachJob(r)).toContain("left");
    expect(coaching(r)?.clubId).toBeNull();
    const back = migrateState(decodeState(encodeState(r)) as unknown as Record<string, unknown>);
    expect(back.user.coach).toEqual(r.user.coach);
    (back.user.coach as unknown as Record<string, unknown>).offers = "bad";
    sanitizeCoaching(back);
    expect(back.user.coach?.offers).toEqual([]);
  });
});

describe("a youth coach's progression", () => {
  let r: GameState;
  let weeks = 0;
  beforeAll(() => {
    r = retiredCareer("coach-run");
    startCoaching(r);
    for (; weeks < 110; weeks++) {
      advanceTurn(r);
      if (coaching(r)?.offers.some((o) => o.role === "assistant")) break;
    }
  }, 300_000);
  it("earns experience and a step-up offer within two seasons", () => {
    const c = coaching(r);
    expect(weeks).toBeLessThan(110);
    expect(c?.xp).toBeGreaterThanOrEqual(XP_FOR.assistant);
    const offer = c?.offers.find((o) => o.role === "assistant");
    expect(offer).toBeDefined();
    acceptCoachOffer(r, offer?.id as string);
    expect(c?.role).toBe("assistant");
    expect(checkInvariants(r).issues).toEqual([]);
  });
});
