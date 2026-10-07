/**
 * Turn orchestration: the weekly game loop and season transitions.
 *
 *   beginTurn  → work out which matches the user must play this week
 *   (UI plays/sims those via playUserMatch/simUserMatch)
 *   advanceTurn → simulate the rest of the world, training, development,
 *                 transfers, events, awards; season end at turn 44,
 *                 world awards + rollover after turn 50
 */
import { BALANCE } from "../balance";
import { isInternationalTurn, isMonthEnd, isTransferWindow, seasonLabel, tournamentFor, upcomingWindow, windowName } from "../calendar";
import { AWARD_RECORD_PREFIX } from "../awards/records";
import { prepareSeasonAwards, settleCeremony } from "../awards/ceremony";
import { awardTrophy, playerOfTheMonth, teamOfTheWeek, totalSeason, worldAwards } from "./awards";
import { maybeCareerEvent, expireDecisions } from "../career/events";
import { computeLegacy } from "../career/legacy";
import { checkUserContract, expireOffers, generateUserOffers, processBids, rolloverUserContract } from "../career/offers";
import { divertToSaga, stepSagas } from "../career/saga/engine";
import { noteRecord, weeklyRivalry } from "../career/rivalry/engine";
import { RUMOUR_MIN_REPUTATION } from "../career/saga/eligibility";
import { leagueCompId, progressKnockouts, refreshLeagueTables, setupSeason } from "../competitions/setup";
import { clubName, leaguesInPlay, stadium, staticClub, staticLeague } from "../data/world";
import type { MatchResult } from "../match/engine";
import { bestFormation } from "../match/lineup";
import { internationalRetirements, progressTournament, scheduleInternationalWindow, selectNationalSquads, setupTournament } from "../national/national";
import { overallFor } from "../players/attributes";
import { developPlayer, runTraining, trainingGrowthMultiplier, weeklyCondition } from "../players/development";
import { clubRevenue, marketValue } from "../players/economy";
import { ageOf, emptyStat } from "../players/generate";
import { clubLevel } from "../world/create";
import { recoverWeek } from "../players/injuries";
import { clamp, Rng } from "../rng";
import { ensureMinimumSquads, processExpiringContracts, processRetirements, refreshVirtualPools, runAiTransfers, youthIntake } from "../transfers/market";
import type { ClubState, Competition, GameState, SeasonArchive, SeasonRecord } from "../types";
import { agentSkill, payAgent } from "../career/agents";
import { refreshRecall } from "../memory/recall";
import { weeklyPersonality, mentorsOf } from "../traits/career";
import { reviewAllTraits, trainingTick, fadeProgress } from "../traits/develop";
import { careerProfile } from "../traits/effects";
import { rememberManagerConflict, rememberPromotionOrRelegation, rememberRecord, rememberRetirement } from "../memory/detect";
import { receiveIncome } from "../career/money";
import { assignRoles } from "../world/create";
import { hireManager, releaseManager } from "../world/managers";
import { addNews, addTimeline, fullName, squadOf, userPlayer, withRng } from "../world/helpers";
import { applyMatchResult, fixturesForTurn, involvesUserTeam, prepareMatch, type TurnRatings } from "./matchday";

const C = BALANCE.calendar;

export function beginTurn(state: GameState): void {
  if (state.user.retired) {
    state.pending = [];
    return;
  }
  withRng(state, (rng) => {
    if (isInternationalTurn(state.turn) && !Object.values(state.competitions).some((c) => c.kind === "international" && c.season === state.season && c.fixtures.some((f) => f.turn === state.turn))) {
      selectNationalSquads(state);
      scheduleInternationalWindow(state, rng);
    }
  });
  state.pending = fixturesForTurn(state)
    .filter((f) => involvesUserTeam(state, f))
    .map((f) => ({ fixtureId: f.id, compId: f.compId }));
}

export function findFixture(state: GameState, fixtureId: string) {
  for (const comp of Object.values(state.competitions)) {
    const f = comp.fixtures.find((x) => x.id === fixtureId);
    if (f) return { comp, fixture: f };
  }
  return null;
}

