import { BALANCE } from "../balance";
import { roundTurns } from "../calendar";
import { countriesInPlay, country, leaguesInPlay, staticLeague } from "../data/world";
import type { Rng } from "../rng";
import type { Competition, Fixture, GameState } from "../types";
import { nextId } from "../world/helpers";
import { drawKnockout, groupDraw, makeLeagueFixtures } from "./fixtures";
import { assignMatchDays } from "./matchdays";
import { buildTable, emptyRow, sortTable } from "./table";

const C = BALANCE.calendar;

export const CUP_NAMES: Record<string, string> = {
  ENG: "FA Cup",
  ESP: "Copa del Rey",
  GER: "DFB-Pokal",
  ITA: "Coppa Italia",
  FRA: "Coupe de France",
  POR: "Taça de Portugal",
  NED: "KNVB Cup",
  BRA: "Copa do Brasil",
  ARG: "Copa Argentina",
  USA: "U.S. Open Cup",
  MEX: "Copa MX",
};
export const CUP_STAGES = ["Round 1", "Round 2", "Round of 16", "Quarter-final", "Semi-final", "Final"];

/** Original Pitchborn-branded continental competitions. */
export const CHAMPIONS_CUP = { prefix: "ccup", name: "Champions Cup", short: "CC" };
export const CONTINENTAL_CUP = { prefix: "ecup", name: "Continental Cup", short: "ECC" };
/** Original Pitchborn cup for the top clubs of the CONMEBOL and CONCACAF leagues. */
export const AMERICAS_CUP = { prefix: "acup", name: "Americas Cup", short: "AMC" };

/**
 * Continental places per top league (Pitchborn's own allocation). European leagues feed the Champions Cup and the
 * Continental Cup; American leagues feed the Americas Cup. When a save simulates fewer countries, the empty places go
 * to the next-ranked clubs of the strongest leagues in play (see fillSlots).
 */
export const CONTINENTAL_SLOTS: Record<string, { champions: number; continental: number; americas?: number }> = {
  ENG: { champions: 4, continental: 2 },
  ESP: { champions: 3, continental: 2 },
  GER: { champions: 2, continental: 3 },
  ITA: { champions: 2, continental: 3 },
  FRA: { champions: 2, continental: 2 },
  POR: { champions: 2, continental: 2 },
  NED: { champions: 1, continental: 2 },
  BRA: { champions: 0, continental: 0, americas: 5 },
  ARG: { champions: 0, continental: 0, americas: 5 },
  MEX: { champions: 0, continental: 0, americas: 3 },
  USA: { champions: 0, continental: 0, americas: 3 },
};
const EUROPE_ORDER = ["ENG", "ESP", "GER", "ITA", "FRA", "POR", "NED"];
const AMERICAS_ORDER = ["BRA", "ARG", "MEX", "USA"];
export const isAmericas = (cc: string) => AMERICAS_ORDER.includes(cc) || country(cc)?.confederation === "CONMEBOL" || country(cc)?.confederation === "CONCACAF";

export const leagueCompId = (leagueId: string, season: number) => `${leagueId}-${season}`;
export const cupCompId = (countryCode: string, season: number) => `cup-${countryCode.toLowerCase()}-${season}`;

export function fixtureWinner(f: Fixture): string | null {
  if (!f.result) return null;
  const { hg, ag, pens } = f.result;
  if (hg > ag) return f.home;
  if (ag > hg) return f.away;
  if (pens) return pens[0] > pens[1] ? f.home : f.away;
  return null;
}

export function fixtureLoser(f: Fixture): string | null {
  const w = fixtureWinner(f);
  if (!w) return null;
  return w === f.home ? f.away : f.home;
}

function teamRep(state: GameState) {
  return (id: string) => state.clubs[id]?.reputation ?? state.nationalTeams[id]?.strength ?? 50;
}

