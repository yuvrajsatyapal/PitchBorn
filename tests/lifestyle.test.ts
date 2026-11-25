import { describe, expect, it } from "vitest";
import { buyItem, canBuy, cashOut, invest, investAmounts, INVEST_AMOUNTS, itemById, lifestyleEffects, lifestyleWeekly, netWorth, ownedItems, priceLevel, quote, sellItem, weeklyUpkeep } from "../src/engine/career/lifestyle";
import type { GameState } from "../src/engine/types";
import { commercialAppeal } from "../src/engine/career/sponsors";
import { BALANCE } from "../src/engine/balance";
import { userPlayer } from "../src/engine/world/helpers";
import { newCareer } from "./helpers";

/** Wages at the full-price level, so list prices apply. */
function wealthy(s: GameState, wage: number = BALANCE.lifestyle.fullPriceWage): GameState {
  const c = userPlayer(s).contract;
  if (c) c.wage = wage;
  return s;
}

describe("lifestyle and money", () => {
  it("buys and replaces a home, selling the old one at 70%", () => {
    const s = wealthy(newCareer({ seed: "ls-1" }));
    s.user.bank = 1_000_000;
    expect(buyItem(s, "flat").ok).toBe(true);
    expect(s.user.bank).toBe(940_000);
    expect(buyItem(s, "townhouse").ok).toBe(true);
    expect(ownedItems(s).map((i) => i.id)).toEqual(["townhouse"]);
    expect(s.user.bank).toBe(940_000 + 42_000 - 450_000);
    expect(canBuy(s, "estate").ok).toBe(false);
  });

  it("charges upkeep weekly and gives its effects", () => {
    const s = wealthy(newCareer({ seed: "ls-2" }));
    s.user.bank = 3_000_000;
    buyItem(s, "villa");
    buyItem(s, "physio");
    buyItem(s, "sports");
    const p = userPlayer(s);
    p.fitness = 80;
    const before = s.user.bank;
    lifestyleWeekly(s);
    expect(s.user.bank).toBe(before - weeklyUpkeep(s));
    expect(p.fitness).toBeCloseTo(80 + 1.6 + 0.4, 5);
    expect(lifestyleEffects(s).injury).toBeCloseTo(0.8);
    const appealWith = commercialAppeal(s);
    sellItem(s, "sports");
    expect(commercialAppeal(s)).toBe(appealWith - 2);
  });

  it("lets things go when the bank can't cover upkeep, staff first", () => {
    const s = wealthy(newCareer({ seed: "ls-3" }));
    s.user.bank = 100_000;
    buyItem(s, "flat");
    buyItem(s, "chef");
    s.user.bank = 400;
    lifestyleWeekly(s);
    expect(ownedItems(s).map((i) => i.id)).toEqual(["flat"]);
    expect(s.user.bank).toBe(100);
  });

  it("settles investments once a season from their own stream", () => {
    const run = () => {
      const s = wealthy(newCareer({ seed: "ls-4" }));
      s.user.bank = 2_000_000;
      invest(s, "bonds", 500_000);
      invest(s, "startup", 500_000);
      s.season += 1;
      s.turn = BALANCE.calendar.seasonEnd;
      const rng = s.rng;
      lifestyleWeekly(s);
      expect(s.rng).toEqual(rng);
      return s;
    };
    const a = run();
    const b = run();
    expect(a.user.lifestyle?.investments.length).toBe(1);
    const bond = a.user.lifestyle?.investments[0];
    expect(bond?.value).toBeGreaterThan(510_000);
    expect(a.user.bank).toBe(b.user.bank);
    expect(netWorth(a)).toBe(a.user.bank + (bond?.value ?? 0));
    const id = bond?.id as string;
    expect(cashOut(a, id).ok).toBe(true);
    expect(a.user.lifestyle?.investments.length).toBe(0);
  });

  it("prices follow the wage: full list price for a well-paid player, far less for a lower-league youngster", () => {
    const rich = wealthy(newCareer({ seed: "ls-5" }), 200_000);
    expect(priceLevel(rich)).toBe(1);
    expect(quote(rich, "flat")).toEqual({ price: 60_000, upkeep: 300 });
    const poor = wealthy(newCareer({ seed: "ls-5" }), 1_500);
    const level = priceLevel(poor);
    expect(level).toBeCloseTo(Math.sqrt(1_500 / BALANCE.lifestyle.fullPriceWage), 5);
    const flat = quote(poor, "flat");
    expect(flat.price).toBeLessThan(15_000);
    // Affordable on about two months of wages, upkeep included.
    expect((flat.price + flat.upkeep * 4) / 1_500).toBeLessThan(10);
    expect(quote(poor, "chef").price).toBe(0);
    expect(quote(poor, "hatch").upkeep).toBeGreaterThan(0);
    const floor = wealthy(newCareer({ seed: "ls-5" }), 0);
    expect(priceLevel(floor)).toBe(BALANCE.lifestyle.minLevel);
  });

  it("locks in the price paid: upkeep and resale don't move when the wage does", () => {
    const s = wealthy(newCareer({ seed: "ls-6" }), 1_500);
    const q = quote(s, "flat");
    s.user.bank = 100_000;
    expect(buyItem(s, "flat").ok).toBe(true);
    expect(s.user.bank).toBe(100_000 - q.price);
    expect(weeklyUpkeep(s)).toBe(q.upkeep);
    wealthy(s, 200_000);
    expect(weeklyUpkeep(s)).toBe(q.upkeep);
    expect(netWorth(s)).toBe(s.user.bank + Math.round(q.price * 0.7));
    const before = s.user.bank;
    sellItem(s, "flat");
    expect(s.user.bank).toBe(before + Math.round(q.price * 0.7));
  });

  it("old saves without a recorded price fall back to list price", () => {
    const s = wealthy(newCareer({ seed: "ls-7" }), 1_500);
    s.user.lifestyle = { owned: [{ id: "townhouse", season: s.season, turn: s.turn }], investments: [], spent: 0, donated: 0 };
    expect(weeklyUpkeep(s)).toBe(itemById("townhouse")?.upkeep);
  });

  it("investment stakes scale with the price level", () => {
    const rich = wealthy(newCareer({ seed: "ls-8" }), 200_000);
    expect(investAmounts(rich)).toEqual([...INVEST_AMOUNTS]);
    const poor = wealthy(newCareer({ seed: "ls-8" }), 1_500);
    const amounts = investAmounts(poor);
    expect(amounts[0]).toBeLessThan(INVEST_AMOUNTS[0]);
    expect(amounts[0]).toBeGreaterThan(0);
    expect(amounts[1]).toBeGreaterThan(amounts[0]);
  });
});
