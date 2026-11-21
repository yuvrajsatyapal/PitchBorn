import { describe, expect, it } from "vitest";
import { BALANCE } from "../src/engine/balance";
import { MatchEngine, type MatchInput, type MatchPlayerInput, type TeamInput } from "../src/engine/match/engine";
import { FORMATIONS } from "../src/engine/match/lineup";
import { generatePlayer } from "../src/engine/players/generate";
import { Rng } from "../src/engine/rng";
import { advanceTurn } from "../src/engine/season/advance";
import { fixturesForTurn, involvesUserTeam, prepareMatch } from "../src/engine/season/matchday";
import type { Attributes, MatchConditions } from "../src/engine/types";
import { conditionsFor, rollConditions, venueOf } from "../src/engine/weather/conditions";
import { attrMultipliers, drainMultiplier, TECH_ATTRS, weatherFx, WIND_ATTRS } from "../src/engine/weather/effects";
import { decodeState, encodeState } from "../src/persistence/codec";
import { migrateState } from "../src/persistence/migrations";
import { newCareer, strongUser } from "./helpers";

const W = BALANCE.weather;
const C = (weather: MatchConditions["weather"], pitch: MatchConditions["pitch"] = "good", tempC = 12): MatchConditions => ({ weather, pitch, tempC });

// ------------------------------------------------------------------------------------------------ teams for controlled matches
const gen = Rng.fromSeed("wx-teams");
let n = 0;
function team(name: string, ovr: number): TeamInput {
  const mk = (slot: (typeof FORMATIONS)["4-3-3"][number]): MatchPlayerInput => {
    const p = generatePlayer(gen, { id: `${name}${n++}`, nationality: "ENG", position: slot, age: 26, season: 2026, overall: ovr, potential: ovr, clubId: null });
    return { id: p.id, name: p.lastName, slot, attrs: p.attrs, fitness: 95, morale: 70, form: 6.6, sharpness: 80, bigMatch: 50, consistency: 55 };
  };
  return { id: name, name, short: name, starters: FORMATIONS["4-3-3"].map(mk), bench: (["GK", "CB", "CM", "ST", "RW", "LB", "DM"] as const).map(mk), mentality: 0, color: "#000" };
}
const HOME = team("H", 74);
const AWAY = team("A", 74);
const input = (conditions?: MatchConditions, detail = false): MatchInput => ({ home: HOME, away: AWAY, importance: 1, detail, ...(conditions ? { conditions } : {}) });

function aggregate(conditions: MatchConditions | undefined, N: number, detail = false) {
  let goals = 0, inj = 0, passes = 0, passesOk = 0, energy = 0, players = 0, subMinute = 0, subs = 0;
  for (let i = 0; i < N; i++) {
    const eng = new MatchEngine(input(conditions, detail), Rng.fromSeed(`wx-agg:${i}`));
    const r = eng.runToEnd();
    goals += r.homeGoals + r.awayGoals;
    inj += r.injuries.length;
    passes += (r.stats.passes?.[0] ?? 0) + (r.stats.passes?.[1] ?? 0);
    passesOk += (r.stats.passesOk?.[0] ?? 0) + (r.stats.passesOk?.[1] ?? 0);
    for (const l of r.lines) {
      if (l.started && !l.offReason) {
        energy += eng.energyOf(l.id) ?? 0;
        players++;
      }
      if (!l.started) {
        subMinute += l.minuteOn;
        subs++;
      }
    }
  }
  return { goals: goals / N, inj: inj / N, passPct: passes ? passesOk / passes : 0, energy: energy / Math.max(1, players), subMinute: subMinute / Math.max(1, subs) };
}

