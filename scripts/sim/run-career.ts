/** Simulates one complete career with the autopilot policy and returns metrics. */
import { BALANCE } from "../../src/engine/balance";
import { autopilotStep, autopilotWantsRetirement } from "../../src/engine/career/autopilot";
import { WORLD } from "../../src/engine/data/world";
import { overallFor } from "../../src/engine/players/attributes";
import { ageOf } from "../../src/engine/players/generate";
import { Rng } from "../../src/engine/rng";
import { advanceTurn, retireUser } from "../../src/engine/season/advance";
import { POSITIONS, type GameState, type Position } from "../../src/engine/types";
import { checkInvariants } from "../../src/engine/validate";
import { createWorld } from "../../src/engine/world/create";

export interface CareerMetrics {
  seed: string;
  country: string;
  position: Position;
  path: string;
  startClub: string;
  startTier: number;
  seasons: number;
  retireAge: number;
  apps: number;
  goals: number;
  assists: number;
  maxSeasonGoals: number;
  peakOverall: number;
  peakAge: number;
  potential: number;
  clubs: number;
  transfers: number;
  trophies: number;
  majorAwards: number;
  goldenPitch: number;
  caps: number;
  intlGoals: number;
  injuries: number;
  seriousInjuries: number;
  legacy: number;
  tier: string;
  stories: string[];
  earnings: number;
  invariantIssues: number;
  world: {
    goalsPerMatch: number;
    maxGoalsInMatch: number;
    maxTopScorer: number;
    minClubBalance: number;
    maxClubBalance: number;
    players: number;
    homeWinPct: number;
    drawPct: number;
  };
  ms: number;
}

export function runCareer(seed: string, opts: { lite: boolean; maxSeasons?: number }): CareerMetrics {
  const t0 = Date.now();
  const rng = Rng.fromSeed(`career:${seed}`);
  const country = rng.pick(["ENG", "ESP", "GER", "ITA", "FRA"]);
  const position = rng.pick(POSITIONS.filter((p) => p !== "GK" || rng.chance(0.4)));
  const path = rng.chance(0.65) ? "academy" : "late";
  const tierPick = rng.weighted([1, 2, 3], (t) => [0.35, 0.35, 0.3][t - 1]);
  const clubs = WORLD.clubs.filter((c) => c.countryCode === country && c.leagueId.endsWith(`-${tierPick}`));
  const club = rng.pick(clubs);
  const state: GameState = createWorld({
    saveName: "sim", firstName: "Sim", lastName: seed, nationality: country, birthCountry: country, position, foot: "R", height: 180,
    look: { skin: 0, hair: 0, hairColor: 0, facial: 0, eyes: 0 }, clubId: club.id, path: path as "academy" | "late", seed, countries: opts.lite ? [country] : undefined,
  });
  const u = state.players[state.user.playerId];
  const potential = u.hidden.potential;
  let invariantIssues = 0;
  let matches = 0;
  let goals = 0;
  let homeWins = 0;
  let draws = 0;
  let maxGoalsInMatch = 0;
  let maxTopScorer = 0;
  let minBal = Infinity;
  let maxBal = -Infinity;
  const maxSeasons = opts.maxSeasons ?? 26;
  while (!state.user.retired && state.season < state.user.startSeason + maxSeasons) {
    autopilotStep(state, rng);
    if (state.turn === BALANCE.calendar.endOfSeasonTurn + 1 && autopilotWantsRetirement(state)) {
      retireUser(state, "Autopilot retirement");
      break;
    }
    if (state.turn === BALANCE.calendar.endOfSeasonTurn) {
      for (const comp of Object.values(state.competitions)) {
        if (comp.kind !== "league") continue;
        for (const f of comp.fixtures) {
          if (!f.result) continue;
          matches++;
          const g = f.result.hg + f.result.ag;
          goals += g;
          if (f.result.hg > f.result.ag) homeWins++;
          else if (f.result.hg === f.result.ag) draws++;
          maxGoalsInMatch = Math.max(maxGoalsInMatch, g);
        }
      }
      for (const c of Object.values(state.clubs)) {
        minBal = Math.min(minBal, c.balance);
        maxBal = Math.max(maxBal, c.balance);
      }
      invariantIssues += checkInvariants(state).issues.length;
    }
    advanceTurn(state);
    if (state.turn === 1) {
      const arch = state.archive[state.archive.length - 1];
      if (arch) for (const ts of Object.values(arch.topScorers)) maxTopScorer = Math.max(maxTopScorer, ts.goals);
    }
  }
  if (!state.user.retired) retireUser(state, "Simulation horizon reached");
  const p = state.players[state.user.playerId];
  const legacy = state.user.legacy;
  const clubsPlayed = new Set(p.history.filter((h) => h.clubId && h.stats.apps > 0).map((h) => h.clubId));
  return {
    seed,
    country,
    position,
    path,
    startClub: club.id,
    startTier: tierPick,
    seasons: p.history.length,
    retireAge: ageOf(p, state.season),
    apps: p.career.apps,
    goals: p.career.goals,
    assists: p.career.assists,
    maxSeasonGoals: Math.max(0, ...p.history.map((h) => h.stats.goals)),
    peakOverall: state.user.peakOverall,
    peakAge: ageOf(p, state.user.peakSeason),
    potential,
    clubs: clubsPlayed.size,
    transfers: state.user.transfers.length,
    trophies: state.user.trophies.length,
    majorAwards: state.user.awards.filter((a) => ["pots", "topscorer", "golden-pitch", "rising-star", "world-glove", "goldenglove"].includes(a.id)).length,
    goldenPitch: state.user.awards.filter((a) => a.id === "golden-pitch").length,
    caps: p.intl.caps,
    intlGoals: p.intl.goals,
    injuries: state.user.injuryHistory.length,
    seriousInjuries: state.user.injuryHistory.filter((i) => i.weeks >= 8).length,
    legacy: Math.round(legacy?.score ?? 0),
    tier: legacy?.tier ?? "",
    stories: legacy?.stories ?? [],
    earnings: state.user.earnings,
    invariantIssues,
    world: {
      goalsPerMatch: matches ? goals / matches : 0,
      maxGoalsInMatch,
      maxTopScorer,
      minClubBalance: minBal,
      maxClubBalance: maxBal,
      players: Object.keys(state.players).length,
      homeWinPct: matches ? homeWins / matches : 0,
      drawPct: matches ? draws / matches : 0,
    },
    ms: Date.now() - t0,
  };
  void overallFor;
}
