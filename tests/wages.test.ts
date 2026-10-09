import { describe, expect, it } from "vitest";
import { makeTerms } from "../src/engine/career/offers";
import { LOYALTY_DISCOUNT_MAX, loyaltyPull, marketDemand, renewalGap, reservationWage, retentionOffer, squadImportance } from "../src/engine/career/wages";
import { overallFor } from "../src/engine/players/attributes";
import { clubLevel, marketWage } from "../src/engine/players/economy";
import { ageOf } from "../src/engine/players/generate";
import { Rng } from "../src/engine/rng";
import { playerWillJoin, processExpiringContracts } from "../src/engine/transfers/market";
import { STAGE_XP } from "../src/engine/traits/types";
import type { GameState, Player, SquadRole } from "../src/engine/types";
import { squadOf, userPlayer } from "../src/engine/world/helpers";
import { newCareer } from "./helpers";

const ROLES: SquadRole[] = ["backup", "rotation", "first", "star"];

/** An NPC who is under contract at a club, optionally filtered. */
function npc(s: GameState, pred: (p: Player) => boolean = () => true): Player {
  const p = Object.values(s.players).find((x) => !x.isUser && !x.virtual && !x.retired && x.clubId && x.contract && pred(x));
  if (!p) throw new Error("no matching NPC in test world");
  return p;
}

/** Raises a player's attributes one point at a time until his overall reaches the target. */
function raiseTo(p: Player, target: number): void {
  for (let i = 0; i < 80 && overallFor(p.attrs, p.position) < target; i++) {
    for (const k of Object.keys(p.attrs) as (keyof Player["attrs"])[]) p.attrs[k] = Math.min(99, p.attrs[k] + 1);
  }
}

/** Lowers a player's attributes one point at a time until his overall reaches the target. */
function lowerTo(p: Player, target: number): void {
  for (let i = 0; i < 80 && overallFor(p.attrs, p.position) > target; i++) {
    for (const k of Object.keys(p.attrs) as (keyof Player["attrs"])[]) p.attrs[k] = Math.max(1, p.attrs[k] - 1);
  }
}

/** A player who has been at his club for a long time, renewed repeatedly, and is One-Club Minded. */
function devoted(s: GameState, p: Player): void {
  p.traits = [{ id: "club_oriented", xp: STAGE_XP.owned, since: s.season }];
  p.clubSince = { clubId: p.clubId as string, season: s.season - 10 };
  p.stay = { clubId: p.clubId as string, seasons: 9, minutes: 9 * 2800, renewals: 3, freeStays: 0, declined: 0, wavered: 0 };
  p.hidden = { ...p.hidden, loyalty: 90 };
}

/** A player with no roots at his club: newly arrived, no renewals, no trait, low loyalty. */
function fresh(s: GameState, p: Player): void {
  p.traits = [];
  p.clubSince = { clubId: p.clubId as string, season: s.season };
  delete p.stay;
  p.hidden = { ...p.hidden, loyalty: 10 };
}

describe("renewal offers carry no automatic raise", () => {
  it("a stagnant or declining player can be offered less than his current wage", () => {
    const s = newCareer({ seed: "wages-raise-stagnant" });
    const u = userPlayer(s);
    const club = s.clubs[u.clubId as string];
    // Paid well above what he is now worth to the club.
    u.contract = { ...u.contract!, wage: Math.round((marketWage(u, s.season) * 1.3) / 100) * 100 };
    const offer = makeTerms(s, Rng.fromSeed("raise-a"), club, u, "renewal").terms.wage;
    expect(offer).toBeLessThan(u.contract.wage);
    // The same is true after a real decline in ability.
    lowerTo(u, overallFor(u.attrs, u.position) - 8);
    const declined = makeTerms(s, Rng.fromSeed("raise-a"), club, u, "renewal").terms.wage;
    expect(declined).toBeLessThan(u.contract.wage);
  });

  it("a player who has improved a lot is offered more than before, on the same contract", () => {
    const s = newCareer({ seed: "wages-raise-improved" });
    const u = userPlayer(s);
    const club = s.clubs[u.clubId as string];
    u.contract = { ...u.contract!, wage: marketWage(u, s.season) };
    const before = makeTerms(s, Rng.fromSeed("raise-b"), club, u, "renewal").terms.wage;
    raiseTo(u, overallFor(u.attrs, u.position) + 8);
    const after = makeTerms(s, Rng.fromSeed("raise-b"), club, u, "renewal").terms.wage;
    expect(after).toBeGreaterThan(before);
  });
});