// ------------------------------------------------------------------------------------------------ generation
describe("weather generation", () => {
  const venue = { countryCode: "ENG", lat: 52.5 };

  it("is deterministic for a seed and fixture, and varies between fixtures and seeds", () => {
    expect(rollConditions("s", "f1", venue, 0)).toEqual(rollConditions("s", "f1", venue, 0));
    const a = new Set(Array.from({ length: 60 }, (_, i) => JSON.stringify(rollConditions("s", `f${i}`, venue, 10))));
    expect(a.size).toBeGreaterThan(10);
    const bySeed = new Set(Array.from({ length: 40 }, (_, i) => rollConditions(`seed${i}`, "f1", venue, 10).tempC));
    expect(bySeed.size).toBeGreaterThan(10);
  });

  it("never touches the world RNG, and ignores unrelated save state", () => {
    const s = newCareer({ seed: "wx-rng" });
    const f = Object.values(s.competitions).flatMap((c) => c.fixtures)[0];
    const rng = [...s.rng];
    const first = conditionsFor(s, f);
    s.idCounter += 1000;
    s.user.relationships.manager = 3;
    expect(conditionsFor(s, f)).toEqual(first);
    expect(s.rng).toEqual(rng);
  });

  it("is plausible by country and season", () => {
    const sample = (code: string, lat: number, month: number) => Array.from({ length: 800 }, (_, i) => rollConditions("clim", `c${i}`, { countryCode: code, lat }, month));
    const count = (xs: MatchConditions[], f: (c: MatchConditions) => boolean) => xs.filter(f).length / xs.length;
    const germanJan = sample("GER", 52.5, 0);
    expect(count(germanJan, (c) => c.weather === "snow" || c.pitch === "frozen")).toBeGreaterThan(0.08);
    expect(count(germanJan, (c) => c.weather === "heat")).toBe(0);
    const sevilleAug = sample("ESP", 37.4, 7);
    expect(count(sevilleAug, (c) => c.weather === "heat")).toBeGreaterThan(0.25);
    expect(count(sevilleAug, (c) => c.weather === "snow" || c.pitch === "frozen")).toBe(0);
    const englandNov = sample("ENG", 53.4, 10);
    const madridJul = sample("ESP", 40.4, 6);
    const wet = (xs: MatchConditions[]) => count(xs, (c) => c.weather === "rain" || c.weather === "heavy-rain");
    expect(wet(englandNov)).toBeGreaterThan(wet(madridJul) * 3);
    const windy = count(englandNov, (c) => c.weather === "wind");
    expect(windy).toBeGreaterThan(0.02);
    expect(windy).toBeLessThan(0.15);
    // Further north in the same country is colder.
    const mean = (xs: MatchConditions[]) => xs.reduce((s, c) => s + c.tempC, 0) / xs.length;
    expect(mean(sample("ENG", 55, 0))).toBeLessThan(mean(sample("ENG", 50.5, 0)));
  });

  it("never produces impossible combinations", () => {
    for (const code of ["ENG", "ESP", "ITA", "GER", "FRA", "BRA", "XXX"]) {
      for (let m = 0; m < 12; m++) {
        for (let i = 0; i < 150; i++) {
          const c = rollConditions("imp", `${code}${m}${i}`, { countryCode: code }, m);
          if (c.weather === "snow") expect(c.tempC).toBeLessThanOrEqual(W.snowMaxC);
          if (c.weather === "heat") expect(c.tempC).toBeGreaterThanOrEqual(W.heatC);
          if (c.pitch === "frozen") expect(c.tempC).toBeLessThanOrEqual(W.frozenMaxC);
          if (c.pitch === "dry") expect(["clear", "heat"]).toContain(c.weather);
          if (c.weather === "heat") expect(c.pitch).toBe("dry");
          expect(c.tempC).toBeGreaterThan(-25);
          expect(c.tempC).toBeLessThan(45);
        }
      }
    }
  });

  it("uses the home club's stadium for the venue", () => {
    const v = venueOf({ home: "eng-ipswich-town" });
    expect(v.countryCode).toBe("ENG");
    expect(typeof v.lat).toBe("number");
    expect(venueOf({ home: "ESP" }).countryCode).toBe("ESP");
  });
});

