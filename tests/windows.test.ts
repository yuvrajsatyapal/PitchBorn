import { describe, expect, it } from "vitest";
import { isTransferWindow, turnDate, windowName } from "../src/engine/calendar";
import { assessSaga } from "../src/engine/career/saga/eligibility";
import { expireOffers, generateUserOffers, negotiate } from "../src/engine/career/offers";
import { advanceTurn } from "../src/engine/season/advance";
import { Rng } from "../src/engine/rng";
import type { GameState } from "../src/engine/types";
import { removeFromSquad, userPlayer } from "../src/engine/world/helpers";
import { newCareer } from "./helpers";

const inSummer = (d: Date) => d.getUTCMonth() === 6 || d.getUTCMonth() === 7; // July, August
const inJanuary = (d: Date) => d.getUTCMonth() === 0;

describe("transfer windows follow the real calendar", () => {
  it("open exactly 1 Jul–31 Aug and 1–31 Jan, and closed otherwise", () => {
    for (const season of [2026, 2027, 2028, 2031]) {
      for (let turn = 1; turn <= 50; turn++) {
        const d = turnDate(season, turn);
        const expected = inSummer(d) || inJanuary(d);
        expect(isTransferWindow(turn), `${season} turn ${turn} ${d.toISOString().slice(0, 10)}`).toBe(expected);
        if (expected) expect(windowName(turn)).toBe(inSummer(d) ? "summer" : "january");
        else expect(windowName(turn)).toBeNull();
      }
    }
    expect(turnDate(2026, 1).toISOString().slice(0, 10)).toBe("2026-07-01");
    expect(isTransferWindow(9)).toBe(true); // 26 Aug
    expect(isTransferWindow(10)).toBe(false); // 2 Sep
    expect(isTransferWindow(27)).toBe(false); // 30 Dec
    expect(isTransferWindow(28)).toBe(true); // 6 Jan
    expect(isTransferWindow(32)).toBe(false); // 3 Feb
  });
});