export function setupSeason(state: GameState, rng: Rng): void {
  const season = state.season;
  const id = () => nextId(state, "f");
  // Leagues
  for (const league of leaguesInPlay(state)) {
    const teams = state.leagueClubs[league.id];
    const rounds = (teams.length - 1) * 2;
    const comp: Competition = {
      id: leagueCompId(league.id, season),
      kind: "league",
      name: league.name,
      shortName: league.shortName,
      season,
      countryCode: league.countryCode,
      tier: league.tier,
      teams: [...teams],
      fixtures: makeLeagueFixtures(leagueCompId(league.id, season), teams, roundTurns(rounds), rng, id),
      table: teams.map(emptyRow),
      prestige: league.tier === 1 ? 8 : league.tier === 2 ? 4 : 2,
      complete: false,
    };
    state.competitions[comp.id] = comp;
  }
  // Domestic cups
  for (const cc of countriesInPlay(state)) {
    const teams = leaguesInPlay(state).filter((l) => l.countryCode === cc).flatMap((l) => state.leagueClubs[l.id]);
    const sorted = [...teams].sort((a, b) => teamRep(state)(b) - teamRep(state)(a));
    const byes = Math.max(0, 64 - sorted.length);
    const byeTeams = sorted.slice(0, byes);
    const playing = sorted.slice(byes);
    const comp: Competition = {
      id: cupCompId(cc, season),
      kind: "cup",
      name: CUP_NAMES[cc] ?? `${country(cc)?.name} Cup`,
      shortName: "Cup",
      season,
      countryCode: cc,
      teams: sorted,
      fixtures: [],
      alive: [...sorted],
      prestige: 5,
      complete: false,
    };
    comp.fixtures = drawKnockout(playing, rng).map(([home, away]) => ({
      id: id(), compId: comp.id, round: 1, turn: C.cupTurns[0], home, away, stage: CUP_STAGES[0],
    }));
    // Byes recorded so next-round draw includes them.
    comp.byes = byeTeams;
    state.competitions[comp.id] = comp;
  }
  setupContinental(state, rng);
  assignMatchDays(state);
}

function previousTable(state: GameState, leagueId: string): string[] | null {
  const arch = state.archive.find((a) => a.season === state.season - 1);
  const t = arch?.tables[leagueCompId(leagueId, state.season - 1)];
  return t ? t.map((r) => r.team) : null;
}

export function continentalQualifiers(state: GameState): { champions: string[]; continental: string[]; americas: string[] } {
  const tops = leaguesInPlay(state).filter((l) => l.tier === 1);
  const ranked: Record<string, string[]> = {};
  for (const l of tops) {
    const prev = previousTable(state, l.id);
    ranked[l.countryCode] = (prev ?? [...state.leagueClubs[l.id]].sort((a, b) => state.clubs[b].reputation - state.clubs[a].reputation)).filter(
      (c) => state.clubs[c],
    );
  }
  const extra = (wantAmericas: boolean, list: string[]) => Object.keys(ranked).filter((cc) => !list.includes(cc) && isAmericas(cc) === wantAmericas);
  const europe = [...EUROPE_ORDER.filter((cc) => ranked[cc]), ...extra(false, EUROPE_ORDER)];
  const americas = [...AMERICAS_ORDER.filter((cc) => ranked[cc]), ...extra(true, AMERICAS_ORDER)];
  const taken = new Map<string, number>();
  const pick = (cc: string, n: number, out: string[]) => {
    const from = taken.get(cc) ?? 0;
    out.push(...ranked[cc].slice(from, from + n));
    taken.set(cc, from + n);
  };
  const fillSlots = (countries: string[], key: "champions" | "continental" | "americas") => {
    const out: string[] = [];
    for (const cc of countries) pick(cc, CONTINENTAL_SLOTS[cc]?.[key] ?? (key === "americas" ? 2 : 2), out);
    // Fewer countries in play: hand the spare places to the strongest leagues, one club at a time.
    for (let guard = 0; out.length < 16 && guard < 64 && countries.length; guard++) pick(countries[guard % countries.length], 1, out);
    return out.filter(Boolean).slice(0, 16);
  };
  const champions = fillSlots(europe, "champions");
  const continental = fillSlots(europe, "continental");
  const americasTeams = americas.length >= 2 ? fillSlots(americas, "americas") : [];
  return { champions, continental, americas: americasTeams };
}

function setupContinental(state: GameState, rng: Rng) {
  const { champions, continental, americas } = continentalQualifiers(state);
  for (const [def, teams, prestige] of [
    [CHAMPIONS_CUP, champions, 10],
    [CONTINENTAL_CUP, continental, 6],
    [AMERICAS_CUP, americas, 8],
  ] as const) {
    if (teams.length < 16) continue;
    const compId = `${def.prefix}-${state.season}`;
    const groups = groupDraw([...teams], 4, rng, teamRep(state));
    const fixtures: Fixture[] = [];
    groups.forEach((g, gi) => {
      // Double round robin among 4 teams across 6 matchdays.
      const pairs: [number, number][][] = [
        [[0, 1], [2, 3]],
        [[3, 0], [1, 2]],
        [[0, 2], [3, 1]],
        [[1, 0], [3, 2]],
        [[0, 3], [2, 1]],
        [[2, 0], [1, 3]],
      ];
      pairs.forEach((md, mi) => {
        for (const [a, b] of md) {
          fixtures.push({
            id: nextId(state, "f"), compId, round: mi + 1, turn: C.continentalGroupTurns[mi], home: g[a], away: g[b], stage: `Group ${"ABCD"[gi]}`, group: gi,
          });
        }
      });
    });
    state.competitions[compId] = {
      id: compId,
      kind: "continental",
      name: def.name,
      shortName: def.short,
      season: state.season,
      teams: [...teams],
      fixtures,
      groups: groups.map((g, gi) => ({ name: `Group ${"ABCD"[gi]}`, teams: g, table: g.map(emptyRow) })),
      alive: [...teams],
      prestige,
      complete: false,
    };
  }
}