// ------------------------------------------------------------------------------------------------ effects
describe("weather effects", () => {
  const attrs = (o: Partial<Attributes>) => ({ ...HOME.starters[5].attrs, ...o }) as Attributes;

  it("has no effect in clear weather on a good or dry pitch", () => {
    expect(weatherFx(undefined)).toBeNull();
    expect(weatherFx(C("clear"))).toBeNull();
    expect(weatherFx(C("clear", "dry", 26))).toBeNull();
  });

  it("costs touch and passing in the wet, less for strong and balanced players", () => {
    const fx = weatherFx(C("heavy-rain", "heavy"));
    const weak = attrMultipliers(fx, attrs({ strength: 50, balance: 50 }));
    const strong = attrMultipliers(fx, attrs({ strength: 90, balance: 90 }));
    for (const k of TECH_ATTRS) {
      expect(weak?.[k]).toBeCloseTo(1 - W.techCap, 5);
      expect(strong?.[k]).toBeGreaterThan(weak?.[k] as number);
      expect(strong?.[k]).toBeLessThan(1);
    }
    expect(Object.keys(weak ?? {}).sort()).toEqual([...TECH_ATTRS].sort());
  });

  it("wind touches only crossing, long shots and kicking", () => {
    const m = attrMultipliers(weatherFx(C("wind")), attrs({}));
    expect(Object.keys(m ?? {}).sort()).toEqual([...WIND_ATTRS].sort());
    for (const k of WIND_ATTRS) expect(m?.[k]).toBeCloseTo(1 - W.wind, 5);
  });

  it("drains more in the heat, less for high-stamina players", () => {
    const mild = weatherFx(C("heat", "dry", W.heatC));
    const severe = weatherFx(C("heat", "dry", W.heatMaxC + 2));
    expect(drainMultiplier(mild, 50)).toBeCloseTo(W.heatDrain[0], 5);
    expect(drainMultiplier(severe, 50)).toBeCloseTo(W.heatDrain[1], 5);
    expect(drainMultiplier(severe, 95)).toBeLessThan(drainMultiplier(severe, 50));
    expect(drainMultiplier(severe, 95)).toBeGreaterThan(1);
    expect(drainMultiplier(null, 50)).toBe(1);
  });

  it("raises injury risk on heavy and frozen pitches only", () => {
    expect(weatherFx(C("rain", "heavy"))?.injury).toBe(W.injury.heavy);
    expect(weatherFx(C("snow", "frozen", -3))?.injury).toBe(W.injury.frozen);
    expect(weatherFx(C("rain"))?.injury).toBe(1);
  });
});

// ------------------------------------------------------------------------------------------------ the match engine
describe("weather in the match engine", () => {
  it("leaves a match without conditions, or in clear weather, exactly as it was", () => {
    for (let i = 0; i < 20; i++) {
      const base = new MatchEngine(input(undefined, true), Rng.fromSeed(`base:${i}`)).runToEnd();
      const clear = new MatchEngine(input(C("clear"), true), Rng.fromSeed(`base:${i}`)).runToEnd();
      const { conditions, ...rest } = clear;
      expect(conditions).toEqual(C("clear"));
      expect(rest).toEqual(base);
    }
  });

  it("heat tires players more and brings substitutions earlier", () => {
    const base = aggregate(undefined, 300);
    const hot = aggregate(C("heat", "dry", 35), 300);
    expect(hot.energy).toBeLessThan(base.energy - 2);
    expect(hot.subMinute).toBeLessThanOrEqual(base.subMinute);
  }, 120_000);

  it("a wet, heavy pitch costs passing a little, not a lot", () => {
    const base = aggregate(undefined, 120, true);
    const wet = aggregate(C("heavy-rain", "heavy"), 120, true);
    expect(wet.passPct).toBeLessThan(base.passPct);
    expect(base.passPct - wet.passPct).toBeLessThan(0.05);
  }, 120_000);

  it("snow stays modest", () => {
    const base = aggregate(undefined, 600);
    const snow = aggregate(C("snow", "frozen", -3), 600);
    expect(Math.abs(snow.goals - base.goals) / base.goals).toBeLessThan(0.2);
  }, 120_000);

  it("heavy and frozen pitches bring a few more injuries, not a flood", () => {
    const base = aggregate(undefined, 1500);
    const frozen = aggregate(C("clear", "frozen", -4), 1500);
    expect(frozen.inj).toBeGreaterThan(base.inj);
    expect(frozen.inj).toBeLessThan(base.inj * 1.6);
  }, 120_000);
});

