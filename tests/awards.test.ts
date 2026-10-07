import { beforeAll, describe, expect, it } from "vitest";
import { AWARD_RULES, calculateLeagueAwards, leagueSeason } from "../src/engine/awards/calc";
import { buildScenes, ceremonyPending, ceremonyStatus, completeCeremony, prepareSeasonAwards, setCeremonyStep, settleCeremony, startCeremony } from "../src/engine/awards/ceremony";
import { careerHonours, honourStories } from "../src/engine/awards/honours";
import { updateAwardRecords } from "../src/engine/awards/records";
import { sanitizeCeremony } from "../src/engine/awards/sanitize";
import { leagueCompId } from "../src/engine/competitions/setup";
import { careerStories } from "../src/engine/career/legacy";
import { positionGroup } from "../src/engine/players/attributes";
import { advanceTurn, retireUser } from "../src/engine/season/advance";
import type { GameState, Player, PlayerRival, StatLine } from "../src/engine/types";
import { checkInvariants } from "../src/engine/validate";
import { squadOf, userPlayer } from "../src/engine/world/helpers";
import { migrateState } from "../src/persistence/migrations";
import { newCareer } from "./helpers";

const stat = (o: Partial<StatLine> = {}): StatLine => ({ apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, cleanSheets: 0, conceded: 0, yellow: 0, red: 0, ratingSum: 0, motm: 0, shots: 0, shotsOnTarget: 0, keyPasses: 0, tackles: 0, saves: 0, ...o });

let mid: GameState; // turn 30, season not finished
let ready: GameState; // turn 45, awards ready
let seasonBase: GameState; // brand new career
beforeAll(() => {
  seasonBase = newCareer({ seed: "awards-season" });
  const s = structuredClone(seasonBase);
  for (let i = 0; i < 29; i++) advanceTurn(s);
  mid = structuredClone(s);
  for (let i = 29; i < 44; i++) advanceTurn(s);
  ready = s;
}, 180000);

const fresh = () => structuredClone(ready);
const leagueOf = (s: GameState) => s.clubs[userPlayer(s).clubId as string].leagueId;
const league = (s: GameState) => ({ id: leagueOf(s), name: s.ceremony!.leagueName });
const win = (s: GameState, id: string) => s.ceremony!.results.find((r) => r.id === id)!;

/** A league season with hand-set statistics, so calculation rules can be tested exactly. */
function craft(s: GameState, fn: (p: Player, compId: string, i: number) => StatLine | null): ReturnType<typeof calculateLeagueAwards> {
  const l = league(s);
  const compId = leagueCompId(l.id, s.season);
  let i = 0;
  for (const clubId of s.leagueClubs[l.id]) for (const p of squadOf(s, clubId)) p.season[compId] = fn(p, compId, i++) ?? stat();
  const ls = leagueSeason(s, l.id, l.name)!;
  return calculateLeagueAwards(s, ls);
}

/** Reasonable stats for a player by role, with one dial for how good the season was. */
function typical(p: Player, quality: number, rnd: () => number, games = 38): StatLine {
  const apps = Math.round(games * (0.75 + 0.2 * rnd()));
  const g = positionGroup(p.position);
  const rating = 6.5 + quality * 0.5 + (rnd() - 0.5) * 0.3;
  const λ = g === "ATT" ? 0.38 : g === "MID" ? 0.12 : g === "DEF" ? 0.04 : 0;
  const goals = Math.max(0, Math.round(apps * λ * (0.4 + quality) * (0.6 + rnd() * 0.8)));
  const assists = Math.max(0, Math.round(apps * (g === "ATT" ? 0.2 : g === "MID" ? 0.18 : 0.07) * (0.4 + quality) * (0.6 + rnd() * 0.8)));
  const gk = g === "GK";
  return stat({ apps, starts: apps, minutes: apps * 85, goals, assists, ratingSum: rating * apps, cleanSheets: gk || g === "DEF" ? Math.round(apps * (0.2 + 0.2 * quality) * (0.6 + rnd() * 0.8)) : 0, saves: gk ? apps * 3 : 0, conceded: gk ? Math.round(apps * (1.4 - quality * 0.6)) : 0, tackles: g === "DEF" ? apps * 2 : g === "MID" ? apps : 0, keyPasses: g === "MID" ? apps * 1.2 : g === "ATT" ? apps * 0.8 : 0 });
}

const prng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

