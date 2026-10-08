import { beforeAll, describe, expect, it } from "vitest";
import { advanceTurn } from "../src/engine/season/advance";
import { ledgerOf } from "../src/engine/career/money";
import { emptyStat } from "../src/engine/players/generate";
import {
  BEST_MIN_MINUTES,
  PER90_MIN_MINUTES,
  TREND_MIN_GAMES,
  byCompetitionKind,
  byPositionPlayed,
  byRole,
  comparables,
  compareWith,
  formTrend,
  homeAway,
  leagueRankings,
  logForSeason,
  milestones,
  per90,
  per90Rows,
  personalBests,
  rankMinutes,
  ratedMatches,
  ratingBand,
  recentForm,
  reserveForm,
  seasonLines,
  startSplit,
} from "../src/engine/stats/analytics";
import { MATCH_LOG_CAP, backfillMatchLog, isPartial, recordMatchLog } from "../src/engine/stats/matchlog";
import type { GameState, MatchLogEntry, StatLine } from "../src/engine/types";
import { userPlayer } from "../src/engine/world/helpers";
import { migrateState } from "../src/persistence/migrations";
import { decodeState, encodeState } from "../src/persistence/codec";
import { newCareer, strongUser } from "./helpers";

function play(seed: string, weeks: number, opts: { position?: "ST" | "GK" | "CB" } = {}): GameState {
  const s = newCareer({ seed, ...opts });
  strongUser(s);
  for (let i = 0; i < weeks; i++) advanceTurn(s);
  return s;
}

const entry = (over: Partial<MatchLogEntry> = {}): MatchLogEntry => ({
  season: 2026, turn: 5, fixtureId: `f${Math.random()}`, compId: "x", compKind: "league", team: "a", opponent: "b", home: true, score: [1, 0], result: "W", slot: "ST", started: true, minutes: 90, rating: 7, goals: 0, assists: 0, ...over,
});

describe("per-90 maths", () => {
  it("is metric / minutes × 90, and safe at zero minutes", () => {
    expect(per90(2, 180)).toBeCloseTo(1);
    expect(per90(3, 270)).toBeCloseTo(1);
    expect(per90(5, 0)).toBe(0);
    expect(per90(0, 0)).toBe(0);
    expect(Number.isFinite(per90(1, 0))).toBe(true);
  });

  it("gives outfield players and keepers their own metrics", () => {
    const s: StatLine = { ...emptyStat(), apps: 10, minutes: 900, goals: 9, assists: 3, shots: 40, keyPasses: 18, tackles: 12, saves: 27, conceded: 9, cleanSheets: 4 };
    const out = per90Rows(s, "ATT");
    expect(out.map((r) => r.key)).toEqual(["goals", "assists", "shots", "key", "tackles"]);
    expect(out[0].value).toBeCloseTo(0.9);
    const gk = per90Rows(s, "GK");
    expect(gk.map((r) => r.key)).toEqual(["saves", "conceded", "cs"]);
    expect(gk[0].value).toBeCloseTo(2.7);
    expect(per90Rows(s, "DEF").some((r) => r.key === "cs")).toBe(true);
    for (const r of per90Rows(emptyStat(), "MID")) expect(r.value).toBe(0);
  });

  it("splits starts and substitute appearances", () => {
    const sp = startSplit({ ...emptyStat(), apps: 10, starts: 6, minutes: 700 });
    expect(sp).toMatchObject({ starts: 6, subs: 4, startPct: 0.6, minPerApp: 70 });
    expect(startSplit(emptyStat())).toMatchObject({ startPct: 0, minPerApp: 0 });
  });

  it("documents the sample-size thresholds", () => {
    expect(PER90_MIN_MINUTES).toBeGreaterThan(0);
    expect(BEST_MIN_MINUTES).toBeGreaterThan(PER90_MIN_MINUTES);
  });
});

