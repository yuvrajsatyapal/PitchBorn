import type { Rng } from "../rng";
import type { Fixture } from "../types";

/**
 * Double round-robin via the circle method. Returns rounds of [home, away]
 * pairs; second half mirrors the first with venues swapped.
 */
export function roundRobin(teams: string[], rng: Rng): [string, string][][] {
  const list = rng.shuffle([...teams]);
  if (list.length % 2) list.push("__bye__");
  const n = list.length;
  const rounds: [string, string][][] = [];
  const arr = [...list];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a === "__bye__" || b === "__bye__") continue;
      pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop() as string);
  }
  const second = rounds.map((pairs) => pairs.map(([h, a]) => [a, h] as [string, string]));
  return [...rounds, ...second];
}

export function makeLeagueFixtures(compId: string, teams: string[], turns: number[], rng: Rng, nextId: () => string): Fixture[] {
  const rounds = roundRobin(teams, rng);
  const fixtures: Fixture[] = [];
  rounds.forEach((pairs, i) => {
    for (const [home, away] of pairs) {
      fixtures.push({ id: nextId(), compId, round: i + 1, turn: turns[i] ?? turns[turns.length - 1], home, away });
    }
  });
  return fixtures;
}

/** Pair teams for a knockout round, higher seeds avoid each other when `seeded` provided. */
export function drawKnockout(teams: string[], rng: Rng): [string, string][] {
  const pool = rng.shuffle([...teams]);
  const pairs: [string, string][] = [];
  for (let i = 0; i + 1 < pool.length; i += 2) pairs.push([pool[i], pool[i + 1]]);
  return pairs;
}

export function groupDraw(teams: string[], groups: number, rng: Rng, strength: (t: string) => number): string[][] {
  // Pot-based draw: sort by strength, deal one team from each pot into each group.
  const sorted = [...teams].sort((a, b) => strength(b) - strength(a));
  const out: string[][] = Array.from({ length: groups }, () => []);
  for (let pot = 0; pot * groups < sorted.length; pot++) {
    const slice = rng.shuffle(sorted.slice(pot * groups, pot * groups + groups));
    slice.forEach((t, i) => out[i].push(t));
  }
  return out;
}