/** Apply a user match that was played interactively in the UI. */
export function completeUserMatch(state: GameState, fixtureId: string, result: MatchResult): void {
  const found = findFixture(state, fixtureId);
  if (!found || found.fixture.result) return;
  withRng(state, (rng) => applyMatchResult(state, found.fixture, result, rng));
  state.pending = state.pending.filter((p) => p.fixtureId !== fixtureId);
}

/** Quick-sim a pending user match (decisions auto-resolved by the engine). */
export function simUserMatch(state: GameState, fixtureId: string): MatchResult | null {
  const found = findFixture(state, fixtureId);
  if (!found || found.fixture.result) return null;
  const res = withRng(state, (rng) => {
    const prepared = prepareMatch(state, found.fixture, rng.fork(fixtureId), { interactive: false, detail: true });
    return prepared.engine.runToEnd();
  });
  completeUserMatch(state, fixtureId, res);
  return res;
}

/** Can the player ask to be rested this week? (club match pending, not injured, not already resting) */
export function canRequestRest(state: GameState): boolean {
  const p = userPlayer(state);
  if (!p.clubId || p.injury || state.user.retired || state.user.restTurnIndex === state.turnIndex) return false;
  return state.pending.some((pm) => state.competitions[pm.compId]?.kind !== "international" && state.competitions[pm.compId]?.kind !== "friendly");
}

/**
 * Ask the manager to rest you for this week's club matches: extra recovery,
 * but the manager is less impressed the fresher you already are.
 */
export function requestRest(state: GameState): string {
  if (!canRequestRest(state)) return "You can't ask to be rested right now.";
  const p = userPlayer(state);
  state.user.restTurnIndex = state.turnIndex;
  const fresh = p.fitness >= 85;
  state.user.relationships.manager = clamp(state.user.relationships.manager - (fresh ? 5 : 1.5), 0, 100);
  addNews(state, {
    kind: "club",
    title: "Rested this week",
    body: fresh ? "The manager agreed, but wasn't impressed — you looked fresh enough to play." : "The manager agreed you need a breather.",
  });
  return fresh ? "Rested — the manager wasn't thrilled." : "The manager agrees: you'll sit this week out and recover.";
}

/** Seed for a live match so the UI can create the engine deterministically. */
export function liveMatchRng(state: GameState, fixtureId: string): Rng {
  return withRng(state, (rng) => rng.fork(`live:${fixtureId}`));
}

function simulateWorldFixtures(state: GameState, rng: Rng, ratings: TurnRatings): void {
  const fixtures = fixturesForTurn(state);
  for (const f of fixtures) {
    if (f.result) continue;
    const prepared = prepareMatch(state, f, rng, { interactive: false, detail: false });
    const res = prepared.engine.runToEnd();
    applyMatchResult(state, f, res, rng, ratings);
  }
}

function awardCompletedTrophies(state: GameState): void {
  for (const comp of Object.values(state.competitions)) {
    if (comp.complete && comp.winner && !comp.trophyAwarded && comp.season === state.season) {
      comp.trophyAwarded = true;
      awardTrophy(state, comp);
    }
  }
}

function weeklyFinances(state: GameState): void {
  for (const club of Object.values(state.clubs)) {
    const st = staticClub(club.id);
    const tier = staticLeague(club.leagueId)?.tier ?? 3;
    const cap = stadium(st?.stadiumId ?? "")?.capacity ?? 10000;
    let wages = 0;
    for (const id of club.squad) wages += state.players[id]?.contract?.wage ?? 0;
    const revenue = clubRevenue(club.reputation, tier, cap);
    // Operating costs (staff, travel, facilities) take a share of revenue.
    club.balance = Math.round(club.balance + (revenue * 0.72) / C.turnsPerSeason - wages * 1.04);
    // Deep debt triggers restructuring (owner bail-out with a reputational cost).
    if (club.balance < -revenue * 0.6 && state.turn === C.endOfSeasonTurn) {
      club.balance = Math.round(-revenue * 0.25);
      club.reputation = clamp(club.reputation - 2, 8, 99);
      for (const id of club.squad) {
        const p = state.players[id];
        if (p && !p.isUser && p.contract && p.contract.wage > revenue / 60) p.listed = true;
      }
    }
    // Clubs sitting on huge reserves reinvest in facilities rather than hoarding.
    if (club.balance > revenue * 2 && state.turn % 4 === 0) {
      club.balance = Math.round(club.balance * 0.94);
      club.facilities = Math.min(99, club.facilities + 1);
      club.youth = Math.min(99, club.youth + 0.5);
    }
  }
}

