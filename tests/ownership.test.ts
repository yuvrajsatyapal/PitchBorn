import { describe, expect, it } from "vitest";
import {
  OWNERSHIP_TYPES, annualRevenue, distress, ownerTopUp, ownershipOf, ownershipProfile, profileFor, refusalChance, restructuredBalance,
  spendableCash, transferBudget, wageTolerance, forcedSales,
} from "../src/engine/club/ownership";
import { WORLD, staticLeague } from "../src/engine/data/world";
import ownershipJson from "../src/data/ownership.json";
import type { ClubState } from "../src/engine/types";

function club(id: string, balance: number, reputation?: number): ClubState {
  const st = WORLD.clubs.find((c) => c.id === id)!;
  return {
    id, leagueId: st.leagueId, reputation: reputation ?? st.prestige, balance, formation: "4-3-3",
    style: { pressing: 0.5, tempo: 0.5, directness: 0.5 }, manager: { name: "M", quality: 50, since: 2025, nationality: "ENG" },
    youth: 50, facilities: 50, squad: [], form: [],
  };
}
const baseOf = (c: ClubState) => c.reputation * c.reputation * ((staticLeague(c.leagueId)?.tier ?? 1) === 1 ? 26000 : 7000);
const budget = (c: ClubState) => transferBudget(c, baseOf(c), annualRevenue(c));
const rev = (c: ClubState) => annualRevenue(c);

// Broke = deep in the red, at 40% of annual revenue.
const broke = (id: string, reputation?: number) => {
  const c = club(id, 0, reputation);
  c.balance = -rev(c) * 0.4;
  return c;
};

// Same-reputation stand-ins so ownership is the only variable.
const PEERS = { standard: "eng-crystal-palace", fan: "esp-athletic", billionaire: "eng-aston-villa", state: "eng-newcastle-united", corporate: "ger-bayer-leverkusen" };

describe("ownership data", () => {
  it("only lists real clubs with valid types", () => {
    const ids = new Set(WORLD.clubs.map((c) => c.id));
    for (const [id, t] of Object.entries(ownershipJson.clubs)) {
      expect(ids.has(id), id).toBe(true);
      expect(OWNERSHIP_TYPES as readonly string[]).toContain(t);
    }
  });
  it("defaults unlisted clubs to standard and classifies the headline clubs", () => {
    expect(ownershipOf("not-a-club")).toBe("standard");
    expect(ownershipOf("esp-real-madrid")).toBe("fan-owned");
    expect(ownershipOf("esp-barcelona")).toBe("fan-owned");
    expect(ownershipOf("fra-psg")).toBe("state-backed");
    expect(ownershipOf("eng-man-city")).toBe("state-backed");
  });
  it("standard ownership is neutral", () => {
    const p = profileFor("standard");
    expect([p.creditShare, p.topUpCap, p.retention]).toEqual([0, 0, 0]);
    expect([p.baseMul, p.wageMul, p.willingness, p.sellPressure]).toEqual([1, 1, 1, 1]);
  });
});

describe("transfer budget", () => {
  it("a broke standard club cannot spend; broke fan-owned cannot either", () => {
    expect(budget(broke("eng-crystal-palace"))).toBe(0);
    expect(budget(broke("esp-athletic"))).toBe(0);
  });
  it("broke backed clubs keep some owner credit, state more than billionaire, and both stay below a healthy version", () => {
    const bill = broke("eng-aston-villa");
    const state = broke("eng-newcastle-united", bill.reputation);
    expect(budget(bill)).toBeGreaterThan(0);
    expect(budget(state)).toBeGreaterThan(budget(bill) * 0.9);
    const healthy = club("eng-aston-villa", rev(bill) * 0.3);
    expect(budget(bill)).toBeLessThan(budget(healthy));
  });
  it("a broke backed club does not out-spend a healthy elite fan-owned club", () => {
    const madrid = club("esp-real-madrid", annualRevenue(club("esp-real-madrid", 0)) * 0.3);
    expect(budget(madrid)).toBeGreaterThan(budget(broke("eng-newcastle-united")));
    expect(budget(madrid)).toBeGreaterThan(budget(broke("fra-psg")));
  });
  it("a healthy fan-owned elite club spends heavily", () => {
    const madrid = club("esp-real-madrid", annualRevenue(club("esp-real-madrid", 0)) * 0.4);
    expect(budget(madrid)).toBeGreaterThan(baseOf(madrid) * 0.4);
  });
  it("reputation still decides: a low-reputation backed club trails a bigger one", () => {
    const small = club("eng-newcastle-united", 0, 60);
    const big = club("esp-real-madrid", 0, 95);
    big.balance = rev(big) * 0.2;
    expect(budget(small)).toBeLessThan(budget(big));
    // and the ownership edge is bounded by the ceiling
    expect(budget(club("eng-newcastle-united", 1e12, 60))).toBeLessThanOrEqual(baseOf(small) * ownershipProfile("eng-newcastle-united").ceiling);
  });
  it("a healthy standard club is unchanged from the original formula", () => {
    const c = club(PEERS.standard, 40_000_000);
    expect(budget(c)).toBe(Math.max(0, Math.min(c.balance * 0.6 + baseOf(c) * 0.4, baseOf(c) * 2.2)));
  });
  it("backing raises the same healthy club's budget over a standard one", () => {
    const std = club(PEERS.standard, 30_000_000, 85);
    const bill = club(PEERS.billionaire, 30_000_000, 85);
    const state = club(PEERS.state, 30_000_000, 85);
    expect(budget(bill)).toBeGreaterThan(budget(std));
    expect(budget(state)).toBeGreaterThan(budget(bill));
  });
});

