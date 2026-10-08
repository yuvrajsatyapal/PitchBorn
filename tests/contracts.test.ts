import { describe, expect, it } from "vitest";
import { payMatchBonuses, payPromotionBonus, payTrophyBonus, applyWageRise } from "../src/engine/career/bonuses";
import { extrasWeekly, normaliseClauses, packageWeekly, relevantClauses, sanitizeClauses, signingBonusCeiling } from "../src/engine/career/contracts";
import { evaluateBid, generateUserOffers, makeTerms, negotiate, processBids } from "../src/engine/career/offers";
import { ledgerOf, payOnce } from "../src/engine/career/money";
import { marketValue } from "../src/engine/players/economy";
import { Rng } from "../src/engine/rng";
import type { Competition, ContractTerms, Fixture, GameState, TransferOffer } from "../src/engine/types";
import { userPlayer } from "../src/engine/world/helpers";
import { migrateState } from "../src/persistence/migrations";
import { decodeState, encodeState } from "../src/persistence/codec";
import { newCareer } from "./helpers";

const rng = () => Rng.fromSeed("contracts");

function offerFor(s: GameState, over: Partial<TransferOffer> = {}, terms: Partial<ContractTerms> = {}): TransferOffer {
  const p = userPlayer(s);
  const o: TransferOffer = {
    id: "o-test",
    kind: "renewal",
    fromClubId: p.clubId as string,
    toPlayerClubId: p.clubId,
    fee: 0,
    terms: { wage: 10_000, years: 3, role: "first", signingBonus: 50_000, goalBonus: 0, ...terms },
    maxWage: 13_000,
    patience: 3,
    status: "terms",
    createdTurn: s.turn,
    expiresTurn: s.turn + 6,
    season: s.season,
    history: [],
    ...over,
  };
  s.user.offers.unshift(o);
  return o;
}

const line = (over: Record<string, unknown> = {}) => ({ id: "u", side: "home", slot: "ST", started: true, minuteOn: 0, minuteOff: 90, rating: 7, goals: 0, assists: 0, shots: 0, onTarget: 0, keyPasses: 0, tackles: 0, saves: 0, fouls: 0, yellow: 0, red: 0, injured: false, conceded: 0, ...over }) as never;
const fix = (s: GameState, id: string): { f: Fixture; c: Competition } => {
  const p = userPlayer(s);
  const c = Object.values(s.competitions).find((x) => x.kind === "league" && x.teams.includes(p.clubId as string)) as Competition;
  return { f: { id, compId: c.id, round: 1, turn: 5, home: p.clubId as string, away: c.teams.find((t) => t !== p.clubId) as string }, c };
};

describe("signing bonus", () => {
  it("is paid once, when the contract is signed, and booked as career earnings", () => {
    const s = newCareer({ seed: "sb1" });
    const o = offerFor(s);
    const before = { bank: s.user.bank, earn: s.user.earnings, club: s.clubs[o.fromClubId].balance };
    expect(ledgerOf(s).career.signing ?? 0).toBe(0);
    const r = negotiate(s, o.id, { type: "accept" }, rng());
    expect(r.completed).toBe(true);
    expect(s.user.earnings - before.earn).toBe(50_000);
    expect(ledgerOf(s).career.signing).toBe(50_000);
    expect(before.club - s.clubs[o.fromClubId].balance).toBe(50_000);
    // A second attempt on the same offer pays nothing more.
    expect(negotiate(s, o.id, { type: "accept" }, rng()).ok).toBe(false);
    expect(s.user.earnings - before.earn).toBe(50_000);
  });

  it("is not paid when an offer is merely proposed or turned down", () => {
    const s = newCareer({ seed: "sb2" });
    const earned = s.user.earnings;
    const o = offerFor(s);
    expect(s.user.earnings).toBe(earned);
    negotiate(s, o.id, { type: "reject" }, rng());
    expect(s.user.earnings).toBe(earned);
  });

  it("is capped by what the club can afford, with no patience lost for asking too much", () => {
    const s = newCareer({ seed: "sb3" });
    const o = offerFor(s);
    const club = s.clubs[o.fromClubId];
    club.balance = 0;
    expect(signingBonusCeiling(club, userPlayer(s), o.terms.wage)).toBe(0);
    const r = negotiate(s, o.id, { type: "counter", wage: 10_500, signingBonus: 900_000 }, rng());
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/afford/);
    expect(o.patience).toBe(3);
    expect(o.status).toBe("terms");
  });

  it("is bigger for a bigger name, and never opens with more than the club can pay", () => {
    const s = newCareer({ seed: "sb4" });
    const p = userPlayer(s);
    const club = s.clubs[p.clubId as string];
    club.balance = 2e7;
    p.reputation = 20;
    const small = signingBonusCeiling(club, p, 10_000);
    p.reputation = 90;
    expect(signingBonusCeiling(club, p, 10_000)).toBeGreaterThan(small);
    club.balance = 100_000;
    const t = makeTerms(s, rng(), club, p, "free").terms;
    expect(t.signingBonus).toBeLessThanOrEqual(signingBonusCeiling(club, p, t.wage));
  });
});

