import { beforeAll, describe, expect, it } from "vitest";
import { calculateLeagueAwards, leagueSeason, leagueStatPlayers } from "../src/engine/awards/calc";
import { completeCeremony, prepareSeasonAwards } from "../src/engine/awards/ceremony";
import { leagueCompId } from "../src/engine/competitions/setup";
import { leaguesInPlay } from "../src/engine/data/world";
import { advanceTurn } from "../src/engine/season/advance";
import type { GameState, Player, SeasonArchive, StatLine } from "../src/engine/types";
import { squadOf, userPlayer } from "../src/engine/world/helpers";
import { newCareer } from "./helpers";

const stat = (o: Partial<StatLine> = {}): StatLine => ({ apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, cleanSheets: 0, conceded: 0, yellow: 0, red: 0, ratingSum: 0, motm: 0, shots: 0, shotsOnTarget: 0, keyPasses: 0, tackles: 0, saves: 0, ...o });
const season = (apps: number, o: Partial<StatLine> = {}) => stat({ apps, starts: apps, minutes: apps * 88, ratingSum: apps * 6.9, ...o });

let ready: GameState;
beforeAll(() => {
  const s = newCareer({ seed: "league-awards" });
  for (let i = 0; i < 44; i++) advanceTurn(s);
  ready = s;
}, 180000);

const fresh = () => structuredClone(ready);
const twoLeagues = (s: GameState) => {
  const ls = leaguesInPlay(s).filter((l) => leagueSeason(s, l.id, l.name));
  expect(ls.length).toBeGreaterThanOrEqual(2);
  return [ls[0], ls[1]];
};
const strikerOf = (s: GameState, leagueId: string, nth = 0): Player => squadOf(s, s.leagueClubs[leagueId][nth]).find((p) => p.position === "ST") as Player;
const wipe = (s: GameState, leagueId: string) => {
  const compId = leagueCompId(leagueId, s.season);
  for (const c of s.leagueClubs[leagueId]) for (const p of squadOf(s, c)) p.season[compId] = stat();
  return compId;
};
const winnerOf = (s: GameState, leagueId: string, id: string) => {
  const l = leaguesInPlay(s).find((x) => x.id === leagueId)!;
  return calculateLeagueAwards(s, leagueSeason(s, leagueId, l.name)!).results.find((r) => r.id === id);
};

describe("league isolation", () => {
  it("a bigger goal tally in one league does not touch another league's Golden Boot", () => {
    const s = fresh();
    const [a, b] = twoLeagues(s);
    const ca = wipe(s, a.id);
    const cb = wipe(s, b.id);
    const pa = strikerOf(s, a.id);
    const pb = strikerOf(s, b.id);
    pa.season[ca] = season(34, { goals: 25 });
    pb.season[cb] = season(38, { goals: 33 });
    expect(winnerOf(s, a.id, "topscorer")?.winnerId).toBe(pa.id);
    expect(winnerOf(s, b.id, "topscorer")?.winnerId).toBe(pb.id);
    expect(winnerOf(s, a.id, "topscorer")?.leagueId).toBe(a.id);
    expect(winnerOf(s, a.id, "topscorer")?.nominees.map((n) => n.playerId)).not.toContain(pb.id);
  });

  it("Golden Boot counts league goals only: cup and continental goals are ignored", () => {
    const s = fresh();
    const [a] = twoLeagues(s);
    const ca = wipe(s, a.id);
    const pa = strikerOf(s, a.id, 0);
    const rival = strikerOf(s, a.id, 1);
    pa.season[ca] = season(34, { goals: 12 });
    rival.season[ca] = season(34, { goals: 15 });
    const other = Object.values(s.competitions).find((c) => c.kind === "cup" || c.kind === "continental")!;
    pa.season[other.id] = season(10, { goals: 20, assists: 20 });
    const r = winnerOf(s, a.id, "topscorer")!;
    expect(r.winnerId).toBe(rival.id);
    expect(r.nominees[1].goals).toBe(12);
  });

  it("Playmaker counts league assists only", () => {
    const s = fresh();
    const [a] = twoLeagues(s);
    const ca = wipe(s, a.id);
    const x = strikerOf(s, a.id, 0);
    const y = strikerOf(s, a.id, 1);
    x.season[ca] = season(30, { assists: 6 });
    y.season[ca] = season(30, { assists: 9 });
    const other = Object.values(s.competitions).find((c) => c.kind === "cup")!;
    x.season[other.id] = season(8, { assists: 15 });
    expect(winnerOf(s, a.id, "topassist")?.winnerId).toBe(y.id);
  });

  it("Team of the Season and the judged awards only name players from that league's season", () => {
    const s = fresh();
    for (const l of twoLeagues(s)) {
      const compId = leagueCompId(l.id, s.season);
      const out = calculateLeagueAwards(s, leagueSeason(s, l.id, l.name)!);
      for (const t of out.team) expect(s.players[t.playerId].season[compId]?.apps ?? 0).toBeGreaterThan(0);
      for (const r of out.results) for (const n of r.nominees) expect(s.players[n.playerId].season[compId]?.apps ?? 0).toBeGreaterThan(0);
    }
  });
});

