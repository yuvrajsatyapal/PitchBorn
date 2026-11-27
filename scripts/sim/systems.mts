/**
 * Balance simulator for the newer career systems: lifestyle and money, set-piece duties, and the manager's transfer market.
 *
 *   npm run sim:systems -- [--seeds 4] [--seasons 5] [--managers 12] [--workers 8]
 *
 * Player careers are played by the game's own autopilot. Each career also follows one spending policy (frugal: buys nothing;
 * sensible: buys what upkeep at a sixth of the wage allows; lavish: buys the dearest thing it can, whatever the upkeep;
 * investor: sensible, plus half the bank into bonds, property and start-ups each summer) and half of them ask the manager for
 * both set-piece duties every season. Cohorts start the way a player can: from an academy, as a late starter in the lower
 * divisions, as an established pro and as a star. Manager careers retire at once, take a manager's job in each English tier
 * and run the transfer market with a simple policy (sign for the neediest positions within budget, sell surplus veterans).
 * The newer systems ride along: each career follows one recovery policy for its injuries (rush, plan, rest, clinic), picks a
 * random option in every drama beat, and the "asks" half also has the agent leak interest once a window. Two more cohorts
 * start at 15 on the youth path (half go on every trial) and as late starters in the six newer countries. Managers promote
 * the two best academy prospects after intake day, so the board's youth objective can be met.
 * Writes data/reports/systems-<careers>x<seasons>.md and prints it. Nothing about the player is edited.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { generateAppearance } from "../../src/engine/appearance/generate.ts";
import { BALANCE } from "../../src/engine/balance.ts";
import { autopilotStep } from "../../src/engine/career/autopilot.ts";
import { acceptCoachOffer, coaching, startCoaching, XP_FOR } from "../../src/engine/career/coaching.ts";
import { bidForPlayer, managerBudget, managerNeeds, managing, marketOpen, reportsLeft, salePrice, scoutPlayer, scoutTargets, sellPlayer } from "../../src/engine/career/coachMarket.ts";
import { buyItem, canBuy, invest, LIFESTYLE, netWorth, priceLevel, quote, weeklyUpkeep, type LifestyleKind } from "../../src/engine/career/lifestyle.ts";
import { askForDuty, canAskForDuty, holdsDuty, setPieceState } from "../../src/engine/career/setPieces.ts";
import { academyPlayers, promoteAcademyPlayer, wageBill, wageCap } from "../../src/engine/career/board.ts";
import { resolveDecision } from "../../src/engine/career/events.ts";
import { leakBlock, leakInterest } from "../../src/engine/career/market.ts";
import { leagueCompId } from "../../src/engine/competitions/setup.ts";
import { ageOf } from "../../src/engine/players/generate.ts";
import { Rng } from "../../src/engine/rng.ts";
import { advanceTurn, retireUser } from "../../src/engine/season/advance.ts";
import type { GameState, Position, SetPieceKind } from "../../src/engine/types.ts";
import { clubLevel, createWorld, type CustomStart, type StartPath } from "../../src/engine/world/create.ts";
import { overallFor } from "../../src/engine/players/attributes.ts";

const CAL = BALANCE.calendar;
const POSITIONS: Position[] = ["ST", "LW", "AM", "CM", "DM", "CB", "RB", "GK"];
type Policy = "frugal" | "sensible" | "lavish" | "investor";
const POLICIES: Policy[] = ["frugal", "sensible", "lavish", "investor"];

interface Cohort {
  name: string;
  path: StartPath;
  custom?: CustomStart;
  clubs: string[];
}
type Recovery = "rush" | "plan" | "rest" | "clinic";
const RECOVERIES: Recovery[] = ["rush", "plan", "rest", "clinic"];
/** What each recovery policy picks for a serious injury, where rush/plan/rest are not on offer. */
const SERIOUS: Record<Recovery, string> = { rush: "conservative", plan: "surgery", rest: "surgery", clinic: "clinic" };
const COHORTS: Cohort[] = [
  { name: "academy", path: "academy", clubs: ["eng-arsenal", "eng-chelsea", "eng-man-united", "eng-aston-villa"] },
  { name: "late-starter", path: "late", clubs: ["eng-millwall", "eng-reading", "eng-stockport-county", "eng-wycombe"] },
  { name: "established", path: "custom", custom: { age: 25, overall: 79, potential: 83 }, clubs: ["eng-aston-villa", "eng-brighton", "eng-newcastle-united", "eng-west-ham-united"] },
  { name: "star", path: "custom", custom: { age: 24, overall: 85, potential: 90 }, clubs: ["eng-arsenal", "eng-liverpool", "eng-man-city", "eng-chelsea"] },
  { name: "youth", path: "youth", clubs: ["eng-arsenal", "eng-southampton", "eng-millwall", "eng-reading"] },
  {
    name: "late-abroad",
    path: "late",
    clubs: ["bra-flamengo", "por-braga", "ned-az-alkmaar", "arg-boca-juniors", "usa-seattle-sounders", "mex-monterrey", "bra-goias", "por-chaves", "ned-nac-breda", "arg-colon", "usa-louisville-city", "mex-tigres-uanl"],
  },
];
const MANAGER_CLUBS: Record<string, string[]> = {
  "tier 1": ["eng-brighton", "eng-nottm-forest", "eng-leeds-united", "eng-sunderland"],
  "tier 2": ["eng-middlesbrough", "eng-millwall", "eng-stoke-city", "eng-qpr"],
  "tier 3": ["eng-reading", "eng-wycombe", "eng-peterborough", "eng-stevenage"],
};

type Job = { type: "player"; cohort: Cohort; position: Position; index: number } | { type: "manager"; tier: string; clubId: string; index: number };

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const COUNTRY: Record<string, string> = { eng: "ENG", bra: "BRA", por: "POR", ned: "NED", arg: "ARG", usa: "USA", mex: "MEX" };
function world(seed: string, clubId: string, position: Position, path: StartPath, custom?: CustomStart): GameState {
  const cc = COUNTRY[clubId.slice(0, 3)] ?? "ENG";
  return createWorld({ saveName: "sim", firstName: "Sim", lastName: "Player", nationality: cc, birthCountry: cc, position, foot: "R", height: 181, look: generateAppearance(seed), clubId, path, custom, seed, countries: [cc] });
}

// ------------------------------------------------------------------------------------------------ player careers

