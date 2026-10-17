import { describe, expect, it } from "vitest";
import { MatchEngine, MAX_DECISIONS, type MatchEvent, type MatchPlayerInput, type TeamInput } from "../src/engine/match/engine";
import { FORMATIONS } from "../src/engine/match/lineup";
import { generatePlayer } from "../src/engine/players/generate";
import { Rng } from "../src/engine/rng";
import type { Position } from "../src/engine/types";

const gen = Rng.fromSeed("sub-teams");
let n = 0;
function mk(slot: Position, ovr: number, id?: string, user = false, stamina?: number): MatchPlayerInput {
  const p = generatePlayer(gen, { id: id ?? `s${n++}`, nationality: "ENG", position: slot, age: 26, season: 2026, overall: ovr, potential: ovr, clubId: null });
  const attrs = stamina === undefined ? p.attrs : { ...p.attrs, stamina };
  return { id: p.id, name: p.lastName, slot, attrs, fitness: 95, morale: 70, form: 6.6, sharpness: 80, bigMatch: 50, consistency: 55, isUser: user };
}
interface UserOpts { slot: Position; ovr: number; bench?: boolean; stamina?: number }
function team(name: string, ovr: number, user?: UserOpts): TeamInput {
  const shape = FORMATIONS[user?.slot === "AM" ? "4-2-3-1" : "4-3-3"];
  let placed = false;
  const starters = shape.map((slot) => {
    if (user && !user.bench && !placed && slot === user.slot) {
      placed = true;
      const u = mk(slot, user.ovr, "USER", true, user.stamina);
      return { ...u, id: "USER" };
    }
    return mk(slot, ovr);
  });
  const bench = (["GK", "CB", "CM", "ST", "RW", "LB", "DM"] as const).map((s) => mk(s, ovr));
  if (user?.bench) bench[bench.findIndex((b) => b.slot === user.slot)] = { ...mk(user.slot, user.ovr, "USER", true, user.stamina), id: "USER" };
  return { id: name, name, short: name, starters, bench, mentality: 0, color: "#000" };
}
const make = (seed: string, user?: UserOpts, interactive = false, detail = true, sides = { home: team("H", 72, user), away: team("A", 72) }) =>
  new MatchEngine({ ...sides, importance: 1, detail, interactive }, Rng.fromSeed(seed));

/** Reaches into the engine's live state: the decision functions are private and the inputs they read are the match's own. */
interface Live { input: { id: string; slot: Position }; energy: number; lvl: number; onPitch: boolean; line: { rating: number; minuteOn: number; started: boolean; minuteOff: number | null; offReason?: string } }
interface Peek {
  teams: Record<"home" | "away", { players: Live[]; bench: Live[]; subsUsed: number; subWindows: number; goals: number }>;
  subHazard(t: unknown, p: Live): number;
  injure(t: unknown, p: Live): void;
  minute: number;
}
const peek = (e: MatchEngine) => e as unknown as Peek;
const subsOf = (e: MatchEngine): MatchEvent[] => e.events.filter((x) => x.type === "sub");
function stepTo(e: MatchEngine, minute: number) {
  let guard = 0;
  while (!e.finished && peek(e).minute < minute && guard++ < 400) {
    if (e.pending) e.resolve(e.pending.options[0].id);
    else e.step();
  }
}