/**
 * Young players left out of the matchday squad turn out for the development
 * side: a light abstraction that keeps them sharp and growing.
 */
function reserveMatch(state: GameState, rng: Rng, trainingMul: number): void {
  const p = userPlayer(state);
  const u = state.user;
  if (!p.clubId || p.injury || ageOf(p, state.season) > 21) return;
  if (state.turn < C.seasonStart || state.turn > C.seasonEnd || u.lastMatchTurn === state.turn) return;
  const clubPlayed = Object.values(state.competitions).some((c) => c.kind === "league" && c.season === state.season && c.fixtures.some((f) => f.turn === state.turn && (f.home === p.clubId || f.away === p.clubId)));
  if (!clubPlayed) return;
  const level = clubLevel(state.clubs[p.clubId].reputation) - 12; // U21 opposition
  const ovr = overallFor(p.attrs, p.position);
  const rating = Math.round(clamp(rng.normal(6.5 + (ovr - level) / 12, 0.7), 4.5, 9.8) * 10) / 10;
  const att = ["ST", "RW", "LW", "AM"].includes(p.position);
  const goals = rng.chance(att ? 0.32 + (ovr - level) / 80 : p.position === "GK" ? 0 : 0.08) ? (rng.chance(0.2) ? 2 : 1) : 0;
  const assists = rng.chance(att || p.position === "CM" ? 0.2 : 0.06) ? 1 : 0;
  if (!u.reserves || u.reserves.season !== state.season) u.reserves = { season: state.season, apps: 0, goals: 0, assists: 0, ratingSum: 0 };
  u.reserves.apps++;
  u.reserves.goals += goals;
  u.reserves.assists += assists;
  u.reserves.ratingSum = Math.round((u.reserves.ratingSum + rating) * 10) / 10;
  p.sharpness = clamp(p.sharpness + 12, 0, 100);
  p.morale = clamp(p.morale + (rating - 6.6), 0, 100);
  u.relationships.manager = clamp(u.relationships.manager + (rating - 6.8) * 0.8, 0, 100);
  // Counts as meaningful minutes for development (feeds monthly growth).
  u.trainingHistory[u.trainingHistory.length - 1] = trainingMul + 0.25;
  if (goals || rating >= 7.8) addNews(state, { kind: "match", title: `Development squad: ${goals ? `${goals} goal${goals > 1 ? "s" : ""} for you` : "standout display"}`, body: `Rating ${rating.toFixed(1)} · the manager was watching.` });
}

function userWeekly(state: GameState, rng: Rng): void {
  const p = userPlayer(state);
  const u = state.user;
  // Active boosts from optional rewards/events.
  u.boosts = u.boosts.filter((b) => b.untilTurnIndex >= state.turnIndex);
  const trainingBoost = u.boosts.filter((b) => b.kind === "training").reduce((s, b) => s + b.amount, 0);
  const recovery = u.boosts.filter((b) => b.kind === "recovery").reduce((s, b) => s + b.amount, 0);
  const moraleBoost = u.boosts.filter((b) => b.kind === "morale").reduce((s, b) => s + b.amount, 0);
  if (recovery) p.fitness = clamp(p.fitness + recovery, 0, 100);
  if (u.restTurnIndex === state.turnIndex) p.fitness = clamp(p.fitness + BALANCE.fitness.restBonus, 0, 100);
  if (moraleBoost) p.morale = clamp(p.morale + moraleBoost * 0.5, 0, 100);
  const out = runTraining(state, rng, p, u.training, trainingBoost);
  u.lastTraining = { note: out.note, injured: out.injured };
  if (out.injured) addNews(state, { kind: "injury", title: `Training injury: ${out.injured}`, body: out.note, important: true });
  trainingTick(state, p, u.training.focus, u.training.intensity);
  u.trainingHistory.push(out.growthMultiplier);
  if (u.trainingHistory.length > 4) u.trainingHistory.shift();
  reserveMatch(state, rng, out.growthMultiplier);
  if (p.contract) {
    const goals = Object.values(p.season).reduce((s, x) => s + x.goals, 0);
    void goals;
    receiveIncome(state, p.contract.wage);
  }
  payAgent(state);
  weeklyPersonality(state);
  if (u.relationships.manager < 18 && p.clubId && state.turn >= C.seasonStart + 4) rememberManagerConflict(state);
  // A good agent keeps spirits up.
  p.morale = clamp(p.morale + (agentSkill(state, "care") - 30) / 400, 0, 100);
  // Playing-time morale: regulars expect to start.
  if (p.clubId && state.turn > C.seasonStart + 2 && state.turn <= C.seasonEnd) {
    const playedRecently = u.lastMatchTurn !== undefined && state.turn - u.lastMatchTurn <= 2;
    const expectsToPlay = p.contract?.role === "star" || p.contract?.role === "first";
    if (!playedRecently && expectsToPlay && !p.injury) p.morale = clamp(p.morale - BALANCE.morale.benchPenalty, 0, 100);
  }
  const ovr = overallFor(p.attrs, p.position);
  if (ovr > u.peakOverall) {
    u.peakOverall = ovr;
    u.peakSeason = state.season;
  }
}

