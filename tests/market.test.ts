import { describe, expect, it } from "vitest";
import { isDeadlineDay, leakBlock, leakInterest, marketWeekly } from "../src/engine/career/market";
import { makeTerms } from "../src/engine/career/offers";
import { Rng } from "../src/engine/rng";
import type { TransferOffer } from "../src/engine/types";
import { newCareer, strongUser } from "./helpers";

function bid(s: ReturnType<typeof newCareer>, clubId: string, fee = 4_000_000): TransferOffer {
  const p = s.players[s.user.playerId];
  const { terms, maxWage } = makeTerms(s, Rng.fromSeed("t"), s.clubs[clubId], p, "transfer");
  const o: TransferOffer = { id: `o-${clubId}`, kind: "transfer", fromClubId: clubId, toPlayerClubId: p.clubId, fee, terms, maxWage, patience: 2, status: "club-pending", createdTurn: s.turn, expiresTurn: s.turn + 3, season: s.season, history: [] };
  s.user.offers.unshift(o);
  return o;
}

describe("transfer rivals, deadline day and leaks", () => {
  it("knows deadline day is the last week of each window", () => {
    expect(isDeadlineDay(9)).toBe(true);
    expect(isDeadlineDay(31)).toBe(true);
    expect(isDeadlineDay(5)).toBe(false);
    expect(isDeadlineDay(20)).toBe(false);
  });

  it("a rival joins an open bid with more money, and the first bidder can answer", () => {
    const s = newCareer();
    strongUser(s);
    const me = s.players[s.user.playerId];
    const other = Object.values(s.clubs).filter((c) => c.id !== me.clubId).sort((a, b) => b.reputation - a.reputation)[3];
    for (const c of Object.values(s.clubs)) c.balance = 500_000_000;
    const first = bid(s, other.id);
    let war = false;
    for (let t = 1; t <= 8 && !war; t++) {
      s.turn = t;
      s.turnIndex = t;
      marketWeekly(s);
      war = !!first.warWith;
    }
    expect(war).toBe(true);
    const rival = s.user.offers.find((o) => o.id === first.warWith)!;
    expect(rival.fee).toBeGreaterThan(4_000_000);
    expect(rival.warWith).toBe(first.id);
  });

  it("leaking needs interest and an agent, works once a window and costs the manager's goodwill", () => {
    const s = newCareer();
    strongUser(s);
    s.turn = 3;
    expect(leakBlock(s)).toBeTruthy();
    s.user.agent = { ...s.user.agent, id: "a1" };
    const me = s.players[s.user.playerId];
    const other = Object.values(s.clubs).find((c) => c.id !== me.clubId)!;
    bid(s, other.id);
    expect(leakBlock(s)).toBeNull();
    const before = s.user.relationships.manager;
    expect(leakInterest(s).ok).toBe(true);
    expect(s.user.relationships.manager).toBeLessThan(before);
    expect(leakBlock(s)).toMatch(/already/);
  });

  it("leaks only work while a window is open, so they can't be repeated week after week between windows", () => {
    const s = newCareer();
    strongUser(s);
    s.user.agent = { ...s.user.agent, id: "a1" };
    const me = s.players[s.user.playerId];
    bid(s, Object.values(s.clubs).find((c) => c.id !== me.clubId)!.id);
    s.turn = 20;
    expect(leakBlock(s)).toMatch(/window/);
    expect(leakInterest(s).ok).toBe(false);
  });
});