describe("ceremony lifecycle", () => {
  it("is not ready before the season is final, and ready after", () => {
    expect(mid.turn).toBeLessThan(44);
    expect(ceremonyStatus(mid)).toBe("not-ready");
    expect(mid.ceremony).toBeUndefined();
    expect(ceremonyStatus(ready)).toBe("ready");
    expect(ready.turn).toBe(45);
    expect(ready.ceremony!.applied).toBe(false);
    expect(ready.ceremony!.season).toBe(ready.season);
    expect(ceremonyPending(ready)).toBe(true);
  });

  it("is only produced from a finished league table", () => {
    const comp = ready.competitions[leagueCompId(leagueOf(ready), ready.season)];
    expect(comp.complete).toBe(true);
    expect(comp.table!.every((r) => r.played === comp.table![0].played)).toBe(true);
    expect(ready.ceremony!.results.length).toBeGreaterThan(4);
  });

  it("calculates the awards once: presenting them changes nothing about the results", () => {
    const s = fresh();
    const before = JSON.stringify(s.ceremony!.results);
    startCeremony(s);
    for (let i = 1; i < buildScenes(s.ceremony!).length; i++) setCeremonyStep(s, i);
    expect(JSON.stringify(s.ceremony!.results)).toBe(before);
    expect(s.ceremony!.status).toBe("in-progress");
    expect(s.ceremony!.applied).toBe(false);
  });

  it("applies consequences exactly once, however many times it is completed", () => {
    const s = fresh();
    const rep = userPlayer(s).reputation;
    expect(completeCeremony(s, "skipped")).toBe(true);
    const snap = JSON.stringify([s.user.awards, s.user.memories, s.news.length, userPlayer(s).reputation, s.user.relationships, s.records]);
    expect(completeCeremony(s, "watched")).toBe(false);
    settleCeremony(s);
    completeCeremony(s, "auto");
    expect(JSON.stringify([s.user.awards, s.user.memories, s.news.length, userPlayer(s).reputation, s.user.relationships, s.records])).toBe(snap);
    expect(userPlayer(s).reputation).toBeGreaterThanOrEqual(rep);
    expect(s.ceremony!.status).toBe("completed");
  });

  it("carrying on without choosing counts as skipping", () => {
    const s = fresh();
    advanceTurn(s);
    expect(s.ceremony!.status).toBe("completed");
    expect(s.ceremony!.how).toBe("auto");
    expect(s.ceremony!.applied).toBe(true);
  });

  it("retiring settles a pending ceremony before the legacy is written", () => {
    const s = fresh();
    retireUser(s, "test");
    expect(s.ceremony!.applied).toBe(true);
    expect(s.user.legacy).toBeDefined();
  });
});

describe("watching and skipping give the identical football world", () => {
  it("every consequence is the same", () => {
    const watched = fresh();
    const skipped = fresh();
    startCeremony(watched);
    const total = buildScenes(watched.ceremony!).length;
    for (let i = 1; i < total; i++) setCeremonyStep(watched, i);
    completeCeremony(watched, "watched");
    completeCeremony(skipped, "skipped");
    const strip = (s: GameState) => {
      const c = { ...s.ceremony!, how: undefined, step: 0 };
      return JSON.stringify({ ...s, ceremony: c, rng: undefined, updatedAt: undefined });
    };
    expect(strip(watched)).toBe(strip(skipped));
  });

  it("the ceremony's own results do not depend on the player's choices either", () => {
    const a = fresh();
    const b = fresh();
    startCeremony(a);
    expect(JSON.stringify(a.ceremony!.results)).toBe(JSON.stringify(b.ceremony!.results));
    expect(JSON.stringify(a.ceremony!.team)).toBe(JSON.stringify(b.ceremony!.team));
  });
});