function monthlyDevelopment(state: GameState, rng: Rng): void {
  const u = state.user;
  const mentorCache = new Map<string, number>();
  for (const p of Object.values(state.players)) {
    if (p.retired) continue;
    const club = p.clubId ? state.clubs[p.clubId] ?? null : null;
    let trainingMultiplier = 1;
    if (p.isUser) {
      trainingMultiplier = trainingGrowthMultiplier(u.trainingHistory) * careerProfile(p).training;
      fadeProgress(p);
    }
    // Experienced teammates who take youngsters under their wing help them develop.
    if (p.clubId && ageOf(p, state.season) <= 21) trainingMultiplier *= 1 + 0.05 * Math.min(2, mentorsOf(state, p.clubId, mentorCache));
    developPlayer(state, rng, p, { club, trainingMultiplier }, 12.5);
    if (!p.virtual) p.value = marketValue(p, state.season);
  }
}

function sackManagers(state: GameState, rng: Rng): void {
  for (const club of Object.values(state.clubs)) {
    if (state.season - club.manager.since < 1 && state.turn < 30) continue;
    const comp = state.competitions[leagueCompId(club.leagueId, state.season)];
    if (!comp?.table || club.expectation === undefined) continue;
    const pos = comp.table.findIndex((r) => r.team === club.id) + 1;
    const played = comp.table[pos - 1]?.played ?? 0;
    if (played < 10) continue;
    const under = pos - club.expectation;
    if (under >= 7 && rng.chance(0.08 + under * 0.01)) {
      const old = club.manager.name;
      const nat = rng.chance(0.6) ? staticClub(club.id)?.countryCode ?? "ENG" : rng.pick(["ESP", "POR", "ITA", "GER", "FRA", "NED", "ARG"]);
      releaseManager(state, club.manager);
      club.manager = hireManager(state, rng, club, nat);
      const u = userPlayer(state);
      if (u.clubId === club.id) {
        state.user.relationships.manager = 50;
        addNews(state, { kind: "club", title: `${old} sacked`, body: `${club.manager.name} takes charge at ${clubName(club.id)}. A fresh start for everyone.`, important: true });
      } else if (club.reputation > 80) addNews(state, { kind: "world", title: `${clubName(club.id)} part ways with ${old}`, body: `${club.manager.name} is the new manager.` });
    }
  }
}

function setExpectations(state: GameState): void {
  for (const l of leaguesInPlay(state)) {
    const ids = [...(state.leagueClubs[l.id] ?? [])].sort((a, b) => state.clubs[b].reputation - state.clubs[a].reputation);
    ids.forEach((id, i) => (state.clubs[id].expectation = i + 1));
  }
}

export interface AdvanceReport {
  season: number;
  turn: number;
  seasonEnded: boolean;
  newSeason: boolean;
  retiredForced?: boolean;
}