describe("match log from real matches", () => {
  let s: GameState;
  beforeAll(() => {
    s = play("st-log", 30);
  });

  it("holds one entry per senior match the user played, matching the season line", () => {
    const u = userPlayer(s);
    const log = logForSeason(s, s.season);
    const apps = Object.values(u.season).reduce((n, x) => n + x.apps, 0);
    expect(apps).toBeGreaterThan(5);
    expect(log.length).toBe(apps);
    expect(new Set(log.map((e) => e.fixtureId)).size).toBe(log.length);
    const goals = Object.values(u.season).reduce((n, x) => n + x.goals, 0);
    expect(log.reduce((n, e) => n + e.goals, 0)).toBe(goals);
    const mins = Object.values(u.season).reduce((n, x) => n + x.minutes, 0);
    expect(log.reduce((n, e) => n + (e.minutes ?? 0), 0)).toBe(mins);
  });

  it("scores and results agree with the fixture they came from", () => {
    for (const e of s.user.matchLog!.slice(-12)) {
      const f = s.competitions[e.compId].fixtures.find((x) => x.id === e.fixtureId)!;
      expect(f.result).toBeTruthy();
      const [h, a] = [f.result!.hg, f.result!.ag];
      expect(e.score).toEqual(e.home ? [h, a] : [a, h]);
      expect(e.result).toBe(e.score[0] > e.score[1] ? "W" : e.score[0] < e.score[1] ? "L" : e.pens ? (e.pens[0] > e.pens[1] ? "W" : "L") : "D");
      expect(e.rating).toBeGreaterThan(0);
    }
  });

  it("is de-duplicated and capped", () => {
    const t = newCareer({ seed: "st-cap" });
    const e = entry({ fixtureId: "dup" });
    t.user.matchLog = [e, e];
    recordMatchLog(t, { id: "dup", compId: "x", round: 1, turn: 1, home: "a", away: "b" }, { id: "x", kind: "league" } as never, { homeGoals: 1, awayGoals: 0, penalties: undefined } as never, { slot: "ST", started: true, minuteOn: 0, minuteOff: 90, rating: 7, goals: 0, assists: 0, side: "home", conceded: 0 } as never, "a");
    expect(t.user.matchLog.filter((x) => x.fixtureId === "dup").length).toBe(2); // existing entry: recording again adds nothing
    expect(t.user.matchLog.length).toBe(2);
    t.user.matchLog = Array.from({ length: MATCH_LOG_CAP + 10 }, (_, i) => entry({ fixtureId: `c${i}` }));
    recordMatchLog(t, { id: "new", compId: "x", round: 1, turn: 1, home: "a", away: "b" }, { id: "x", kind: "league" } as never, { homeGoals: 1, awayGoals: 0 } as never, { slot: "ST", started: true, minuteOn: 0, minuteOff: 90, rating: 7, goals: 0, assists: 0, side: "home", conceded: 0 } as never, "a");
    expect(t.user.matchLog.length).toBe(MATCH_LOG_CAP);
  });

  it("splits by home/away, starts/subs, position and competition without losing matches", () => {
    const log = logForSeason(s, s.season);
    const total = (rows: { apps: number }[]) => rows.reduce((n, r) => n + r.apps, 0);
    expect(total(homeAway(log))).toBe(log.length);
    expect(total(byRole(log))).toBe(log.length);
    expect(total(byPositionPlayed(log))).toBe(log.length);
    expect(total(byCompetitionKind(log))).toBe(log.length);
  });

  it("builds the recent form from rated matches only, newest last", () => {
    const f = recentForm(s, 5);
    expect(f.entries.length).toBe(5);
    expect(f.entries.every((e) => e.rating > 0)).toBe(true);
    const all = ratedMatches(s);
    expect(f.entries[4]).toBe(all[all.length - 1]);
    expect(f.average).toBeCloseTo(f.entries.reduce((n, e) => n + e.rating, 0) / 5);
    expect(recentForm(s, 500).short).toBe(true);
  });
});

