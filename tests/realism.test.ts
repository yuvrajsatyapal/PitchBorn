import { describe, expect, it } from "vitest";
import { generateUserOffers, negotiate } from "../src/engine/career/offers";
import { MatchEngine, type MatchPlayerInput, type TeamInput } from "../src/engine/match/engine";
import { FORMATIONS } from "../src/engine/match/lineup";
import { overallFor } from "../src/engine/players/attributes";
import { generatePlayer } from "../src/engine/players/generate";
import { keeperMetrics, keeperScore } from "../src/engine/players/keeper";
import { Rng } from "../src/engine/rng";
import { advanceTurn } from "../src/engine/season/advance";
import { clubLevel } from "../src/engine/world/create";
import { userPlayer } from "../src/engine/world/helpers";
import type { GameState, StatLine } from "../src/engine/types";
import { newCareer } from "./helpers";

// ---------------------------------------------------------------- contracts

describe("contract length", () => {
  it("a contract lasts through its final season before the player becomes a free agent", () => {
    const s = newCareer({ seed: "ct-1" });
    const p = userPlayer(s);
    const expires = p.contract!.expires;
    let lastSeason = s.season;
    const clubAtStart: Record<number, string | null> = {};
    while (s.season <= expires + 1) {
      advanceTurn(s);
      if (s.season !== lastSeason) {
        clubAtStart[s.season] = p.clubId;
        lastSeason = s.season;
      }
    }
    expect(clubAtStart[expires]).toBe(p.history.length ? clubAtStart[expires] : null);
    expect(clubAtStart[expires]).not.toBeNull(); // still under contract entering the final season
    expect(clubAtStart[expires + 1]).toBeNull(); // free only after it
  });

  it("accepting a renewal extends the existing deal and keeps the player at the club", () => {
    const s = newCareer({ seed: "ct-2" });
    const p = userPlayer(s);
    const before = p.contract!.expires;
    s.user.offers.unshift({
      id: "o-renew", kind: "renewal", fromClubId: p.clubId!, toPlayerClubId: p.clubId, fee: 0,
      terms: { wage: 5000, years: 3, role: "first", signingBonus: 0, goalBonus: 0 }, maxWage: 6000, patience: 2, status: "terms",
      createdTurn: s.turn, expiresTurn: s.turn + 6, season: s.season, history: [],
    } as never);
    expect(negotiate(s, "o-renew", { type: "accept" }, Rng.fromSeed("x")).ok).toBe(true);
    expect(p.contract!.expires).toBe(before + 3);
    for (let i = 0; i < 50 * (before + 1 - s.season + 1); i++) advanceTurn(s);
    expect(p.clubId).toBe(s.players[s.user.playerId].clubId);
    expect(p.clubId).not.toBeNull();
  });

  it("a short renewal can never shorten a longer existing contract", () => {
    const s = newCareer({ seed: "ct-3" });
    const p = userPlayer(s);
    p.contract!.expires = s.season + 3;
    s.user.offers.unshift({
      id: "o-short", kind: "renewal", fromClubId: p.clubId!, toPlayerClubId: p.clubId, fee: 0,
      terms: { wage: 5000, years: 1, role: "first", signingBonus: 0, goalBonus: 0 }, maxWage: 6000, patience: 2, status: "terms",
      createdTurn: s.turn, expiresTurn: s.turn + 6, season: s.season, history: [],
    } as never);
    negotiate(s, "o-short", { type: "accept" }, Rng.fromSeed("x"));
    expect(p.contract!.expires).toBeGreaterThanOrEqual(s.season + 4);
  });
});

// ---------------------------------------------------------------- offers

describe("contract offers match the player's level", () => {
  it("a star free agent is not offered deals by much weaker clubs", () => {
    const s = newCareer({ seed: "of-1", clubId: "eng-ipswich-town" });
    const p = userPlayer(s);
    for (const k in p.attrs) p.attrs[k as keyof typeof p.attrs] = 90;
    p.reputation = 80;
    p.clubId = null;
    p.contract = null;
    const ovr = overallFor(p.attrs, p.position);
    const rng = Rng.fromSeed("of-1-rng");
    const levels: number[] = [];
    for (let i = 0; i < 300; i++) {
      s.user.offers = [];
      s.turn = 2; // the summer window
      generateUserOffers(s, rng);
      for (const o of s.user.offers) levels.push(clubLevel(s.clubs[o.fromClubId].reputation));
    }
    expect(levels.length).toBeGreaterThan(20);
    expect(Math.min(...levels)).toBeGreaterThanOrEqual(ovr - 12);
    expect(levels.filter((l) => l < ovr - 9).length / levels.length).toBeLessThan(0.05);
  });
});

// ---------------------------------------------------------------- the match engine