describe("retention premium", () => {
  it("rises with squadImportance: depth near market, key men above it, never past the market ceiling", () => {
    const s = newCareer({ seed: "wages-premium" });
    const p = npc(s);
    const club = s.clubs[p.clubId as string];
    // No contract on record, so no floor from the old wage; this isolates the club's own valuation.
    p.contract = { ...p.contract!, wage: 0 };
    const market = marketWage(p, s.season);
    const ratio: Record<SquadRole, number> = { prospect: 0, backup: 0, rotation: 0, first: 0, star: 0 };
    for (const role of ROLES) {
      const r = retentionOffer(s, club, p, role);
      ratio[role] = r.wage / market;
      expect(r.maxWage).toBeLessThanOrEqual(Math.round(market * 1.3 / 100) * 100 + 100);
      expect(r.maxWage).toBeGreaterThanOrEqual(r.wage);
    }
    expect(squadImportance(club, p, "star", s.season)).toBeGreaterThan(squadImportance(club, p, "backup", s.season));
    expect(ratio.star).toBeGreaterThanOrEqual(ratio.first);
    expect(ratio.first).toBeGreaterThanOrEqual(ratio.rotation);
    expect(ratio.rotation).toBeGreaterThanOrEqual(ratio.backup);
    expect(ratio.backup).toBeGreaterThanOrEqual(0.8);
    expect(ratio.backup).toBeLessThanOrEqual(1.0);
    expect(ratio.star).toBeLessThanOrEqual(1.25);
  });

  it("a club in the red offers no premium over market", () => {
    const s = newCareer({ seed: "wages-red" });
    const p = npc(s);
    const club = s.clubs[p.clubId as string];
    p.contract = { ...p.contract!, wage: 0 };
    club.balance = -1;
    const market = marketWage(p, s.season);
    expect(retentionOffer(s, club, p, "star").wage / market).toBeLessThanOrEqual(0.96);
  });
});