describe("players who changed club during the season", () => {
  function moved() {
    const s = fresh();
    const [a, b] = twoLeagues(s);
    const ca = wipe(s, a.id);
    const cb = wipe(s, b.id);
    const clubA = s.leagueClubs[a.id][0];
    const clubB = s.leagueClubs[b.id][0];
    const p = strikerOf(s, a.id);
    p.season[ca] = season(30, { goals: 40 });
    p.seasonClubs = { [ca]: clubA };
    s.clubs[clubA].squad = s.clubs[clubA].squad.filter((id) => id !== p.id);
    s.clubs[clubB].squad.push(p.id);
    p.clubId = clubB;
    return { s, a, b, p, clubA, clubB, ca, cb };
  }

  it("keeps his goals and his club in the league where he scored them", () => {
    const { s, a, p, clubA } = moved();
    const r = winnerOf(s, a.id, "topscorer")!;
    expect(r.winnerId).toBe(p.id);
    expect(r.nominees[0].clubId).toBe(clubA);
    expect(leagueStatPlayers(s, leagueCompId(a.id, s.season)).map((x) => x.id)).toContain(p.id);
  });

  it("does not enter him into the new league's awards without appearances there", () => {
    const { s, b, p } = moved();
    const r = winnerOf(s, b.id, "topscorer");
    expect(r?.nominees.map((n) => n.playerId) ?? []).not.toContain(p.id);
  });

  it("counts a player in both leagues separately, each with his own statistics", () => {
    const { s, a, b, p, clubB, cb } = moved();
    p.season[cb] = season(12, { goals: 7 });
    p.seasonClubs![cb] = clubB;
    const ra = winnerOf(s, a.id, "topscorer")!;
    const rb = winnerOf(s, b.id, "topscorer")!;
    expect(ra.nominees[0].goals).toBe(40);
    expect(rb.winnerId).toBe(p.id);
    expect(rb.nominees[0].goals).toBe(7);
    expect(rb.nominees[0].clubId).toBe(clubB);
  });
});

