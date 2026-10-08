/**
 * Knockout brackets, built only from the fixtures and results the competition actually has.
 *
 * Every round of a knockout is drawn from the winners of the one before, so a tie's two teams each came from exactly one
 * earlier tie (or entered directly: a bye, a group qualifier). That is what the connecting lines show. Nothing is
 * guessed: a tie with no result has no winner, and a team that entered without a feeder has none drawn.
 */
import type { Competition, Fixture } from "../types";
import { fixtureWinner } from "./setup";

export interface Tie {
  fixture: Fixture;
  winner: string | null;
  /** The earlier ties whose winners met here (by home, away), where there were any. */
  from: [Tie | null, Tie | null];
  /** Row position within its column, in half-slots, so a tie sits between the two that feed it. */
  y: number;
}

export interface BracketRound {
  round: number;
  stage: string;
  ties: Tie[];
  /** Rounds not drawn yet, shown as empty places so the road to the final is visible. */
  pending?: boolean;
}

export interface Bracket {
  rounds: BracketRound[];
  champion: string | null;
  runnerUp: string | null;
  /** Rounds before the bracket, which stay as plain lists. */
  earlier: { round: number; stage: string; fixtures: Fixture[] }[];
  /** Tie count of the first round the bracket shows. */
  width: number;
}

/** How many ties a round of this size is called. */
export function stageForTies(n: number): string {
  return n <= 1 ? "Final" : n === 2 ? "Semi-final" : n === 4 ? "Quarter-final" : n === 8 ? "Round of 16" : n === 16 ? "Round of 32" : `Round of ${n * 2}`;
}

/** Ties of a knockout in play order (everything that is not a group match). */
export function knockoutFixtures(comp: Competition): Fixture[] {
  return comp.fixtures.filter((f) => f.group === undefined);
}

/** Largest first round that still reads well as a bracket. Earlier rounds stay as collapsible lists. */
export const BRACKET_MAX_TIES = 8;

/** Whether a competition has knockout rounds worth drawing (leagues and the international friendly schedule do not). */
export function hasKnockout(comp: Competition): boolean {
  return comp.kind === "cup" || comp.kind === "continental" || (comp.kind === "international" && !!comp.groups);
}

export function buildBracket(comp: Competition): Bracket | null {
  if (!hasKnockout(comp)) return null;
  const ko = knockoutFixtures(comp);
  if (!ko.length) return null;
  const byRound = new Map<number, Fixture[]>();
  for (const f of ko) (byRound.get(f.round) ?? byRound.set(f.round, []).get(f.round)!).push(f);
  const roundNums = [...byRound.keys()].sort((a, b) => a - b);

  // The bracket starts at the first round with few enough ties; every round after it is part of the bracket.
  const startIdx = Math.max(0, roundNums.findIndex((r) => (byRound.get(r) ?? []).length <= BRACKET_MAX_TIES));
  const inBracket = roundNums.slice(startIdx);
  const earlier = roundNums.slice(0, startIdx).map((r) => ({ round: r, stage: byRound.get(r)![0].stage ?? `Round ${r}`, fixtures: byRound.get(r)! }));

  // Build ties, wiring each to the earlier tie its team won.
  const tiesByRound: Tie[][] = inBracket.map((r) => (byRound.get(r) ?? []).map((fixture) => ({ fixture, winner: fixtureWinner(fixture), from: [null, null] as [Tie | null, Tie | null], y: 0 })));
  for (let i = 1; i < tiesByRound.length; i++) {
    for (const tie of tiesByRound[i]) {
      const feeder = (team: string) => tiesByRound[i - 1].find((t) => t.winner === team) ?? null;
      tie.from = [feeder(tie.fixture.home), feeder(tie.fixture.away)];
    }
  }

  // Order each column so feeders sit next to the tie they feed, working back from the last round.
  const last = tiesByRound.length - 1;
  const ordered: Tie[][] = tiesByRound.map(() => []);
  ordered[last] = [...tiesByRound[last]];
  for (let i = last; i > 0; i--) {
    const seen = new Set<Tie>();
    for (const tie of ordered[i]) for (const f of tie.from) if (f && !seen.has(f)) {
      seen.add(f);
      ordered[i - 1].push(f);
    }
    // Ties that fed nothing in the next round (an eliminated-before-drawn edge case) go at the end, in fixture order.
    for (const t of tiesByRound[i - 1]) if (!seen.has(t)) ordered[i - 1].push(t);
  }
  // Vertical placement: the first column is evenly spaced; later ties sit at the mean of their feeders.
  ordered[0].forEach((t, k) => (t.y = k * 2 + 1));
  for (let i = 1; i < ordered.length; i++) {
    ordered[i].forEach((t, k) => {
      const ys = t.from.filter((f): f is Tie => !!f).map((f) => f.y);
      t.y = ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : (k * 2 + 1) * 2 ** i;
    });
  }

  const rounds: BracketRound[] = ordered.map((ties, i) => ({ round: inBracket[i], stage: ties[0]?.fixture.stage ?? stageForTies(ties.length), ties }));
  // Show the road ahead: empty rounds, halving each time, down to the final.
  if (!comp.complete) {
    let n = ordered[last].length;
    while (n > 1) {
      n = Math.ceil(n / 2);
      rounds.push({ round: (rounds[rounds.length - 1]?.round ?? 0) + 1, stage: stageForTies(n), ties: [], pending: true });
    }
  }
  const final = rounds.filter((r) => !r.pending).pop();
  const finalTie = final && final.ties.length === 1 ? final.ties[0] : null;
  return {
    rounds,
    champion: comp.winner ?? (finalTie?.winner ?? null),
    runnerUp: comp.runnerUp ?? (finalTie?.winner ? (finalTie.winner === finalTie.fixture.home ? finalTie.fixture.away : finalTie.fixture.home) : null),
    earlier,
    width: ordered[0].length,
  };
}