/** Simulate the rest of the current week and move to the next one. */
export function advanceTurn(state: GameState): AdvanceReport {
  if (state.user.retired) return { season: state.season, turn: state.turn, seasonEnded: false, newSeason: false };
  settleCeremony(state);
  for (const pm of [...state.pending]) simUserMatch(state, pm.fixtureId);
  const report: AdvanceReport = { season: state.season, turn: state.turn, seasonEnded: false, newSeason: false };
  withRng(state, (rng) => {
    if (state.turn === 1 && state.season === state.user.startSeason) setExpectations(state);
    const ratings: TurnRatings = {};
    simulateWorldFixtures(state, rng, ratings);
    refreshLeagueTables(state);
    progressKnockouts(state, rng);
    progressTournament(state, rng);
    awardCompletedTrophies(state);
    if (state.turn >= C.seasonStart && state.turn <= C.seasonEnd) teamOfTheWeek(state, ratings);

    // Weekly condition for everyone; injuries heal.
    const played = new Set(Object.keys(ratings));
    const uid = state.user.playerId;
    for (const p of Object.values(state.players)) {
      if (p.injury) {
        const back = recoverWeek(p, p.isUser ? 0 : 0);
        if (back && p.id === uid) addNews(state, { kind: "injury", title: "Back in full training", body: "You've recovered from injury.", important: true });
      }
      weeklyCondition(p, played.has(p.id) || (p.id === uid && state.user.lastMatchTurn === state.turn));
    }
    userWeekly(state, rng);
    weeklyFinances(state);
    if (state.turn % 4 === 0) monthlyDevelopment(state, rng);
    if (isMonthEnd(state.turn)) playerOfTheMonth(state);
    if (state.turn % 4 === 2 && state.turn > 10 && state.turn <= C.seasonEnd) sackManagers(state, rng);

    // Transfers
    if (isTransferWindow(state.turn)) {
      runAiTransfers(state, rng, windowName(state.turn) === "summer" ? 0.3 : 0.15);
    }
    processBids(state, rng);
    generateUserOffers(state, rng, (club, draft, r) => divertToSaga(state, club, draft, r));
    // Stories can start brewing in the weeks before a window opens, but only for players clubs would build a saga around.
    if (!state.user.retired && upcomingWindow(state.turn) && userPlayer(state).reputation >= RUMOUR_MIN_REPUTATION) {
      generateUserOffers(state, rng, (club, draft, r) => divertToSaga(state, club, draft, r), true);
    }
    checkUserContract(state, rng);
    stepSagas(state, rng);
    weeklyRivalry(state);
    expireOffers(state);
    maybeCareerEvent(state, rng);
    expireDecisions(state);

    if (state.turn === C.endOfSeasonTurn) {
      seasonEnd(state, rng);
      report.seasonEnded = true;
    }
    if (state.turn >= C.turnsPerSeason) {
      const world = worldAwards(state);
      state.archive[state.archive.length - 1]?.awards.push(...world);
      rollover(state, rng);
      report.newSeason = true;
    } else {
      state.turn++;
    }
    state.turnIndex++;
  });
  if (state.user.retired) report.retiredForced = true;
  beginTurn(state);
  refreshRecall(state);
  state.updatedAt = new Date().toISOString();
  return report;
}

/** Recording season lines for every player who played. */
function recordSeasonHistory(state: GameState): void {
  for (const p of Object.values(state.players)) {
    if (p.virtual) continue;
    const total = totalSeason(p);
    if (total.apps === 0 && !p.isUser) continue;
    const intl = { caps: 0, goals: 0 };
    for (const [k, s] of Object.entries(p.season)) {
      if (state.competitions[k]?.kind === "international" || state.competitions[k]?.kind === "friendly") {
        intl.caps += s.apps;
        intl.goals += s.goals;
      }
    }
    const rec: SeasonRecord = {
      season: state.season,
      clubId: p.clubId,
      leagueId: p.clubId ? state.clubs[p.clubId]?.leagueId : undefined,
      age: ageOf(p, state.season),
      overall: Math.round(overallFor(p.attrs, p.position)),
      stats: total,
      intl,
    };
    if (p.isUser) rec.byCompetition = JSON.parse(JSON.stringify(p.season));
    p.history.push(rec);
    if (!p.isUser && p.history.length > 4) p.history.shift();
  }
}

