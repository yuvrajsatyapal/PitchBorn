/**
 * Times server-side renders of the heaviest play pages against a saved long career, to find render hot spots.
 *
 *   BENCH_OUT=/tmp/long.json npx tsx scripts/sim/ui-bench.ts 15   # writes the career
 *   npx tsx scripts/sim/render-bench.tsx /tmp/long.json        # BENCH_PAGES=dashboard,club to pick pages
 */
import { readFileSync } from "node:fs";
import { createElement, type ComponentType } from "react";
import { renderToString } from "react-dom/server";
import type { GameState } from "@/engine/types";
import { useGame } from "@/game/store";

const file = process.argv[2];
const g = JSON.parse(readFileSync(file, "utf8")) as GameState;
// Server renders read the store's initial state object, so load the career into that.
Object.assign(useGame.getInitialState(), { game: g, version: 1 });

const pages: [string, () => Promise<{ default: ComponentType }>][] = [
  ["dashboard", () => import("@/app/play/page")],
  ["stats", () => import("@/app/play/stats/page")],
  ["profile", () => import("@/app/play/profile/page")],
  ["history", () => import("@/app/play/history/page")],
  ["club", () => import("@/app/play/club/page")],
  ["league", () => import("@/app/play/league/page")],
  ["schedule", () => import("@/app/play/schedule/page")],
  ["world", () => import("@/app/play/world/page")],
  ["lifestyle", () => import("@/app/play/lifestyle/page")],
];
async function main(): Promise<void> {
const only = process.env.BENCH_PAGES?.split(",");
for (const [name, load] of pages) {
  if (only && !only.includes(name)) continue;
  const Page = (await load()).default;
  const times: number[] = [];
  let size = 0;
  for (let i = 0; i < 8; i++) {
    const t = performance.now();
    size = renderToString(createElement(Page)).length;
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  console.log(`${name.padEnd(10)} ${times[4].toFixed(1).padStart(7)} ms  (${(size / 1024).toFixed(0)} KB html)`);
}
}
void main();
