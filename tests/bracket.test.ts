import { beforeAll, describe, expect, it } from "vitest";
import { BRACKET_MAX_TIES, buildBracket, journeyOf, resultNote, stageForTies } from "../src/engine/competitions/bracket";
import { fixtureWinner, progressKnockouts } from "../src/engine/competitions/setup";
import { advanceTurn } from "../src/engine/season/advance";
import { Rng } from "../src/engine/rng";
import type { Competition, Fixture, GameState } from "../src/engine/types";
import { newCareer } from "./helpers";

let n = 0;
function fx(round: number, stage: string, home: string, away: string, hg?: number, ag?: number, extra: Partial<NonNullable<Fixture["result"]>> = {}): Fixture {
  return { id: `t${n++}`, compId: "c", round, turn: round * 3, home, away, stage, result: hg === undefined ? undefined : { hg, ag: ag as number, goals: [], ...extra } };
}
const comp = (fixtures: Fixture[], over: Partial<Competition> = {}): Competition =>
  ({ id: "c", kind: "cup", name: "Test Cup", shortName: "Cup", season: 2026, teams: [...new Set(fixtures.flatMap((f) => [f.home, f.away]))], fixtures, alive: [], prestige: 5, complete: false, ...over }) as Competition;

describe("knockout results", () => {
  it("decides the winner from the score, then from the shoot-out, never from guesswork", () => {
    expect(fixtureWinner(fx(1, "R", "A", "B", 2, 1))).toBe("A");
    expect(fixtureWinner(fx(1, "R", "A", "B", 1, 2))).toBe("B");
    expect(fixtureWinner(fx(1, "R", "A", "B", 3, 3, { pens: [3, 4] }))).toBe("B");
    expect(fixtureWinner(fx(1, "R", "A", "B", 1, 1, { pens: [5, 4] }))).toBe("A");
    expect(fixtureWinner(fx(1, "R", "A", "B"))).toBeNull();
    // Extra time does not change who won: the score after it does.
    expect(fixtureWinner(fx(1, "R", "A", "B", 2, 1, { et: true }))).toBe("A");
  });

  it("keeps the penalty score apart from the match score in words", () => {
    const name = (id: string) => ({ W: "Wrexham", D: "Derby" })[id] ?? id;
    expect(resultNote(fx(1, "R", "W", "D", 3, 3, { pens: [3, 4] }), name)).toEqual({ text: "Derby win 4–3 on penalties", winner: "D" });
    expect(resultNote(fx(1, "R", "W", "D", 2, 1, { et: true }), name).text).toBe("Wrexham win after extra time");
    expect(resultNote(fx(1, "R", "W", "D", 2, 0), name).text).toBeNull();
    expect(resultNote(fx(1, "R", "W", "D"), name).winner).toBeNull();
  });

  it("names rounds by the ties in them", () => {
    expect([1, 2, 4, 8, 16, 32].map(stageForTies)).toEqual(["Final", "Semi-final", "Quarter-final", "Round of 16", "Round of 32", "Round of 64"]);
  });
});

