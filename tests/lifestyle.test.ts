import { describe, expect, it } from "vitest";
import { buyItem, canBuy, cashOut, invest, lifestyleEffects, lifestyleWeekly, netWorth, ownedItems, sellItem, weeklyUpkeep } from "../src/engine/career/lifestyle";
import { commercialAppeal } from "../src/engine/career/sponsors";
import { BALANCE } from "../src/engine/balance";
import { userPlayer } from "../src/engine/world/helpers";
import { newCareer } from "./helpers";

describe("lifestyle and money", () => {
  it("buys and replaces a home, selling the old one at 70%", () => {
    const s = newCareer({ seed: "ls-1" });
    s.user.bank = 1_000_000;
    expect(buyItem(s, "flat").ok).toBe(true);
    expect(s.user.bank).toBe(940_000);
    expect(buyItem(s, "townhouse").ok).toBe(true);
    expect(ownedItems(s).map((i) => i.id)).toEqual(["townhouse"]);
    expect(s.user.bank).toBe(940_000 + 42_000 - 450_000);
    expect(canBuy(s, "estate").ok).toBe(false);
  });

  it("charges upkeep weekly and gives its effects", () => {
    const s = newCareer({ seed: "ls-2" });
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
    const s = newCareer({ seed: "ls-3" });
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
      const s = newCareer({ seed: "ls-4" });
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
});