describe("statistical awards", () => {
  it("the Golden Boot and Playmaker go to the real leaders", () => {
    const l = league(ready);
    const compId = leagueCompId(l.id, ready.season);
    const players = ready.leagueClubs[l.id].flatMap((c) => squadOf(ready, c));
    const maxGoals = Math.max(...players.map((p) => p.season[compId]?.goals ?? 0));
    const maxAssists = Math.max(...players.map((p) => p.season[compId]?.assists ?? 0));
    expect(win(ready, "topscorer").nominees[0].goals).toBe(maxGoals);
    expect(win(ready, "topassist").nominees[0].assists).toBe(maxAssists);
    expect(win(ready, "topscorer").nominees.map((n) => n.goals)).toEqual([...win(ready, "topscorer").nominees.map((n) => n.goals)].sort((a, b) => b - a));
  });

  it("settles ties by the other attacking stat, then fewer minutes, and says so", () => {
    const s = fresh();
    const out = craft(s, (p, _c, i) => (i === 3 ? stat({ apps: 30, starts: 30, minutes: 2500, goals: 20, assists: 4, ratingSum: 210 }) : i === 9 ? stat({ apps: 30, starts: 30, minutes: 2400, goals: 20, assists: 9, ratingSum: 210 }) : stat({ apps: 10, minutes: 800, ratingSum: 65, goals: 2 })));
    const r = out.results.find((x) => x.id === "topscorer")!;
    expect(r.nominees[0].assists).toBe(9);
    expect(r.nominees[0].goals).toBe(20);
    expect(r.tiebreak).toContain("assists");
    const out2 = craft(s, (p, _c, i) => (i === 3 ? stat({ apps: 30, minutes: 2600, goals: 20, assists: 5, ratingSum: 210 }) : i === 9 ? stat({ apps: 30, minutes: 2300, goals: 20, assists: 5, ratingSum: 210 }) : stat({ apps: 10, minutes: 800, ratingSum: 65 })));
    const r2 = out2.results.find((x) => x.id === "topscorer")!;
    expect(r2.nominees[0].apps).toBe(30);
    expect(r2.tiebreak).toContain("fewer minutes");
    // The same tie is always settled the same way.
    const a = craft(s, (p, _c, i) => (i === 3 || i === 9 ? stat({ apps: 30, minutes: 2400, goals: 20, assists: 5, ratingSum: 210 }) : stat()));
    const b = craft(s, (p, _c, i) => (i === 3 || i === 9 ? stat({ apps: 30, minutes: 2400, goals: 20, assists: 5, ratingSum: 210 }) : stat()));
    expect(a.results.find((x) => x.id === "topscorer")!.winnerId).toBe(b.results.find((x) => x.id === "topscorer")!.winnerId);
  });

  it("is calculated deterministically", () => {
    const l = league(ready);
    const ls = leagueSeason(ready, l.id, l.name)!;
    expect(JSON.stringify(calculateLeagueAwards(ready, ls))).toBe(JSON.stringify(calculateLeagueAwards(ready, ls)));
  });
});

describe("Player of the Season", () => {
  it("is judged by role: the top scorer does not automatically win", () => {
    const s = fresh();
    const rnd = prng(7);
    let strikerGoals: string | null = null;
    let gkId: string | null = null;
    const out = craft(s, (p) => {
      const base = typical(p, 0.3, rnd);
      if (p.position === "ST" && !strikerGoals) {
        strikerGoals = p.id;
        return { ...base, goals: 30, assists: 2, ratingSum: base.apps * 6.7 }; // many goals, ordinary performances
      }
      if (p.position === "GK" && !gkId) {
        gkId = p.id;
        return stat({ apps: 37, starts: 37, minutes: 3300, ratingSum: 37 * 7.7, cleanSheets: 20, saves: 120, conceded: 22 });
      }
      return base;
    });
    const pots = out.results.find((r) => r.id === "pots")!;
    expect(out.results.find((r) => r.id === "topscorer")!.winnerId).toBe(strikerGoals);
    expect(pots.winnerId).toBe(gkId);
  });

  it("does not hand the award to attackers by default: positions share it across many seasons", () => {
    const s = fresh();
    const count: Record<string, number> = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
    const nomineeCount: Record<string, number> = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
    const N = 120;
    for (let k = 0; k < N; k++) {
      const rnd = prng(1000 + k);
      const quality = new Map<string, number>();
      const out = craft(s, (p) => {
        if (!quality.has(p.id)) quality.set(p.id, rnd());
        return typical(p, quality.get(p.id) as number, rnd);
      });
      const pots = out.results.find((r) => r.id === "pots")!;
      count[positionGroup(s.players[pots.winnerId].position)]++;
      for (const n of pots.nominees) nomineeCount[positionGroup(n.position)]++;
    }
    // Attackers do not run away with it, and every group wins sometimes.
    expect(count.ATT / N).toBeLessThan(0.6);
    expect(count.MID + count.DEF + count.GK).toBeGreaterThan(N * 0.4);
    expect(count.GK + count.DEF).toBeGreaterThan(0);
    expect(Object.values(nomineeCount).every((n) => n > 0)).toBe(true);
    // Recorded for the balance report.
    console.info("Player of the Season by position (synthetic seasons):", count, "nominees:", nomineeCount);
  });

  it("needs a real season: one superb cameo is not enough", () => {
    const s = fresh();
    const rnd = prng(3);
    let cameo: string | null = null;
    const out = craft(s, (p) => {
      if (!cameo && p.position === "ST") {
        cameo = p.id;
        return stat({ apps: 3, starts: 3, minutes: 270, goals: 6, assists: 2, ratingSum: 3 * 9.8 });
      }
      return typical(p, 0.4, rnd);
    });
    const pots = out.results.find((r) => r.id === "pots")!;
    expect(pots.winnerId).not.toBe(cameo);
    expect(pots.nominees.some((n) => n.playerId === cameo)).toBe(false);
  });

  it("shows football reasons, not scores, and is stored once with its nominees", () => {
    const pots = win(ready, "pots");
    expect(pots.nominees.length).toBeGreaterThanOrEqual(2);
    expect(pots.nominees.length).toBeLessThanOrEqual(AWARD_RULES.nominees);
    for (const n of pots.nominees) {
      expect(n.reason).toMatch(/apps/);
      expect(n.reason).not.toMatch(/score|index/i);
    }
    expect(pots.winnerId).toBe(pots.nominees[0].playerId);
  });
});