describe("bracket from saved fixtures", () => {
  const qf = () => [fx(4, "Quarter-final", "A", "B", 1, 1, { pens: [4, 3] }), fx(4, "Quarter-final", "C", "D", 2, 0), fx(4, "Quarter-final", "E", "F", 2, 1, { et: true }), fx(4, "Quarter-final", "G", "H", 0, 0, { pens: [3, 5] })];

  it("connects each tie to the earlier ties its two teams won, using the real winners", () => {
    const sf = [fx(5, "Semi-final", "A", "C", 0, 1), fx(5, "Semi-final", "E", "H", 1, 2)];
    const f = [fx(6, "Final", "C", "H", 1, 1, { pens: [2, 4] })];
    const c = comp([...qf(), ...sf, ...f], { complete: true, winner: "H", runnerUp: "C" });
    const b = buildBracket(c)!;
    expect(b.rounds.map((r) => r.stage)).toEqual(["Quarter-final", "Semi-final", "Final"]);
    expect(b.rounds.map((r) => r.ties.length)).toEqual([4, 2, 1]);
    const [semi1, semi2] = b.rounds[1].ties;
    expect(semi1.from.map((t) => t?.winner).sort()).toEqual(["A", "C"]);
    expect(semi2.from.map((t) => t?.winner).sort()).toEqual(["E", "H"]);
    const final = b.rounds[2].ties[0];
    expect(final.from.map((t) => t?.winner).sort()).toEqual(["C", "H"]);
    expect(final.winner).toBe("H");
    expect(b.champion).toBe("H");
    expect(b.runnerUp).toBe("C");
    // Feeders sit next to the tie they feed: positions are strictly ordered inside each round.
    for (const r of b.rounds) for (let i = 1; i < r.ties.length; i++) expect(r.ties[i].y).toBeGreaterThan(r.ties[i - 1].y);
    expect(semi1.y).toBeCloseTo((semi1.from[0]!.y + semi1.from[1]!.y) / 2);
  });

  it("shows the road ahead for rounds not drawn yet, and no champion before the final", () => {
    const c = comp(qf());
    const b = buildBracket(c)!;
    expect(b.rounds.map((r) => [r.stage, !!r.pending])).toEqual([["Quarter-final", false], ["Semi-final", true], ["Final", true]]);
    expect(b.champion).toBeNull();
    const half = buildBracket(comp([...qf(), fx(5, "Semi-final", "A", "C"), fx(5, "Semi-final", "E", "H")]))!;
    expect(half.rounds.map((r) => !!r.pending)).toEqual([false, false, true]);
    expect(half.rounds[1].ties.every((t) => t.winner === null)).toBe(true);
  });

  it("keeps big early rounds as plain lists and brackets only the later ones", () => {
    const r1 = Array.from({ length: 12 }, (_, i) => fx(1, "Round 1", `a${i}`, `b${i}`, 1, 0));
    const r2 = Array.from({ length: 6 }, (_, i) => fx(2, "Round 2", `a${i * 2}`, `a${i * 2 + 1}`, 1, 0));
    const r3 = Array.from({ length: 3 }, (_, i) => fx(3, "Round of 16", `a${i * 4}`, `a${i * 4 + 2}`, 1, 0));
    const b = buildBracket(comp([...r1, ...r2, ...r3]))!;
    expect(b.earlier.map((e) => e.stage)).toEqual(["Round 1"]);
    expect(b.rounds[0].stage).toBe("Round 2");
    expect(b.rounds[0].ties.length).toBeLessThanOrEqual(BRACKET_MAX_TIES);
    expect(b.earlier[0].fixtures.length).toBe(12);
  });

  it("returns nothing for a competition with no knockout ties yet", () => {
    expect(buildBracket(comp([{ ...fx(1, "Group A", "A", "B", 1, 0), group: 0 }]))).toBeNull();
  });
});

describe("a club's journey", () => {
  const ko = () => [fx(1, "Round 1", "U", "X", 2, 0), fx(2, "Round 2", "Y", "U", 1, 1, { pens: [5, 4] })];
  it("says where a club went out", () => {
    const j = journeyOf(comp(ko(), { teams: ["U", "X", "Y"] }), "U");
    expect(j.status).toBe("eliminated");
    expect(j.stage).toBe("Round 2");
    expect(j.played.length).toBe(2);
  });
  it("says a club is still alive, with its next tie, and who won it all", () => {
    const f = [fx(1, "Round 1", "U", "X", 1, 0), fx(2, "Round 2", "U", "Y")];
    const j = journeyOf(comp(f, { teams: ["U", "X", "Y"] }), "U");
    expect(j.status).toBe("alive");
    expect(j.next?.stage).toBe("Round 2");
    expect(journeyOf(comp(f, { teams: ["U", "X", "Y"], winner: "U", complete: true }), "U").status).toBe("champion");
  });
  it("does not give a journey to a club that was never in the competition", () => {
    const j = journeyOf(comp(ko(), { teams: ["U", "X", "Y"] }), "Z");
    expect(j.entered).toBe(false);
    expect(j.status).toBe("not-entered");
  });
  it("recognises a club that went out in the group stage", () => {
    const f: Fixture[] = [{ ...fx(1, "Group A", "U", "X", 0, 3), group: 0 }, fx(7, "Quarter-final", "Y", "X", 1, 0)];
    expect(journeyOf(comp(f, { kind: "continental", teams: ["U", "X", "Y"], groups: [{ name: "Group A", teams: ["U", "X"], table: [] }] }), "U").status).toBe("group-exit");
  });
});