function updateRecords(state: GameState): void {
  const current = Object.values(state.players).filter((p) => !p.virtual);
  const all = [
    ...current.map((p) => ({ id: p.id, name: fullName(p), goals: p.career.goals, apps: p.career.apps, caps: p.intl.caps })),
    ...state.legends.map((l) => ({ id: l.id, name: l.name, goals: l.goals, apps: l.apps, caps: l.caps })),
  ];
  const top = (key: "goals" | "apps" | "caps") => all.reduce((b, x) => (x[key] > b[key] ? x : b), all[0]);
  const g = top("goals");
  const a = top("apps");
  const c = top("caps");
  const records = [
    { id: "career-goals", label: "Most career goals (active era)", value: g.goals, playerId: g.id, name: g.name },
    { id: "career-apps", label: "Most career appearances", value: a.apps, playerId: a.id, name: a.name },
    { id: "intl-caps", label: "Most international caps", value: c.caps, playerId: c.id, name: c.name },
  ];
  // Single-season league goals record from archives.
  let best = { value: 0, playerId: "", name: "", season: 0 };
  for (const arch of state.archive) for (const ts of Object.values(arch.topScorers)) if (ts.goals > best.value) best = { value: ts.goals, playerId: ts.playerId, name: ts.name, season: arch.season };
  if (best.value) records.push({ id: "season-goals", label: "Most league goals in a season", value: best.value, playerId: best.playerId, name: best.name, season: best.season } as (typeof records)[number]);
  const uid = state.user.playerId;
  for (const r of records) {
    const prev = state.records.find((x) => x.id === r.id);
    if (r.playerId === uid && prev?.playerId !== uid) {
      addTimeline(state, { kind: "record", title: `Record: ${r.label}`, detail: String(r.value) });
      rememberRecord(state, r.label, r.value);
      addNews(state, { kind: "career", title: `New record: ${r.label}`, body: `${r.value}`, important: true });
      if (prev && prev.playerId !== uid) noteRecord(state, prev.playerId, true, r.label);
    } else if (prev?.playerId === uid && r.playerId !== uid) {
      noteRecord(state, r.playerId, false, r.label);
    }
  }
  // Award records are kept separately and refreshed when the awards are given out.
  state.records = [...records, ...state.records.filter((r) => r.id.startsWith(AWARD_RECORD_PREFIX))];
}