interface SeasonRec {
  cohort: string;
  position: string;
  policy: Policy;
  asks: boolean;
  age: number;
  wage: number;
  level: number;
  bank: number;
  netWorth: number;
  upkeep: number;
  /** Upkeep as a share of the wage, at the season's end. */
  burden: number;
  injuries: number;
  avgFitness: number;
  forcedSales: number;
  pens: number;
  pensScored: number;
  fks: number;
  fksScored: number;
  penDuty: boolean;
  fkDuty: boolean;
  penDropped: boolean;
  asked: number;
  granted: number;
  refused: number;
  recovery: Recovery;
  club: string;
  ovr: number;
  apps: number;
  minutes: number;
  weeksOut: number;
  bigInjuries: number;
  reinjuries: number;
  dramas: number;
  wars: number;
  deadlineBids: number;
  leaks: number;
  leaksWorked: number;
}
interface DramaRec {
  kind: string;
  choice: string;
  outcome: string;
  cohort: string;
}
interface YouthRec {
  invited: number;
  went: number;
  impressed: number;
  offers: string;
  outcome: string;
  clubAfter: string;
  ovr17: number;
  minutes17: number;
  minutes18: number;
}
interface PlayerResult {
  cohort: string;
  position: string;
  policy: Policy;
  firstHomeWeeks?: number;
  firstHomeLevel?: number;
  /** Cheapest home's price in weeks of wages at the start. */
  flatWeeksAtStart: number;
  seasons: SeasonRec[];
  investments: { kind: string; ret: number }[];
  startups: { won: number; lost: number };
  recovery: Recovery;
  dramas: DramaRec[];
  careerThreats: number;
  injuryRetired: boolean;
  youth?: YouthRec;
  /** Each moderate-or-worse injury: weeks out from the choice to the return, and whether he broke down again within ten weeks. */
  episodes: { weeksOut: number; again: boolean }[];
  /** Weeks until the first senior appearance. */
  firstAppWeek?: number;
  startClub: string;
}

const ORDER: LifestyleKind[] = ["home", "car", "staff", "charity"];

/** Buys for one policy. `sensible` keeps total upkeep under a sixth of the wage and spends at most 40% of the bank on one item. */
function spend(s: GameState, policy: Policy): void {
  if (policy === "frugal") return;
  const wage = s.players[s.user.playerId]?.contract?.wage ?? 0;
  for (const kind of ORDER) {
    const items = LIFESTYLE.filter((i) => i.kind === kind).sort((a, b) => b.price + b.upkeep * 50 - (a.price + a.upkeep * 50));
    for (const it of items) {
      if (!canBuy(s, it.id).ok) continue;
      const q = quote(s, it.id);
      if (policy !== "lavish") {
        const owned = s.user.lifestyle?.owned.find((o) => LIFESTYLE.find((x) => x.id === o.id)?.kind === kind && kind !== "staff");
        const freed = owned?.upkeep ?? 0;
        if (weeklyUpkeep(s) - freed + q.upkeep > wage / 6) continue;
        if (q.price > s.user.bank * 0.4) continue;
        // Only upgrade: never trade down within a kind.
        if (owned && (owned.price ?? 0) >= q.price) continue;
      }
      buyItem(s, it.id);
      if (kind !== "staff") break;
    }
  }
}