describe("substitution decisions", () => {
  it("are deterministic: the same seed makes the same changes at the same minutes", () => {
    for (let i = 0; i < 6; i++) {
      const sides = { home: team("H", 72, { slot: "ST", ovr: 70 }), away: team("A", 72) };
      const a = make(`det-${i}`, undefined, false, true, sides);
      const b = make(`det-${i}`, undefined, false, true, sides);
      const ra = a.runToEnd();
      const rb = b.runToEnd();
      expect(subsOf(a).map((e) => [e.minute, e.playerId, e.otherId])).toEqual(subsOf(b).map((e) => [e.minute, e.playerId, e.otherId]));
      expect([ra.homeGoals, ra.awayGoals]).toEqual([rb.homeGoals, rb.awayGoals]);
    }
  });

  it("respect the limits, never repeat a player and never replace someone who is not on the pitch", () => {
    for (let i = 0; i < 60; i++) {
      const e = make(`lim-${i}`, { slot: i % 2 ? "CM" : "CB", ovr: 60 + (i % 5) * 8 }, false, true);
      e.runToEnd();
      const subs = subsOf(e);
      for (const side of ["home", "away"] as const) {
        const mine = subs.filter((x) => x.side === side);
        expect(mine.length).toBeLessThanOrEqual(5);
        expect(new Set(mine.map((x) => x.playerId)).size).toBe(mine.length);
        expect(new Set(mine.map((x) => x.otherId)).size).toBe(mine.length);
        // someone who came on is not also one of those taken off earlier
        const on = new Set(mine.map((x) => x.playerId));
        for (const x of mine) expect(on.has(x.otherId as string)).toBe(false);
        const t = peek(e).teams[side];
        expect(t.subsUsed).toBe(mine.length);
        expect(t.subWindows).toBeLessThanOrEqual(3);
      }
      for (const x of subs) expect(x.minute).toBeLessThanOrEqual(90);
      // everybody who played has exactly one coherent spell
      for (const l of e.result().lines) if (l.minuteOn >= 0) expect((l.minuteOff ?? 90) >= l.minuteOn).toBe(true);
    }
  });

  it("never take a goalkeeper off for tiredness or form, only for injury", () => {
    for (let i = 0; i < 80; i++) {
      const e = make(`gk-${i}`, { slot: "GK", ovr: 55 });
      peek(e).minute = 75;
      const gk = peek(e).teams.home.players.find((p) => p.input.id === "USER") as Live;
      gk.energy = 10;
      gk.line.rating = 3.5;
      expect(peek(e).subHazard(peek(e).teams.home, gk)).toBe(0);
      const full = make(`gk-run-${i}`, { slot: "GK", ovr: 55 });
      full.runToEnd();
      const l = full.result().lines.find((x) => x.id === "USER");
      expect(l && l.offReason !== "sub").toBe(true);
    }
  });

  it("still make the forced change for an injury", () => {
    const e = make("inj-1", { slot: "CM", ovr: 70 });
    stepTo(e, 30);
    const t = peek(e).teams.home;
    const hurt = t.players.find((p) => p.input.id === "USER") as Live;
    peek(e).injure(t, hurt);
    expect(hurt.onPitch).toBe(false);
    expect(hurt.line.offReason).toBe("injury");
    expect(subsOf(e).some((x) => x.otherId === "USER")).toBe(true);
    e.runToEnd();
    expect(subsOf(e).filter((x) => x.otherId === "USER").length).toBe(1);
  });

  it("let a low-rated player who is playing well stay, and keep a high-rated one who is playing badly eligible", () => {
    const e = make("form-1", { slot: "ST", ovr: 70 });
    peek(e).minute = 72;
    const t = peek(e).teams.home;
    const p = t.players.find((x) => x.input.id === "USER") as Live;
    p.energy = 72;
    const probe = (lvl: number, rating: number) => {
      p.lvl = lvl;
      p.line.rating = rating;
      return peek(e).subHazard(t, p);
    };
    const lowGood = probe(62, 7.7);
    const highBad = probe(91, 5.3);
    const lowBad = probe(62, 5.3);
    const highGood = probe(91, 7.7);
    expect(highBad).toBeGreaterThan(lowGood);
    // rating alone is not the trigger: the same performance is judged the same way, with level a small secondary lean
    expect(lowBad - highBad).toBeLessThan(0.05);
    expect(highGood - lowGood).toBeLessThan(0.05);
    expect(lowBad).toBeGreaterThan(lowGood);
    expect(highBad).toBeGreaterThan(highGood);
    // bounded: nobody is certain to go and nobody is certain to stay
    expect(highBad).toBeLessThan(1);
    expect(probe(91, 8.5)).toBeGreaterThanOrEqual(0);
  });

  it("respond to fatigue, and never promise 90 minutes", () => {
    const e = make("fat-1", { slot: "CM", ovr: 70 });
    peek(e).minute = 72;
    const t = peek(e).teams.home;
    const p = t.players.find((x) => x.input.id === "USER") as Live;
    p.line.rating = 6.2;
    const at = (energy: number) => {
      p.energy = energy;
      return peek(e).subHazard(t, p);
    };
    expect(at(55)).toBeGreaterThan(at(70));
    expect(at(70)).toBeGreaterThan(at(85));
    // a fresh, in-form player has little chance, a spent one a real one
    expect(at(40)).toBeGreaterThan(0.2);
  });

  it("take a low-stamina player off more often, and later, than a high-stamina one", () => {
    const rate = (stamina: number) => {
      let off = 0;
      let mins = 0;
      const N = 120;
      for (let i = 0; i < N; i++) {
        const e = make(`sta-${i}`, { slot: "CM", ovr: 72, stamina });
        const l = e.runToEnd().lines.find((x) => x.id === "USER");
        if (l?.offReason === "sub") off++;
        mins += (l?.minuteOff ?? 90) - (l?.minuteOn ?? 0);
      }
      return { off: off / N, mins: mins / N };
    };
    const low = rate(30);
    const high = rate(92);
    expect(low.off).toBeGreaterThan(high.off + 0.1);
    expect(low.mins).toBeLessThan(high.mins);
    expect(high.off).toBeGreaterThan(0);
  });

  it("do not judge a substitute as though he had played the whole match, and change him only once", () => {
    const e = make("subbed-1", { slot: "CM", ovr: 70 });
    peek(e).minute = 75;
    const t = peek(e).teams.home;
    const p = t.players.find((x) => x.input.id === "USER") as Live;
    p.energy = 50;
    p.line.rating = 5.0;
    expect(peek(e).subHazard(t, p)).toBeGreaterThan(0.2);
    p.line.started = false;
    p.line.minuteOn = 46;
    expect(peek(e).subHazard(t, p)).toBe(0);
    // and a substitute starts on full legs, not on the energy the starter he replaced had left
    const bench = make("subbed-2", { slot: "CM", ovr: 70, bench: true });
    for (let i = 0; i < 60 && !bench.finished; i++) bench.step();
    const sub = peek(bench).teams.home.bench.find((x) => x.input.id === "USER") as Live;
    if (sub.onPitch) expect(sub.energy).toBeGreaterThan(60);
  });

  it("never take a substitute off for his legs or his form, only for injury or a red card", () => {
    let came = 0;
    for (let i = 0; i < 80; i++) {
      const e = make(`again-${i}`, { slot: "CM", ovr: 70, bench: true });
      e.runToEnd();
      const l = e.result().lines.find((x) => x.id === "USER");
      if (l && !l.started && l.minuteOn >= 0) {
        came++;
        expect(l.offReason).not.toBe("sub");
      }
    }
    expect(came).toBeGreaterThan(0);
  });

  it("spread the changes over the second half, with none in stoppage time", () => {
    const mins: number[] = [];
    for (let i = 0; i < 80; i++) {
      const e = make(`late-${i}`, { slot: "ST", ovr: 72 });
      e.runToEnd();
      for (const l of e.result().lines) if (l.offReason === "sub" && (l.minuteOff as number) > 45) mins.push(l.minuteOff as number);
    }
    expect(Math.max(...mins)).toBeLessThanOrEqual(89);
    const share = (lo: number, hi: number) => mins.filter((m) => m >= lo && m < hi).length / mins.length;
    expect(share(55, 70)).toBeGreaterThan(0.2);
    expect(share(70, 80)).toBeGreaterThan(0.2);
    expect(share(80, 90)).toBeGreaterThan(0.08);
  });

  it("let a trailing side keep an influential attacker and a leading side protect a tired one", () => {
    const e = make("ctx-1", { slot: "ST", ovr: 72 });
    peek(e).minute = 78;
    const t = peek(e).teams.home;
    const opp = peek(e).teams.away;
    const p = t.players.find((x) => x.input.id === "USER") as Live;
    p.energy = 76;
    p.line.rating = 6.4;
    const at = (diff: number) => {
      t.goals = diff > 0 ? diff : 0;
      opp.goals = diff < 0 ? -diff : 0;
      return peek(e).subHazard(t, p);
    };
    expect(at(2)).toBeGreaterThan(at(0));
    expect(at(0)).toBeGreaterThan(at(-2));
  });

  it("complete the match, take the user off at most once and ask him nothing after he has gone", () => {
    for (let i = 0; i < 40; i++) {
      const e = make(`done-${i}`, { slot: "ST", ovr: 58 + (i % 4) * 10 }, true);
      let guard = 0;
      while (!e.finished && guard++ < 1500) {
        if (e.pending) e.resolve(e.pending.options[0].id);
        else e.step();
      }
      expect(e.finished).toBe(true);
      const off = e.events.find((x) => x.type === "sub" && x.otherId === "USER" || (x.type === "injury" && x.user && false));
      expect(e.events.filter((x) => x.type === "sub" && x.otherId === "USER").length).toBeLessThanOrEqual(1);
      const l = e.result().lines.find((x) => x.id === "USER");
      if (off && l?.minuteOff != null) {
        const asked = e.events.filter((x) => x.type === "decision" && x.minute > (l.minuteOff as number));
        expect(asked.length).toBe(0);
      }
      expect(e.events.filter((x) => x.type === "decision").length).toBeLessThanOrEqual(MAX_DECISIONS);
    }
  });
});