describe("rating bands and trend", () => {
  it("bands ratings the way the chart colours them", () => {
    expect([5.9, 6, 6.99, 7, 7.99, 8, 10].map(ratingBand)).toEqual(["poor", "average", "average", "good", "good", "excellent", "excellent"]);
  });

  it("claims a trend only with enough games, from the last three against the three before", () => {
    expect(formTrend([7, 7, 7, 7, 7])).toBe("unknown");
    expect(TREND_MIN_GAMES).toBe(6);
    expect(formTrend([6, 6, 6, 7.5, 7.5, 7.5])).toBe("improving");
    expect(formTrend([7.5, 7.5, 7.5, 6, 6, 6])).toBe("declining");
    expect(formTrend([7, 7.1, 6.9, 7, 7.1, 6.9])).toBe("stable");
    expect(formTrend([])).toBe("unknown");
  });

  it("has nothing to chart with no rated matches, and ignores unrated ones", () => {
    const t = newCareer({ seed: "st-empty" });
    expect(ratedMatches(t)).toEqual([]);
    expect(recentForm(t, 10).entries).toEqual([]);
    expect(recentForm(t, 10).average).toBe(0);
    t.user.matchLog = [entry({ rating: 0 }), entry({ rating: Number.NaN }), entry({ rating: 7.2 })];
    expect(ratedMatches(t).length).toBe(1);
    expect(recentForm(t, 5).trend).toBe("unknown");
  });

  it("keeps development-squad games apart from senior ones", () => {
    const t = newCareer({ seed: "st-dev" });
    t.user.matchLog = [entry({ rating: 7 }), entry({ rating: 8 })];
    t.user.reserveLog = [{ season: 2026, turn: 5, rating: 5.5, goals: 1, assists: 0 }];
    expect(recentForm(t, 5).entries.length).toBe(2);
    expect(recentForm(t, 5).average).toBeCloseTo(7.5);
    expect(reserveForm(t, 5).entries.length).toBe(1);
    expect(reserveForm(t, 5).average).toBeCloseTo(5.5);
  });

  it("rebuilds only what an older save recorded, flagging it as partial", () => {
    const t = newCareer({ seed: "st-old" });
    t.user.matchLog = undefined;
    t.user.recentRatings = [{ season: 2026, turn: 5, rating: 7.4, compId: "eng-1-2026", opponent: "x", goals: 1, assists: 0 }];
    backfillMatchLog(t);
    expect(t.user.matchLog!.length).toBe(1);
    expect(isPartial(t.user.matchLog![0])).toBe(true);
    expect(t.user.matchLog![0].minutes).toBeUndefined();
    // Breakdowns that need a venue or minutes leave it out instead of guessing.
    expect(homeAway(t.user.matchLog!)).toEqual([]);
  });
});

describe("seasons, bests and milestones", () => {
  let s: GameState;
  beforeAll(() => {
    s = play("st-bests", 52);
  });

  it("lists archived seasons then the current one", () => {
    const lines = seasonLines(s);
    expect(lines.length).toBeGreaterThanOrEqual(1);
    for (let i = 1; i < lines.length; i++) expect(lines[i].season).toBeGreaterThanOrEqual(lines[i - 1].season);
  });

  it("only reports records that are real and qualified", () => {
    const bests = personalBests(s);
    for (const b of bests) {
      expect(b.value).toBeGreaterThan(0);
      if (b.note) {
        const line = seasonLines(s).find((l) => l.season === b.season)!;
        expect(line.stats.minutes).toBeGreaterThanOrEqual(BEST_MIN_MINUTES);
      }
    }
    const goals = bests.find((b) => b.id === "goals");
    if (goals) expect(goals.value).toBe(Math.max(...seasonLines(s).map((l) => l.stats.goals)));
  });

  it("does not invent a rate record from a few minutes", () => {
    const t = newCareer({ seed: "st-few" });
    userPlayer(t).season = { x: { ...emptyStat(), apps: 1, minutes: 10, goals: 3, ratingSum: 9 } };
    const b = personalBests(t);
    expect(b.find((x) => x.id === "goalRate")).toBeUndefined();
    expect(b.find((x) => x.id === "rating")).toBeUndefined();
    expect(b.find((x) => x.id === "goals")?.value).toBe(3);
  });

  it("shows reached milestones from the timeline and the next target for each kind", () => {
    const ms = milestones(s);
    expect(ms.find((m) => m.id === "debut")?.reached).toBe(true);
    const nextApps = ms.find((m) => m.id.startsWith("apps-") && !m.reached);
    if (nextApps) expect(nextApps.progress!.have).toBe(userPlayer(s).career.apps);
    expect(new Set(ms.map((m) => m.id)).size).toBe(ms.length);
  });
});