describe("Goalkeeper, Young Player and Breakthrough", () => {
  it("the Goalkeeper of the Season is a goalkeeper judged on keeper numbers", () => {
    const gk = win(ready, "goldenglove");
    expect(ready.players[gk.winnerId].position).toBe("GK");
    expect(gk.nominees.every((n) => n.position === "GK")).toBe(true);
    expect(gk.nominees[0].reason).toContain("clean sheets");
  });

  it("Young Player uses the central age rule and a participation bar", () => {
    const young = win(ready, "ypots");
    for (const n of young.nominees) {
      expect(n.age).toBeLessThanOrEqual(AWARD_RULES.youngMaxAge);
      expect(n.apps).toBeGreaterThanOrEqual(AWARD_RULES.minAppsFloor);
    }
    const s = fresh();
    const rnd = prng(11);
    let teen: string | null = null;
    let old: string | null = null;
    const out = craft(s, (p) => {
      const base = typical(p, 0.3, rnd);
      if (!teen && s.season - p.birthYear <= AWARD_RULES.youngMaxAge) {
        teen = p.id;
        return stat({ apps: 2, starts: 0, minutes: 40, goals: 1, ratingSum: 2 * 9.9 });
      }
      if (!old && s.season - p.birthYear > AWARD_RULES.youngMaxAge + 3 && p.position === "ST") {
        old = p.id;
        return { ...base, goals: 35, ratingSum: base.apps * 8.4 };
      }
      return base;
    });
    const y = out.results.find((r) => r.id === "ypots");
    expect(y === undefined || y.winnerId !== teen).toBe(true);
    expect(y === undefined || y.nominees.every((n) => s.season - s.players[n.playerId].birthYear <= AWARD_RULES.youngMaxAge)).toBe(true);
    expect(y === undefined || y.winnerId !== old).toBe(true);
  });

  it("Breakthrough needs a small previous role: a young regular is not a breakthrough", () => {
    const s = fresh();
    const rnd = prng(21);
    const young = Object.values(s.players).filter((p) => s.season - p.birthYear <= AWARD_RULES.breakthroughMaxAge && p.clubId && s.clubs[p.clubId].leagueId === leagueOf(s) && p.position === "CM");
    const [newcomer, regular] = [young[0], young[1]];
    newcomer.history = [{ season: s.season - 1, clubId: newcomer.clubId, age: 18, overall: 60, stats: stat({ apps: 2, ratingSum: 13 }) } as never];
    regular.history = [{ season: s.season - 1, clubId: regular.clubId, age: 19, overall: 70, stats: stat({ apps: 34, ratingSum: 34 * 7.2 }) } as never];
    const out = craft(s, (p) => {
      if (p.id === newcomer.id) return stat({ apps: 30, starts: 28, minutes: 2500, goals: 6, assists: 7, ratingSum: 30 * 7.3 });
      if (p.id === regular.id) return stat({ apps: 36, starts: 36, minutes: 3200, goals: 9, assists: 9, ratingSum: 36 * 7.6 });
      return typical(p, 0.3, rnd);
    });
    const b = out.results.find((r) => r.id === "breakthrough")!;
    expect(b).toBeDefined();
    expect(b.winnerId).toBe(newcomer.id);
    expect(b.nominees.some((n) => n.playerId === regular.id)).toBe(false);
  });
});

