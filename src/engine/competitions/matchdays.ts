import type { Fixture, GameState } from "../types";

const LAST_DAY = 6;
/** Where a match sits in its week: league games and the first international go first, everything else midweek-to-weekend. */
const FIRST = [0, 3, 1, 4, 2, 5, 6];
const SECOND = [3, 0, 4, 1, 5, 2, 6];
const KIND_ORDER: Record<string, number> = { league: 0, cup: 1, continental: 2, international: 3, friendly: 3 };

/**
 * Gives every unscheduled fixture a day within its week so that no team plays twice on one day. League rounds that
 * share a week (midweek doubles) keep their round order; cups, continental ties and international legs take the
 * nearest free day. Fixtures that already have a day are never moved, so it is safe to call whenever new ones appear.
 */
export function assignMatchDays(state: GameState): void {
  const taken = new Map<number, Map<string, Set<number>>>();
  const take = (turn: number, team: string, day: number) => {
    let teams = taken.get(turn);
    if (!teams) taken.set(turn, (teams = new Map()));
    let days = teams.get(team);
    if (!days) teams.set(team, (days = new Set()));
    days.add(day);
  };
  const isFree = (turn: number, team: string, day: number) => !taken.get(turn)?.get(team)?.has(day);

  const todo: { f: Fixture; kind: string }[] = [];
  const leagueRounds = new Map<string, Set<number>>();
  for (const comp of Object.values(state.competitions)) {
    if (comp.season !== state.season) continue;
    for (const f of comp.fixtures) {
      if (f.day !== undefined || f.result) {
        const day = f.day ?? 0;
        take(f.turn, f.home, day);
        take(f.turn, f.away, day);
      } else {
        todo.push({ f, kind: comp.kind });
      }
      if (comp.kind === "league") {
        const key = `${comp.id}:${f.turn}`;
        let rounds = leagueRounds.get(key);
        if (!rounds) leagueRounds.set(key, (rounds = new Set()));
        rounds.add(f.round);
      }
    }
  }

  todo.sort((a, b) => a.f.turn - b.f.turn || (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9) || a.f.round - b.f.round);
  for (const { f, kind } of todo) {
    let order = FIRST;
    if (kind === "league") {
      const rounds = [...(leagueRounds.get(`${f.compId}:${f.turn}`) ?? [])].sort((x, y) => x - y);
      if (rounds.indexOf(f.round) > 0) order = SECOND;
    } else if (kind === "international" || kind === "friendly") {
      // Window friendlies encode their leg in the round (turn * 10 + leg).
      if (f.round >= 10 && f.round % 10 === 1) order = SECOND;
    } else {
      order = SECOND;
    }
    const day = order.find((d) => isFree(f.turn, f.home, d) && isFree(f.turn, f.away, d)) ?? LAST_DAY;
    f.day = day;
    take(f.turn, f.home, day);
    take(f.turn, f.away, day);
  }
}
