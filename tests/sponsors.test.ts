import { describe, expect, it } from "vitest";
import { acceptSponsorOffer, BRANDS, commercialAppeal, declineSponsorOffer, sponsorState, sponsorWeekly } from "../src/engine/career/sponsors";
import { advanceTurn, retireUser } from "../src/engine/season/advance";
import { decodeState, encodeState } from "../src/persistence/codec";
import { migrateState } from "../src/persistence/migrations";
import { userPlayer } from "../src/engine/world/helpers";
import { newCareer } from "./helpers";

function star(s: ReturnType<typeof newCareer>) {
  const p = userPlayer(s);
  p.reputation = 90;
  p.intlReputation = 70;
  p.form = 7.8;
}

/** Plays weeks forward until an offer exists, or gives up. */
function untilOffer(s: ReturnType<typeof newCareer>, max = 80) {
  for (let i = 0; i < max && sponsorState(s).offers.length === 0; i++) {
    s.turnIndex++;
    sponsorWeekly(s);
  }
  return sponsorState(s).offers[0];
}

describe("sponsorships", () => {
  it("uses fictional brands, one category each tier of fame", () => {
    expect(BRANDS.length).toBeGreaterThanOrEqual(10);
    expect(BRANDS.length).toBeLessThanOrEqual(15);
    expect(new Set(BRANDS.map((b) => b.id)).size).toBe(BRANDS.length);
  });

  it("appeal rises with reputation, not overall alone", () => {
    const s = newCareer();
    const low = commercialAppeal(s);
    star(s);
    expect(commercialAppeal(s)).toBeGreaterThan(low + 40);
  });

  it("an unknown player gets only small brands; a star can get a big one", () => {
    const small = newCareer();
    userPlayer(small).reputation = 12;
    const o = untilOffer(small, 400);
    if (o) expect(BRANDS.find((b) => b.id === o.brandId)!.minAppeal).toBeLessThanOrEqual(commercialAppeal(small));
    const big = newCareer();
    star(big);
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      big.turnIndex++;
      sponsorWeekly(big);
      for (const x of sponsorState(big).offers) seen.add(x.brandId);
      sponsorState(big).offers = [];
      sponsorState(big).cooldown = {};
      sponsorState(big).lastOfferIndex = -99;
    }
    expect([...seen].some((id) => BRANDS.find((b) => b.id === id)!.minAppeal >= 60)).toBe(true);
  });

  it("offers are deterministic and spaced out", () => {
    const a = newCareer();
    const b = newCareer();
    star(a);
    star(b);
    expect(untilOffer(a)).toEqual(untilOffer(b));
    let count = 0;
    const c = newCareer();
    star(c);
    for (let i = 0; i < 24; i++) {
      c.turnIndex++;
      const before = sponsorState(c).offers.length;
      sponsorWeekly(c);
      count += sponsorState(c).offers.length - before;
    }
    expect(count).toBeLessThanOrEqual(3);
  });

  it("accepting starts a deal that pays once per week, never twice", () => {
    const s = newCareer();
    star(s);
    const o = untilOffer(s);
    expect(acceptSponsorOffer(s, o.id)).toMatch(/Signed/);
    const before = s.user.pay?.career.sponsor ?? 0;
    s.turnIndex++;
    sponsorWeekly(s);
    sponsorWeekly(s); // the same week again
    const paid = (s.user.pay?.career.sponsor ?? 0) - before;
    expect(paid).toBe(Math.round(o.annual / 50));
  });

  it("one partner per category", () => {
    const s = newCareer();
    star(s);
    const o = untilOffer(s);
    acceptSponsorOffer(s, o.id);
    const cat = BRANDS.find((b) => b.id === o.brandId)!.category;
    const rival = BRANDS.find((b) => b.category === cat && b.id !== o.brandId);
    if (rival) {
      sponsorState(s).offers.push({ id: "x", brandId: rival.id, annual: 1, years: 1, expiresIndex: s.turnIndex + 5 });
      expect(acceptSponsorOffer(s, "x")).toMatch(/already/);
    }
  });

  it("declining removes the offer with no reputation cost, and the brand waits before returning", () => {
    const s = newCareer();
    star(s);
    const o = untilOffer(s);
    const rep = userPlayer(s).reputation;
    declineSponsorOffer(s, o.id);
    expect(sponsorState(s).offers.find((x) => x.id === o.id)).toBeUndefined();
    expect(userPlayer(s).reputation).toBe(rep);
    expect(sponsorState(s).cooldown[o.brandId]).toBeGreaterThan(s.turnIndex);
  });

  it("offers expire, deals end, and a renewal is offered before the end", () => {
    const s = newCareer();
    star(s);
    const o = untilOffer(s);
    s.turnIndex += 20;
    sponsorWeekly(s);
    expect(sponsorState(s).offers.find((x) => x.id === o.id)).toBeUndefined();

    const t = newCareer();
    star(t);
    const o2 = untilOffer(t);
    acceptSponsorOffer(t, o2.id);
    const deal = sponsorState(t).deals[0];
    t.turnIndex = deal.endIndex - 5;
    sponsorWeekly(t);
    expect(sponsorState(t).offers.some((x) => x.renewsDealId === deal.id)).toBe(true);
    t.turnIndex = deal.endIndex;
    sponsorWeekly(t);
    expect(sponsorState(t).deals.find((d) => d.id === deal.id)).toBeUndefined();
  });

  it("accepting a renewal replaces the old deal", () => {
    const s = newCareer();
    star(s);
    const o = untilOffer(s);
    acceptSponsorOffer(s, o.id);
    const deal = sponsorState(s).deals[0];
    s.turnIndex = deal.endIndex - 5;
    sponsorWeekly(s);
    const r = sponsorState(s).offers.find((x) => x.renewsDealId === deal.id)!;
    acceptSponsorOffer(s, r.id);
    expect(sponsorState(s).deals).toHaveLength(1);
    expect(sponsorState(s).deals[0].id).toBe(r.id);
  });

  it("a player who fell far below the brand's level is not renewed", () => {
    const s = newCareer();
    star(s);
    const o = untilOffer(s);
    acceptSponsorOffer(s, o.id);
    const deal = sponsorState(s).deals[0];
    userPlayer(s).reputation = 3;
    userPlayer(s).intlReputation = 0;
    s.turnIndex = deal.endIndex - 5;
    sponsorWeekly(s);
    const brand = BRANDS.find((b) => b.id === deal.brandId)!;
    if (commercialAppeal(s) < brand.minAppeal * 0.8) expect(sponsorState(s).offers.some((x) => x.renewsDealId)).toBe(false);
  });

  it("survives a save and reload, and retirement clears the deals", () => {
    const s = newCareer();
    star(s);
    const o = untilOffer(s);
    acceptSponsorOffer(s, o.id);
    const back = migrateState(decodeState(encodeState(s)) as never);
    expect(back.user.sponsor?.deals).toEqual(s.user.sponsor?.deals);
    retireUser(s);
    expect(sponsorState(s).deals).toHaveLength(0);
  });

  it("old saves load without sponsor data", () => {
    const s = newCareer();
    delete s.user.sponsor;
    s.schemaVersion = 15;
    const m = migrateState(JSON.parse(JSON.stringify(s)));
    expect(sponsorState(m).deals).toEqual([]);
  });

  it("the old random sponsor event is gone and a normal season still advances", () => {
    const s = newCareer();
    star(s);
    for (let i = 0; i < 8; i++) advanceTurn(s);
    expect(s.news.some((n) => n.title === "Boot sponsor wants you")).toBe(false);
  });
});
