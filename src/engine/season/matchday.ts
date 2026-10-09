import { BALANCE } from "../balance";
import { agentSkill } from "../career/agents";
import { baseRivalry } from "../memory/rivalry";
import { comebackContributions, recordMatchEvidence } from "../traits/develop";
import { AMBIDEXTROUS } from "../players/foot";
import { careerProfile, hasTrait, resolveMatchFx } from "../traits/effects";
import { defeatSting } from "../traits/career";
import { noteMatch } from "../career/rivalry/engine";
import { instruction, instructionResult } from "../match/insight";
import { detectInjuryComeback, detectMatchMemory, noteLastMatch, rememberMajorInjury } from "../memory/detect";
import { applyResult as applyToTable, sortTable } from "../competitions/table";
import { country, stadium, staticClub, clubName } from "../data/world";
import { MatchEngine, type MatchInput, type MatchPlayerInput, type MatchResult, type TeamInput } from "../match/engine";
import { selectTeam, type Selection, type SelectionOpts } from "../match/lineup";
import { overallFor } from "../players/attributes";
import { addStat, emptyStat } from "../players/generate";
import { matchExperience } from "../players/development";
import { applyInjury, injuryRiskFactor, rollInjury } from "../players/injuries";
import { clamp, r1, Rng } from "../rng";
import type { Competition, Fixture, FormationId, GameState, Player, StatLine } from "../types";
import { addNews, addTimeline, fullName, squadOf, userPlayer } from "../world/helpers";
import { payMatchBonuses } from "../career/bonuses";
import { adjustRel } from "../career/relationships";
import { intlTeam } from "../national/identity";
import { recordMatchLog } from "../stats/matchlog";
import { settleCommitment } from "./commitments";
import { currentStint, noteStintMatch } from "../managers/history";
import { onMatchAgainstFormerManager, rememberBreakthrough } from "../managers/story";

export function fixturesForTurn(state: GameState): Fixture[] {
  const out: Fixture[] = [];
  for (const comp of Object.values(state.competitions)) {
    if (comp.season !== state.season || comp.complete) continue;
    for (const f of comp.fixtures) if (f.turn === state.turn && !f.result) out.push(f);
  }
  return out.sort((a, b) => a.round - b.round);
}

export function isNationalComp(comp: Competition | undefined): boolean {
  return comp?.kind === "international" || comp?.kind === "friendly";
}

/** Teams the user can appear for: their club, plus national team when called up. */
export function userTeams(state: GameState): string[] {
  const p = userPlayer(state);
  const teams: string[] = [];
  if (p.clubId) teams.push(p.clubId);
  for (const nt of Object.values(state.nationalTeams)) if (nt.squad.includes(p.id)) teams.push(nt.code);
  return teams;
}

export function involvesUserTeam(state: GameState, f: Fixture): boolean {
  if (state.user.retired) return false;
  const comp = state.competitions[f.compId];
  const teams = userTeams(state);
  const nat = isNationalComp(comp);
  return teams.some((t) => (nat ? !state.clubs[t] : !!state.clubs[t]) && (f.home === t || f.away === t));
}

function toInput(p: Player, slot: Player["position"]): MatchPlayerInput {
  return {
    id: p.id,
    name: p.lastName,
    slot,
    attrs: p.attrs,
    fitness: p.fitness,
    morale: p.morale,
    form: p.form,
    sharpness: p.sharpness,
    bigMatch: p.hidden.bigMatch,
    consistency: p.hidden.consistency,
    isUser: p.isUser,
    fx: resolveMatchFx(p.traits, p.attrs),
    foot: p.foot,
    weakFoot: p.weakFoot,
    ambidextrous: hasTrait(p, AMBIDEXTROUS),
  };
}

function managerBias(state: GameState): number {
  const r = state.user.relationships.manager;
  const diff = state.settings.difficulty;
  return (r - 50) / 12 + (diff === "relaxed" ? 2 : diff === "hardcore" ? -1.5 : 0);
}

/** The random stream the user's club selection draws from for one fixture. */
export function selectionRng(state: GameState, fixture: Fixture, teamId: string): Rng {
  return Rng.fromSeed(`sel:${state.seed}:${fixture.id}:${teamId}`);
}

/** Everything that decides who a side picks for a fixture, shared by the real selection and the explanation of it. */
export interface SelectionSetup {
  squad: Player[];
  formation: FormationId;
  opts: SelectionOpts;
  /** The user asked to be rested for this fixture. */
  resting: boolean;
}