function runPlayer(job: Extract<Job, { type: "player" }>, seasons: number): PlayerResult {
  const { cohort, position, index } = job;
  const policy = POLICIES[index % POLICIES.length];
  const asks = index % 2 === 0;
  const recovery = RECOVERIES[(index + POSITIONS.indexOf(position)) % RECOVERIES.length];
  const seed = `sim-systems:${cohort.name}:${position}:${index}`;
  const clubId = cohort.clubs[(index * POSITIONS.length + POSITIONS.indexOf(position)) % cohort.clubs.length];
  const s = world(seed, clubId, position, cohort.path, cohort.custom);
  const rng = Rng.fromSeed(`${seed}:pilot`);
  const choose = Rng.fromSeed(`${seed}:choices`);
  const wage0 = s.players[s.user.playerId].contract?.wage ?? 0;
  const res: PlayerResult = {
    cohort: cohort.name, position, policy, flatWeeksAtStart: wage0 ? quote(s, "flat").price / wage0 : Infinity, seasons: [], investments: [], startups: { won: 0, lost: 0 },
    recovery, dramas: [], careerThreats: 0, injuryRetired: false, startClub: clubId, episodes: [],
    youth: cohort.path === "youth" ? { invited: 0, went: 0, impressed: 0, offers: "", outcome: "none", clubAfter: "", ovr17: 0, minutes17: 0, minutes18: 0 } : undefined,
  };
  const goesOnTrials = index % 2 === 0;
  let episode: { start: number; back?: number } | undefined;
  let story: { id: string; kind: string; choice: string } | undefined;
  let weeksOut = 0;
  let bigInjuries = 0;
  let reinjuries = 0;
  let dramas = 0;
  let wars = 0;
  let deadlineBids = 0;
  let leaks = 0;
  let leaksWorked = 0;
  let minutes0 = 0;
  let apps0 = 0;
  const careerApps = () => s.players[s.user.playerId].career.apps;
  const careerMinutes = () => {
    const pl = s.players[s.user.playerId];
    let m = pl.history.reduce((n, h) => n + (h.season < s.season ? h.stats.minutes : 0), 0);
    for (const k in pl.season) m += pl.season[k].minutes;
    return m;
  };
  let injuries = 0;
  let fitSum = 0;
  let fitN = 0;
  let forced = 0;
  let asked = 0;
  let granted = 0;
  let refused = 0;
  let sp0 = { pens: 0, pensScored: 0, fks: 0, fksScored: 0 };
  let penDuty = false;
  let fkDuty = false;
  const before = new Map<string, number>();

  for (let t = 0; t < CAL.turnsPerSeason * seasons && !s.user.retired; t++) {
    const logBefore = s.user.drama?.log.length ?? 0;
    for (const d of [...s.user.decisions]) {
      if (d.handler === "recovery") {
        const ids = d.options.map((o) => o.id);
        if (ids.includes("fight-on")) {
          res.careerThreats++;
          resolveDecision(s, d.id, "fight-on");
          continue;
        }
        bigInjuries++;
        const want = ids.includes("rush") ? recovery : SERIOUS[recovery];
        resolveDecision(s, d.id, ids.includes(want) ? want : d.fallback);
        if (episode && episode.back === undefined) res.episodes.push({ weeksOut: t - episode.start, again: true });
        episode = { start: t };
      } else if (d.handler === "drama") {
        const opt = choose.pick(d.options).id;
        const active = s.user.drama?.active;
        if (active && active.stage === 0 && story?.id !== active.id) {
          story = { id: active.id, kind: active.kind, choice: opt };
          dramas++;
        }
        resolveDecision(s, d.id, opt);
      } else if (d.handler === "youth" && res.youth) {
        if (d.ref?.startsWith("trial:")) {
          res.youth.invited++;
          if (goesOnTrials) res.youth.went++;
          resolveDecision(s, d.id, goesOnTrials ? "go" : "stay");
          res.youth.impressed = s.user.youth?.trials.filter((x) => x.impressed).length ?? 0;
        } else {
          const ids = d.options.map((o) => o.id);
          res.youth.offers = ids.map((x) => (x.startsWith("club:") ? "trial club" : x)).join(" + ");
          // Take a trial club over the academy when one is on offer and the player went on trials; else the default.
          const pick = goesOnTrials ? (ids.find((x) => x.startsWith("club:")) ?? d.fallback) : d.fallback;
          res.youth.outcome = pick.startsWith("club:") ? "trial club" : pick === "home" ? "academy" : "free agent";
          res.youth.ovr17 = overallFor(s.players[s.user.playerId].attrs, position);
          resolveDecision(s, d.id, pick);
        }
      }
    }
    if (asks && !leakBlock(s)) {
      leaks++;
      if (leakInterest(s).msg?.startsWith("It worked")) leaksWorked++;
    }
    autopilotStep(s, rng);
    if (t % 4 === 0) spend(s, policy);
    if (policy === "investor" && s.turn === CAL.seasonEnd + 2 && s.user.bank > 0) {
      const pot = Math.floor(s.user.bank * 0.5);
      for (const k of ["bonds", "property", "startup"] as const) invest(s, k, Math.floor(pot / 3));
    }
    if (asks && s.turn >= CAL.seasonStart && s.turn <= CAL.seasonEnd) {
      for (const kind of ["penalty", "freekick"] as SetPieceKind[]) {
        if (!canAskForDuty(s, kind).ok) continue;
        asked++;
        if (askForDuty(s, kind).ok) granted++;
        else refused++;
      }
    }
    const p = s.players[s.user.playerId];
    const wasInjured = !!p.injury;
    before.clear();
    for (const h of s.user.lifestyle?.investments ?? []) before.set(h.id, h.value);
    const newsBefore = s.news.length;
    const topBefore = s.news[0]?.id;
    advanceTurn(s);
    if (s.user.retireRequested && !s.user.retired) {
      res.injuryRetired = true;
      retireUser(s);
    }
    const top = s.news.findIndex((n) => n.id === topBefore);
    const fresh = s.news.slice(0, top < 0 ? Math.max(0, s.news.length - newsBefore) : top).map((n) => n.title);
    void newsBefore;
    forced += fresh.filter((x) => x.includes("can't keep up the payments")).length;
    reinjuries += fresh.filter((x) => x === "The same injury again").length;
    wars += fresh.filter((x) => x.startsWith("⚔️ Bidding war")).length;
    deadlineBids += fresh.filter((x) => x.startsWith("📺 Deadline-day bid")).length;
    const log = s.user.drama?.log ?? [];
    if (log.length > logBefore && story) {
      for (const e of log.slice(logBefore)) res.dramas.push({ kind: e.kind, choice: story.choice, outcome: e.outcome, cohort: cohort.name });
      story = undefined;
    } else if (log.length > logBefore) for (const e of log.slice(logBefore)) res.dramas.push({ kind: e.kind, choice: "?", outcome: e.outcome, cohort: cohort.name });
    if (p.injury) weeksOut++;
    if (res.firstAppWeek === undefined && careerApps() > 0) res.firstAppWeek = t;
    if (res.youth) {
      const age = ageOf(p, s.season);
      if (s.turn === CAL.seasonEnd + 1 && (age === 17 || age === 18)) {
        const m = careerMinutes();
        if (age === 17) res.youth.minutes17 = m - minutes0;
        else res.youth.minutes18 = m - minutes0;
      }
      if (res.youth.outcome !== "none" && !res.youth.clubAfter && s.turn === CAL.seasonStart + 2) res.youth.clubAfter = p.clubId ? (p.clubId === clubId ? "academy" : "other club") : "no club";
    }
    res.startups.won += fresh.filter((x) => x.includes("start-up stake pays off")).length;
    res.startups.lost += fresh.filter((x) => x.includes("start-up stake goes under")).length;
    for (const h of s.user.lifestyle?.investments ?? []) {
      const v = before.get(h.id);
      if (v !== undefined && v !== h.value) res.investments.push({ kind: h.kind, ret: h.value / v - 1 });
    }
    if (!wasInjured && p.injury) injuries++;
    if (episode) {
      if (episode.back === undefined && !p.injury) episode.back = t;
      else if (episode.back !== undefined && !wasInjured && p.injury) {
        res.episodes.push({ weeksOut: episode.back - episode.start, again: true });
        episode = undefined;
      } else if (episode.back !== undefined && t - episode.back > 10) {
        res.episodes.push({ weeksOut: episode.back - episode.start, again: false });
        episode = undefined;
      }
    }
    if (s.turn >= CAL.seasonStart && s.turn <= CAL.seasonEnd) {
      fitSum += p.fitness;
      fitN++;
      penDuty ||= holdsDuty(s, "penalty");
      fkDuty ||= holdsDuty(s, "freekick");
    }
    const home = s.user.lifestyle?.owned.find((o) => LIFESTYLE.find((x) => x.id === o.id)?.kind === "home");
    if (home && res.firstHomeWeeks === undefined) {
      res.firstHomeWeeks = t;
      res.firstHomeLevel = priceLevel(s);
    }
    if (s.turn === CAL.seasonEnd + 1) {
      const sp = setPieceState(s);
      const wage = p.contract?.wage ?? 0;
      const upkeep = weeklyUpkeep(s);
      res.seasons.push({
        cohort: cohort.name, position, policy, asks, age: ageOf(p, s.season), wage, level: priceLevel(s), bank: s.user.bank, netWorth: netWorth(s), upkeep,
        burden: wage ? upkeep / wage : 0, injuries, avgFitness: fitN ? fitSum / fitN : 0, forcedSales: forced,
        pens: sp.pens - sp0.pens, pensScored: sp.pensScored - sp0.pensScored, fks: sp.fks - sp0.fks, fksScored: sp.fksScored - sp0.fksScored,
        penDuty, fkDuty, penDropped: sp.dropped.penalty === s.season, asked, granted, refused,
        recovery, club: p.clubId ?? "", ovr: overallFor(p.attrs, p.position), apps: careerApps() - apps0, minutes: careerMinutes() - minutes0, weeksOut, bigInjuries, reinjuries,
        dramas, wars, deadlineBids, leaks, leaksWorked,
      });
      apps0 = careerApps();
      minutes0 = careerMinutes();
      weeksOut = bigInjuries = reinjuries = dramas = wars = deadlineBids = leaks = leaksWorked = 0;
      sp0 = { pens: sp.pens, pensScored: sp.pensScored, fks: sp.fks, fksScored: sp.fksScored };
      injuries = fitSum = fitN = forced = asked = granted = refused = 0;
      penDuty = fkDuty = false;
    }
  }
  return res;
}