describe("package negotiation", () => {
  it("makes the clauses trade off against wage within one budget", () => {
    const s = newCareer({ seed: "pk1" });
    const p = userPlayer(s);
    const o = offerFor(s, { maxWage: 12_000 });
    const club = s.clubs[o.fromClubId];
    const lean = normaliseClauses({ ...o.terms, wage: 12_000, signingBonus: 0 }, p.position);
    const heavy = normaliseClauses({ ...o.terms, wage: 12_000, signingBonus: 200_000, appearanceBonus: 3_000, goalBonus: 6_000, trophyBonus: 60_000 }, p.position);
    expect(packageWeekly(heavy, p, club, s)).toBeGreaterThan(packageWeekly(lean, p, club, s));
  });

  it("agrees a package inside the ceiling and counters one outside it", () => {
    const s = newCareer({ seed: "pk2" });
    const o = offerFor(s, { maxWage: 11_000 }, { signingBonus: 0 });
    const r1 = negotiate(s, o.id, { type: "counter", wage: 30_000 }, rng());
    expect(r1.completed).toBeUndefined();
    expect(o.patience).toBe(2);
    expect(o.terms.wage).toBeLessThanOrEqual(11_000);
    const s2 = newCareer({ seed: "pk2" });
    const o2 = offerFor(s2, { maxWage: 12_000 }, { signingBonus: 0 });
    expect(negotiate(s2, o2.id, { type: "counter", wage: 10_200, role: "first" }, rng()).completed).toBe(true);
  });

  it("walks away when patience runs out", () => {
    const s = newCareer({ seed: "pk3" });
    const o = offerFor(s, { maxWage: 10_500, patience: 1 });
    const r = negotiate(s, o.id, { type: "counter", wage: 60_000 }, rng());
    expect(r.ok).toBe(false);
    expect(o.status).toBe("withdrawn");
  });

  it("only writes clauses that make sense for the position", () => {
    expect(relevantClauses("GK")).toContain("cleanSheetBonus");
    expect(relevantClauses("GK")).not.toContain("goalBonus");
    expect(relevantClauses("ST")).toContain("goalBonus");
    expect(relevantClauses("ST")).not.toContain("cleanSheetBonus");
    const s = newCareer({ seed: "pk4", position: "GK" });
    const gk = userPlayer(s);
    const t = normaliseClauses({ wage: 5000, years: 2, role: "first", signingBonus: 0, goalBonus: 900, cleanSheetBonus: 400, assistBonus: 300 }, gk.position);
    expect(t.goalBonus).toBe(0);
    expect(t.assistBonus).toBeUndefined();
    expect(t.cleanSheetBonus).toBe(400);
  });

  it("opens with position-appropriate bonuses and a package a club can afford", () => {
    const s = newCareer({ seed: "pk5" });
    const p = userPlayer(s);
    const club = s.clubs[p.clubId as string];
    const { terms } = makeTerms(s, rng(), club, p, "transfer");
    expect(terms.cleanSheetBonus).toBeUndefined();
    expect(extrasWeekly(terms, p, club, s)).toBeLessThan(terms.wage);
  });
});