describe("loyalty only closes a small gap", () => {
  it("reservation wage stays near market and loyalty alone takes at most 8% off a star's", () => {
    const s = newCareer({ seed: "wages-loyal-star" });
    const p = npc(s, (x) => ageOf(x, s.season) <= 28);
    const club = s.clubs[p.clubId as string];
    raiseTo(p, clubLevel(club.reputation) + 8);
    expect(marketDemand(s, p)).toBe(1);
    const market = marketWage(p, s.season);
    const res = reservationWage(s, p);
    expect((market - res) / market).toBeLessThanOrEqual(LOYALTY_DISCOUNT_MAX + 0.005);
    expect(res).toBeGreaterThanOrEqual(Math.round(market * (1 - LOYALTY_DISCOUNT_MAX) / 100) * 100 - 100);
  });

  it("with no other clubs interested the reservation wage still stays within the stated band", () => {
    const s = newCareer({ seed: "wages-loyal-floor" });
    const p = npc(s, (x) => ageOf(x, s.season) >= 25 && ageOf(x, s.season) <= 28);
    lowerTo(p, clubLevel(s.clubs[p.clubId as string].reputation) - 20);
    expect(marketDemand(s, p)).toBe(0);
    const market = marketWage(p, s.season);
    expect(reservationWage(s, p)).toBeGreaterThanOrEqual(market * (1 - 0.08 - 0.18 - 0.04) - 100);
  });

  it("a long-serving, renewed, One-Club Minded player needs no more than a fresh one", () => {
    const s = newCareer({ seed: "wages-loyal-compare" });
    const base = npc(s, (x) => ageOf(x, s.season) <= 28);
    raiseTo(base, clubLevel(s.clubs[base.clubId as string].reputation) + 6);
    const high = structuredClone(base);
    const low = structuredClone(base);
    devoted(s, high);
    fresh(s, low);
    expect(loyaltyPull(s, high)).toBeGreaterThan(loyaltyPull(s, low));
    expect(reservationWage(s, high)).toBeLessThanOrEqual(reservationWage(s, low));
  });

  it("loyalty never makes a 40% lowball acceptable", () => {
    const s = newCareer({ seed: "wages-lowball" });
    const p = npc(s, (x) => ageOf(x, s.season) <= 28);
    raiseTo(p, clubLevel(s.clubs[p.clubId as string].reputation) + 8);
    devoted(s, p);
    const market = marketWage(p, s.season);
    expect(renewalGap(s, p, Math.round(market * 0.6))).toBeGreaterThan(0);
    expect(renewalGap(s, p, Math.round(market * 0.6 / 100) * 100)).toBeGreaterThan(0.1);
  });
});

describe("loyalty pull", () => {
  it("is always between 0 and 1, even at the extremes", () => {
    const s = newCareer({ seed: "wages-pull-range" });
    const p = npc(s, (x) => ageOf(x, s.season) <= 28);
    devoted(s, p);
    p.hidden = { ...p.hidden, loyalty: 100 };
    const maxed = loyaltyPull(s, p);
    expect(maxed).toBeGreaterThanOrEqual(0);
    expect(maxed).toBeLessThanOrEqual(1);
    p.clubId = null;
    expect(loyaltyPull(s, p)).toBe(0);
  });

  it("is lower when the club is in crisis", () => {
    const s = newCareer({ seed: "wages-pull-crisis" });
    const p = npc(s, (x) => ageOf(x, s.season) <= 28);
    devoted(s, p);
    const club = s.clubs[p.clubId as string];
    club.balance = 1_000_000;
    const calm = loyaltyPull(s, p);
    club.balance = -1_000_000;
    expect(loyaltyPull(s, p)).toBeLessThan(calm);
  });

  it("is higher for One-Club Minded than for the same player without the trait", () => {
    const s = newCareer({ seed: "wages-pull-trait" });
    const p = npc(s, (x) => ageOf(x, s.season) <= 28);
    fresh(s, p);
    const plain = structuredClone(p);
    p.traits = [{ id: "club_oriented", xp: STAGE_XP.owned, since: s.season }];
    expect(loyaltyPull(s, p)).toBeGreaterThan(loyaltyPull(s, plain));
  });
});

describe("leaving", () => {
  it("a high-pull player is harder to prise away than a low-pull one with the same offer", () => {
    const s = newCareer({ seed: "wages-leave" });
    const base = npc(s, (x) => ageOf(x, s.season) <= 28);
    raiseTo(base, clubLevel(s.clubs[base.clubId as string].reputation) + 4);
    const high = structuredClone(base);
    const low = structuredClone(base);
    devoted(s, high);
    fresh(s, low);
    const buyer = Object.values(s.clubs).filter((c) => c.id !== base.clubId).sort((a, b) => b.reputation - a.reputation)[0];
    // The lowest wage multiple at which the buyer can prise him away, on a fine grid.
    const threshold = (q: Player): number => {
      for (let m = 1; m <= 3; m += 0.02) {
        if (playerWillJoin(s, q, buyer, Math.round((q.contract!.wage * m) / 100) * 100)) return m;
      }
      return Infinity;
    };
    expect(threshold(high)).toBeGreaterThanOrEqual(threshold(low));
  });
});