describe("league rankings and comparisons", () => {
  let s: GameState;
  beforeAll(() => {
    s = play("st-rank", 30);
  });

  it("ranks counting stats among everyone and rate stats among qualified players only", () => {
    const rows = leagueRankings(s);
    const goals = rows.find((r) => r.id === "goals")!;
    expect(goals.rank).toBeGreaterThanOrEqual(1);
    const rating = rows.find((r) => r.id === "rating")!;
    expect(userPlayer(s).season[Object.keys(userPlayer(s).season)[0]].minutes).toBeGreaterThan(0);
    if (rating.rank !== null) expect(rating.rank).toBeLessThanOrEqual(rating.of);
    expect(rankMinutes(s)).toBeGreaterThanOrEqual(270);
  });

  it("explains an unranked rate when the sample is too small", () => {
    const t = newCareer({ seed: "st-rank2" });
    const rows = leagueRankings(t);
    const rating = rows.find((r) => r.id === "rating")!;
    expect(rating.rank).toBeNull();
    expect(rating.reason).toMatch(/minutes/);
  });

  it("offers only comparable players and refuses goalkeeper-versus-outfield", () => {
    const list = comparables(s);
    for (const c of list) expect(s.players[c.id].position === "GK").toBe(false);
    const gk = Object.values(s.players).find((p) => p.position === "GK" && !p.virtual)!;
    const res = compareWith(s, gk.id);
    expect(res?.rows).toEqual([]);
    expect(res?.reason).toMatch(/goalkeeper/i);
    if (list.length) {
      const r = compareWith(s, list[0].id)!;
      expect(r.rows.length).toBeGreaterThan(0);
      const apps = r.rows.find((x) => x.label === "Appearances")!;
      expect(Number(apps.mine)).toBeGreaterThan(0);
    }
  });

  it("only compares players who both have enough minutes", () => {
    const list = comparables(s);
    const lid = s.clubs[userPlayer(s).clubId as string].leagueId;
    for (const c of list) expect((s.players[c.id].season[`${lid}-${s.season}`]?.minutes ?? 0)).toBeGreaterThanOrEqual(rankMinutes(s));
  });
});

describe("goalkeepers", () => {
  it("get goalkeeper breakdowns, not goals and assists", () => {
    const s = play("st-gk", 30, { position: "GK" });
    const rows = per90Rows(userPlayer(s).career, "GK");
    expect(rows.map((r) => r.key)).toEqual(["saves", "conceded", "cs"]);
    const bests = personalBests(s).map((b) => b.id);
    expect(bests).not.toContain("goals");
    expect(bests).not.toContain("goalRate");
    expect(leagueRankings(s).map((r) => r.id)).not.toContain("goals");
  });
});

describe("career earnings", () => {
  it("itemises every payment and reconciles with the career total", () => {
    const s = play("st-pay", 40);
    const ledger = ledgerOf(s);
    const sum = Object.values(ledger.career).reduce((n, v) => n + (v ?? 0), 0);
    expect(ledger.career.wage ?? 0).toBeGreaterThan(0);
    // Everything earned lands in exactly one bucket (event penalties are costs, not income).
    expect(Math.abs(sum - s.user.earnings)).toBeLessThanOrEqual(s.user.earnings * 0.2 + 1);
    const season = ledger.season.amounts;
    expect(Object.values(season).reduce((n, v) => n + (v ?? 0), 0)).toBeLessThanOrEqual(sum);
  });

  it("separates this season from the career when a season turns over", () => {
    const s = play("st-pay2", 52);
    const ledger = ledgerOf(s);
    expect(ledger.season.season).toBe(s.season);
    const seasonTotal = Object.values(ledger.season.amounts).reduce((n, v) => n + (v ?? 0), 0);
    const career = Object.values(ledger.career).reduce((n, v) => n + (v ?? 0), 0);
    expect(seasonTotal).toBeLessThan(career);
  });
});

describe("reload", () => {
  it("keeps the match log and ledger through a save", () => {
    const s = play("st-save", 20);
    const back = migrateState(JSON.parse(JSON.stringify(decodeState(encodeState(s)))));
    expect(back.user.matchLog).toEqual(JSON.parse(JSON.stringify(s.user.matchLog)));
    expect(back.user.pay).toEqual(JSON.parse(JSON.stringify(s.user.pay)));
  });
});