describe("release clauses", () => {
  function clauseState(clause: number) {
    const s = newCareer({ seed: "rc1" });
    const p = userPlayer(s);
    p.contract!.releaseClause = clause;
    for (const c of Object.values(s.clubs)) c.balance = Math.max(c.balance, 1e9);
    return { s, p };
  }
  const bid = (s: GameState, fee: number): TransferOffer => offerFor(s, { kind: "transfer", fromClubId: Object.keys(s.clubs).find((c) => c !== userPlayer(s).clubId) as string, fee, status: "club-pending" });

  it("activates when a bid meets the clause, even if the club would refuse it", () => {
    const { s, p } = clauseState(8_000_000);
    const value = marketValue(p, s.season);
    const o = bid(s, 8_000_000);
    expect(evaluateBid(s, bid(s, Math.round(value * 0.5)), rng()).accept).toBe(false);
    const v = evaluateBid(s, o, rng());
    expect(v.clause).toBe(true);
    expect(v.accept).toBe(true);
  });

  it("does not activate below the clause", () => {
    const { s } = clauseState(8_000_000);
    expect(evaluateBid(s, bid(s, 7_999_999), rng()).clause).toBe(false);
  });

  it("still leaves the player to agree personal terms, and respects the transfer window", () => {
    const { s } = clauseState(8_000_000);
    const o = bid(s, 8_000_000);
    o.status = "terms"; // what processBids does after the clause is met
    o.terms = { wage: 20_000, years: 3, role: "first", signingBonus: 0, goalBonus: 0 };
    const home = userPlayer(s).clubId;
    s.turn = 20; // window closed
    const r = negotiate(s, o.id, { type: "accept" }, rng());
    expect(r.completed).toBeUndefined();
    expect(userPlayer(s).clubId).toBe(home);
    expect(o.status).toBe("expired");
  });

  it("is not transferred automatically: the bid only opens personal terms", () => {
    const { s } = clauseState(8_000_000);
    const home = userPlayer(s).clubId;
    s.turn = 3;
    const o = bid(s, 8_000_000);
    processBids(s, rng());
    expect(o.status).toBe("terms");
    expect(o.history.join(" ")).toMatch(/Release clause triggered/);
    expect(userPlayer(s).clubId).toBe(home);
    expect(s.transferLog.some((t) => t.playerId === userPlayer(s).id)).toBe(false);
  });

  it("lets a lower clause attract more interest than none", () => {
    const { s, p } = clauseState(1_000_000);
    s.turn = 3;
    let withClause = 0;
    let without = 0;
    for (let i = 0; i < 40; i++) {
      p.contract!.releaseClause = 1_000_000;
      s.user.offers = [];
      generateUserOffers(s, Rng.fromSeed(`o${i}`));
      withClause += s.user.offers.length;
      delete p.contract!.releaseClause;
      s.user.offers = [];
      generateUserOffers(s, Rng.fromSeed(`o${i}`));
      without += s.user.offers.length;
    }
    expect(withClause).toBeGreaterThanOrEqual(without);
  });
});