function seasonEnd(state: GameState, rng: Rng): void {
  refreshLeagueTables(state);
  const archive: SeasonArchive = { season: state.season, champions: {}, topScorers: {}, awards: [], tables: {}, promoted: {}, relegated: {} };
  // Close leagues
  for (const comp of Object.values(state.competitions)) {
    if (comp.season !== state.season) continue;
    if (comp.kind === "league" && comp.table) {
      comp.complete = true;
      comp.winner = comp.table[0]?.team;
      comp.runnerUp = comp.table[1]?.team;
      archive.tables[comp.id] = comp.table.map((r) => ({ ...r, form: [...r.form] }));
      let best: { playerId: string; name: string; clubId: string | null; goals: number } | null = null;
      for (const clubId of comp.teams) for (const p of squadOf(state, clubId)) {
        const g = p.season[comp.id]?.goals ?? 0;
        if (!best || g > best.goals) best = { playerId: p.id, name: fullName(p), clubId: p.clubId, goals: g };
      }
      if (best) archive.topScorers[comp.id] = best;
    }
  }
  awardCompletedTrophies(state);
  archive.awards = prepareSeasonAwards(state);
  for (const comp of Object.values(state.competitions)) {
    if (comp.season === state.season && comp.winner && comp.kind !== "international") archive.champions[comp.id] = { name: comp.name, winner: comp.winner, runnerUp: comp.runnerUp };
  }

  // Promotion / relegation (applied at rollover)
  const moves: { clubId: string; to: string }[] = [];
  for (const cc of [...new Set(leaguesInPlay(state).map((l) => l.countryCode))]) {
    const tiers = leaguesInPlay(state).filter((l) => l.countryCode === cc).sort((a, b) => a.tier - b.tier);
    for (let i = 0; i + 1 < tiers.length; i++) {
      const upper = state.competitions[leagueCompId(tiers[i].id, state.season)];
      const lower = state.competitions[leagueCompId(tiers[i + 1].id, state.season)];
      if (!upper?.table || !lower?.table) continue;
      const n = Math.min(tiers[i].relegated, tiers[i + 1].promoted);
      const down = upper.table.slice(-n).map((r) => r.team);
      const up = lower.table.slice(0, n).map((r) => r.team);
      archive.relegated[upper.id] = down;
      archive.promoted[lower.id] = up;
      for (const c of down) moves.push({ clubId: c, to: tiers[i + 1].id });
      for (const c of up) moves.push({ clubId: c, to: tiers[i].id });
    }
  }
  state.pendingMoves = moves;
  const u = userPlayer(state);
  const myClub = u.clubId;
  const myMove = moves.find((m) => m.clubId === myClub);
  if (myMove && myClub) {
    const up = (staticLeague(myMove.to)?.tier ?? 9) < (staticLeague(state.clubs[myClub].leagueId)?.tier ?? 9);
    addTimeline(state, { kind: up ? "promotion" : "relegation", title: `${up ? "Promoted" : "Relegated"} with ${clubName(myClub)}`, detail: `To the ${staticLeague(myMove.to)?.name}` });
    addNews(state, { kind: "club", title: up ? `Promotion! ${clubName(myClub)} go up` : `Heartbreak: ${clubName(myClub)} relegated`, important: true });
    rememberPromotionOrRelegation(state, up, myClub, totalSeason(u).apps);
    state.user.relationships.supporters = clamp(state.user.relationships.supporters + (up ? 8 : -4), 0, 100);
  }

  // Club reputation + prize money
  for (const l of leaguesInPlay(state)) {
    const comp = state.competitions[leagueCompId(l.id, state.season)];
    if (!comp?.table) continue;
    comp.table.forEach((row, i) => {
      const club = state.clubs[row.team];
      if (!club) return;
      const exp = club.expectation ?? i + 1;
      const delta = ((exp - (i + 1)) / comp.table!.length) * 7 + (i === 0 ? 2.5 : 0);
      club.reputation = clamp(club.reputation + delta, 8, 99);
      club.balance += (comp.table!.length - i) * (l.tier === 1 ? 1_600_000 : l.tier === 2 ? 300_000 : 60_000);
    });
  }
  for (const comp of Object.values(state.competitions)) {
    if (comp.season !== state.season || !comp.winner) continue;
    const club = state.clubs[comp.winner];
    if (club && comp.kind === "continental") club.reputation = clamp(club.reputation + (comp.prestige >= 10 ? 4 : 2), 8, 99);
    if (club && comp.kind === "cup") club.reputation = clamp(club.reputation + 1, 8, 99);
  }
  recordSeasonHistory(state);
  state.archive.push(archive);
  if (state.archive.length > 40) state.archive.shift();
  updateRecords(state);

  // User season review
  const last = u.history[u.history.length - 1];
  if (last) {
    const avg = last.stats.apps ? last.stats.ratingSum / last.stats.apps : 0;
    addNews(state, {
      kind: "career",
      title: `Season ${seasonLabel(state.season)} review`,
      body: `${last.stats.apps} apps · ${last.stats.goals} goals · ${last.stats.assists} assists · avg ${avg.toFixed(2)} · OVR ${last.overall}`,
      important: true,
    });
    const prev = u.history[u.history.length - 2];
    if (prev && last.overall - prev.overall >= 5 && last.stats.apps >= 20 && !state.user.milestones.includes("breakthrough")) {
      state.user.milestones.push("breakthrough");
      addTimeline(state, { kind: "breakthrough", title: "Breakthrough season", detail: `${last.stats.apps} apps, ${last.stats.goals} goals, OVR ${prev.overall}→${last.overall}` });
    }
  }
  setupTournament(state, rng);
}

function applyMoves(state: GameState): void {
  for (const m of state.pendingMoves ?? []) {
    const club = state.clubs[m.clubId];
    if (!club) continue;
    const from = club.leagueId;
    state.leagueClubs[from] = state.leagueClubs[from].filter((c) => c !== m.clubId);
    state.leagueClubs[m.to].push(m.clubId);
    club.leagueId = m.to;
    const tier = staticLeague(m.to)?.tier ?? 1;
    const relegated = (staticLeague(from)?.tier ?? 1) < tier;
    // Relegation wage clauses: contracts drop when a club goes down.
    if (relegated) for (const id of club.squad) {
      const c = state.players[id]?.contract;
      if (c && c.clubId === club.id) c.wage = Math.round(c.wage * 0.7);
    }
    const cap = tier === 1 ? 99 : tier === 2 ? 80 : 62;
    const floor = tier === 1 ? 55 : tier === 2 ? 35 : 10;
    club.reputation = clamp(club.reputation + ((staticLeague(from)?.tier ?? 1) > tier ? 3 : -3), floor, cap);
  }
  state.pendingMoves = [];
}