describe("owner funding and resilience", () => {
  it("tops up backed clubs, bounded by the cap, and stops once healthy", () => {
    const c = broke("fra-psg");
    const add = ownerTopUp(c, rev(c));
    expect(add).toBeGreaterThan(0);
    expect(add).toBeLessThanOrEqual(Math.ceil(rev(c) * ownershipProfile(c.id).topUpCap));
    c.balance = rev(c) * 0.5;
    expect(ownerTopUp(c, rev(c))).toBe(0);
  });
  it("never funds standard or fan-owned clubs", () => {
    for (const id of ["eng-crystal-palace", "esp-athletic", "ita-milan"]) {
      const c = broke(id);
      expect(ownerTopUp(c, rev(c)), id).toBe(0);
    }
  });
  it("state-backed funds more than billionaire at the same size", () => {
    const a = broke("eng-aston-villa", 85);
    const b = broke("eng-newcastle-united", 85);
    expect(ownerTopUp(b, rev(b))).toBeGreaterThan(ownerTopUp(a, rev(a)));
  });
  it("backed clubs tolerate more debt and are bailed out more gently", () => {
    expect(ownershipProfile("fra-psg").debtTolerance).toBeGreaterThan(ownershipProfile("eng-crystal-palace").debtTolerance);
    const std = club("eng-crystal-palace", 0);
    const st = club("fra-psg", 0);
    expect(restructuredBalance(st, rev(st)) / rev(st)).toBeGreaterThan(restructuredBalance(std, rev(std)) / rev(std));
  });
});

describe("selling pressure and retention", () => {
  it("poor fan-owned and investment-owned clubs feel more pressure than backed ones", () => {
    const fan = broke("esp-athletic", 85);
    const std = broke("eng-crystal-palace", 85);
    const bill = broke("eng-aston-villa", 85);
    const state = broke("eng-newcastle-united", 85);
    expect(distress(fan, rev(fan))).toBeGreaterThan(distress(std, rev(std)));
    expect(distress(std, rev(std))).toBeGreaterThan(distress(bill, rev(bill)));
    expect(distress(bill, rev(bill))).toBeGreaterThan(distress(state, rev(state)));
    expect(forcedSales(fan, rev(fan))).toBeGreaterThan(forcedSales(state, rev(state)));
  });
  it("healthy clubs feel none", () => {
    const c = club("esp-athletic", 50_000_000);
    expect(distress(c, rev(c))).toBe(0);
    expect(forcedSales(c, rev(c))).toBe(0);
  });
  it("backed sellers resist rivals' bids on key players; standard never does; a far bigger buyer overrides it", () => {
    const seller = club("eng-newcastle-united", 20_000_000);
    const peer = club("eng-everton", 20_000_000, seller.reputation);
    const giant = club("esp-real-madrid", 1e8, seller.reputation + 20);
    expect(refusalChance(seller, peer, rev(seller))).toBeGreaterThan(0);
    expect(refusalChance(seller, giant, rev(seller))).toBe(0);
    const std = club("eng-crystal-palace", 20_000_000);
    expect(refusalChance(std, peer, rev(std))).toBe(0);
  });
  it("distress removes a seller's resistance", () => {
    const healthy = club("eng-aston-villa", 20_000_000);
    const buyer = club("eng-everton", 20_000_000, healthy.reputation);
    const sick = { ...healthy, balance: -rev(healthy) * 0.9 };
    expect(refusalChance(sick, buyer, rev(sick))).toBeLessThan(refusalChance(healthy, buyer, rev(healthy)));
  });
});

describe("wages and cash", () => {
  it("backed clubs stretch further on star wages than standard, bounded", () => {
    const std = club("eng-crystal-palace", 10_000_000);
    const state = club("eng-newcastle-united", 10_000_000);
    expect(wageTolerance(state, rev(state))).toBeGreaterThan(wageTolerance(std, rev(std)));
    expect(wageTolerance(state, rev(state))).toBeLessThanOrEqual(1.25);
  });
  it("debt trims wage tolerance for everyone, without going below 90%", () => {
    const c = broke("eng-crystal-palace");
    expect(wageTolerance(c, rev(c))).toBeLessThan(1);
    expect(wageTolerance(c, rev(c))).toBeGreaterThanOrEqual(0.9);
  });
  it("a club in debt has no signing-bonus cash unless an owner stands behind it", () => {
    expect(spendableCash(broke("eng-crystal-palace"), rev(club("eng-crystal-palace", 0)))).toBe(0);
    const psg = broke("fra-psg");
    expect(spendableCash(psg, rev(psg))).toBeGreaterThan(0);
  });
});