describe("archive: a result for every league, kept as decided", () => {
  it("stores full results for every simulated league, with competition, season, nominees and statistics", () => {
    const entry = ready.archive[ready.archive.length - 1];
    expect(entry.season).toBe(ready.season);
    const stored = entry.leagueAwards ?? [];
    expect(stored.length).toBe(leaguesInPlay(ready).filter((l) => leagueSeason(ready, l.id, l.name)).length);
    expect(new Set(stored.map((x) => x.compId)).size).toBe(stored.length);
    for (const x of stored) {
      expect(x.compId).toBe(leagueCompId(x.leagueId, x.season));
      expect(x.results.length).toBeGreaterThan(0);
      for (const r of x.results) {
        expect(r.compId).toBe(x.compId);
        expect(r.winnerId).toBe(r.nominees[0].playerId);
        expect(typeof r.nominees[0].apps).toBe("number");
      }
      expect(x.team.length).toBeGreaterThan(0);
    }
  });

  it("never replaces an archived league result, even if the awards are prepared again", () => {
    const s = fresh();
    const entry: SeasonArchive = s.archive[s.archive.length - 1];
    const before = JSON.stringify(entry.leagueAwards);
    // Later stats change; the archived result must not.
    for (const p of Object.values(s.players)) for (const k of Object.keys(p.season)) p.season[k].goals += 3;
    prepareSeasonAwards(s, entry);
    expect(JSON.stringify(entry.leagueAwards)).toBe(before);
  });

  it("calculation is deterministic and awards no trophy twice when the ceremony is completed repeatedly", () => {
    const s = fresh();
    const l = leaguesInPlay(s)[0];
    const one = JSON.stringify(calculateLeagueAwards(s, leagueSeason(s, l.id, l.name)!));
    const two = JSON.stringify(calculateLeagueAwards(s, leagueSeason(s, l.id, l.name)!));
    expect(one).toBe(two);
    completeCeremony(s, "skipped");
    const awards = JSON.stringify(s.user.awards);
    completeCeremony(s, "watched");
    expect(JSON.stringify(s.user.awards)).toBe(awards);
  });

  it("survives the season rollover: the next season's awards are added and the earlier ones are unchanged", () => {
    const s = fresh();
    completeCeremony(s, "skipped");
    const firstSeason = s.season;
    const firstJson = JSON.stringify(s.archive.find((a) => a.season === firstSeason)!.leagueAwards);
    for (let i = 0; i < 50; i++) advanceTurn(s); // finish the summer, then play the next season to its end
    expect(s.season).toBe(firstSeason + 1);
    expect(JSON.stringify(s.archive.find((a) => a.season === firstSeason)!.leagueAwards)).toBe(firstJson);
    const next = s.archive.find((a) => a.season === firstSeason + 1);
    expect(next?.leagueAwards?.length).toBeGreaterThan(0);
    expect(s.players[s.archive.find((a) => a.season === firstSeason)!.leagueAwards![0].results[0].winnerId]).toBeDefined();
  }, 240000);

  it("clears the per-season club record at rollover so a new season starts clean", () => {
    const s = fresh();
    completeCeremony(s, "skipped");
    expect(Object.values(s.players).some((p) => Object.keys(p.seasonClubs ?? {}).length > 0)).toBe(true);
    for (let i = 0; i < 6; i++) advanceTurn(s);
    expect(s.season).toBe(ready.season + 1);
    expect(Object.values(s.players).every((p) => Object.keys(p.seasonClubs ?? {}).length === 0 || Object.keys(p.seasonClubs ?? {}).every((k) => k.includes(String(s.season))))).toBe(true);
  }, 240000);
});

describe("an award won in a league other than the user's current one", () => {
  it("is credited to the user's career exactly once", () => {
    const s = fresh();
    const me = userPlayer(s);
    const old = leaguesInPlay(s).find((l) => l.id !== s.ceremony!.leagueId)!;
    s.ceremony!.others.push({ id: "topscorer", name: "Golden Boot", scope: old.name, leagueId: old.id, playerId: me.id, clubId: me.clubId, value: "21 goals", age: 20 });
    const count = () => s.user.awards.filter((a) => a.id === "topscorer" && a.scope === old.name).length;
    completeCeremony(s, "skipped");
    completeCeremony(s, "watched");
    expect(count()).toBe(1);
    expect(s.user.awards.find((a) => a.scope === old.name)?.value).toBe("21 goals");
  });
});