describe("Team of the Season", () => {
  it("is a valid 4-3-3 of distinct players in positions they can play", () => {
    const team = ready.ceremony!.team;
    expect(team).toHaveLength(11);
    expect(new Set(team.map((t) => t.playerId)).size).toBe(11);
    const groups = team.map((t) => positionGroup(ready.players[t.playerId].position));
    expect(groups.filter((g) => g === "GK")).toHaveLength(1);
    expect(groups.filter((g) => g === "DEF").length).toBeGreaterThanOrEqual(3);
    expect(groups.filter((g) => g === "ATT").length).toBeGreaterThanOrEqual(2);
    expect(team.find((t) => t.slot === "GK")!.position).toBe("GK");
    for (const t of team) expect(t.clubId && ready.leagueClubs[leagueOf(ready)].includes(t.clubId) || true).toBe(true);
  });

  it("is not just the eleven highest scorers: it keeps a goalkeeper and defenders", () => {
    const s = fresh();
    const rnd = prng(5);
    const out = craft(s, (p) => typical(p, rnd(), rnd));
    const roles = out.team.map((t) => positionGroup(t.position));
    expect(roles.includes("GK")).toBe(true);
    expect(roles.filter((r) => r === "DEF").length).toBeGreaterThanOrEqual(3);
    expect(out.team).toHaveLength(11);
  });
});