// ------------------------------------------------------------------------------------------------ manager careers

interface ManagerSeason {
  tier: string;
  /** Median balance change of the other clubs in the same league over the season (the AI baseline). */
  aiBalanceChange: number;
  budgetAtWindow: number;
  balanceStart: number;
  balanceEnd: number;
  signings: number;
  spent: number;
  sales: number;
  income: number;
  squadMin: number;
  squadMax: number;
  posStart?: number;
  posEnd?: number;
  expectation?: number;
  /** Board review at the season's end: objective id → met. */
  objectives: Record<string, boolean>;
  ultimatum: boolean;
  bids: number;
  capBlocked: number;
  /** Wage bill over the cap when the summer window opened. */
  billShare: number;
  promoted: number;
}
interface ManagerResult {
  tier: string;
  seasons: ManagerSeason[];
  sacked: number;
  sackedInSeason: number;
  sackedByBoard: number;
  /** AI managers in the simulated league system: changes during the season and over the summer, per season. */
  aiChanges: { inSeason: number; summer: number; clubs: number }[];
  unemployedSeasons: number;
  bidFails: Record<string, number>;
  saleFails: Record<string, number>;
  avgAgeStart: number;
  avgAgeEnd: number;
}

const reasonKey = (r: string | undefined) => (r ?? "?").replace(/€[\d.]+[KMB]?/g, "€X").replace(/[A-Z][a-z]+ [A-Z][a-z]+(?: [A-Z][a-z]+)?/g, "<name>").slice(0, 60);

function leaguePos(s: GameState, clubId: string): number | undefined {
  const club = s.clubs[clubId];
  const t = s.competitions[leagueCompId(club.leagueId, s.season)]?.table;
  const i = t?.findIndex((r) => r.team === clubId) ?? -1;
  return i >= 0 ? i + 1 : undefined;
}

function avgAge(s: GameState, clubId: string): number {
  const sq = s.clubs[clubId]?.squad ?? [];
  return sq.reduce((n, id) => n + ageOf(s.players[id], s.season), 0) / Math.max(1, sq.length);
}

/** The position where the squad's best player falls furthest below the club's level: where an upgrade helps most. */
function weakestPosition(s: GameState, clubId: string): Position | undefined {
  const club = s.clubs[clubId];
  const level = clubLevel(club.reputation);
  let worst: { pos: Position; gap: number } | undefined;
  for (const pos of POSITIONS) {
    const best = Math.max(0, ...club.squad.map((id) => s.players[id]).filter((p) => p?.position === pos).map((p) => overallFor(p.attrs, pos)));
    const gap = level - best;
    if (!worst || gap > worst.gap) worst = { pos, gap };
  }
  return worst && worst.gap > 0 ? worst.pos : undefined;
}

function leagueBalances(s: GameState, leagueId: string, except?: string): Map<string, number> {
  return new Map(Object.values(s.clubs).filter((c) => c.leagueId === leagueId && c.id !== except).map((c) => [c.id, c.balance]));
}