export function selectionSetup(state: GameState, teamId: string, fixture: Fixture): SelectionSetup {
  const comp = state.competitions[fixture.compId];
  const club = state.clubs[teamId];
  if (club && !isNationalComp(comp)) {
    const resting = state.user.restTurnIndex === state.turnIndex;
    const squad = squadOf(state, teamId).filter((p) => !(resting && p.isUser));
    const opp = state.clubs[fixture.home === teamId ? fixture.away : fixture.home];
    const rotate = comp?.kind === "cup" && !!opp && opp.reputation < club.reputation - 12 && (fixture.stage ?? "").startsWith("Round");
    // A request to start this match nudges the manager's view of the user for this fixture only.
    const asked = state.user.preMatch?.requestedStart?.fixtureId === fixture.id ? ASKED_START_BIAS : 0;
    return { squad, formation: club.formation, opts: { rotate, managerBias: managerBias(state) + asked, style: club.style }, resting };
  }
  const nt = state.nationalTeams[teamId];
  const squad = (nt?.squad ?? []).map((id) => state.players[id]).filter((p): p is Player => Boolean(p));
  return { squad, formation: "4-3-3", opts: { managerBias: managerBias(state) / 2 }, resting: false };
}

/** Selection-score points a granted request for a start adds for that one fixture. */
export const ASKED_START_BIAS = 2;

export function teamSelection(state: GameState, teamId: string, fixture: Fixture, rng: Rng | null): Selection {
  const { squad, formation, opts } = selectionSetup(state, teamId, fixture);
  // The user's team is picked from a stream seeded by the fixture, so the line-up the Match Day screen explains is
  // exactly the one that plays (quick-sim, live play and the preview can never disagree).
  const user = state.players[state.user.playerId];
  const withUser = state.clubs[teamId] ? user?.clubId === teamId : !!state.nationalTeams[teamId]?.squad.includes(user?.id ?? "");
  return selectTeam(squad, formation, withUser ? selectionRng(state, fixture, teamId) : rng, opts);
}

function teamName(state: GameState, id: string, short = false): string {
  if (state.clubs[id]) return clubName(id, short);
  const c = country(id);
  return c ? (short ? id : c.name) : id;
}

function teamColor(state: GameState, id: string): string {
  return staticClub(id)?.colors.primary ?? "#1d4fa3";
}

function importanceOf(comp: Competition | undefined, f: Fixture): number {
  if (!comp) return 1;
  if (f.stage === "Final") return 3;
  if (f.stage === "Semi-final") return 2.4;
  if (f.stage === "Quarter-final") return 2;
  if (comp.kind === "continental" || comp.kind === "international") return 1.6;
  if (comp.kind === "friendly") return 0.8;
  return 1;
}

/**
 * How much this match matters, beyond its competition: derbies, the run-in of a title race or a
 * relegation fight. Drives "big-game" behaviour (traits such as Big-Game Performer).
 */
export function matchImportance(state: GameState, comp: Competition | undefined, f: Fixture): number {
  let imp = importanceOf(comp, f);
  if (!comp || comp.kind !== "league" || !state.clubs[f.home] || !state.clubs[f.away]) return imp;
  imp += 0.6 * baseRivalry(f.home, f.away);
  const table = comp.table;
  if (table && state.turn >= BALANCE.calendar.seasonEnd - 7) {
    const pos = (id: string) => table.findIndex((r) => r.team === id) + 1;
    const n = table.length;
    const stakes = (id: string) => {
      const p = pos(id);
      return p > 0 && (p <= 2 || p > n - 4);
    };
    if (stakes(f.home) || stakes(f.away)) imp += 0.5;
  }
  return Math.min(2.6, imp);
}

export function buildTeamInput(state: GameState, teamId: string, sel: Selection): TeamInput {
  return {
    id: teamId,
    name: teamName(state, teamId),
    short: state.clubs[teamId]?.id ? staticClub(teamId)?.abbreviation ?? teamId : teamId,
    starters: sel.starters.map((s) => toInput(s.player, s.slot)),
    bench: sel.bench.map((p) => toInput(p, p.position)),
    mentality: 0,
    color: teamColor(state, teamId),
    style: state.clubs[teamId]?.style,
  };
}

export interface PreparedMatch {
  engine: MatchEngine;
  fixture: Fixture;
  userSide: "home" | "away" | null;
  userStarting: boolean;
  userOnBench: boolean;
  home: Selection;
  away: Selection;
}