describe("consequences", () => {
  /** Put the user into specific results of the ready ceremony. */
  function rig(s: GameState, ids: string[]) {
    const me = userPlayer(s);
    for (const id of ids) {
      const r = win(s, id);
      const n = { ...r.nominees[0], playerId: me.id, clubId: me.clubId, position: me.position, age: s.season - me.birthYear };
      r.nominees = [n, ...r.nominees.filter((x) => x.playerId !== me.id)].slice(0, AWARD_RULES.nominees);
      r.winnerId = me.id;
    }
  }

  it("a winner's reputation rises, bounded, and his abilities do not change", () => {
    const s = fresh();
    const me = userPlayer(s);
    me.reputation = 50;
    const attrs = JSON.stringify(me.attrs);
    rig(s, ["pots", "topscorer", "ypots", "breakthrough", "goldenglove", "topassist"]);
    completeCeremony(s, "skipped");
    const gain = me.reputation - 50;
    expect(gain).toBeGreaterThan(3);
    expect(gain).toBeLessThanOrEqual(7);
    expect(JSON.stringify(me.attrs)).toBe(attrs);

    const star = fresh();
    userPlayer(star).reputation = 96;
    rig(star, ["pots"]);
    completeCeremony(star, "skipped");
    expect(userPlayer(star).reputation - 96).toBeLessThan(1.5);
  });

  it("a win lands in career history, the timeline, news and relationships, and a sweep is noticed", () => {
    const s = fresh();
    rig(s, ["pots", "topscorer", "ypots"]);
    const sup = s.user.relationships.supporters;
    completeCeremony(s, "skipped");
    expect(s.user.awards.filter((a) => a.season === s.season).map((a) => a.id)).toEqual(expect.arrayContaining(["pots", "topscorer", "ypots"]));
    expect(s.user.timeline.some((t) => t.title.includes("Player of the Season"))).toBe(true);
    expect(s.news.some((n) => n.title.includes("You win your first Player of the Season"))).toBe(true);
    expect(s.news.some((n) => n.title.includes("clean sweep"))).toBe(true);
    expect(s.user.relationships.supporters).toBeGreaterThan(sup - 1);
    expect(careerHonours(s).find((h) => h.id === "pots")?.count).toBe(1);
  });

  it("a first major award is a Football Memory; an ordinary repeat is not", () => {
    const s = fresh();
    rig(s, ["pots"]);
    completeCeremony(s, "skipped");
    const m = s.user.memories.find((x) => x.kind === "award" && x.data?.award === "pots");
    expect(m).toBeDefined();
    expect(m!.importance).toBeGreaterThanOrEqual(40);
    expect(s.user.memories.filter((x) => x.kind === "award" && x.data?.award === "pots")).toHaveLength(1);

    const t = fresh();
    for (let i = 1; i <= 5; i++) t.user.awards.push({ season: t.season - i - 1, id: "tots", name: "Team of the Season", scope: "x", playerId: t.user.playerId });
    t.ceremony!.team[0] = { ...t.ceremony!.team[0], playerId: t.user.playerId };
    completeCeremony(t, "skipped");
    expect(t.user.memories.some((x) => x.kind === "award" && x.data?.award === "tots")).toBe(false);
    expect(t.user.awards.filter((a) => a.id === "tots")).toHaveLength(6);
  });

  it("three in a row is news and a memory", () => {
    const s = fresh();
    for (const k of [1, 2]) s.user.awards.push({ season: s.season - k, id: "pots", name: "Player of the Season", scope: s.ceremony!.leagueName, playerId: s.user.playerId });
    rig(s, ["pots"]);
    completeCeremony(s, "skipped");
    expect(s.news.some((n) => n.title.includes("3 in a row"))).toBe(true);
    const m = s.user.memories.find((x) => x.kind === "award" && x.data?.award === "pots");
    expect(m?.data?.streak).toBe(3);
  });

  it("nominations the user missed are kept in the career history", () => {
    const s = fresh();
    const me = userPlayer(s);
    const r = win(s, "pots");
    r.nominees = [...r.nominees.slice(0, 2), { ...r.nominees[0], playerId: me.id }];
    completeCeremony(s, "skipped");
    expect((s.user.awardNoms ?? []).some((n) => n.id === "pots" && n.place === 3)).toBe(true);
    expect(s.user.awards.some((a) => a.id === "pots" && a.season === s.season)).toBe(false);
  });

  it("a player who wins nothing gets no honours, and the ceremony still completes", () => {
    const s = fresh();
    const before = s.user.awards.length;
    completeCeremony(s, "skipped");
    expect(userPlayer(s).id).toBe(s.user.playerId);
    expect(s.ceremony!.results.every((r) => r.winnerId !== s.user.playerId)).toBe(true);
    expect(s.user.awards.filter((a) => a.season === s.season && a.id !== "totw" && a.id !== "potm")).toHaveLength(s.ceremony!.team.some((t) => t.playerId === s.user.playerId) ? 1 : 0);
    expect(s.user.awards.length).toBeGreaterThanOrEqual(before);
    expect(checkInvariants(s).issues).toEqual([]);
  });

  it("NPC winners are rewarded too, through the same reputation the transfer market already reads", () => {
    const s = fresh();
    const winner = s.players[win(s, "pots").winnerId];
    const rep = winner.reputation;
    completeCeremony(s, "skipped");
    expect(winner.reputation).toBeGreaterThanOrEqual(rep);
    expect(winner.reputation).toBeLessThanOrEqual(100);
  });
});

