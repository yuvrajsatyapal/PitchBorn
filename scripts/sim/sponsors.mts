/**
 * Sponsor balance simulator: season targets and the form clause in realistic careers.
 *
 *   npm run sim:sponsors -- [--seeds 5] [--seasons 5] [--workers 8]
 *
 * Plays careers with the game's own autopilot and accepts every sponsor offer (renewals first), so deals and form
 * clauses only arise where the player genuinely qualifies; nothing about the player is edited. Three cohorts start the
 * way a player can: late starters in the lower divisions, and Custom starts as an established pro (25, overall 79) at
 * mid-table Premier League clubs and as a star (24, overall 85) at the top clubs. Every position is covered, `--seeds`
 * careers each. Writes data/reports/sponsors-<careers>x<seasons>.md and prints it.
 *
 * Note: a player with several sponsors has one target per deal, so a season can count more than once in the tables.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { generateAppearance } from "../../src/engine/appearance/generate.ts";
import { BALANCE } from "../../src/engine/balance.ts";
import { autopilotStep } from "../../src/engine/career/autopilot.ts";
import { acceptSponsorOffer, brandOf, commercialAppeal, seasonCount, sponsorState } from "../../src/engine/career/sponsors.ts";
import { Rng } from "../../src/engine/rng.ts";
import { advanceTurn } from "../../src/engine/season/advance.ts";
import type { Position } from "../../src/engine/types.ts";
import { createWorld, type CustomStart, type StartPath } from "../../src/engine/world/create.ts";

interface Cohort {
  name: string;
  path: StartPath;
  custom?: CustomStart;
  clubs: string[];
}

const POSITIONS: Position[] = ["ST", "LW", "AM", "CM", "DM", "CB", "RB", "GK"];
const COHORTS: Cohort[] = [
  { name: "late-starter", path: "late", clubs: ["eng-southampton", "eng-millwall", "eng-reading", "eng-burnley"] },
  { name: "established", path: "custom", custom: { age: 25, overall: 79, potential: 83 }, clubs: ["eng-aston-villa", "eng-brighton", "eng-newcastle-united", "eng-west-ham-united"] },
  { name: "star", path: "custom", custom: { age: 24, overall: 85, potential: 90 }, clubs: ["eng-arsenal", "eng-liverpool", "eng-man-city", "eng-chelsea"] },
];
const SP = BALANCE.sponsors;
const CAL = BALANCE.calendar;

interface Job {
  cohort: Cohort;
  position: Position;
  index: number;
}
interface TargetRec {
  cohort: string;
  position: string;
  role: string;
  kind: string;
  need: number;
  done: number;
  status: string;
  clause: boolean;
}
interface DealRec {
  cohort: string;
  position: string;
  brand: string;
  minAppeal: number;
  appealAtSign: number;
  clause: boolean;
  signedTurnIndex: number;
  end?: "renewed" | "form-clause" | "expired" | "retired" | "running";
  warned?: boolean;
  recoveredAfterWarning?: boolean;
  firstPoorIndex?: number;
  endIndex?: number;
  formAtEnd?: number;
  roleAtEnd?: string;
}
interface CareerRec {
  cohort: string;
  position: string;
  seasonsPlayed: number;
  maxAppeal: number;
}
interface Result {
  targets: TargetRec[];
  deals: DealRec[];
  career: CareerRec;
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function runJob(job: Job, seasons: number): Result {
  const { cohort, position, index } = job;
  const seed = `sim-sponsors:${cohort.name}:${position}:${index}`;
  const s = createWorld({
    saveName: "sim",
    firstName: "Sim",
    lastName: "Player",
    nationality: "ENG",
    birthCountry: "ENG",
    position,
    foot: "R",
    height: 181,
    look: generateAppearance(seed),
    clubId: cohort.clubs[index % cohort.clubs.length],
    path: cohort.path,
    custom: cohort.custom,
    seed,
    countries: ["ENG"],
  });
  const rng = Rng.fromSeed(`${seed}:pilot`);
  const targets: TargetRec[] = [];
  const deals: DealRec[] = [];
  const live = new Map<string, DealRec>();
  const seenTargets = new Set<object>();
  let maxAppeal = 0;
  const startSeason = s.season;

  for (let t = 0; t < CAL.turnsPerSeason * seasons && !s.user.retired; t++) {
    autopilotStep(s, rng);
    const st = sponsorState(s);
    for (const o of [...st.offers].sort((a, b) => Number(!!b.renewsDealId) - Number(!!a.renewsDealId))) {
      const brand = brandOf(o.brandId);
      const appeal = commercialAppeal(s);
      if (!brand || !/Signed/.test(acceptSponsorOffer(s, o.id))) continue;
      const old = o.renewsDealId ? live.get(o.renewsDealId) : undefined;
      if (old && o.renewsDealId) {
        old.end = "renewed";
        live.delete(o.renewsDealId);
      }
      const rec: DealRec = { cohort: cohort.name, position, brand: brand.id, minAppeal: brand.minAppeal, appealAtSign: appeal, clause: !!o.formClause, signedTurnIndex: s.turnIndex };
      deals.push(rec);
      live.set(o.id, rec);
    }

    const newsBefore = s.news.length;
    advanceTurn(s);
    maxAppeal = Math.max(maxAppeal, commercialAppeal(s));
    const p = s.players[s.user.playerId];
    const fresh = s.news.slice(newsBefore).map((n) => n.title);
    const now = sponsorState(s).deals;
    for (const d of now) {
      const rec = live.get(d.id);
      if (!rec) continue;
      const poor = d.poorWeeks ?? 0;
      if (poor === 1 && rec.firstPoorIndex === undefined) rec.firstPoorIndex = s.turnIndex;
      if (poor >= SP.warnWeeks) rec.warned = true;
      if (rec.warned && poor === 0) rec.recoveredAfterWarning = true;
      if (poor === 0 && !rec.warned) rec.firstPoorIndex = undefined;
      const tg = d.target;
      if (tg && tg.status !== "open" && !seenTargets.has(tg)) {
        seenTargets.add(tg);
        const done = Math.max(0, seasonCount(p, tg.kind) - tg.baseline);
        targets.push({ cohort: cohort.name, position, role: p.contract?.role ?? "none", kind: tg.kind, need: tg.need, done: tg.status === "met" ? tg.need : done, status: tg.status, clause: !!d.formClause });
      }
    }
    for (const [id, rec] of [...live]) {
      if (now.some((d) => d.id === id)) continue;
      const name = brandOf(rec.brand)?.name ?? rec.brand;
      rec.end = fresh.includes(`${name} ends your deal`) ? "form-clause" : s.user.retired ? "retired" : "expired";
      rec.endIndex = s.turnIndex;
      rec.formAtEnd = Math.round(p.form * 100) / 100;
      rec.roleAtEnd = p.contract?.role ?? "none";
      live.delete(id);
    }
  }
  for (const rec of live.values()) rec.end ??= "running";
  return { targets, deals, career: { cohort: cohort.name, position, seasonsPlayed: s.season - startSeason, maxAppeal } };
}

// ------------------------------------------------------------------------------------------------ report

const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(0)}%` : "–");
function group<T>(rows: T[], key: (r: T) => string): Record<string, T[]> {
  const m: Record<string, T[]> = {};
  for (const r of rows) (m[key(r)] ??= []).push(r);
  return m;
}
const row = (cells: (string | number)[]) => `| ${cells.join(" | ")} |`;
const rule = (n: number) => row(Array.from({ length: n }, () => "---"));

function targetTable(title: string, groups: [string, TargetRec[]][]): string[] {
  const out = [row([title, "Targets", "Hit", "Missed but ≥75%", "Missed with 0", "Avg need"]), rule(6)];
  for (const [name, rows] of groups) {
    const met = rows.filter((r) => r.status === "met").length;
    const near = rows.filter((r) => r.status === "missed" && r.done >= r.need * 0.75).length;
    const zero = rows.filter((r) => r.status === "missed" && r.done === 0).length;
    const avg = rows.reduce((s, r) => s + r.need, 0) / Math.max(1, rows.length);
    out.push(row([name, rows.length, pct(met, rows.length), pct(near, rows.length), pct(zero, rows.length), avg.toFixed(1)]));
  }
  return out;
}

function summarize(results: Result[], meta: { seasons: number; seconds: number }): string {
  const targets = results.flatMap((r) => r.targets);
  const deals = results.flatMap((r) => r.deals);
  const careers = results.map((r) => r.career);
  const L: string[] = [];
  L.push(`# Sponsor simulation: ${careers.length} careers × ${meta.seasons} seasons`, "");
  L.push(`${careers.reduce((s, c) => s + c.seasonsPlayed, 0)} career-seasons, ${deals.length} deals signed, ${targets.length} settled season targets (${meta.seconds.toFixed(0)}s). Every offer accepted; autopilot plays.`, "");

  L.push("## Eligibility", "", row(["Cohort", "Careers", "Reached appeal 40+", "Deals", "With form clause", "Without"]), rule(6));
  for (const [c, rows] of Object.entries(group(careers, (r) => r.cohort))) {
    const d = deals.filter((x) => x.cohort === c);
    L.push(row([c, rows.length, rows.filter((r) => r.maxAppeal >= 40).length, d.length, d.filter((x) => x.clause).length, d.filter((x) => !x.clause).length]));
  }
  L.push("", `Clause deals from brands below appeal ${SP.formClauseAppeal}: ${deals.filter((d) => d.clause && d.minAppeal < SP.formClauseAppeal).length}. Clause deals signed while the player's appeal was under ${SP.formClauseAppeal} (renewals after a dip): ${deals.filter((d) => d.clause && d.appealAtSign < SP.formClauseAppeal).length}.`, "");

  L.push("## Season targets", "");
  L.push(...targetTable("All", [["all", targets]]), "");
  L.push(...targetTable("Cohort", Object.entries(group(targets, (r) => r.cohort))), "");
  const byPos = group(targets, (r) => r.position);
  L.push(...targetTable("Position", POSITIONS.map((p) => [`${p} (${byPos[p]?.[0]?.kind ?? "-"})`, byPos[p] ?? []] as [string, TargetRec[]])), "");
  const byRole = group(targets, (r) => r.role);
  L.push(...targetTable("Squad role", ["star", "first", "rotation", "backup", "prospect"].map((r) => [r, byRole[r] ?? []] as [string, TargetRec[]])), "");
  L.push(...targetTable("Deal", [["with form clause", targets.filter((t) => t.clause)], ["without", targets.filter((t) => !t.clause)]]), "");

  const cd = deals.filter((d) => d.clause);
  const term = cd.filter((d) => d.end === "form-clause");
  const dealSeasons = cd.reduce((s, d) => s + ((d.endIndex ?? d.signedTurnIndex + CAL.turnsPerSeason) - d.signedTurnIndex) / CAL.turnsPerSeason, 0);
  L.push("## Form clause", "", row(["Clause deals", "Deal-seasons", "Warned", "Recovered after a warning", "Terminated", "Per deal-season"]), rule(6));
  L.push(row([cd.length, dealSeasons.toFixed(0), cd.filter((d) => d.warned).length, cd.filter((d) => d.recoveredAfterWarning).length, term.length, (term.length / Math.max(1, dealSeasons)).toFixed(3)]), "");
  L.push(`How clause deals ended: ${Object.entries(group(cd, (d) => d.end ?? "running")).map(([k, v]) => `${k} ${v.length}`).join(", ")}.`, "");
  if (term.length) {
    const weeks = term.filter((d) => d.firstPoorIndex !== undefined && d.endIndex !== undefined).map((d) => (d.endIndex as number) - (d.firstPoorIndex as number));
    L.push(`Calendar weeks from the first poor week to termination: avg ${(weeks.reduce((s, w) => s + w, 0) / Math.max(1, weeks.length)).toFixed(1)}, min ${Math.min(...weeks)}, max ${Math.max(...weeks)} (${SP.dropWeeks} played poor weeks are needed).`, "");
    for (const d of term) L.push(`- ${d.cohort} ${d.position}, ${d.brand}: form ${d.formAtEnd}, role ${d.roleAtEnd}`);
    L.push("");
  }
  L.push(`Clause deals by position: ${Object.entries(group(cd, (d) => d.position)).map(([k, v]) => `${k} ${v.length} (${v.filter((d) => d.end === "form-clause").length} ended)`).join(", ")}.`, "");
  L.push(`All deals ended: ${Object.entries(group(deals, (d) => d.end ?? "running")).map(([k, v]) => `${k} ${v.length}`).join(", ")}.`, "");
  L.push("Note: a player with several sponsors has one target per deal, so a season can count more than once.", "");
  return L.join("\n");
}

// ------------------------------------------------------------------------------------------------ main

if (!isMainThread) {
  const { jobs, seasons } = workerData as { jobs: Job[]; seasons: number };
  for (const job of jobs) {
    try {
      parentPort?.postMessage({ ok: true, r: runJob(job, seasons) });
    } catch (err) {
      parentPort?.postMessage({ ok: false, error: `${job.cohort.name} ${job.position} ${job.index}: ${String((err as Error).stack ?? err)}` });
    }
  }
} else {
  const seeds = Number(arg("seeds", "5"));
  const seasons = Number(arg("seasons", "5"));
  const jobs: Job[] = COHORTS.flatMap((cohort) => POSITIONS.flatMap((position) => Array.from({ length: seeds }, (_, index) => ({ cohort, position, index }))));
  const workers = Math.min(Number(arg("workers", String(Math.max(1, availableParallelism() - 1)))), jobs.length);
  const results: Result[] = [];
  const errors: string[] = [];
  const t0 = Date.now();
  let done = 0;
  await Promise.all(
    Array.from({ length: workers }, (_, w) =>
      new Promise<void>((resolve) => {
        const mine = jobs.filter((_, i) => i % workers === w);
        const worker = new Worker(new URL(import.meta.url), { workerData: { jobs: mine, seasons }, execArgv: ["--import", "tsx"] });
        worker.on("message", (msg: { ok: boolean; r?: Result; error?: string }) => {
          done++;
          if (msg.ok && msg.r) results.push(msg.r);
          else errors.push(msg.error ?? "unknown error");
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
  const report = summarize(results, { seasons, seconds: (Date.now() - t0) / 1000 });
  mkdirSync(join(process.cwd(), "data", "reports"), { recursive: true });
  writeFileSync(join(process.cwd(), "data", "reports", `sponsors-${jobs.length}x${seasons}.md`), report);
  console.log(report);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  }
}