export interface ResultNote {
  /** "Wrexham 3–3 Derby County" style score is the caller's; this is the sentence under it. */
  text: string | null;
  winner: string | null;
}

/** How a tie was settled, in words: extra time, or the shoot-out and who won it. Null for an ordinary result. */
export function resultNote(f: Fixture, nameOf: (id: string) => string): ResultNote {
  const winner = fixtureWinner(f);
  const r = f.result;
  if (!r || !winner) return { text: null, winner };
  if (r.pens) {
    const [h, a] = r.pens;
    const hi = Math.max(h, a);
    const lo = Math.min(h, a);
    return { text: `${nameOf(winner)} win ${hi}–${lo} on penalties`, winner };
  }
  if (r.et) return { text: `${nameOf(winner)} win after extra time`, winner };
  return { text: null, winner };
}

/** A club's journey through one competition, from the fixtures it played. */
export interface Journey {
  entered: boolean;
  status: "alive" | "eliminated" | "champion" | "not-entered" | "group-exit";
  /** Stage of the last tie played (or the one that ended the run). */
  stage: string | null;
  played: Fixture[];
  /** The last tie, if it is still to be played. */
  next: Fixture | null;
}

export function journeyOf(comp: Competition, team: string): Journey {
  const mine = comp.fixtures.filter((f) => f.home === team || f.away === team).sort((a, b) => a.turn - b.turn || a.round - b.round);
  if (!mine.length) {
    const direct = comp.byes?.includes(team) || comp.alive?.includes(team);
    return direct ? { entered: true, status: "alive", stage: null, played: [], next: null } : { entered: false, status: "not-entered", stage: null, played: [], next: null };
  }
  const played = mine.filter((f) => f.result);
  const next = mine.find((f) => !f.result) ?? null;
  if (comp.winner === team) return { entered: true, status: "champion", stage: "Final", played, next };
  const lastKo = [...played].reverse().find((f) => f.group === undefined);
  if (lastKo && fixtureWinner(lastKo) !== team) return { entered: true, status: "eliminated", stage: lastKo.stage ?? null, played, next: null };
  if (comp.groups && comp.groups.some((g) => g.teams.includes(team)) && !next && !lastKo && comp.fixtures.some((f) => f.group === undefined)) {
    return { entered: true, status: "group-exit", stage: "Group stage", played, next: null };
  }
  return { entered: true, status: "alive", stage: next?.stage ?? lastKo?.stage ?? null, played, next };
}