let n = 0;
function player(rng: Rng, slot: (typeof FORMATIONS)["4-3-3"][number], ovr: number, id?: string): MatchPlayerInput {
  const p = generatePlayer(rng, { id: id ?? `p${n++}`, nationality: "ENG", position: slot, age: 26, season: 2026, overall: ovr + rng.normal(0, 2), potential: ovr, clubId: null });
  return { id: p.id, name: p.lastName, slot, attrs: p.attrs, fitness: 95, morale: 70, form: 6.6, sharpness: 80, bigMatch: 50, consistency: 55 };
}
function side(rng: Rng, ovr: number, star?: { slot: (typeof FORMATIONS)["4-3-3"][number]; ovr: number }): TeamInput {
  return {
    id: "T", name: "T", short: "T", mentality: 0, color: "#000",
    starters: FORMATIONS["4-3-3"].map((slot) => (star && slot === star.slot ? player(rng, slot, star.ovr, "STAR") : player(rng, slot, ovr))),
    bench: (["GK", "CB", "CM", "ST", "RW", "LB", "DM"] as const).map((s) => player(rng, s, ovr)),
  };
}
function season(slot: "ST" | "RW" | "CM" | "GK", ovr: number, N = 260) {
  const rng = Rng.fromSeed(`real-${slot}-${ovr}`);
  const opp = side(rng, 76);
  const ratings: number[] = [];
  let goals = 0, assists = 0, clean = 0, conceded = 0;
  for (let i = 0; i < N; i++) {
    const r = new MatchEngine({ home: side(rng, 76, { slot, ovr }), away: opp, importance: 1, detail: false }, rng.fork(i)).runToEnd();
    const l = r.lines.find((x) => x.id === "STAR")!;
    ratings.push(l.rating);
    goals += l.goals;
    assists += l.assists;
    if (r.awayGoals === 0) clean++;
    conceded += r.awayGoals;
  }
  const mean = ratings.reduce((a, b) => a + b, 0) / N;
  const sd = Math.sqrt(ratings.reduce((a, b) => a + (b - mean) ** 2, 0) / N);
  return { mean, sd, goalsPer38: (goals / N) * 38, assistsPer38: (assists / N) * 38, cleanRate: clean / N, conceded: conceded / N };
}

describe("quality shows up in ratings, goals and assists", () => {
  it("better strikers rate higher and score far more, and ratings vary game to game", () => {
    const low = season("ST", 70);
    const mid = season("ST", 82);
    const high = season("ST", 92);
    expect(high.mean).toBeGreaterThan(mid.mean + 0.3);
    expect(mid.mean).toBeGreaterThan(low.mean + 0.3);
    expect(high.mean).toBeGreaterThan(7.4);
    expect(high.goalsPer38).toBeGreaterThan(24);
    expect(low.goalsPer38).toBeLessThan(15);
    expect(high.goalsPer38).toBeGreaterThan(low.goalsPer38 * 1.8);
    for (const x of [low, mid, high]) expect(x.sd).toBeGreaterThan(0.8);
  });

  it("star midfielders and wingers rate and create more than average ones", () => {
    const cmLow = season("CM", 72);
    const cmHigh = season("CM", 90);
    expect(cmHigh.mean).toBeGreaterThan(cmLow.mean + 0.6);
    const rwLow = season("RW", 72);
    const rwHigh = season("RW", 90);
    expect(rwHigh.assistsPer38).toBeGreaterThan(rwLow.assistsPer38 * 1.3);
  });

  it("goalkeepers are rated on clean sheets and goals prevented", () => {
    const low = season("GK", 65, 700);
    const high = season("GK", 90, 700);
    expect(high.cleanRate).toBeGreaterThan(low.cleanRate + 0.03);
    expect(high.conceded).toBeLessThan(low.conceded - 0.12);
    expect(high.mean).toBeGreaterThan(low.mean + 0.7);
  });
});

describe("goalkeeper metrics", () => {
  const line = (over: Partial<StatLine>): StatLine => ({ apps: 30, starts: 30, minutes: 2700, goals: 0, assists: 0, cleanSheets: 10, conceded: 30, yellow: 0, red: 0, ratingSum: 200, motm: 0, shots: 0, shotsOnTarget: 0, keyPasses: 0, tackles: 0, saves: 90, ...over } as StatLine);
  it("derives clean-sheet rate, save % and conceded per 90", () => {
    const m = keeperMetrics(line({}));
    expect(m.cleanSheetRate).toBeCloseTo(1 / 3);
    expect(m.savePct).toBeCloseTo(0.75);
    expect(m.concededPer90).toBeCloseTo(1);
  });
  it("ranks a keeper with more clean sheets and a better save rate higher", () => {
    expect(keeperScore(line({ cleanSheets: 18, conceded: 20, saves: 100 }))).toBeGreaterThan(keeperScore(line({})));
    expect(keeperScore(line({}))).toBeGreaterThan(keeperScore(line({ cleanSheets: 4, conceded: 55, saves: 80 })));
  });
});

void (undefined as unknown as GameState);