function forcedRetirementCheck(state: GameState): void {
  const p = userPlayer(state);
  const age = ageOf(p, state.season);
  const ovr = overallFor(p.attrs, p.position);
  if (age >= BALANCE.retirement.userForcedAge || (age >= 36 && ovr < 58) || (age >= 33 && !p.clubId && (state.user.freeSeasons ?? 0) >= 1)) {
    retireUser(state, age >= BALANCE.retirement.userForcedAge ? "Your body has made the decision for you." : "With no offers coming, you hang up your boots.");
  }
}

/** Retire the user's player and compute their legacy. */
export function retireUser(state: GameState, reason = "You announce your retirement from professional football."): void {
  const u = state.user;
  if (u.retired) return;
  const p = userPlayer(state);
  // Make sure an in-progress season is recorded.
  if (Object.keys(p.season).length && !p.history.some((h) => h.season === state.season)) {
    const total = totalSeason(p);
    if (total.apps) p.history.push({ season: state.season, clubId: p.clubId, leagueId: p.clubId ? state.clubs[p.clubId]?.leagueId : undefined, age: ageOf(p, state.season), overall: Math.round(overallFor(p.attrs, p.position)), stats: total, byCompetition: JSON.parse(JSON.stringify(p.season)) });
  }
  u.retired = true;
  u.retiredSeason = state.season;
  settleCeremony(state);
  addTimeline(state, { kind: "retirement", title: "Retired from professional football", detail: reason });
  addNews(state, { kind: "career", title: "End of an era", body: reason, important: true });
  u.legacy = computeLegacy(state);
  rememberRetirement(state);
  state.pending = [];
  u.offers = u.offers.map((o) => (o.status === "terms" || o.status === "club-pending" ? { ...o, status: "withdrawn" as const } : o));
}

function rollover(state: GameState, rng: Rng): void {
  processExpiringContracts(state, rng);
  processRetirements(state, rng);
  internationalRetirements(state, rng);
  applyMoves(state);
  reviewAllTraits(state);
  const prevSeason = state.season;
  state.season++;
  state.turn = 1;
  const u = userPlayer(state);
  const wasFree = !u.clubId;
  rolloverUserContract(state);
  state.user.freeSeasons = wasFree && !u.clubId ? (state.user.freeSeasons ?? 0) + 1 : 0;
  for (const p of Object.values(state.players)) {
    p.season = {};
    p.yellowAccum = 0;
    p.suspension = 0;
    p.month = { apps: 0, ratingSum: 0, goals: 0, assists: 0 };
  }
  youthIntake(state, rng);
  refreshVirtualPools(state, rng);
  ensureMinimumSquads(state, rng);
  for (const club of Object.values(state.clubs)) {
    const squad = squadOf(state, club.id);
    assignRoles(squad.filter((p) => !p.isUser));
    club.formation = bestFormation(squad);
    club.form = [];
    if (!club.captain || !club.squad.includes(club.captain)) club.captain = [...squad].sort((a, b) => b.reputation - a.reputation)[0]?.id;
  }
  // Drop last season's detailed competitions (archive keeps the summary).
  for (const id of Object.keys(state.competitions)) if (state.competitions[id].season < state.season - 0) delete state.competitions[id];
  setupSeason(state, rng);
  setExpectations(state);
  state.transferLog = state.transferLog.filter((t) => t.season >= prevSeason);
  state.news = state.news.slice(0, 120);
  addNews(state, { kind: "world", title: `Season ${seasonLabel(state.season)} begins`, body: "Pre-season training is underway." });
  if (!state.user.retired) forcedRetirementCheck(state);
}

export { tournamentFor };
export type { Competition, ClubState };
void emptyStat;