export function prepareMatch(state: GameState, fixture: Fixture, rng: Rng, opts: { interactive: boolean; detail: boolean }): PreparedMatch {
  const comp = state.competitions[fixture.compId];
  const home = teamSelection(state, fixture.home, fixture, rng);
  const away = teamSelection(state, fixture.away, fixture, rng);
  const knockout = !!comp && comp.kind !== "league" && fixture.group === undefined && comp.kind !== "friendly" && !(fixture.stage ?? "").startsWith("Group");
  const input: MatchInput = {
    home: buildTeamInput(state, fixture.home, home),
    away: buildTeamInput(state, fixture.away, away),
    neutral: fixture.neutral,
    knockout,
    importance: matchImportance(state, comp, fixture),
    detail: opts.detail,
    interactive: opts.interactive,
  };
  const uid = state.user.playerId;
  const inHome = home.starters.some((s) => s.player.id === uid) || home.bench.some((p) => p.id === uid);
  const inAway = away.starters.some((s) => s.player.id === uid) || away.bench.some((p) => p.id === uid);
  const userSide = inHome ? "home" : inAway ? "away" : null;
  const userStarting = [...home.starters, ...away.starters].some((s) => s.player.id === uid);
  const userOnBench = !userStarting && !!userSide;
  return { engine: new MatchEngine(input, rng), fixture, userSide, userStarting, userOnBench, home, away };
}

function statKey(comp: Competition): string {
  return comp.id;
}

function lineMinutes(line: MatchResult["lines"][number]): number {
  return Math.max(0, (line.minuteOff ?? 90) - line.minuteOn);
}

function lineToStat(line: MatchResult["lines"][number]): StatLine {
  const s = emptyStat();
  const mins = lineMinutes(line);
  s.apps = 1;
  s.starts = line.started ? 1 : 0;
  s.minutes = mins;
  s.goals = line.goals;
  s.assists = line.assists;
  s.yellow = line.yellow;
  s.red = line.red;
  s.ratingSum = line.rating;
  s.shots = line.shots;
  s.shotsOnTarget = line.onTarget;
  s.keyPasses = line.keyPasses;
  s.tackles = line.tackles;
  s.saves = line.saves;
  if (line.slot === "GK") s.conceded = line.conceded;
  if (line.conceded === 0 && mins >= 60 && ["GK", "CB", "RB", "LB"].includes(line.slot)) s.cleanSheets = 1;
  return s;
}

/** Collected during a turn for Team of the Week. */
export interface TurnRatings {
  [playerId: string]: { rating: number; compId: string };
}

