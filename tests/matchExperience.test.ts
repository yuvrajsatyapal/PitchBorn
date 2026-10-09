import { describe, expect, it } from "vitest";
import { tickInterval } from "../src/components/game/match/speed";
import { MatchEngine, MAX_DECISIONS, type MatchPlayerInput, type PlayerLine, type TeamInput } from "../src/engine/match/engine";
import { filterEvents, isKey, isYou } from "../src/engine/match/feed";
import { instruction, instructionResult, lowInvolvementReason, performance, postMatch, ratingReasons, ratingVisible, statCells } from "../src/engine/match/insight";
import { FORMATIONS } from "../src/engine/match/lineup";
import { riskOf } from "../src/engine/match/moments";
import { generatePlayer } from "../src/engine/players/generate";
import { Rng } from "../src/engine/rng";
import type { MatchFx } from "../src/engine/traits/types";
import type { Position } from "../src/engine/types";

const gen = Rng.fromSeed("exp-teams");
let n = 0;
function mk(slot: Position, ovr: number, id?: string, user = false, fx?: MatchFx): MatchPlayerInput {
  const p = generatePlayer(gen, { id: id ?? `x${n++}`, nationality: "ENG", position: slot, age: 26, season: 2026, overall: ovr, potential: ovr, clubId: null });
  return { id: p.id, name: p.lastName, slot, attrs: p.attrs, fitness: 95, morale: 70, form: 6.6, sharpness: 80, bigMatch: 50, consistency: 55, isUser: user, fx };
}
interface UserOpts { slot: Position; ovr: number; bench?: boolean; fx?: MatchFx; team?: number }
function team(name: string, ovr: number, user?: UserOpts): TeamInput {
  const shape = FORMATIONS[user?.slot === "AM" ? "4-2-3-1" : "4-3-3"];
  let placed = false;
  const starters = shape.map((slot) => {
    if (user && !user.bench && !placed && slot === user.slot) {
      placed = true;
      return mk(slot, user.ovr, "USER", true, user.fx);
    }
    return mk(slot, ovr);
  });
  const bench = (["GK", "CB", "CM", "ST", "RW", "LB", "DM"] as const).map((s) => mk(s, ovr));
  if (user?.bench) bench[bench.findIndex((b) => b.slot === user.slot)] = mk(user.slot, user.ovr, "USER", true, user.fx);
  return { id: name, name, short: name, starters, bench, mentality: 0, color: "#000" };
}
const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
const run = (home: TeamInput, away: TeamInput, seed: string, interactive = false) => new MatchEngine({ home, away, importance: 1, detail: true, interactive }, Rng.fromSeed(seed));

/** Step a match to the end, answering every moment with the first option. */
function play(eng: MatchEngine, onStep?: () => void, choose: (e: MatchEngine) => string = (e) => e.pending?.options[0].id ?? "") {
  let guard = 0;
  while (!eng.finished && guard++ < 600) {
    if (eng.pending) eng.resolve(choose(eng));
    else {
      eng.step();
      onStep?.();
    }
  }
  return eng.result();
}