describe("expiring NPC contracts", () => {
  /** Leaves only the chosen player's contract expiring this season, so the NPC pass is about him alone. */
  function onlyExpiring(s: GameState, p: Player): void {
    for (const q of Object.values(s.players)) {
      if (q.contract && q !== p) q.contract = { ...q.contract, expires: s.season + 5 };
    }
    p.contract = { ...p.contract!, expires: s.season };
  }

  it("a renewed wage follows the club's retention offer, with no 1.08x floor on the old wage", () => {
    let renewed = 0;
    for (const seed of ["npc-a", "npc-b", "npc-c", "npc-d", "npc-e", "npc-f"]) {
      const s = newCareer({ seed: "wages-npc-renew" });
      const p = npc(s, (x) => ageOf(x, s.season + 1) <= 30 && x.contract?.role !== "prospect");
      const club = s.clubs[p.clubId as string];
      raiseTo(p, clubLevel(club.reputation) + 2);
      // An old contract far above what the player is worth now: any renewal must come in well under it.
      p.contract = { ...p.contract!, wage: Math.round((marketWage(p, s.season) * 1.6) / 100) * 100 };
      devoted(s, p);
      onlyExpiring(s, p);
      const oldWage = p.contract.wage;
      const offer = retentionOffer(s, club, p, p.contract.role);
      const need = reservationWage(s, p);
      const expected = offer.importance >= 0.3 && need > offer.wage && need <= offer.maxWage ? need : offer.wage;
      processExpiringContracts(s, Rng.fromSeed(seed));
      if (p.clubId === club.id && p.contract && p.contract.expires > s.season) {
        renewed++;
        expect(p.contract.wage).toBe(expected);
        expect(p.contract.wage).toBeLessThan(oldWage * 1.08);
      }
    }
    expect(renewed).toBeGreaterThan(0);
  });

  it("a player whose asking price is far beyond the club's offer leaves", () => {
    const s = newCareer({ seed: "wages-npc-leave" });
    const p = npc(s, (x) => ageOf(x, s.season + 1) <= 27);
    const club = s.clubs[p.clubId as string];
    // A backup of a level that wants him at the going rate, with no form or standing to add to his importance.
    raiseTo(p, clubLevel(club.reputation) + 3);
    fresh(s, p);
    p.form = 5.8;
    p.reputation = 0;
    p.contract = { ...p.contract!, role: "backup", wage: 0 };
    // The club is in the red and its wage bill is stretched: no premium, so the offer sits well under his worth.
    club.balance = -1;
    for (const q of squadOf(s, club.id)) if (q !== p && q.contract) q.contract = { ...q.contract, wage: 1_000_000 };
    onlyExpiring(s, p);
    const offer = retentionOffer(s, club, p, "backup");
    expect(offer.importance).toBeLessThan(0.3);
    expect(renewalGap(s, p, offer.wage)).toBeGreaterThan(0.12);
    processExpiringContracts(s, Rng.fromSeed("npc-leave"));
    expect(p.clubId).toBeNull();
    expect(p.contract).toBeNull();
  });
});

describe("determinism", () => {
  it("the same seed gives the same renewal wages", () => {
    const run = () => {
      const s = newCareer({ seed: "wages-determinism" });
      const u = userPlayer(s);
      const club = s.clubs[u.clubId as string];
      const offer = makeTerms(s, Rng.fromSeed("det"), club, u, "renewal").terms.wage;
      processExpiringContracts(s, Rng.fromSeed("det-npc"));
      const wages = Object.values(s.players).map((p) => [p.id, p.contract?.wage ?? null, p.clubId]);
      return { offer, wages: JSON.stringify(wages) };
    };
    const a = run();
    const b = run();
    expect(a.offer).toBe(b.offer);
    expect(a.wages).toBe(b.wages);
  });
});