export function applyMatchResult(state: GameState, fixture: Fixture, res: MatchResult, rng: Rng, turnRatings?: TurnRatings): void {
  const comp = state.competitions[fixture.compId];
  if (!comp) return;
  const involvesUser = res.lines.some((l) => l.id === state.user.playerId) || involvesUserTeam(state, fixture);
  const cap = state.clubs[fixture.home] ? stadium(staticClub(fixture.home)?.stadiumId ?? "")?.capacity ?? 20000 : 50000;
  const fill = clamp(0.55 + (state.clubs[fixture.home]?.reputation ?? 70) / 250 + importanceOf(comp, fixture) * 0.05 + rng.normal(0, 0.05), 0.35, 1);
  const attendance = Math.round(cap * fill);
  fixture.result = {
    hg: res.homeGoals,
    ag: res.awayGoals,
    et: res.extraTime || undefined,
    pens: res.penalties,
    goals: res.goals.map((g) => ({ minute: g.minute, side: g.side, scorer: g.scorer, assist: g.assist, penalty: g.penalty })),
    motm: res.motm,
    attendance,
    detail: involvesUser
      ? {
          possession: res.stats.possession,
          shots: res.stats.shots,
          onTarget: res.stats.onTarget,
          corners: res.stats.corners,
          fouls: res.stats.fouls,
          yellows: res.stats.yellows,
          reds: res.stats.reds,
          xg: res.stats.xg,
          passes: res.stats.passes,
          passesOk: res.stats.passesOk,
          userLine: res.lines.find((l) => l.id === state.user.playerId),
          ratings: Object.fromEntries(res.lines.map((l) => [l.id, l.rating])),
        }
      : undefined,
  };
  const nat = isNationalComp(comp);
  const key = statKey(comp);
  const repWeight = comp.kind === "continental" ? 1.6 : comp.kind === "international" ? 1.5 : comp.kind === "friendly" ? 0.5 : comp.kind === "cup" ? 0.8 : (comp.tier ?? 1) === 1 ? 1 : (comp.tier ?? 1) === 2 ? 0.6 : 0.35;
  const homeWon = res.homeGoals > res.awayGoals || (res.penalties ? res.penalties[0] > res.penalties[1] : false);
  const awayWon = res.awayGoals > res.homeGoals || (res.penalties ? res.penalties[1] > res.penalties[0] : false);

  const played = new Set<string>();
  for (const line of res.lines) {
    const p = state.players[line.id];
    if (!p) continue;
    played.add(p.id);
    const stat = lineToStat(line);
    if (line.id === res.motm) stat.motm = 1;
    const s = (p.season[key] ??= emptyStat());
    addStat(s, stat);
    addStat(p.career, stat);
    p.month.apps++;
    p.month.ratingSum += line.rating;
    p.month.goals += line.goals;
    p.month.assists += line.assists;
    if (nat) {
      p.intl.caps++;
      p.intl.goals += line.goals;
      // Only a competitive senior match (a qualifier or tournament game) makes the choice of nation binding.
      if (comp.kind === "international" && fixture.stage !== "Friendly") {
        p.intl.compCaps = (p.intl.compCaps ?? 0) + 1;
        if (!p.intl.tiedTo) {
          const side = [intlTeam(p), p.nationality, p.altNationality].find((c) => c && (c === fixture.home || c === fixture.away));
          if (side) p.intl.tiedTo = side;
        }
      }
      if (p.intl.debutSeason === undefined) p.intl.debutSeason = state.season;
    }
    // Condition updates
    const mins = stat.minutes;
    const staminaFactor = 1.2 - p.attrs.stamina / 250;
    p.fitness = r1(clamp(p.fitness - mins * BALANCE.fitness.matchDrainPerMinute * staminaFactor, Math.min(p.fitness, BALANCE.fitness.matchFloor), 100));
    p.sharpness = r1(clamp(p.sharpness + mins / 5, 0, 100));
    p.form = Math.round((p.form * 0.68 + line.rating * 0.32) * 100) / 100;
    const won = line.side === "home" ? homeWon : awayWon;
    const lost = line.side === "home" ? awayWon : homeWon;
    const cp = careerProfile(p);
    p.morale = r1(clamp(p.morale + (won ? BALANCE.morale.winBoost : lost ? -BALANCE.morale.lossPenalty * defeatSting(p) : 0.3) * cp.moraleSwing + (line.rating - 6.6) * 1.2, 5, 100));
    // Everyone in the user's own matches is observed: their habits can turn into traits too.
    if (involvesUser) recordMatchEvidence(state, p, line, { importance: matchImportance(state, comp, fixture), comeback: comebackContributions(res.goals, line.side, p.id, res.homeGoals, res.awayGoals) });
    const keeperBonus = line.slot === "GK" && line.conceded === 0 && stat.minutes >= 60 ? 0.12 : 0;
    const repDelta = (line.rating - 6.5) * 0.22 * repWeight + (line.goals * 0.12 + keeperBonus) * repWeight;
    if (comp.kind === "continental" || nat) p.intlReputation = r1(clamp(p.intlReputation + repDelta * 1.2, 0, 100));
    const mediaBoost = (p.isUser && repDelta > 0 ? 1 + (agentSkill(state, "media") - 30) / 300 : 1) * (repDelta > 0 ? cp.media : 1);
    p.reputation = r1(clamp(p.reputation + repDelta * mediaBoost, 0, 100));
    if (line.red) p.suspension += line.yellow >= 2 ? 1 : 2;
    if (comp.kind === "league" && line.yellow === 1 && !line.red) {
      p.yellowAccum++;
      if (p.yellowAccum >= 5) {
        p.suspension += 1;
        p.yellowAccum = 0;
      }
    }
    if (turnRatings && !nat) turnRatings[p.id] = { rating: line.rating, compId: comp.id };
  }
  // Serve suspensions for squad members who sat out.
  for (const teamId of [fixture.home, fixture.away]) {
    const ids = nat ? state.nationalTeams[teamId]?.squad ?? [] : state.clubs[teamId]?.squad ?? [];
    for (const id of ids) {
      const p = state.players[id];
      if (p && !played.has(id) && p.suspension > 0) p.suspension--;
    }
  }
  // Injuries: knocks from challenges in the engine, plus non-contact injuries
  // that tired or injury-prone players are more likely to pick up.
  const userId = state.user.playerId;
  const hurt = new Set(res.injuries.map((i) => i.id));
  for (const line of res.lines) {
    const p = state.players[line.id];
    const mins = lineMinutes(line);
    if (!p || hurt.has(p.id) || p.injury || mins <= 0) continue;
    if (rng.chance(BALANCE.match.injuryPerPlayerMatch * (mins / 90) * injuryRiskFactor(p))) hurt.add(p.id);
  }
  for (const id of hurt) {
    const p = state.players[id];
    if (!p || p.injury) continue;
    const seriousAllowed = !p.isUser || seriousCount(state) < BALANCE.injuries.maxSeriousPerSeason;
    const injury = rollInjury(rng, p, { context: "match", seriousAllowed });
    applyInjury(rng, p, injury);
    if (p.id === userId && injury.weeksLeft > 0) {
      state.user.injuryHistory.push({ season: state.season, type: injury.type, weeks: injury.totalWeeks });
      rememberMajorInjury(state, injury.type, injury.totalWeeks);
      addNews(state, { kind: "injury", title: `Injury: ${injury.type}`, body: `Expected out for ${injury.totalWeeks} week${injury.totalWeeks === 1 ? "" : "s"}.`, important: true });
      if (injury.totalWeeks >= 8) addTimeline(state, { kind: "injury", title: `${injury.type}`, detail: `Out for ${injury.totalWeeks} weeks` });
    }
  }
  // Table + club form
  if (comp.kind === "league" && comp.table) {
    applyToTable(comp.table, fixture);
    sortTable(comp.table);
  }
  if (!nat) {
    for (const [id, w, l] of [[fixture.home, homeWon, awayWon], [fixture.away, awayWon, homeWon]] as const) {
      const club = state.clubs[id];
      if (!club) continue;
      club.form.push(w ? "W" : l ? "L" : "D");
      if (club.form.length > 6) club.form.shift();
    }
    // Gate income is part of club revenue (weekly finances); cup/continental ties add a bonus.
    const host = state.clubs[fixture.home];
    if (host && (comp.kind === "cup" || comp.kind === "continental")) host.balance = Math.round(host.balance + attendance * (comp.kind === "continental" ? 40 : 15));
  } else {
    for (const [id, w, l] of [[fixture.home, homeWon, awayWon], [fixture.away, awayWon, homeWon]] as const) {
      const nt = state.nationalTeams[id];
      if (!nt) continue;
      nt.form.push(w ? "W" : l ? "L" : "D");
      if (nt.form.length > 6) nt.form.shift();
    }
  }
  if (involvesUser) {
    const line = res.lines.find((l) => l.id === userId);
    const u = state.players[userId];
    if (line && u) matchExperience(state, rng, u, lineMinutes(line), line.rating);
    recordUserMatch(state, fixture, comp, res);
  }
}