function runManager(job: Extract<Job, { type: "manager" }>, seasons: number): ManagerResult {
  const seed = `sim-systems:mgr:${job.clubId}:${job.index}`;
  const s = world(seed, "eng-ipswich-town", "CM", "custom", { age: 33, overall: 74, potential: 74 });
  advanceTurn(s);
  retireUser(s);
  startCoaching(s);
  const c = s.user.coach;
  if (!c) throw new Error("no coach");
  // As if he had come up through the youth and assistant jobs: after a sacking, offers are for manager jobs.
  c.xp = Math.max(c.xp, XP_FOR.manager);
  c.offers.push({ id: "co-sim", clubId: job.clubId, role: "manager", expiresIndex: s.turnIndex + 4, note: "" });
  acceptCoachOffer(s, "co-sim");
  const res: ManagerResult = { tier: job.tier, seasons: [], sacked: 0, sackedInSeason: 0, sackedByBoard: 0, aiChanges: [], unemployedSeasons: 0, bidFails: {}, saleFails: {}, avgAgeStart: avgAge(s, job.clubId), avgAgeEnd: 0 };
  const managersNow = () => new Map(Object.values(s.clubs).map((c) => [c.id, c.manager.id ?? c.manager.name]));
  let mgrs = managersNow();
  let ai = { inSeason: 0, summer: 0, clubs: Object.keys(s.clubs).length };
  let cur: ManagerSeason | undefined;
  let aiBefore = new Map<string, number>();
  let aiLeague = "";
  const begin = () => {
    const club = managing(s);
    aiLeague = club?.leagueId ?? aiLeague;
    aiBefore = aiLeague ? leagueBalances(s, aiLeague, club?.id) : new Map();
    cur = {
      tier: job.tier, aiBalanceChange: 0, budgetAtWindow: club ? managerBudget(s) : 0, balanceStart: club?.balance ?? 0, balanceEnd: 0, signings: 0, spent: 0, sales: 0, income: 0,
      squadMin: club?.squad.length ?? 0, squadMax: club?.squad.length ?? 0, expectation: club?.expectation, objectives: {}, ultimatum: false, bids: 0, capBlocked: 0,
      billShare: club ? wageBill(s, club.id) / Math.max(1, wageCap(s, club)) : 0, promoted: 0,
    };
  };
  begin();
  for (let t = 0; t < CAL.turnsPerSeason * seasons; t++) {
    const co = coaching(s);
    if (co && !co.clubId) {
      // Manager jobs only: a youth or assistant role would leave the board systems untested.
      const o = co.offers.find((x) => x.role === "manager");
      if (o) acceptCoachOffer(s, o.id);
    }
    const club = managing(s);
    if (club && cur && club.squad.length && cur.squadMin === 0) cur.squadMin = cur.squadMax = club.squad.length;
    if (club && cur && marketOpen(s)) {
      // Sell first: veterans out of the side, when the squad has room to spare.
      for (const id of [...club.squad]) {
        const p = s.players[id];
        if (!p || club.squad.length <= BALANCE.squad.target) break;
        if (ageOf(p, s.season) < 31 || p.contract?.role === "star" || p.contract?.role === "first") continue;
        const fee = salePrice(s, p);
        const r = sellPlayer(s, id);
        if (r.ok) {
          cur.sales++;
          cur.income += fee;
        } else res.saleFails[reasonKey(r.reason)] = (res.saleFails[reasonKey(r.reason)] ?? 0) + 1;
      }
      const upgrade = weakestPosition(s, club.id);
      const wanted = managerNeeds(s).slice(0, 2);
      if (!wanted.length && upgrade && club.squad.length < BALANCE.squad.max) wanted.push(upgrade);
      for (const pos of wanted) {
        const targets = scoutTargets(s, pos, 6);
        for (const tg of targets) if (!tg.report && reportsLeft(s) > 0) scoutPlayer(s, tg.player.id);
        const pick = targets.filter((x) => x.asking <= managerBudget(s)).sort((a, b) => (b.report?.high ?? b.overall) - (a.report?.high ?? a.overall))[0];
        if (!pick) continue;
        const r = bidForPlayer(s, pick.player.id);
        cur.bids++;
        if (r.reason?.includes("wage cap")) cur.capBlocked++;
        if (r.ok) {
          cur.signings++;
          cur.spent += pick.asking;
        } else res.bidFails[reasonKey(r.reason)] = (res.bidFails[reasonKey(r.reason)] ?? 0) + 1;
      }
    }
    if (club && cur && s.turn === 37) {
      // After intake day, promote the two best academy prospects so the board's debut objective is reachable.
      for (const pl of academyPlayers(s).sort((a, b) => overallFor(b.attrs, b.position) - overallFor(a.attrs, a.position)).slice(0, 2)) if (promoteAcademyPlayer(s, pl.id).ok) cur.promoted++;
    }
    if (club && cur) {
      cur.squadMin = Math.min(cur.squadMin, club.squad.length);
      cur.squadMax = Math.max(cur.squadMax, club.squad.length);
      if (s.turn === CAL.seasonStart + 1) cur.posStart = leaguePos(s, club.id);
    }
    const wasSacked = (c.stints.filter((x) => x.reason === "sacked").length);
    const topBefore = s.news[0]?.id;
    const turnBefore = s.turn;
    advanceTurn(s);
    const sackedNow = c.stints.filter((x) => x.reason === "sacked").length - wasSacked;
    res.sacked += sackedNow;
    const top = s.news.findIndex((n) => n.id === topBefore);
    const fresh = s.news.slice(0, top < 0 ? 0 : top);
    if (sackedNow) {
      if (fresh.some((n) => n.title.startsWith("🚪 Sacked") && n.body?.includes("season review"))) res.sackedByBoard += sackedNow;
      else res.sackedInSeason += sackedNow;
    }
    if (cur && fresh.some((n) => n.title.startsWith("⏳ The board's ultimatum"))) cur.ultimatum = true;
    const review = fresh.find((n) => n.title.startsWith("📋 Board review"));
    if (cur && review?.body) {
      const ids = ["league", "cup", "youth", "wages"];
      review.body.split(" · ").forEach((part, i) => {
        if (ids[i]) cur!.objectives[ids[i]] = part.startsWith("✔");
      });
    }
    const now = managersNow();
    const own = managing(s)?.id;
    let changed = 0;
    for (const [id, m] of now) if (id !== own && mgrs.has(id) && mgrs.get(id) !== m) changed++;
    if (turnBefore >= CAL.seasonStart && turnBefore <= CAL.seasonEnd) ai.inSeason += changed;
    else ai.summer += changed;
    mgrs = now;
    if (s.turn === 1) {
      res.aiChanges.push(ai);
      ai = { inSeason: 0, summer: 0, clubs: now.size };
    }
    const after = managing(s);
    if (s.turn === CAL.seasonEnd + 1 && cur) {
      if (after) {
        cur.posEnd = leaguePos(s, after.id);
        cur.balanceEnd = after.balance;
        const now = leagueBalances(s, aiLeague, after.id);
        cur.aiBalanceChange = median([...aiBefore].filter(([id]) => now.has(id)).map(([id, b]) => (now.get(id) as number) - b));
        res.seasons.push(cur);
      } else res.unemployedSeasons++;
      begin();
    }
  }
  const last = managing(s);
  res.avgAgeEnd = last ? avgAge(s, last.id) : 0;
  return res;
}

// ------------------------------------------------------------------------------------------------ report

const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(0)}%` : "–");
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const v = [...xs].sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)];
};
const money = (v: number) => {
  const a = Math.abs(v);
  const sgn = v < 0 ? "-" : "";
  return a >= 1e6 ? `${sgn}€${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `${sgn}€${Math.round(a / 1e3)}K` : `${sgn}€${Math.round(a)}`;
};
function group<T>(rows: T[], key: (r: T) => string): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    m.set(k, [...(m.get(k) ?? []), r]);
  }
  return [...m.entries()];
}
const row = (cells: (string | number)[]) => `| ${cells.join(" | ")} |`;
const rule = (n: number) => row(Array.from({ length: n }, () => "---"));