// ------------------------------------------------------------------------------------------------ the career
describe("weather in a career", () => {
  it("applies to the user's matches only, and the played conditions survive a save", () => {
    const s = newCareer({ seed: "wx-career" });
    let checked = false;
    for (let i = 0; i < 12; i++) {
      strongUser(s);
      for (const f of fixturesForTurn(s)) {
        const mine = involvesUserTeam(s, f);
        const prepared = prepareMatch(s, f, Rng.fromSeed(`p:${f.id}`), { interactive: false, detail: mine });
        if (mine) expect(prepared.engine.input.conditions).toEqual(conditionsFor(s, f));
        else expect(prepared.engine.input.conditions).toBeUndefined();
        checked = true;
      }
      advanceTurn(s);
    }
    expect(checked).toBe(true);
    const played = Object.values(s.competitions).flatMap((c) => c.fixtures).filter((f) => f.result?.detail?.userLine);
    expect(played.length).toBeGreaterThan(0);
    for (const f of played) expect(f.result?.detail?.conditions).toEqual(conditionsFor(s, f));
    const back = migrateState(decodeState(encodeState(s)) as unknown as Record<string, unknown>);
    const again = Object.values(back.competitions).flatMap((c) => c.fixtures).filter((f) => f.result?.detail?.userLine);
    expect(again.map((f) => f.result?.detail?.conditions)).toEqual(played.map((f) => f.result?.detail?.conditions));
  }, 300_000);
});

// ------------------------------------------------------------------------------------------------ integrations
describe("weather integrations", () => {
  it("adds kick-off and half-time commentary in adverse conditions only", () => {
    const wet = new MatchEngine(input(C("heavy-rain", "heavy"), true), Rng.fromSeed("talk")).runToEnd();
    const info = wet.events.filter((e) => e.type === "info").map((e) => e.text);
    expect(info.some((t) => t.includes("rain is lashing down"))).toBe(true);
    expect(info.some((t) => t.includes("churned up"))).toBe(true);
    const clear = new MatchEngine(input(C("clear"), true), Rng.fromSeed("talk")).runToEnd();
    expect(clear.events.filter((e) => e.type === "info").some((e) => /rain|snow|wind|heat|pitch/i.test(e.text))).toBe(false);
  });

  it("unlocks weather achievements from the conditions a match was played in", async () => {
    const { checkMatchAchievements, hasAchievement } = await import("../src/engine/career/achievements");
    const s = newCareer({ seed: "wx-ach" });
    const uid = s.user.playerId;
    s.players[uid].career.apps = 30;
    const line = { id: uid, side: "home", slot: "ST", started: true, minuteOn: 0, minuteOff: null, rating: 7.2, goals: 1, assists: 1 } as unknown as import("../src/engine/match/engine").PlayerLine;
    const mk = (conditions: MatchConditions) => ({
      comp: { id: "c", kind: "league", name: "L" } as never,
      fixture: { id: `f-${conditions.weather}`, home: "a", away: "b" } as never,
      res: { goals: [{ minute: 10, side: "home", scorer: uid }], lines: [line], motm: "x", conditions } as never,
      line, mine: 1, theirs: 0, myTeam: "a", opponent: "b", nat: false,
    });
    checkMatchAchievements(s, mk(C("heavy-rain", "heavy", 9)));
    checkMatchAchievements(s, mk(C("snow", "frozen", -3)));
    checkMatchAchievements(s, mk(C("heat", "dry", 31)));
    checkMatchAchievements(s, mk(C("wind", "good", 8)));
    for (const id of ["mudlark", "ice-cold", "desert-heat", "into-the-wind"]) expect(hasAchievement(s, id)).toBe(true);
  });

  it("gets a feed post when the conditions were extreme", async () => {
    const { feedAfterMatch } = await import("../src/engine/career/feed");
    const s = newCareer({ seed: "wx-feed" });
    const uid = s.user.playerId;
    const line = { id: uid, side: "home", slot: "ST", goals: 0, assists: 0, rating: 6.8 } as unknown as import("../src/engine/match/engine").PlayerLine;
    const club = s.players[uid].clubId as string;
    feedAfterMatch(s, { comp: { id: "c", kind: "league", name: "L" } as never, fixture: { id: "fw", home: club, away: "eng-norwich-city" } as never, res: { goals: [], lines: [line], conditions: C("snow", "frozen", -4) } as never, line, mine: 1, theirs: 1, myTeam: club, opponent: "eng-norwich-city", nat: false });
    expect(s.user.feed?.some((p) => p.id.endsWith(":wx"))).toBe(true);
  });
});