function seriousCount(state: GameState): number {
  return state.user.injuryHistory.filter((i) => i.season === state.season && i.weeks >= 8).length;
}

function recordUserMatch(state: GameState, fixture: Fixture, comp: Competition, res: MatchResult) {
  const u = userPlayer(state);
  const line = res.lines.find((l) => l.id === u.id);
  const nat = isNationalComp(comp);
  const myTeam = nat ? (fixture.home === intlTeam(u) ? fixture.home : fixture.away) : u.clubId ?? fixture.home;
  const opp = fixture.home === myTeam ? fixture.away : fixture.home;
  const hg = res.homeGoals;
  const ag = res.awayGoals;
  const mine = fixture.home === myTeam ? hg : ag;
  const theirs = fixture.home === myTeam ? ag : hg;
  const resultText = `${mine}-${theirs}`;
  if (!line) {
    settleCommitment(state, fixture.id, null);
    addNews(state, { kind: "match", title: `${teamName(state, fixture.home, true)} ${hg}-${ag} ${teamName(state, fixture.away, true)}`, body: `${comp.name} · You were not involved.` });
    return;
  }
  settleCommitment(state, fixture.id, line.rating);
  state.user.recentRatings.push({ season: state.season, turn: state.turn, rating: line.rating, compId: comp.id, opponent: opp, goals: line.goals, assists: line.assists });
  if (state.user.recentRatings.length > 60) state.user.recentRatings.shift();
  recordMatchLog(state, fixture, comp, res, line, myTeam);
  payMatchBonuses(state, fixture, comp, line);
  if (!nat && u.clubId) {
    const wasBreakthrough = currentStint(state)?.events.some((e) => e.k === "breakthrough");
    noteStintMatch(state, u.clubId, line.started, line.goals);
    if (!wasBreakthrough && currentStint(state)?.events.some((e) => e.k === "breakthrough")) rememberBreakthrough(state);
    onMatchAgainstFormerManager(state, fixture, comp, line.goals, mine > theirs);
  }
  state.user.lastMatchTurn = state.turn;
  const oppName = teamName(state, opp, true);
  const rated = `Rated ${line.rating.toFixed(1)} against ${oppName}`;
  adjustRel(state, "manager", (line.rating - 6.7) * 1.4, line.rating >= 6.7 ? `${rated}: you earned the manager's trust` : `${rated}: the manager was not impressed`);
  // The manager's instruction is one piece of his verdict, never the whole of it: a small nudge either way on top of the performance.
  const asked = instruction(line, line.minuteOff ?? 90);
  const followed = instructionResult(line, line.minuteOff ?? 90);
  if (asked && followed === "met") adjustRel(state, "manager", 0.6, `You did what the manager asked: ${asked.title.toLowerCase()}`);
  else if (asked && followed === "missed") adjustRel(state, "manager", -0.5, `The manager wanted more on: ${asked.title.toLowerCase()}`);
  adjustRel(state, "supporters", (line.rating - 6.7) * 0.9 + line.goals * 1.2, line.goals ? `${line.goals} goal${line.goals > 1 ? "s" : ""} against ${oppName}` : rated);
  adjustRel(state, "teammates", line.assists * 0.8 + (line.rating - 6.6) * 0.4, line.assists ? `${line.assists} assist${line.assists > 1 ? "s" : ""} for a teammate against ${oppName}` : rated);
  // Milestones
  const ms = state.user.milestones;
  const total = u.career;
  const mark = (id: string, kind: Parameters<typeof addTimeline>[1]["kind"], title: string, detail?: string) => {
    if (ms.includes(id)) return;
    ms.push(id);
    addTimeline(state, { kind, title, detail });
    addNews(state, { kind: "career", title, body: detail, important: true });
  };
  const vs = `vs ${teamName(state, opp)} (${comp.name})`;
  if (nat) {
    mark("intl-debut", "international", `International debut for ${country(myTeam)?.name ?? myTeam}`, vs);
    if (line.goals > 0) mark("intl-goal", "international", `First international goal`, vs);
    if (u.intl.caps >= 50) mark("caps-50", "milestone", "50 international caps");
    if (u.intl.caps >= 100) mark("caps-100", "milestone", "Centurion: 100 international caps");
  } else {
    mark("debut", "debut", `Professional debut for ${clubName(u.clubId)}`, vs);
    if (line.goals > 0) mark("first-goal", "first-goal", "First senior goal", vs);
    if (line.goals >= 3) mark(`hattrick-${state.season}-${state.turn}`, "milestone", `Hat-trick ${vs}`, `${line.goals} goals`);
    for (const n of [50, 100, 200, 300, 400, 500, 600, 700]) if (total.apps >= n) mark(`apps-${n}`, "milestone", `${n} career appearances`);
    for (const n of [10, 50, 100, 150, 200, 250, 300, 400, 500]) if (total.goals >= n) mark(`goals-${n}`, "milestone", `${n} career goals`);
    if (comp.kind === "continental") mark("continental-debut", "milestone", `Champions-level debut in the ${comp.name}`, vs);
  }
  const verdict = line.rating >= 8.5 ? "Outstanding" : line.rating >= 7.5 ? "Excellent" : line.rating >= 6.8 ? "Solid" : line.rating >= 6 ? "Quiet" : "Poor";
  addNews(state, {
    kind: "match",
    title: `${teamName(state, fixture.home, true)} ${hg}-${ag} ${teamName(state, fixture.away, true)}`,
    body: `${comp.name}${fixture.stage ? ` · ${fixture.stage}` : ""} · ${verdict} display (${line.rating.toFixed(1)})${line.goals ? ` · ${line.goals} goal${line.goals > 1 ? "s" : ""}` : ""}${line.assists ? ` · ${line.assists} assist${line.assists > 1 ? "s" : ""}` : ""}${res.motm === u.id ? " · Player of the Match" : ""}`,
    important: res.motm === u.id || line.goals > 0,
  });
  noteLastMatch(state, fixture, line, mine, theirs);
  noteMatch(state, fixture, comp, res, line);
  detectMatchMemory(state, fixture, comp, res, line);
  detectInjuryComeback(state, fixture, comp, line);
  void resultText;
  void fullName;
  void overallFor;
}

export { teamName };