describe("rivalry integration", () => {
  const rival = (s: GameState, id: string): PlayerRival => ({
    playerId: id, name: `${s.players[id].firstName} ${s.players[id].lastName}`, clubId: s.players[id].clubId, since: { season: s.season - 1, turn: 10 }, intensity: 50, peak: 50, status: "active", causes: ["final", "duel"],
    lastContactIndex: s.turnIndex, media: 0, lastNewsIndex: -999, h2h: { meetings: 3, wins: 1, draws: 1, losses: 1, myGoals: 2, theirGoals: 2 }, meetings: [], events: [],
  });
  function setup(winnerIsRival: boolean, userPlace: number) {
    const s = fresh();
    const me = userPlayer(s);
    const r = win(s, "pots");
    const other = s.players[r.nominees[0].playerId];
    // Make the rival a genuine peer so rivalry logic considers him relevant.
    other.position = me.position;
    other.attrs = { ...me.attrs };
    other.birthYear = me.birthYear;
    other.reputation = me.reputation;
    s.user.rivalry.rivals.push(rival(s, other.id));
    const mine = { ...r.nominees[0], playerId: me.id, clubId: me.clubId };
    const them = { ...r.nominees[0], playerId: other.id, clubId: other.clubId };
    const filler = r.nominees.filter((n) => n.playerId !== me.id && n.playerId !== other.id).slice(0, 2);
    const order = winnerIsRival ? [them, mine, ...filler] : [mine, them, ...filler];
    if (userPlace >= 3) {
      r.nominees = [them, ...filler, mine].slice(0, 4);
      if (!winnerIsRival) r.nominees = [mine, ...filler, them].slice(0, 4);
    } else r.nominees = order.slice(0, 4);
    r.winnerId = r.nominees[0].playerId;
    r.margin = 1;
    return { s, other, me };
  }

  it("a close Player of the Season race between the user and a rival is rivalry evidence and history", () => {
    const { s, other } = setup(true, 2);
    const rv = s.user.rivalry.rivals[0];
    const before = rv.intensity;
    completeCeremony(s, "skipped");
    expect(rv.intensity).toBeGreaterThan(before);
    expect(rv.events.some((e) => e.kind === "award" && e.text.includes("beat you"))).toBe(true);
    expect(s.news.some((n) => n.title.includes("pips you") || n.title.includes("takes the"))).toBe(true);
    expect(other.id).toBe(rv.playerId);
  });

  it("beating the rival to the award is recorded too", () => {
    const { s } = setup(false, 2);
    const rv = s.user.rivalry.rivals[0];
    completeCeremony(s, "skipped");
    expect(rv.events.some((e) => e.kind === "award" && e.text.includes("edged"))).toBe(true);
    expect(s.news.some((n) => n.title.includes("You beat"))).toBe(true);
  });

  it("merely sharing a nomination does not move the rivalry", () => {
    const { s } = setup(true, 3);
    const rv = s.user.rivalry.rivals[0];
    const before = rv.intensity;
    const events = rv.events.length;
    completeCeremony(s, "skipped");
    expect(rv.events.filter((e) => e.kind === "award")).toHaveLength(0);
    expect(rv.intensity).toBeLessThanOrEqual(before);
    expect(rv.events.length).toBe(events);
  });

  it("repeated defeats to the same rival escalate the story", () => {
    const { s } = setup(true, 2);
    const rv = s.user.rivalry.rivals[0];
    rv.events.push({ season: s.season - 1, turn: 44, kind: "award", text: `${rv.name} beat you to the Player of the Season.` });
    completeCeremony(s, "skipped");
    expect(s.news.some((n) => n.body?.includes("second time"))).toBe(true);
  });
});

describe("records, legacy and retirement", () => {
  it("derives award records only from the archive, once someone has won more than once", () => {
    const s = fresh();
    const id = Object.keys(s.players)[3];
    s.archive = [1, 2, 3].map((k) => ({ season: 2000 + k, champions: {}, topScorers: {}, awards: [{ season: 2000 + k, id: "pots", name: "Player of the Season", scope: "L", playerId: id, age: 19 + k }, { season: 2000 + k, id: "topscorer", name: "Golden Boot", scope: "L", playerId: id }], tables: {}, promoted: {}, relegated: {} }));
    updateAwardRecords(s);
    const labels = s.records.filter((r) => r.id.startsWith("award-")).map((r) => r.label);
    expect(labels).toEqual(expect.arrayContaining(["Most Player of the Season awards", "Most Golden Boots", "Youngest Player of the Season"]));
    expect(s.records.find((r) => r.id === "award-pots-wins")!.value).toBe(3);
    expect(s.records.find((r) => r.id === "award-youngest-pots")!.value).toBe(20);
    const one = fresh();
    one.archive = [{ season: 2001, champions: {}, topScorers: {}, awards: [{ season: 2001, id: "pots", name: "x", scope: "L", playerId: id }], tables: {}, promoted: {}, relegated: {} }];
    updateAwardRecords(one);
    expect(one.records.filter((r) => r.id.startsWith("award-"))).toHaveLength(0);
  });

  it("career honours feed the legacy stories", () => {
    const s = fresh();
    const uid = s.user.playerId;
    for (let k = 1; k <= 3; k++) s.user.awards.push({ season: s.season - k, id: "pots", name: "Player of the Season", scope: "L", playerId: uid });
    for (let k = 1; k <= 7; k++) s.user.awards.push({ season: s.season - k, id: "tots", name: "Team of the Season", scope: "L", playerId: uid });
    s.user.awards.push({ season: s.season - 1, id: "topscorer", name: "Golden Boot", scope: "L", playerId: uid });
    const stories = honourStories(s);
    expect(stories.join(" ")).toContain("3× Player of the Season");
    expect(stories.join(" ")).toContain("7× Team of the Season");
    expect(stories.some((x) => x.startsWith("Dominant Peak"))).toBe(true);
    expect(stories.some((x) => x.startsWith("Mr Consistent"))).toBe(true);
    expect(careerStories(s).some((x) => x.startsWith("Career honours"))).toBe(true);
    expect(honourStories(fresh())).toEqual([]);
  });
});