describe("real competitions after a simulated season", () => {
  let s: GameState;
  beforeAll(() => {
    s = newCareer({ seed: "bracket-real" });
    for (let i = 0; i < 46; i++) advanceTurn(s);
  });

  it("derives a complete cup bracket that ends in the saved winner", () => {
    const cup = Object.values(s.competitions).find((c) => c.kind === "cup")!;
    expect(cup.complete).toBe(true);
    const b = buildBracket(cup)!;
    expect(b.champion).toBe(cup.winner);
    expect(b.runnerUp).toBe(cup.runnerUp);
    const final = b.rounds.at(-1)!;
    expect(final.ties.length).toBe(1);
    expect(final.ties[0].fixture.stage).toBe("Final");
    expect(b.rounds.every((r) => !r.pending)).toBe(true);
  });

  it("only advances winners: every team in a round won its tie in the one before", () => {
    const cup = Object.values(s.competitions).find((c) => c.kind === "cup")!;
    const byRound = new Map<number, Fixture[]>();
    for (const f of cup.fixtures) (byRound.get(f.round) ?? byRound.set(f.round, []).get(f.round)!).push(f);
    const rounds = [...byRound.keys()].sort((a, b) => a - b);
    for (let i = 1; i < rounds.length; i++) {
      const winners = new Set(byRound.get(rounds[i - 1])!.map(fixtureWinner));
      const byes = new Set(cup.byes ?? []);
      for (const f of byRound.get(rounds[i])!) for (const t of [f.home, f.away]) expect(winners.has(t) || (rounds[i - 1] === 1 && byes.has(t))).toBe(true);
    }
    expect(cup.fixtures.every((f) => f.result && fixtureWinner(f))).toBe(true);
  });

  it("builds a bracket for the continental knockout after the groups", () => {
    const cc = Object.values(s.competitions).find((c) => c.kind === "continental");
    if (!cc) return;
    const b = buildBracket(cc)!;
    expect(b.rounds[0].stage).toBe("Quarter-final");
    expect(b.champion).toBe(cc.winner);
    const qfTeams = b.rounds[0].ties.flatMap((t) => [t.fixture.home, t.fixture.away]);
    for (const t of qfTeams) {
      const g = cc.groups!.find((gr) => gr.teams.includes(t))!;
      expect(g.table.findIndex((r) => r.team === t)).toBeLessThan(2); // only the top two advance
    }
  });

  it("is quick enough to derive on every render of the page", () => {
    const cup = Object.values(s.competitions).find((c) => c.kind === "cup")!;
    const t0 = performance.now();
    for (let i = 0; i < 50; i++) buildBracket(cup);
    expect((performance.now() - t0) / 50).toBeLessThan(10);
  });

  it("draws later rounds without breaking when progression runs again", () => {
    const cup = Object.values(s.competitions).find((c) => c.kind === "cup")!;
    const count = cup.fixtures.length;
    progressKnockouts(s, Rng.fromSeed("again"));
    expect(cup.fixtures.length).toBe(count);
  });
});

describe("different competition formats", () => {
  let s: GameState;
  beforeAll(() => {
    s = newCareer({ seed: "bracket-formats", countries: ["ENG", "ESP", "GER", "ITA", "FRA"] });
    // Two seasons: the continental cups in the first, a European tournament after the second.
    for (let i = 0; i < 99; i++) advanceTurn(s);
  }, 300_000);

  it("takes continental cups from the group tables into a bracket, top two only", () => {
    const first = s.archive.length ? s : null;
    expect(first).toBeTruthy();
    const cc = Object.values(s.competitions).find((c) => c.kind === "continental" && c.groups);
    expect(cc).toBeTruthy();
    const b = buildBracket(cc!);
    if (!b) return; // groups not finished yet this season
    expect(b.rounds[0].stage).toBe("Quarter-final");
    for (const tie of b.rounds[0].ties) for (const t of [tie.fixture.home, tie.fixture.away]) {
      const g = cc!.groups!.find((gr) => gr.teams.includes(t))!;
      expect(g.table.findIndex((r) => r.team === t)).toBeLessThan(2);
    }
  });

  it("uses the same bracket for an international tournament", () => {
    const t = Object.values(s.competitions).find((c) => c.kind === "international" && c.groups);
    if (!t) return;
    const b = buildBracket(t);
    if (!b) return;
    expect(b.rounds[0].stage).toBe("Quarter-final");
    for (const r of b.rounds.filter((x) => !x.pending)) for (const tie of r.ties) expect(tie.fixture.neutral).toBe(true);
    if (t.complete) {
      expect(b.champion).toBe(t.winner);
      expect(b.rounds.at(-1)!.ties[0].fixture.stage).toBe("Final");
    }
  });

  it("draws no bracket for leagues or the international friendly schedule", () => {
    const sched = Object.values(s.competitions).find((c) => c.kind === "international" && !c.groups)!;
    expect(sched.fixtures.length).toBeGreaterThan(0);
    expect(buildBracket(sched)).toBeNull();
    expect(buildBracket(Object.values(s.competitions).find((c) => c.kind === "league")!)).toBeNull();
  });

  it("describes a user's own run in a competition they are not in as no run at all", () => {
    const cup = Object.values(s.competitions).find((c) => c.kind === "cup" && c.countryCode === "ESP")!;
    const mine = s.players[s.user.playerId].clubId as string;
    expect(journeyOf(cup, mine).status).toBe("not-entered");
  });
});