function summarize(players: PlayerResult[], managers: ManagerResult[], meta: { seasons: number; seconds: number }): string {
  const L: string[] = [];
  const seasonsAll = players.flatMap((r) => r.seasons);
  L.push(`# Systems simulation: ${players.length} player careers and ${managers.length} manager careers × ${meta.seasons} seasons`, "");
  L.push(`${seasonsAll.length} player-seasons and ${managers.reduce((n, m) => n + m.seasons.length, 0)} manager-seasons (${meta.seconds.toFixed(0)}s). Autopilot plays; see the header of scripts/sim/systems.mts for the policies.`, "");

  L.push("## Lifestyle: what a home costs", "", row(["Cohort", "Careers", "Wage at start (median)", "Price level at start", "City flat in weeks of wages", "Sensible: first home after (weeks)"]), rule(6));
  for (const [c, rows] of group(players, (r) => r.cohort)) {
    const first = rows.filter((r) => r.policy === "sensible" || r.policy === "investor");
    const weeks = first.map((r) => r.firstHomeWeeks).filter((w): w is number => w !== undefined);
    const s0 = rows.map((r) => r.seasons[0]).filter(Boolean);
    L.push(row([c, rows.length, money(median(s0.map((x) => x.wage))), avg(s0.map((x) => x.level)).toFixed(2), median(rows.map((r) => r.flatWeeksAtStart)).toFixed(1), weeks.length ? `${median(weeks)} (${weeks.length}/${first.length} bought one)` : "none bought"]));
  }
  L.push("");

  L.push("## Lifestyle: does money run out?", "", row(["Policy", "Cohort", "Seasons", "Upkeep / wage (median)", "Seasons with a forced sale", "Bank at the end (median)", "Net worth at the end (median)", "Training injuries / season", "Avg fitness"]), rule(9));
  for (const pol of POLICIES) {
    for (const [c, rows] of group(seasonsAll.filter((x) => x.policy === pol), (r) => r.cohort)) {
      const ends = players.filter((r) => r.policy === pol && r.cohort === c).map((r) => r.seasons.at(-1)).filter((x): x is SeasonRec => !!x);
      L.push(row([pol, c, rows.length, `${(median(rows.map((r) => r.burden)) * 100).toFixed(0)}%`, pct(rows.filter((r) => r.forcedSales > 0).length, rows.length), money(median(ends.map((r) => r.bank))), money(median(ends.map((r) => r.netWorth))), avg(rows.map((r) => r.injuries)).toFixed(2), avg(rows.map((r) => r.avgFitness)).toFixed(1)]));
    }
  }
  L.push("");
  const inv = players.flatMap((r) => r.investments);
  L.push("## Investments", "", row(["Kind", "Yearly settlements", "Mean return", "Worst", "Best", "Years that lost money"]), rule(6));
  for (const [k, rows] of group(inv, (r) => r.kind)) {
    const rets = rows.map((r) => r.ret);
    L.push(row([k, rows.length, `${(avg(rets) * 100).toFixed(1)}%`, `${(Math.min(...rets) * 100).toFixed(0)}%`, `${(Math.max(...rets) * 100).toFixed(0)}%`, pct(rets.filter((r) => r < 0).length, rets.length)]));
  }
  const su = players.reduce((a, r) => ({ won: a.won + r.startups.won, lost: a.lost + r.startups.lost }), { won: 0, lost: 0 });
  L.push(row(["startup", su.won + su.lost, "(settles once)", `${su.lost} went under`, `${su.won} paid off`, pct(su.lost, su.won + su.lost)]), "");

  const out = seasonsAll.filter((r) => r.position !== "GK");
  L.push("## Set pieces", "", "Seasons for outfield players; \"asks\" careers ask the manager for both duties whenever they may.", "");
  L.push(row(["Position", "Asks", "Seasons", "Took ≥1 penalty", "Penalties / season", "Scored", "Held the penalty duty", "Lost it", "Free kicks / season", "FK scored", "Held the FK duty", "Asked → granted"]), rule(12));
  for (const pos of POSITIONS.filter((p) => p !== "GK")) {
    for (const ask of [true, false]) {
      const rows = out.filter((r) => r.position === pos && r.asks === ask);
      const pens = rows.reduce((n, r) => n + r.pens, 0);
      const fks = rows.reduce((n, r) => n + r.fks, 0);
      L.push(row([pos, ask ? "yes" : "no", rows.length, pct(rows.filter((r) => r.pens > 0).length, rows.length), (pens / Math.max(1, rows.length)).toFixed(2), pct(rows.reduce((n, r) => n + r.pensScored, 0), pens), pct(rows.filter((r) => r.penDuty).length, rows.length), pct(rows.filter((r) => r.penDropped).length, rows.length), (fks / Math.max(1, rows.length)).toFixed(2), pct(rows.reduce((n, r) => n + r.fksScored, 0), fks), pct(rows.filter((r) => r.fkDuty).length, rows.length), ask ? `${rows.reduce((n, r) => n + r.granted, 0)}/${rows.reduce((n, r) => n + r.asked, 0)}` : "–"]));
    }
  }
  L.push("");
  L.push(row(["Cohort", "Seasons (outfield)", "Took ≥1 penalty", "Never a penalty in the whole career", "Penalties / season"]), rule(5));
  for (const [c, rows] of group(out, (r) => r.cohort)) {
    const careers = players.filter((r) => r.cohort === c && r.position !== "GK");
    L.push(row([c, rows.length, pct(rows.filter((r) => r.pens > 0).length, rows.length), pct(careers.filter((r) => r.seasons.every((x) => x.pens === 0)).length, careers.length), (rows.reduce((n, r) => n + r.pens, 0) / Math.max(1, rows.length)).toFixed(2)]));
  }
  L.push("");

  L.push("## Manager transfer market", "", row(["Tier", "Seasons", "Budget at the window (median)", "Signings / season", "Spent / season", "Sales / season", "Squad range", "Balance start → end (median)", "Balance change: you vs AI clubs (median)", "Seasons ending in debt", "Position start → end (avg)", "Sacked", "Seasons out of work"]), rule(13));
  for (const [tier, rows] of group(managers, (m) => m.tier)) {
    const ss = rows.flatMap((m) => m.seasons);
    L.push(row([tier, ss.length, money(median(ss.map((x) => x.budgetAtWindow))), avg(ss.map((x) => x.signings)).toFixed(1), money(avg(ss.map((x) => x.spent))), avg(ss.map((x) => x.sales)).toFixed(1), `${Math.min(...ss.map((x) => x.squadMin))}–${Math.max(...ss.map((x) => x.squadMax))}`, `${money(median(ss.map((x) => x.balanceStart)))} → ${money(median(ss.map((x) => x.balanceEnd)))}`, `${money(median(ss.map((x) => x.balanceEnd - x.balanceStart)))} vs ${money(median(ss.map((x) => x.aiBalanceChange)))}`, pct(ss.filter((x) => x.balanceEnd < 0).length, ss.length), `${avg(ss.map((x) => x.posStart ?? 0)).toFixed(1)} → ${avg(ss.map((x) => x.posEnd ?? 0)).toFixed(1)}`, rows.reduce((n, m) => n + m.sacked, 0), rows.reduce((n, m) => n + m.unemployedSeasons, 0)]));
  }
  L.push("", `Squad average age: ${avg(managers.map((m) => m.avgAgeStart)).toFixed(1)} at the start, ${avg(managers.filter((m) => m.avgAgeEnd).map((m) => m.avgAgeEnd)).toFixed(1)} at the end.`, "");
  const tally = (pick: (m: ManagerResult) => Record<string, number>) => {
    const t: Record<string, number> = {};
    for (const m of managers) for (const [k, v] of Object.entries(pick(m))) t[k] = (t[k] ?? 0) + v;
    return Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} (${v})`).join("; ") || "none";
  };
  L.push(`Failed bids: ${tally((m) => m.bidFails)}.`, "", `Failed sales: ${tally((m) => m.saleFails)}.`, "");

  L.push("## Manager board", "", row(["Tier", "Seasons", "League target met", "Cup target met", "Youth debuts met", "Wage cap met", "Ultimatums", "Sacked in season", "Sacked at the review", "Seasons with no signing", "Bids blocked by the cap", "Wage bill / cap at the window (median)", "Prospects promoted / season"]), rule(13));
  for (const [tier, rows] of group(managers, (m) => m.tier)) {
    const ss = rows.flatMap((m) => m.seasons);
    const met = (k: string) => {
      const v = ss.filter((x) => k in x.objectives);
      return pct(v.filter((x) => x.objectives[k]).length, v.length);
    };
    const bids = ss.reduce((n, x) => n + x.bids, 0);
    L.push(row([tier, ss.length, met("league"), met("cup"), met("youth"), met("wages"), pct(ss.filter((x) => x.ultimatum).length, ss.length), rows.reduce((n, m) => n + m.sackedInSeason, 0), rows.reduce((n, m) => n + m.sackedByBoard, 0), pct(ss.filter((x) => x.signings === 0).length, ss.length), pct(ss.reduce((n, x) => n + x.capBlocked, 0), bids), `${(median(ss.map((x) => x.billShare)) * 100).toFixed(0)}%`, avg(ss.map((x) => x.promoted)).toFixed(1)]));
  }
  const ai = managers.flatMap((m) => m.aiChanges);
  if (ai.length) L.push("", `AI managers (English pyramid around the user's club): ${(avg(ai.map((a) => a.inSeason / a.clubs)) * 100).toFixed(1)}% of clubs change manager during a season and ${(avg(ai.map((a) => a.summer / a.clubs)) * 100).toFixed(1)}% over the summer (${ai.length} seasons).`);
  L.push("");

  const reg = seasonsAll.filter((r) => r.cohort !== "youth");
  L.push("## Injury and recovery choices", "", "Each career follows one policy for every moderate-or-worse injury (serious ones: rush → conservative, plan and rest → surgery, clinic → clinic when affordable). Youth careers are left out.", "");
  L.push(row(["Policy", "Careers", "Seasons", "Big injuries / season", "Weeks out per big injury", "Injured again within 10 weeks of the return", "Weeks injured / season", "Same-area re-injuries per big injury", "Apps / season", "Overall change over the run", "Career threats", "Retired through injury"]), rule(12));
  for (const pol of RECOVERIES) {
    const rows = reg.filter((r) => r.recovery === pol);
    const careers = players.filter((r) => r.recovery === pol && r.cohort !== "youth");
    const big = rows.reduce((n, r) => n + r.bigInjuries, 0);
    const delta = careers.filter((r) => r.seasons.length >= 2).map((r) => (r.seasons.at(-1) as SeasonRec).ovr - r.seasons[0].ovr);
    const eps = careers.flatMap((r) => r.episodes);
    L.push(row([pol, careers.length, rows.length, avg(rows.map((r) => r.bigInjuries)).toFixed(2), `${avg(eps.map((e) => e.weeksOut)).toFixed(1)} (${eps.length})`, pct(eps.filter((e) => e.again).length, eps.length), avg(rows.map((r) => r.weeksOut)).toFixed(1), big ? (rows.reduce((n, r) => n + r.reinjuries, 0) / big).toFixed(2) : "–", avg(rows.map((r) => r.apps)).toFixed(1), avg(delta).toFixed(1), careers.reduce((n, r) => n + r.careerThreats, 0), careers.filter((r) => r.injuryRetired).length]));
  }
  L.push("");

  const dr = players.flatMap((r) => r.dramas);
  const proSeasons = seasonsAll.filter((r) => r.cohort !== "youth");
  L.push("## Off-pitch drama", "", `${dr.length} stories in ${proSeasons.length} senior player-seasons: ${(dr.length / Math.max(1, proSeasons.length)).toFixed(2)} a season; ${pct(proSeasons.filter((r) => r.dramas > 0).length, proSeasons.length)} of seasons have at least one. Choices are random.`, "");
  L.push(row(["Cohort", "Seasons", "Stories / season", "Stand-off", "Cliques", "Fall-out", "Captaincy"]), rule(7));
  for (const [c, rows] of group(proSeasons, (r) => r.cohort)) {
    const mine = dr.filter((d) => d.cohort === c);
    const k = (kind: string) => mine.filter((d) => d.kind === kind).length;
    L.push(row([c, rows.length, (mine.length / Math.max(1, rows.length)).toFixed(2), k("standoff"), k("clique"), k("fallout"), k("captaincy")]));
  }
  L.push("", row(["Story", "First choice", "Outcomes"]), rule(3));
  for (const [key, rows] of group(dr, (d) => `${d.kind}|${d.choice}`).sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const [kind, choice] = key.split("|");
    L.push(row([kind, choice, group(rows, (d) => d.outcome).sort((a, b) => b[1].length - a[1].length).map(([o, xs]) => `${o} (${xs.length})`).join(", ")]));
  }
  L.push("");

  L.push("## Transfer drama", "", row(["Cohort", "Seasons", "Bidding wars / season", "Deadline-day bids / season", "Leaks (asks careers)", "Leak → improved contract"]), rule(6));
  for (const [c, rows] of group(seasonsAll, (r) => r.cohort)) {
    const leaks = rows.reduce((n, r) => n + r.leaks, 0);
    L.push(row([c, rows.length, avg(rows.map((r) => r.wars)).toFixed(2), avg(rows.map((r) => r.deadlineBids)).toFixed(2), leaks, pct(rows.reduce((n, r) => n + r.leaksWorked, 0), leaks)]));
  }
  L.push("");

  const yr = players.filter((r) => r.youth);
  if (yr.length) {
    L.push("## Youth start (age 15)", "", `${yr.length} careers; half go on every trial they are offered and take a trial club over the academy when they can.`, "");
    L.push(row(["Trials", "Careers", "Invitations", "Went", "Impressed", "Offers at 17", "Signed with", "A season later", "Overall at 17", "Senior minutes at 17", "Senior minutes at 18"]), rule(11));
    for (const go of [true, false]) {
      const rows = yr.filter((r) => ((r.youth as YouthRec).went > 0) === go);
      const ys = rows.map((r) => r.youth as YouthRec);
      const tally2 = (f: (y: YouthRec) => string) => group(ys, f).map(([k, v]) => `${k || "–"} ${v.length}`).join(", ");
      L.push(row([go ? "went" : "stayed / none", rows.length, avg(ys.map((y) => y.invited)).toFixed(1), avg(ys.map((y) => y.went)).toFixed(1), avg(ys.map((y) => y.impressed)).toFixed(1), tally2((y) => y.offers), tally2((y) => y.outcome), tally2((y) => y.clubAfter), avg(ys.map((y) => y.ovr17)).toFixed(1), median(ys.map((y) => y.minutes17)), median(ys.map((y) => y.minutes18))]));
    }
    L.push("");
  }

  const late = players.filter((r) => r.cohort === "late-starter" || r.cohort === "late-abroad");
  L.push("## Late starters: first-team football", "", row(["Start club", "Careers", "Apps season 1 (median)", "Minutes season 1 (median)", "No apps in season 1", "Apps season 2 (median)", "Weeks to the first appearance (median)"]), rule(7));
  for (const [club, rows] of group(late, (r) => r.startClub).sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const s1 = rows.map((r) => r.seasons[0]).filter(Boolean);
    const s2 = rows.map((r) => r.seasons[1]).filter(Boolean);
    const firsts = rows.map((r) => r.firstAppWeek ?? 999);
    L.push(row([club, rows.length, median(s1.map((x) => x.apps)), median(s1.map((x) => x.minutes)), pct(s1.filter((x) => x.apps === 0).length, s1.length), median(s2.map((x) => x.apps)), median(firsts) === 999 ? "never" : median(firsts)]));
  }
  L.push("");
  return L.join("\n");
}

// ------------------------------------------------------------------------------------------------ main

type Msg = { ok: true; kind: "player"; r: PlayerResult } | { ok: true; kind: "manager"; r: ManagerResult } | { ok: false; error: string };

if (!isMainThread) {
  const { jobs, seasons } = workerData as { jobs: Job[]; seasons: number };
  for (const job of jobs) {
    try {
      const msg: Msg = job.type === "player" ? { ok: true, kind: "player", r: runPlayer(job, seasons) } : { ok: true, kind: "manager", r: runManager(job, seasons) };
      parentPort?.postMessage(msg);
    } catch (err) {
      parentPort?.postMessage({ ok: false, error: `${job.type} ${job.index}: ${String((err as Error).stack ?? err)}` } satisfies Msg);
    }
  }
} else {
  const seeds = Number(arg("seeds", "4"));
  // --only players|managers and --cohorts a,b narrow a run while tuning one system.
  const only = arg("only", "");
  const cohortFilter = arg("cohorts", "").split(",").filter(Boolean);
  const seasons = Number(arg("seasons", "5"));
  const perTier = Number(arg("managers", "4"));
  const jobs: Job[] = [
    ...(only === "players" ? [] : Object.entries(MANAGER_CLUBS).flatMap(([tier, clubs]) => Array.from({ length: perTier }, (_, index) => ({ type: "manager" as const, tier, clubId: clubs[index % clubs.length], index })))),
    ...(only === "managers" ? [] : COHORTS.filter((c) => !cohortFilter.length || cohortFilter.includes(c.name)).flatMap((cohort) => POSITIONS.flatMap((position) => Array.from({ length: seeds }, (_, index) => ({ type: "player" as const, cohort, position, index }))))),
  ];
  const workers = Math.min(Number(arg("workers", String(Math.max(1, availableParallelism() - 1)))), jobs.length);
  const players: PlayerResult[] = [];
  const managers: ManagerResult[] = [];
  const errors: string[] = [];
  const t0 = Date.now();
  let done = 0;
  await Promise.all(
    Array.from({ length: workers }, (_, w) =>
      new Promise<void>((resolve) => {
        const mine = jobs.filter((_, i) => i % workers === w);
        const worker = new Worker(new URL(import.meta.url), { workerData: { jobs: mine, seasons }, execArgv: ["--import", "tsx"] });
        worker.on("message", (msg: Msg) => {
          done++;
          if (msg.ok && msg.kind === "player") players.push(msg.r);
          else if (msg.ok && msg.kind === "manager") managers.push(msg.r);
          else if (!msg.ok) errors.push(msg.error);
          if (done % Math.max(1, Math.floor(jobs.length / 10)) === 0) process.stdout.write(`  ${done}/${jobs.length} careers (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
        });
        worker.on("exit", () => resolve());
        worker.on("error", (e) => {
          errors.push(`worker ${w}: ${String(e)}`);
          resolve();
        });
      }),
    ),
  );
  const report = summarize(players, managers, { seasons, seconds: (Date.now() - t0) / 1000 });
  mkdirSync(join(process.cwd(), "data", "reports"), { recursive: true });
  if (!only && !cohortFilter.length) writeFileSync(join(process.cwd(), "data", "reports", `systems-${players.length + managers.length}x${seasons}.md`), report);
  console.log(report);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  }
}