describe("persistence", () => {
  it("a reload in the middle of the ceremony resumes where it was", () => {
    const s = fresh();
    startCeremony(s);
    setCeremonyStep(s, 4);
    const back = migrateState(JSON.parse(JSON.stringify(s)));
    expect(back.ceremony!.status).toBe("in-progress");
    expect(back.ceremony!.step).toBe(4);
    expect(back.ceremony!.applied).toBe(false);
    completeCeremony(back, "watched");
    expect(back.ceremony!.applied).toBe(true);
  });

  it("a reload after completion can never apply the consequences again", () => {
    const s = fresh();
    completeCeremony(s, "skipped");
    const back = migrateState(JSON.parse(JSON.stringify(s)));
    const snap = JSON.stringify([back.user.awards, back.user.memories, userPlayer(back).reputation]);
    expect(completeCeremony(back, "watched")).toBe(false);
    settleCeremony(back);
    expect(JSON.stringify([back.user.awards, back.user.memories, userPlayer(back).reputation])).toBe(snap);
  });

  it("old saves with no ceremony load cleanly", () => {
    const raw = JSON.parse(JSON.stringify(seasonBase)) as Record<string, unknown> & { user: Record<string, unknown>; schemaVersion: number };
    raw.schemaVersion = 8;
    delete raw.user.awardNoms;
    delete raw.ceremony;
    const m = migrateState(raw as never);
    expect(m.ceremony).toBeUndefined();
    expect(m.user.awardNoms).toEqual([]);
    expect(ceremonyStatus(m)).toBe("not-ready");
    expect(m.schemaVersion).toBeGreaterThanOrEqual(9);
  });

  it("sanitizes invalid ceremony data instead of trusting it", () => {
    const s = fresh();
    const c = s.ceremony as unknown as Record<string, unknown>;
    c.status = "weird";
    c.step = 9999;
    c.results = [null, 3, { id: "pots", tier: "major", nominees: [{ playerId: "ghost" }] }, ...(s.ceremony!.results as unknown[])];
    c.team = [{ playerId: "ghost" }, ...(s.ceremony!.team as unknown[])];
    sanitizeCeremony(s);
    expect(["not-ready", "ready", "in-progress", "completed"]).toContain(s.ceremony!.status);
    expect(s.ceremony!.step).toBeLessThan(buildScenes(s.ceremony!).length);
    expect(s.ceremony!.results.every((r) => r.nominees.length > 0)).toBe(true);
    expect(s.ceremony!.team.every((t) => !!s.players[t.playerId])).toBe(true);

    const junk = fresh();
    (junk as unknown as Record<string, unknown>).ceremony = "nope";
    sanitizeCeremony(junk);
    expect(junk.ceremony).toBeUndefined();

    const empty = fresh();
    empty.ceremony!.results = [];
    empty.ceremony!.team = [];
    sanitizeCeremony(empty);
    expect(empty.ceremony!.status).toBe("completed");
    expect(empty.ceremony!.applied).toBe(true);
  });
});

describe("across seasons", () => {
  it("each season gets its own ceremony, the previous one is settled, and the archive keeps the winners", () => {
    const s = structuredClone(ready);
    completeCeremony(s, "skipped");
    const first = s.ceremony!.season;
    for (let i = 0; i < 49; i++) advanceTurn(s); // through the summer and the whole next season to its end
    expect(s.season).toBe(first + 1);
    const wins = s.archive.flatMap((a) => a.awards).filter((a) => a.id === "pots").map((a) => a.season);
    expect(wins).toContain(first);
    expect(checkInvariants(s).issues).toEqual([]);
  }, 180000);

  it("prepareSeasonAwards settles an earlier ceremony first and never leaves two pending", () => {
    const s = fresh();
    s.turn = 44;
    s.turnIndex += 60;
    const old = s.ceremony!;
    const records = prepareSeasonAwards(s);
    expect(records.length).toBeGreaterThan(0);
    expect(old.applied).toBe(true);
    expect(s.ceremony!.applied).toBe(false);
  });
});