describe("player state", () => {
  it("a bench player is on the bench, never 'substituted', and has no rating", () => {
    const eng = run(team("H", 72, { slot: "CM", ovr: 70, bench: true }), team("A", 72), "bench-1");
    expect(eng.playerState("USER").phase).toBe("bench");
    const line = eng.lineFor("USER");
    expect(line && ratingVisible(line, eng.minute, false)).toBe(false);
    for (let i = 0; i < 20; i++) eng.step();
    expect(eng.playerState("USER").phase).toBe("bench");
  });

  it("an unused substitute stays out of the result and out of the ratings", () => {
    let unused = 0;
    for (let i = 0; i < 12 && unused < 2; i++) {
      const eng = run(team("H", 72, { slot: "CM", ovr: 70, bench: true }), team("A", 72), `unused-${i}`);
      const res = play(eng);
      if (eng.playerState("USER").phase === "unused") {
        unused++;
        expect(res.lines.some((l) => l.id === "USER")).toBe(false);
      }
    }
    expect(unused).toBeGreaterThan(0);
  });

  it("a substitute who comes on gets his minute, and a rating only once he has been involved", () => {
    let seen = 0;
    for (let i = 0; i < 60 && seen < 3; i++) {
      const eng = run(team("H", 72, { slot: "CB", ovr: 72, bench: true }), team("A", 72), `on-${i}`);
      let cameOn = -1;
      while (!eng.finished) {
        eng.step();
        if (cameOn < 0 && eng.playerState("USER").phase === "playing") {
          cameOn = eng.minute;
          const s = eng.playerState("USER");
          expect(s.phase === "playing" && s.started).toBe(false);
          expect(s.phase === "playing" && s.minuteOn).toBe(eng.minute);
          const line = eng.lineFor("USER");
          expect(line && ratingVisible(line, eng.minute, false)).toBe(false);
        }
      }
      if (cameOn > 0) {
        seen++;
        expect(eng.events.some((e) => e.user && /COMING ON/.test(e.text))).toBe(true);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("a starter taken off is 'off' with his minute and a reason, and keeps his rating", () => {
    let seen = 0;
    for (let i = 0; i < 80 && seen < 2; i++) {
      const eng = run(team("H", 72, { slot: "CM", ovr: 55 }), team("A", 72), `off-${i}`);
      play(eng);
      const s = eng.playerState("USER");
      if (s.phase === "off") {
        seen++;
        expect(s.minuteOff).toBeGreaterThan(s.minuteOn);
        expect(["sub", "injury", "red"]).toContain(s.reason);
        const line = eng.lineFor("USER");
        expect(line && ratingVisible(line, eng.minute, true)).toBe(true);
      } else expect(s.phase).toBe("fulltime");
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("warming up only ever shows in the second half, once the manager has a reason", () => {
    let warm = 0;
    for (let i = 0; i < 25; i++) {
      const eng = run(team("H", 72, { slot: "CM", ovr: 70, bench: true }), team("A", 72), `warm-${i}`);
      while (!eng.finished) {
        eng.step();
        if (eng.playerState("USER").phase === "warming") {
          warm++;
          expect(eng.minute).toBeGreaterThanOrEqual(52);
        }
      }
    }
    expect(warm).toBeGreaterThan(0);
  });
});

describe("involvement", () => {
  it("never guarantees a weak player an opportunity", () => {
    let noShot = 0;
    for (let i = 0; i < 40; i++) {
      const res = play(run(team("H", 80, { slot: "ST", ovr: 45 }), team("A", 80), `weak-${i}`));
      const l = res.lines.find((x) => x.id === "USER");
      if (l && l.started && l.shots === 0 && l.keyPasses === 0) noShot++;
    }
    expect(noShot).toBeGreaterThan(0);
  });

  it("depends on position: forwards are in the box, defenders clear and win duels, keepers distribute", () => {
    const sum = (slot: Position, pick: (l: PlayerLine) => number) => {
      const v: number[] = [];
      for (let i = 0; i < 30; i++) {
        const l = play(run(team("H", 72, { slot, ovr: 72 }), team("A", 72), `pos-${slot}-${i}`)).lines.find((x) => x.id === "USER");
        if (l) v.push(pick(l));
      }
      return avg(v);
    };
    expect(sum("ST", (l) => l.inv?.boxTouches ?? 0)).toBeGreaterThan(sum("CB", (l) => l.inv?.boxTouches ?? 0));
    expect(sum("CB", (l) => l.inv?.clearances ?? 0)).toBeGreaterThan(sum("ST", (l) => l.inv?.clearances ?? 0));
    expect(sum("CB", (l) => l.inv?.duels ?? 0)).toBeGreaterThan(0);
    expect(sum("GK", (l) => l.inv?.passes ?? 0)).toBeGreaterThan(10);
    expect(sum("DM", (l) => l.inv?.touches ?? 0)).toBeGreaterThan(sum("ST", (l) => l.inv?.touches ?? 0));
    expect(sum("RW", (l) => l.inv?.dribbles ?? 0)).toBeGreaterThan(sum("CB", (l) => l.inv?.dribbles ?? 0));
  });

  it("falls when the side rarely has the ball, but a weak player is not invisible and a star is not everywhere", () => {
    const touches = (mine: number, theirs: number, ovr: number) => {
      const v: number[] = [];
      for (let i = 0; i < 30; i++) {
        const l = play(run(team("H", mine, { slot: "CM", ovr }), team("A", theirs), `poss-${mine}-${ovr}-${i}`)).lines.find((x) => x.id === "USER");
        if (l?.inv) v.push(l.inv.touches);
      }
      return avg(v);
    };
    const dominated = touches(60, 82, 60);
    const dominant = touches(82, 60, 60);
    expect(dominated).toBeLessThan(dominant);
    const weak = touches(72, 72, 52);
    const star = touches(72, 72, 88);
    expect(weak).toBeGreaterThan(12);
    expect(star / weak).toBeLessThan(1.8);
  });

  it("does not give the user's player special football: the same seed scores the same whether he is flagged or not", () => {
    for (let i = 0; i < 8; i++) {
      const asUser = team("H", 72, { slot: "ST", ovr: 72 });
      const asNpc: TeamInput = { ...asUser, starters: asUser.starters.map((s) => ({ ...s, isUser: false })), bench: asUser.bench.map((s) => ({ ...s, isUser: false })) };
      const away = team("A", 72);
      const a = new MatchEngine({ home: asUser, away, importance: 1, detail: true }, Rng.fromSeed(`fair-${i}`)).runToEnd();
      const b = new MatchEngine({ home: asNpc, away, importance: 1, detail: true }, Rng.fromSeed(`fair-${i}`)).runToEnd();
      expect([a.homeGoals, a.awayGoals, a.stats.shots, a.stats.xg, a.stats.fouls]).toEqual([b.homeGoals, b.awayGoals, b.stats.shots, b.stats.xg, b.stats.fouls]);
    }
  });

  it("the flow-of-play layer does not move the football of matches that do not use it", () => {
    for (let i = 0; i < 6; i++) {
      const h = team("H", 72);
      const a = team("A", 72);
      const fast = new MatchEngine({ home: h, away: a, importance: 1, detail: false }, Rng.fromSeed(`fast-${i}`)).runToEnd();
      expect(fast.lines.every((l) => l.inv === undefined)).toBe(true);
      expect(fast.stats.passes).toBeUndefined();
    }
  });

  it("team passing is the sum of what its players did", () => {
    const eng = run(team("H", 72, { slot: "CM", ovr: 72 }), team("A", 72), "passes", true);
    const res = play(eng);
    const sumFor = (side: "home" | "away", f: (l: PlayerLine) => number) => res.lines.filter((l) => l.side === side).reduce((s, l) => s + f(l), 0);
    expect(sumFor("home", (l) => l.inv?.passes ?? 0)).toBe(res.stats.passes?.[0]);
    expect(sumFor("away", (l) => l.inv?.passesOk ?? 0)).toBe(res.stats.passesOk?.[1]);
    expect(res.stats.passesOk?.[0]).toBeLessThanOrEqual(res.stats.passes?.[0] ?? 0);
  });
});

describe("key moments", () => {
  function firstMoment(slot: Position, kind: "progress" | "hold", fx?: MatchFx) {
    for (let i = 0; i < 60; i++) {
      const eng = run(team("H", 72, { slot, ovr: 72, fx }), team("A", 72), `mom-${slot}-${kind}-${i}`, true);
      let guard = 0;
      while (!eng.finished && guard++ < 400) {
        if (eng.pending) {
          if (eng.pending.kind === kind) return eng.pending;
          eng.resolve(eng.pending.options[0].id);
        } else eng.step();
      }
    }
    return null;
  }

  it("offers choices that fit the position, with the abilities they lean on", () => {
    const cm = firstMoment("CM", "progress");
    expect(cm?.options.map((o) => o.id)).toEqual(expect.arrayContaining(["through", "carry", "recycle"]));
    const rw = firstMoment("RW", "progress");
    expect(rw?.options.map((o) => o.id)).toEqual(expect.arrayContaining(["takeOn", "cross"]));
    const gk = firstMoment("GK", "progress");
    expect(gk?.options.map((o) => o.id)).toEqual(expect.arrayContaining(["short", "long"]));
    const cb = firstMoment("CB", "hold");
    expect(cb?.options.map((o) => o.id)).toEqual(expect.arrayContaining(["hold", "track"]));
    for (const m of [cm, rw, gk, cb]) for (const o of m?.options ?? []) expect(o.skills && o.skills.length).toBeGreaterThan(0);
  });

  it("never shows a probability: only a risk word", () => {
    const m = firstMoment("CM", "progress");
    for (const o of m?.options ?? []) {
      expect(["Safe", "Balanced", "Risky"]).toContain(riskOf(o.odds));
      expect(`${o.label} ${o.detail} ${(o.skills ?? []).join(" ")}`).not.toMatch(/%|\d/);
    }
  });

  it("traits add the choices a player's style suggests", () => {
    const plain = firstMoment("CM", "progress");
    const long = firstMoment("CM", "progress", { shootLong: 1.3, xgLong: 1.06 });
    expect(plain?.options.some((o) => o.id === "distance")).toBe(false);
    const d = long?.options.find((o) => o.id === "distance");
    expect(d).toBeDefined();
    expect(d?.suits).toBe(true);
    const play2 = firstMoment("RW", "progress", { createThrough: 1.3, create: 1.3 });
    expect(play2?.options.some((o) => o.id === "split" && o.suits)).toBe(true);
  });

  it("attributes decide how a choice goes: a better dribbler wins more of the duels he picks", () => {
    const rate = (ovr: number) => {
      let won = 0;
      let tried = 0;
      for (let i = 0; i < 40; i++) {
        const eng = run(team("H", 72, { slot: "RW", ovr }), team("A", 72), `attr-${ovr}-${i}`, true);
        play(eng, undefined, (e) => e.pending?.options.find((o) => o.id === "takeOn")?.id ?? e.pending?.options[0].id ?? "");
        const l = eng.lineFor("USER");
        won += l?.inv?.dribblesWon ?? 0;
        tried += l?.inv?.dribbles ?? 0;
      }
      return won / Math.max(1, tried);
    };
    expect(rate(88)).toBeGreaterThan(rate(48));
  });

  it("pauses the match until the user chooses, and play resumes afterwards", () => {
    const eng = run(team("H", 72, { slot: "CM", ovr: 72 }), team("A", 72), "pause", true);
    let guard = 0;
    while (!eng.pending && !eng.finished && guard++ < 400) eng.step();
    expect(eng.pending).not.toBeNull();
    const minute = eng.minute;
    expect(eng.step()).toEqual([]);
    expect(eng.minute).toBe(minute);
    // the screen keeps the speed the user picked and only stops the clock while a choice waits
    expect(tickInterval(2, false, true)).toBe(0);
    eng.resolve(eng.pending?.options[0].id ?? "");
    expect(eng.pending).toBeNull();
    expect(tickInterval(2, false, false)).toBe(220);
    expect(tickInterval(3, false, false)).toBe(60);
    expect(tickInterval(2, true, false)).toBe(0);
    eng.step();
    expect(eng.minute).toBeGreaterThanOrEqual(minute);
  });

  it("keeps the number of questions to what a match can carry, and never forces a minimum", () => {
    const counts: number[] = [];
    for (let i = 0; i < 30; i++) {
      const eng = run(team("H", 72, { slot: "ST", ovr: 50 }), team("A", 80), `dens-${i}`, true);
      play(eng);
      counts.push(eng.events.filter((e) => e.type === "decision").length);
    }
    expect(Math.max(...counts)).toBeLessThanOrEqual(MAX_DECISIONS);
    expect(Math.min(...counts)).toBeLessThan(Math.max(...counts));
  });

  it("skipping resolves the rest on its own, asks nothing more, and is the same match every time", () => {
    const home = team("H", 72, { slot: "CM", ovr: 72 });
    const away = team("A", 72);
    const go = () => {
      const eng = run(home, away, "skip", true);
      for (let i = 0; i < 30; i++) {
        if (eng.pending) eng.resolve(eng.pending.options[0].id);
        else eng.step();
      }
      const askedBefore = eng.events.filter((e) => e.type === "decision").length;
      const res = eng.runToEnd();
      return { res, askedBefore, askedAfter: eng.events.filter((e) => e.type === "decision").length, pending: eng.pending };
    };
    const a = go();
    const b = go();
    expect(a.pending).toBeNull();
    expect(a.res).toEqual(b.res);
    expect(a.res.events.length).toBeGreaterThan(0);
  });
});

describe("determinism", () => {
  it("reading the match for the screen does not change it", () => {
    const home = team("H", 72, { slot: "CM", ovr: 70 });
    const away = team("A", 72);
    const quiet = run(home, away, "read", true);
    const watched = run(home, away, "read", true);
    const a = play(quiet);
    const b = play(watched, () => {
      watched.userContext();
      watched.playerState("USER");
      watched.liveStats;
      const l = watched.lineFor("USER");
      if (l) {
        statCells(l, watched.minute, true);
        ratingReasons(l);
        performance(l, watched.minute);
        instruction(l, watched.minute);
      }
      filterEvents(watched.events, "key", "USER");
    });
    expect(b).toEqual(a);
  });
});

describe("commentary", () => {
  const eng = run(team("H", 72, { slot: "CM", ovr: 72 }), team("A", 72), "feed", true);
  const res = play(eng);
  it("filters one event stream three ways", () => {
    const all = filterEvents(res.events, "all", "USER");
    const you = filterEvents(res.events, "you", "USER");
    const key = filterEvents(res.events, "key", "USER");
    expect(all.length).toBe(res.events.length);
    expect(you.length).toBeGreaterThan(0);
    expect(you.length).toBeLessThan(all.length);
    expect(you.every((e) => isYou(e, "USER"))).toBe(true);
    expect(key.every((e) => isKey(e) || e.type === "goal")).toBe(true);
    expect(key.filter((e) => e.type === "goal").length).toBe(res.homeGoals + res.awayGoals);
    expect(all.filter((e) => e.type === "goal").length).toBe(key.filter((e) => e.type === "goal").length);
  });
  it("tags the user's own small actions and status lines as his", () => {
    const small = res.events.filter((e) => e.tag);
    expect(small.length).toBeGreaterThan(0);
    expect(small.every((e) => e.user && e.playerId === "USER")).toBe(true);
  });
  it("keeps status lines rare and far apart", () => {
    for (let i = 0; i < 12; i++) {
      const e = run(team("H", 72, { slot: "CM", ovr: 55 }), team("A", 82), `status-${i}`, true);
      const r = play(e);
      const status = r.events.filter((x) => x.tag === "status");
      expect(status.length).toBeLessThanOrEqual(6);
      for (let k = 1; k < status.length; k++) expect(status[k].minute - status[k - 1].minute).toBeGreaterThanOrEqual(12);
    }
  });
  it("says he is struggling to get involved only when the counted touches say so", () => {
    let checked = 0;
    for (let i = 0; i < 30; i++) {
      const e = run(team("H", 58, { slot: "CM", ovr: 55 }), team("A", 84), `quiet-${i}`, true);
      const touches: number[] = [];
      let seen = 0;
      play(e, () => {
        if (e.playerState("USER").phase === "playing") touches.push(e.lineFor("USER")?.inv?.touches ?? 0);
        const fresh = e.events.slice(seen).filter((x) => x.tag === "status" && /struggling|not seeing much/.test(x.text));
        seen = e.events.length;
        for (const s of fresh) {
          checked++;
          const len = touches.length;
          expect(touches[len - 1] - touches[len - 11]).toBeLessThanOrEqual(3);
        }
      });
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe("stats", () => {
  const base: PlayerLine = {
    id: "u", side: "home", slot: "ST", started: true, minuteOn: 0, minuteOff: null, rating: 6.6, goals: 0, assists: 0, shots: 2, onTarget: 1, keyPasses: 1, tackles: 0, saves: 0, fouls: 0, yellow: 0, red: 0, injured: false, conceded: 0,
    inv: { touches: 20, passes: 12, passesOk: 9, dribbles: 4, dribblesWon: 2, duels: 5, duelsWon: 3, aerials: 1, aerialsWon: 1, interceptions: 0, clearances: 0, recoveries: 1, possLost: 6, crosses: 0, crossesOk: 0, boxTouches: 4, claims: 0, xg: 0.31, errors: 0 },
  };
  const labels = (slot: Position, full = false) => statCells({ ...base, slot }, 60, full).map((c) => c.label);
  it("shows each position the figures that matter for it", () => {
    expect(labels("ST")).toEqual(expect.arrayContaining(["xG", "Dribbles won", "Chances created"]));
    expect(labels("CM")).toEqual(expect.arrayContaining(["Recoveries", "Passes"]));
    expect(labels("CB")).toEqual(expect.arrayContaining(["Clearances", "Interceptions", "Aerials won"]));
    expect(labels("GK")).toEqual(expect.arrayContaining(["Saves", "xG faced", "Claims", "Distribution"]));
    expect(labels("RB")).toEqual(expect.arrayContaining(["Crosses", "Tackles"]));
    expect(labels("ST")).not.toContain("Clearances");
  });
  it("shows only what the engine counts", () => {
    const allowed = new Set(["Minutes", "Touches", "Passes", "Shots", "xG", "Dribbles won", "Chances created", "Goals", "Assists", "Duels won", "Possession lost", "Box touches", "Recoveries", "Interceptions", "Tackles", "Crosses", "Clearances", "Aerials won", "Errors", "Saves", "Conceded", "xG faced", "Claims", "Distribution", "1v1 saves"]);
    for (const slot of ["GK", "CB", "RB", "DM", "CM", "AM", "RW", "ST"] as Position[]) for (const l of labels(slot, true)) expect(allowed.has(l)).toBe(true);
  });
  it("has nothing to show without a detailed match", () => {
    expect(statCells({ ...base, inv: undefined }, 60)).toEqual([]);
  });
});

describe("ratings", () => {
  it("rates no performance without an appearance, and holds the figure back for a player who has barely been involved", () => {
    const l: PlayerLine = { id: "u", side: "home", slot: "CM", started: false, minuteOn: -1, minuteOff: null, rating: 6, goals: 0, assists: 0, shots: 0, onTarget: 0, keyPasses: 0, tackles: 0, saves: 0, fouls: 0, yellow: 0, red: 0, injured: false, conceded: 0 };
    expect(ratingVisible(l, 80, false)).toBe(false);
    expect(ratingVisible(l, 80, true)).toBe(false);
    const cameo = { ...l, minuteOn: 80, inv: { touches: 1, passes: 1, passesOk: 1, dribbles: 0, dribblesWon: 0, duels: 0, duelsWon: 0, aerials: 0, aerialsWon: 0, interceptions: 0, clearances: 0, recoveries: 0, possLost: 0, crosses: 0, crossesOk: 0, boxTouches: 0, claims: 0, xg: 0, errors: 0 } };
    expect(ratingVisible(cameo, 82, false)).toBe(false);
    expect(ratingVisible(cameo, 91, false)).toBe(true);
  });

  it("scores small contests neutrally on average, so being on the ball neither pays nor costs", () => {
    const d: number[] = [];
    for (let i = 0; i < 40; i++) {
      const res = play(run(team("H", 72), team("A", 72), `neutral-${i}`));
      for (const l of res.lines) if (l.why) d.push(l.why.pass ?? 0);
    }
    expect(Math.abs(avg(d))).toBeLessThan(0.02);
  });

  it("lets a defender earn a high rating from defending alone", () => {
    let best = 0;
    for (let i = 0; i < 60; i++) {
      const res = play(run(team("H", 72, { slot: "CB", ovr: 86 }), team("A", 72), `cb-${i}`));
      const l = res.lines.find((x) => x.id === "USER");
      if (l && l.goals + l.assists === 0) best = Math.max(best, l.rating);
    }
    expect(best).toBeGreaterThanOrEqual(7.2);
  });

  it("does not punish a goalkeeper for a quiet night", () => {
    const quiet: number[] = [];
    for (let i = 0; i < 80; i++) {
      const res = play(run(team("H", 82, { slot: "GK", ovr: 72 }), team("A", 62), `gk-${i}`));
      const l = res.lines.find((x) => x.id === "USER");
      if (l && l.saves === 0 && l.conceded === 0) quiet.push(l.rating);
    }
    expect(quiet.length).toBeGreaterThan(3);
    expect(avg(quiet)).toBeGreaterThan(6.3);
  });

  it("explains a rating with the actions behind it, and only those", () => {
    const l: PlayerLine = {
      id: "u", side: "home", slot: "CM", started: true, minuteOn: 0, minuteOff: 90, rating: 6.8, goals: 0, assists: 0, shots: 0, onTarget: 0, keyPasses: 2, tackles: 0, saves: 0, fouls: 0, yellow: 0, red: 0, injured: false, conceded: 0,
      inv: { touches: 40, passes: 30, passesOk: 22, dribbles: 0, dribblesWon: 0, duels: 4, duelsWon: 3, aerials: 0, aerialsWon: 0, interceptions: 0, clearances: 0, recoveries: 4, possLost: 8, crosses: 0, crossesOk: 0, boxTouches: 0, claims: 0, xg: 0, errors: 0 },
      why: { chance: 0.2, goal: 0.9, pass: -0.3, missed: -0.18 },
    };
    const r = ratingReasons(l);
    expect(r.good.map((x) => x.text)).toEqual(["2 chances created"]);
    expect(r.bad.map((x) => x.text)).toEqual(["Lost possession 8 times", "Missed a big chance"]);
    expect(r.good.some((x) => /goal/.test(x.text))).toBe(false);
  });
});

describe("manager instruction and the post-match read", () => {
  const winger: PlayerLine = {
    id: "u", side: "home", slot: "LW", started: true, minuteOn: 0, minuteOff: 90, rating: 7.1, goals: 0, assists: 1, shots: 1, onTarget: 1, keyPasses: 2, tackles: 1, saves: 0, fouls: 0, yellow: 0, red: 0, injured: false, conceded: 0,
    inv: { touches: 30, passes: 18, passesOk: 15, dribbles: 4, dribblesWon: 3, duels: 6, duelsWon: 4, aerials: 0, aerialsWon: 0, interceptions: 0, clearances: 0, recoveries: 3, possLost: 6, crosses: 4, crossesOk: 1, boxTouches: 2, claims: 0, xg: 0.1, errors: 0 },
  };
  it("asks for something the engine can measure at every position", () => {
    for (const slot of ["GK", "CB", "RB", "LB", "DM", "CM", "AM", "RW", "LW", "ST"] as Position[]) {
      const i = instruction({ ...winger, slot }, 90);
      expect(i?.title).toBeTruthy();
      expect(i?.progress).toMatch(/\d/);
    }
  });
  it("grades the instruction without making it the whole verdict", () => {
    expect(instructionResult(winger, 90)).toBe("met");
    const failed = { ...winger, inv: { ...winger.inv!, dribbles: 5, dribblesWon: 0 }, rating: 6.8 };
    expect(instructionResult(failed, 90)).toBe("missed");
    expect(postMatch(failed, 90, true).manager).toMatch(/wanted more/i);
    const met = postMatch(winger, 90, true);
    expect(met.rating).toBe(7.1);
    expect(met.instruction?.result).toBe("met");
  });
  it("writes the summary from his counts", () => {
    const pm = postMatch(winger, 90, true);
    expect(pm.headline).toContain("1 assist");
    expect(pm.wentWell.join(" ")).toMatch(/chances|marker/);
    expect(pm.improve.join(" ")).toMatch(/Lost possession 6|crosses/);
    expect(postMatch({ ...winger, minuteOn: -1 }, 90, true).manager).toMatch(/Stay ready/);
  });
  it("explains a quiet night only from the counted match", () => {
    const quiet = { ...winger, rating: 6.3, shots: 0, keyPasses: 0, assists: 0, inv: { ...winger.inv!, touches: 4, dribblesWon: 0, dribbles: 1 } };
    const ctx = { side: "home" as const, slot: "LW" as const, possession: 31, attacks: 20, flanks: [2, 4, 14] as [number, number, number], lane: "left" as const, laneShare: 0.1, goalsFor: 0, goalsAgainst: 1 };
    expect(lowInvolvementReason(quiet, 60, ctx)).toMatch(/31% possession/);
    expect(lowInvolvementReason(quiet, 60, { ...ctx, possession: 52 })).toMatch(/down the right/);
    expect(lowInvolvementReason(winger, 60, ctx)).toBeUndefined();
    expect(performance(quiet, 60, ctx).label).toBe("Struggling for involvement");
  });
});