describe("players under contract only move in a window; free agents can sign any time", () => {
  const rng = () => Rng.fromSeed("win");
  function star(seed: string): GameState {
    const s = newCareer({ seed });
    const p = userPlayer(s);
    for (const k of Object.keys(p.attrs)) (p.attrs as Record<string, number>)[k] = 88;
    p.reputation = 85;
    for (const c of Object.values(s.clubs)) c.balance = 5e9;
    return s;
  }

  it("a player under contract gets no offers outside a window", () => {
    const s = star("w-1");
    for (let i = 0; i < 80; i++) {
      for (const turn of [10, 15, 20, 27, 32, 40, 44, 47, 50]) {
        s.turn = turn;
        generateUserOffers(s, rng());
      }
    }
    expect(s.user.offers).toHaveLength(0);
  });

  it("a free agent is offered deals at any time of year, and can join straight away", () => {
    const free = star("w-2");
    const p = userPlayer(free);
    removeFromSquad(free, p.id);
    p.clubId = null;
    p.contract = null;
    const r = rng();
    const closed = [10, 15, 20, 27, 33, 40, 44];
    for (let i = 0; i < 80; i++) {
      free.turn = closed[i % closed.length];
      generateUserOffers(free, r);
    }
    expect(free.user.offers.length).toBeGreaterThan(0);
    expect(free.user.offers.every((o) => o.kind === "free")).toBe(true);
    const offer = free.user.offers.find((o) => o.status === "terms")!;
    free.turn = 15; // mid-September: no window
    expect(isTransferWindow(free.turn)).toBe(false);
    expireOffers(free);
    expect(offer.status).toBe("terms");
    const res = negotiate(free, offer.id, { type: "accept" }, r);
    expect(res.completed).toBe(true);
    expect(p.clubId).toBe(offer.fromClubId);
  });

  it("an offer cannot be completed once the window has closed", () => {
    const s = star("w-3");
    const p = userPlayer(s);
    const buyer = Object.values(s.clubs).find((c) => c.id !== p.clubId)!;
    s.turn = 5;
    s.user.offers.push({ id: "o1", kind: "transfer", fromClubId: buyer.id, toPlayerClubId: p.clubId, fee: 1e6, terms: { wage: 10_000, years: 3, role: "first", signingBonus: 0, goalBonus: 0 }, maxWage: 12_000, patience: 2, status: "terms", createdTurn: 5, expiresTurn: 20, season: s.season, history: [] });
    const home = p.clubId;
    s.turn = 12; // September: closed
    const res = negotiate(s, "o1", { type: "accept" }, rng());
    expect(res.ok).toBe(false);
    expect(res.message).toContain("window is closed");
    expect(p.clubId).toBe(home);
    expect(s.user.offers[0].status).toBe("expired");
    expect(s.user.transfers).toHaveLength(0);
  });

  it("the same offer can be completed while the window is open", () => {
    const s = star("w-4");
    const p = userPlayer(s);
    const buyer = Object.values(s.clubs).find((c) => c.id !== p.clubId)!;
    s.turn = 5;
    s.user.offers.push({ id: "o1", kind: "transfer", fromClubId: buyer.id, toPlayerClubId: p.clubId, fee: 1e6, terms: { wage: 10_000, years: 3, role: "first", signingBonus: 0, goalBonus: 0 }, maxWage: 12_000, patience: 2, status: "terms", createdTurn: 5, expiresTurn: 20, season: s.season, history: [] });
    expect(negotiate(s, "o1", { type: "accept" }, rng()).completed).toBe(true);
    expect(p.clubId).toBe(buyer.id);
  });

  it("renewals can be agreed at any time, and rejecting is always allowed", () => {
    const s = star("w-5");
    const p = userPlayer(s);
    s.turn = 20;
    s.user.offers.push({ id: "r1", kind: "renewal", fromClubId: p.clubId as string, toPlayerClubId: p.clubId, fee: 0, terms: { wage: 50_000, years: 2, role: "first", signingBonus: 0, goalBonus: 0 }, maxWage: 60_000, patience: 2, status: "terms", createdTurn: 20, expiresTurn: 26, season: s.season, history: [] });
    expect(negotiate(s, "r1", { type: "accept" }, rng()).completed).toBe(true);
    s.user.offers.push({ id: "t1", kind: "transfer", fromClubId: Object.keys(s.clubs).find((c) => c !== p.clubId) as string, toPlayerClubId: p.clubId, fee: 1e6, terms: { wage: 10_000, years: 3, role: "first", signingBonus: 0, goalBonus: 0 }, maxWage: 12_000, patience: 2, status: "terms", createdTurn: 5, expiresTurn: 30, season: s.season, history: [] });
    expect(negotiate(s, "t1", { type: "reject" }, rng()).ok).toBe(true);
  });

  it("open offers lapse when the window closes", () => {
    const s = star("w-6");
    const p = userPlayer(s);
    const buyer = Object.values(s.clubs).find((c) => c.id !== p.clubId)!;
    s.turn = 9;
    s.user.offers.push({ id: "o1", kind: "transfer", fromClubId: buyer.id, toPlayerClubId: p.clubId, fee: 1e6, terms: { wage: 10_000, years: 3, role: "first", signingBonus: 0, goalBonus: 0 }, maxWage: 12_000, patience: 2, status: "terms", createdTurn: 8, expiresTurn: 20, season: s.season, history: [] });
    expireOffers(s);
    expect(s.user.offers[0].status).toBe("terms");
    s.turn = 10;
    expireOffers(s);
    expect(s.user.offers[0].status).toBe("expired");
  });

  it("transfer sagas can only begin while a window is open or about to open", () => {
    const s = star("w-7");
    const club = Object.values(s.clubs).filter((c) => c.id !== userPlayer(s).clubId).sort((a, b) => b.reputation - a.reputation)[0];
    for (const turn of [10, 15, 20, 23, 33, 40, 50]) {
      s.turn = turn;
      s.turnIndex = turn;
      expect(assessSaga(s, club, "transfer", 5e7).blocked, `turn ${turn}`).toBe("window closed");
    }
    for (const turn of [1, 2, 28, 24]) {
      s.turn = turn;
      s.turnIndex = turn;
      expect(assessSaga(s, club, "transfer", 5e7).blocked, `turn ${turn}`).not.toBe("window closed");
    }
  });
});

describe("the world follows the same windows", () => {
  it("every transfer in a season happens on a window turn, and clubs do trade inside the windows", () => {
    const s = newCareer({ seed: "w-world" });
    for (let t = 1; t <= 50; t++) advanceTurn(s);
    expect(s.transferLog.length).toBeGreaterThan(5);
    for (const e of s.transferLog) expect(isTransferWindow(e.turn), `${e.name} moved on turn ${e.turn}`).toBe(true);
    // Both windows saw business.
    expect(s.transferLog.some((e) => e.season === s.season - 1 && e.turn <= 9)).toBe(true);
    expect(s.transferLog.some((e) => e.turn >= 28 && e.turn <= 31)).toBe(true);
  }, 120000);
});
