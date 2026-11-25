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
 * Writes data/reports/systems-<careers>x<seasons>.md and prints it. Nothing about the player is edited.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { generateAppearance } from "../../src/engine/appearance/generate.ts";
import { BALANCE } from "../../src/engine/balance.ts";
import { autopilotStep } from "../../src/engine/career/autopilot.ts";
import { acceptCoachOffer, coaching, startCoaching } from "../../src/engine/career/coaching.ts";
import { bidForPlayer, managerBudget, managerNeeds, managing, marketOpen, reportsLeft, salePrice, scoutPlayer, scoutTargets, sellPlayer } from "../../src/engine/career/coachMarket.ts";
import { buyItem, canBuy, invest, LIFESTYLE, netWorth, priceLevel, quote, weeklyUpkeep, type LifestyleKind } from "../../src/engine/career/lifestyle.ts";
import { askForDuty, canAskForDuty, holdsDuty, setPieceState } from "../../src/engine/career/setPieces.ts";
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
const COHORTS: Cohort[] = [
  { name: "academy", path: "academy", clubs: ["eng-arsenal", "eng-chelsea", "eng-man-united", "eng-aston-villa"] },
  { name: "late-starter", path: "late", clubs: ["eng-millwall", "eng-reading", "eng-stockport-county", "eng-wycombe"] },
  { name: "established", path: "custom", custom: { age: 25, overall: 79, potential: 83 }, clubs: ["eng-aston-villa", "eng-brighton", "eng-newcastle-united", "eng-west-ham-united"] },
  { name: "star", path: "custom", custom: { age: 24, overall: 85, potential: 90 }, clubs: ["eng-arsenal", "eng-liverpool", "eng-man-city", "eng-chelsea"] },
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

function world(seed: string, clubId: string, position: Position, path: StartPath, custom?: CustomStart): GameState {
  return createWorld({ saveName: "sim", firstName: "Sim", lastName: "Player", nationality: "ENG", birthCountry: "ENG", position, foot: "R", height: 181, look: generateAppearance(seed), clubId, path, custom, seed, countries: ["ENG"] });
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
  const seed = `sim-systems:${cohort.name}:${position}:${index}`;
  const s = world(seed, cohort.clubs[index % cohort.clubs.length], position, cohort.path, cohort.custom);
  const rng = Rng.fromSeed(`${seed}:pilot`);
  const wage0 = s.players[s.user.playerId].contract?.wage ?? 0;
  const res: PlayerResult = { cohort: cohort.name, position, policy, flatWeeksAtStart: wage0 ? quote(s, "flat").price / wage0 : Infinity, seasons: [], investments: [], startups: { won: 0, lost: 0 } };
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
    advanceTurn(s);
    const fresh = s.news.slice(newsBefore).map((n) => n.title);
    forced += fresh.filter((x) => x.includes("can't keep up the payments")).length;
    res.startups.won += fresh.filter((x) => x.includes("start-up stake pays off")).length;
    res.startups.lost += fresh.filter((x) => x.includes("start-up stake goes under")).length;
    for (const h of s.user.lifestyle?.investments ?? []) {
      const v = before.get(h.id);
      if (v !== undefined && v !== h.value) res.investments.push({ kind: h.kind, ret: h.value / v - 1 });
    }
    if (!wasInjured && p.injury) injuries++;
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
      });
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
}
interface ManagerResult {
  tier: string;
  seasons: ManagerSeason[];
  sacked: number;
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
  c.offers.push({ id: "co-sim", clubId: job.clubId, role: "manager", expiresIndex: s.turnIndex + 4, note: "" });
  acceptCoachOffer(s, "co-sim");
  const res: ManagerResult = { tier: job.tier, seasons: [], sacked: 0, unemployedSeasons: 0, bidFails: {}, saleFails: {}, avgAgeStart: avgAge(s, job.clubId), avgAgeEnd: 0 };
  let cur: ManagerSeason | undefined;
  let aiBefore = new Map<string, number>();
  let aiLeague = "";
  const begin = () => {
    const club = managing(s);
    aiLeague = club?.leagueId ?? aiLeague;
    aiBefore = aiLeague ? leagueBalances(s, aiLeague, club?.id) : new Map();
    cur = { tier: job.tier, aiBalanceChange: 0, budgetAtWindow: club ? managerBudget(s) : 0, balanceStart: club?.balance ?? 0, balanceEnd: 0, signings: 0, spent: 0, sales: 0, income: 0, squadMin: club?.squad.length ?? 0, squadMax: club?.squad.length ?? 0, expectation: club?.expectation };
  };
  begin();
  for (let t = 0; t < CAL.turnsPerSeason * seasons; t++) {
    const co = coaching(s);
    if (co && !co.clubId) {
      const o = co.offers.find((x) => x.role === "manager") ?? co.offers[0];
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
        if (r.ok) {
          cur.signings++;
          cur.spent += pick.asking;
        } else res.bidFails[reasonKey(r.reason)] = (res.bidFails[reasonKey(r.reason)] ?? 0) + 1;
      }
    }
    if (club && cur) {
      cur.squadMin = Math.min(cur.squadMin, club.squad.length);
      cur.squadMax = Math.max(cur.squadMax, club.squad.length);
      if (s.turn === CAL.seasonStart + 1) cur.posStart = leaguePos(s, club.id);
    }
    const wasSacked = (c.stints.filter((x) => x.reason === "sacked").length);
    advanceTurn(s);
    res.sacked += c.stints.filter((x) => x.reason === "sacked").length - wasSacked;
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
  const seasons = Number(arg("seasons", "5"));
  const perTier = Number(arg("managers", "4"));
  const jobs: Job[] = [
    ...Object.entries(MANAGER_CLUBS).flatMap(([tier, clubs]) => Array.from({ length: perTier }, (_, index) => ({ type: "manager" as const, tier, clubId: clubs[index % clubs.length], index }))),
    ...COHORTS.flatMap((cohort) => POSITIONS.flatMap((position) => Array.from({ length: seeds }, (_, index) => ({ type: "player" as const, cohort, position, index })))),
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
  writeFileSync(join(process.cwd(), "data", "reports", `systems-${players.length + managers.length}x${seasons}.md`), report);
  console.log(report);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  }
}
