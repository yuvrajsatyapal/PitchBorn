/**
 * Career stress simulator.
 *
 *   npm run sim:careers -- --count 100 --workers 8 [--full] [--seasons 26]
 *
 * Runs N complete careers in parallel worker threads with the autopilot
 * policy and writes data/reports/sim-<N>.json + .md with balancing metrics.
 * `--full` simulates all five countries (slow); default simulates only the
 * career's country ("lite" world) which keeps 1,000-career runs practical.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { runCareer, type CareerMetrics } from "./run-career.ts";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

if (!isMainThread) {
  const { seeds, lite, seasons } = workerData as { seeds: string[]; lite: boolean; seasons: number };
  for (const seed of seeds) {
    try {
      parentPort?.postMessage({ ok: true, m: runCareer(seed, { lite, maxSeasons: seasons }) });
    } catch (err) {
      parentPort?.postMessage({ ok: false, seed, error: String((err as Error).stack ?? err) });
    }
  }
} else {
  const count = Number(arg("count", "10"));
  const workers = Math.min(Number(arg("workers", String(Math.max(1, availableParallelism() - 1)))), count);
  const lite = !process.argv.includes("--full");
  const seasons = Number(arg("seasons", "26"));
  const prefix = arg("seed", "stress");
  const seeds = Array.from({ length: count }, (_, i) => `${prefix}-${i}`);
  const results: CareerMetrics[] = [];
  const errors: { seed: string; error: string }[] = [];
  const t0 = Date.now();
  let done = 0;
  await Promise.all(
    Array.from({ length: workers }, (_, w) =>
      new Promise<void>((resolve) => {
        const mine = seeds.filter((_, i) => i % workers === w);
        const worker = new Worker(new URL(import.meta.url), { workerData: { seeds: mine, lite, seasons }, execArgv: ["--import", "tsx"] });
        worker.on("message", (msg: { ok: boolean; m?: CareerMetrics; seed?: string; error?: string }) => {
          done++;
          if (msg.ok && msg.m) results.push(msg.m);
          else errors.push({ seed: msg.seed ?? "?", error: msg.error ?? "" });
          if (done % Math.max(1, Math.floor(count / 20)) === 0) process.stdout.write(`  ${done}/${count} careers (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
        });
        worker.on("exit", () => resolve());
        worker.on("error", (e) => {
          errors.push({ seed: `worker-${w}`, error: String(e) });
          resolve();
        });
      }),
    ),
  );
  const report = summarize(results, errors, { count, lite, seconds: (Date.now() - t0) / 1000 });
  mkdirSync(join(process.cwd(), "data", "reports"), { recursive: true });
  writeFileSync(join(process.cwd(), "data", "reports", `sim-${count}.json`), JSON.stringify({ results, errors }, null, 1));
  writeFileSync(join(process.cwd(), "data", "reports", `sim-${count}.md`), report);
  console.log(report);
  if (errors.length) process.exitCode = 1;
}

function pct(xs: number[], q: number): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))];
}
function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function summarize(r: CareerMetrics[], errors: { seed: string; error: string }[], meta: { count: number; lite: boolean; seconds: number }): string {
  const row = (label: string, xs: number[], digits = 1) =>
    `| ${label} | ${mean(xs).toFixed(digits)} | ${pct(xs, 0.1).toFixed(digits)} | ${pct(xs, 0.5).toFixed(digits)} | ${pct(xs, 0.9).toFixed(digits)} | ${Math.max(0, ...xs).toFixed(digits)} |`;
  const tiers = new Map<string, number>();
  for (const c of r) tiers.set(c.tier, (tiers.get(c.tier) ?? 0) + 1);
  const stories = new Map<string, number>();
  for (const c of r) for (const s of c.stories) {
    const k = s.split(" — ")[0];
    stories.set(k, (stories.get(k) ?? 0) + 1);
  }
  const flags: string[] = [];
  const gpm = mean(r.map((c) => c.world.goalsPerMatch));
  if (gpm < 2.2 || gpm > 3.3) flags.push(`League goals per match ${gpm.toFixed(2)} outside 2.2–3.3`);
  if (Math.max(0, ...r.map((c) => c.world.maxGoalsInMatch)) > 13) flags.push("A league match had more than 13 goals");
  if (Math.max(0, ...r.map((c) => c.world.maxTopScorer)) > 55) flags.push("A league top scorer exceeded 55 goals");
  const superstar = r.filter((c) => c.peakOverall >= 90).length / Math.max(1, r.length);
  if (superstar > 0.25) flags.push(`${(superstar * 100).toFixed(0)}% of careers peak at 90+ (too many superstars)`);
  const injuryRate = mean(r.map((c) => c.injuries / Math.max(1, c.seasons)));
  if (injuryRate > 2.2) flags.push(`Injury rate ${injuryRate.toFixed(2)} per season is high`);
  const earlyRetire = r.filter((c) => c.retireAge < 30).length / Math.max(1, r.length);
  if (earlyRetire > 0.15) flags.push(`${(earlyRetire * 100).toFixed(0)}% retired before 30`);
  if (r.some((c) => c.invariantIssues > 0)) flags.push(`${r.filter((c) => c.invariantIssues > 0).length} careers hit invariant issues`);
  const maxBal = Math.max(0, ...r.map((c) => c.world.maxClubBalance));
  if (maxBal > 3e9) flags.push(`Runaway club balance (${(maxBal / 1e9).toFixed(1)}B)`);
  return [
    `# Career stress simulation — ${meta.count} careers`,
    ``,
    `World: ${meta.lite ? "lite (career country only)" : "full (5 countries)"} · ${meta.seconds.toFixed(0)}s · ${errors.length} errors`,
    ``,
    `| Metric | Mean | P10 | Median | P90 | Max |`,
    `|---|---|---|---|---|---|`,
    row("Seasons played", r.map((c) => c.seasons)),
    row("Retirement age", r.map((c) => c.retireAge)),
    row("Appearances", r.map((c) => c.apps), 0),
    row("Goals", r.map((c) => c.goals), 0),
    row("Assists", r.map((c) => c.assists), 0),
    row("Best season goals", r.map((c) => c.maxSeasonGoals), 0),
    row("Potential (hidden)", r.map((c) => c.potential), 0),
    row("Peak overall", r.map((c) => c.peakOverall), 0),
    row("Peak age", r.map((c) => c.peakAge)),
    row("Clubs", r.map((c) => c.clubs)),
    row("Trophies", r.map((c) => c.trophies)),
    row("Major awards", r.map((c) => c.majorAwards)),
    row("International caps", r.map((c) => c.caps), 0),
    row("Injuries per season", r.map((c) => c.injuries / Math.max(1, c.seasons)), 2),
    row("Serious injuries", r.map((c) => c.seriousInjuries)),
    row("Legacy score", r.map((c) => c.legacy), 0),
    row("World goals/match", r.map((c) => c.world.goalsPerMatch), 2),
    row("World home win %", r.map((c) => c.world.homeWinPct * 100), 1),
    row("World draw %", r.map((c) => c.world.drawPct * 100), 1),
    row("Max goals in a match", r.map((c) => c.world.maxGoalsInMatch), 0),
    row("Max league top scorer", r.map((c) => c.world.maxTopScorer), 0),
    row("World player count", r.map((c) => c.world.players), 0),
    row("Max club balance (M)", r.map((c) => c.world.maxClubBalance / 1e6), 0),
    row("Min club balance (M)", r.map((c) => c.world.minClubBalance / 1e6), 0),
    row("Career sim seconds", r.map((c) => c.ms / 1000), 1),
    ``,
    `## Legacy tiers`,
    ...[...tiers.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `- ${t}: ${n}`),
    ``,
    `## Emergent stories`,
    ...[...stories.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `- ${t}: ${n}`),
    ``,
    `## Balance flags`,
    ...(flags.length ? flags.map((f) => `- ⚠ ${f}`) : ["- none"]),
    ``,
    ...(errors.length ? ["## Errors", ...errors.slice(0, 10).map((e) => `- ${e.seed}: ${e.error.split("\n")[0]}`)] : []),
  ].join("\n");
}