describe("performance bonuses", () => {
  function bonusState(position: "ST" | "GK" = "ST") {
    const s = newCareer({ seed: `bn-${position}`, position });
    const p = userPlayer(s);
    p.contract = { ...p.contract!, appearanceBonus: 1_000, goalBonus: 2_000, assistBonus: 1_500, cleanSheetBonus: 3_000, trophyBonus: 50_000, promotionBonus: 80_000 };
    return { s, p };
  }

  it("pays appearance, goal and assist bonuses from the real match line", () => {
    const { s } = bonusState();
    const { f, c } = fix(s, "f-a");
    const paid = payMatchBonuses(s, f, c, line({ goals: 2, assists: 1 }));
    expect(paid).toBe(1_000 + 2 * 2_000 + 1_500);
    const l = ledgerOf(s).career;
    expect([l.appearance, l.goal, l.assist]).toEqual([1_000, 4_000, 1_500]);
    expect(s.user.earnings).toBe(paid);
  });

  it("pays a clean-sheet bonus only for a defender or keeper who played 60+ minutes and conceded nothing", () => {
    const { s } = bonusState("GK");
    const { f, c } = fix(s, "f-cs");
    expect(payMatchBonuses(s, f, c, line({ slot: "GK", conceded: 1 }))).toBe(1_000);
    const { f: f2, c: c2 } = fix(s, "f-cs2");
    expect(payMatchBonuses(s, f2, c2, line({ slot: "GK", conceded: 0, minuteOff: 50 }))).toBe(1_000);
    const { f: f3, c: c3 } = fix(s, "f-cs3");
    expect(payMatchBonuses(s, f3, c3, line({ slot: "GK", conceded: 0 }))).toBe(1_000 + 3_000);
    const { f: f4, c: c4 } = fix(s, "f-cs4");
    expect(payMatchBonuses(s, f4, c4, line({ slot: "ST", conceded: 0 }))).toBe(1_000);
  });

  it("never pays the same match twice (resimulation, reload, repeated calls)", () => {
    const { s } = bonusState();
    const { f, c } = fix(s, "f-dup");
    const first = payMatchBonuses(s, f, c, line({ goals: 1 }));
    expect(first).toBeGreaterThan(0);
    expect(payMatchBonuses(s, f, c, line({ goals: 1 }))).toBe(0);
    const reloaded = migrateState(JSON.parse(JSON.stringify(decodeState(encodeState(s)))));
    expect(payMatchBonuses(reloaded, f, c, line({ goals: 1 }))).toBe(0);
    expect(reloaded.user.earnings).toBe(first);
  });

  it("pays nothing for international games, on loan, or with no minutes", () => {
    const { s, p } = bonusState();
    const { f, c } = fix(s, "f-x");
    expect(payMatchBonuses(s, f, { ...c, kind: "international" }, line({ goals: 1 }))).toBe(0);
    expect(payMatchBonuses(s, f, c, line({ goals: 1, minuteOff: 0, minuteOn: 0 }))).toBe(0);
    p.loan = { fromClubId: p.clubId as string, untilSeason: s.season };
    expect(payMatchBonuses(s, f, c, line({ goals: 1 }))).toBe(0);
  });

  it("has the club foot the bill", () => {
    const { s, p } = bonusState();
    const { f, c } = fix(s, "f-b");
    const before = s.clubs[p.clubId as string].balance;
    const paid = payMatchBonuses(s, f, c, line({ goals: 1 }));
    expect(before - s.clubs[p.clubId as string].balance).toBe(paid);
  });

  it("pays trophy and promotion bonuses once", () => {
    const { s, p } = bonusState();
    const comp = Object.values(s.competitions).find((x) => x.kind === "league") as Competition;
    comp.winner = p.clubId as string;
    expect(payTrophyBonus(s, comp, true)).toBe(50_000);
    expect(payTrophyBonus(s, comp, true)).toBe(0);
    expect(payPromotionBonus(s, 5)).toBe(0); // not enough games
    expect(payPromotionBonus(s, 20)).toBe(80_000);
    expect(payPromotionBonus(s, 20)).toBe(0);
    const other = { ...comp, id: "elsewhere", winner: "someone-else" } as Competition;
    expect(payTrophyBonus(s, other, true)).toBe(0);
  });

  it("applies an annual wage rise once per season, never in the first year", () => {
    const { s, p } = bonusState();
    p.contract!.wageRise = 0.1;
    p.contract!.signed = s.season;
    const w = p.contract!.wage;
    applyWageRise(s);
    expect(p.contract!.wage).toBe(w);
    s.season++;
    applyWageRise(s);
    applyWageRise(s);
    expect(p.contract!.wage).toBe(Math.round((w * 1.1) / 100) * 100);
  });

  it("payOnce rejects zero and repeated keys", () => {
    const s = newCareer({ seed: "po" });
    expect(payOnce(s, "k", 0, "other")).toBe(false);
    expect(payOnce(s, "k", 10, "other")).toBe(true);
    expect(payOnce(s, "k", 10, "other")).toBe(false);
  });
});

describe("persistence of contracts and earnings", () => {
  it("keeps old contracts valid and itemises past earnings as 'earlier'", () => {
    const s = JSON.parse(JSON.stringify(newCareer({ seed: "old1" })));
    s.schemaVersion = 9;
    s.user.earnings = 123_456;
    delete s.user.pay;
    delete s.user.matchLog;
    const m = migrateState(s);
    expect(m.user.pay?.career.earlier).toBe(123_456);
    expect(m.user.matchLog).toEqual([]);
    const p = m.players[m.user.playerId];
    expect(p.contract?.wage).toBeGreaterThan(0);
    expect(p.contract?.releaseClause).toBeUndefined();
  });

  it("drops malformed clauses without touching good ones", () => {
    const c = { releaseClause: -5, goalBonus: Number.NaN, appearanceBonus: 400, wageRise: 0.9 } as Record<string, number>;
    sanitizeClauses(c);
    expect(c.releaseClause).toBeUndefined();
    expect(c.goalBonus).toBeUndefined();
    expect(c.appearanceBonus).toBe(400);
    expect(c.wageRise).toBeLessThanOrEqual(0.12);
  });

  it("round-trips new contract fields through save and load", () => {
    const s = newCareer({ seed: "old2" });
    userPlayer(s).contract = { ...userPlayer(s).contract!, appearanceBonus: 700, wageRise: 0.05, releaseClause: 9e6 };
    const back = migrateState(JSON.parse(JSON.stringify(decodeState(encodeState(s)))));
    expect(back.players[back.user.playerId].contract).toMatchObject({ appearanceBonus: 700, wageRise: 0.05, releaseClause: 9e6 });
  });
});