/** Create follow-up knockout rounds once a round has finished. */
export function progressKnockouts(state: GameState, rng: Rng): void {
  for (const comp of Object.values(state.competitions)) {
    if (comp.complete || comp.season !== state.season) continue;
    if (comp.kind === "cup") progressCup(state, comp, rng);
    else if (comp.kind === "continental") progressContinental(state, comp, rng);
  }
  assignMatchDays(state);
}

function progressCup(state: GameState, comp: Competition, rng: Rng) {
  const lastRound = Math.max(...comp.fixtures.map((f) => f.round));
  const current = comp.fixtures.filter((f) => f.round === lastRound);
  if (!current.length || current.some((f) => !f.result)) return;
  const winners = current.map(fixtureWinner).filter((w): w is string => Boolean(w));
  const byes = comp.byes ?? [];
  const alive = lastRound === 1 ? [...winners, ...byes] : winners;
  comp.alive = alive;
  if (alive.length === 1) {
    comp.winner = alive[0];
    comp.runnerUp = fixtureLoser(current[0]) ?? undefined;
    comp.complete = true;
    return;
  }
  const nextRound = lastRound + 1;
  const turn = C.cupTurns[nextRound - 1] ?? C.cupTurns[C.cupTurns.length - 1];
  const final = alive.length === 2;
  comp.fixtures.push(
    ...drawKnockout(alive, rng).map(([home, away]) => ({
      id: nextId(state, "f"), compId: comp.id, round: nextRound, turn, home, away, stage: final ? "Final" : CUP_STAGES[nextRound - 1] ?? `Round ${nextRound}`, neutral: final,
    })),
  );
}

function progressContinental(state: GameState, comp: Competition, rng: Rng) {
  const KO = C.continentalKnockoutTurns;
  const groupFixtures = comp.fixtures.filter((f) => f.group !== undefined);
  if (groupFixtures.some((f) => !f.result)) return;
  const ko = comp.fixtures.filter((f) => f.group === undefined);
  if (!ko.length) {
    const groups = comp.groups ?? [];
    for (const g of groups) g.table = buildTable(g.teams, groupFixtures.filter((f) => g.teams.includes(f.home)));
    const w = groups.map((g) => g.table[0].team);
    const r = groups.map((g) => g.table[1].team);
    comp.alive = [...w, ...r];
    const pairs: [string, string][] = [
      [w[0], r[1]],
      [w[1], r[0]],
      [w[2], r[3]],
      [w[3], r[2]],
    ];
    comp.fixtures.push(...pairs.map(([home, away]) => ({ id: nextId(state, "f"), compId: comp.id, round: 7, turn: KO.QF, home, away, stage: "Quarter-final" })));
    return;
  }
  const lastRound = Math.max(...ko.map((f) => f.round));
  const current = ko.filter((f) => f.round === lastRound);
  if (current.some((f) => !f.result)) return;
  const winners = current.map(fixtureWinner).filter((x): x is string => Boolean(x));
  comp.alive = winners;
  if (winners.length === 1) {
    comp.winner = winners[0];
    comp.runnerUp = fixtureLoser(current[0]) ?? undefined;
    comp.complete = true;
    return;
  }
  const final = winners.length === 2;
  comp.fixtures.push(
    ...drawKnockout(winners, rng).map(([home, away]) => ({
      id: nextId(state, "f"), compId: comp.id, round: lastRound + 1, turn: final ? KO.F : KO.SF, home, away, stage: final ? "Final" : "Semi-final", neutral: final,
    })),
  );
}

export function refreshLeagueTables(state: GameState): void {
  for (const comp of Object.values(state.competitions)) {
    if (comp.kind === "league" && comp.season === state.season) comp.table = buildTable(comp.teams, comp.fixtures);
    if (comp.kind === "continental" && comp.groups && comp.season === state.season) {
      for (const g of comp.groups) g.table = buildTable(g.teams, comp.fixtures.filter((f) => f.group !== undefined && g.teams.includes(f.home)));
    }
  }
}

export function leagueOf(state: GameState, clubId: string): Competition | undefined {
  const lid = state.clubs[clubId]?.leagueId;
  return lid ? state.competitions[leagueCompId(lid, state.season)] : undefined;
}

export { sortTable, staticLeague };
