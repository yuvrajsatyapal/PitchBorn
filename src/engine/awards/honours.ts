import { ageOf } from "../players/generate";
import type { GameState } from "../types";
import { userPlayer } from "../world/helpers";

const LABEL: [string, string][] = [
  ["pots", "Player of the Season"],
  ["topscorer", "Golden Boot"],
  ["topassist", "Playmaker Award"],
  ["goldenglove", "Goalkeeper of the Season"],
  ["ypots", "Young Player of the Season"],
  ["breakthrough", "Breakthrough Player"],
  ["tots", "Team of the Season"],
];

export interface Honour {
  id: string;
  name: string;
  count: number;
}

/** The user's season honours, counted from the career's own award history. */
export function careerHonours(state: GameState): Honour[] {
  return LABEL.map(([id, name]) => ({ id, name, count: state.user.awards.filter((a) => a.id === id).length })).filter((h) => h.count > 0);
}

function longestRun(seasons: number[]): number {
  const s = [...new Set(seasons)].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  for (let i = 0; i < s.length; i++) {
    run = i > 0 && s[i] === s[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

/** Stories the honours tell: the tally, a dominant peak, a late-career award, a record-setting run. */
export function honourStories(state: GameState): string[] {
  const honours = careerHonours(state);
  if (!honours.length) return [];
  const out: string[] = [];
  const me = userPlayer(state);
  const tally = honours.filter((h) => h.id !== "breakthrough").map((h) => `${h.count}× ${h.name}`).join(", ");
  out.push(`Career honours — ${tally}.`);
  const pots = state.user.awards.filter((a) => a.id === "pots");
  const run = longestRun(pots.map((a) => a.season));
  if (run >= 3) out.push(`Dominant Peak — ${run} Player of the Season awards in a row.`);
  else if (pots.length >= 3) out.push(`Dominant Peak — ${pots.length} Player of the Season awards, the best of their generation.`);
  const major = state.user.awards.filter((a) => ["pots", "topscorer", "goldenglove"].includes(a.id));
  const late = major.find((a) => ageOf(me, a.season) >= 33);
  if (late) out.push(`Late-career honour — still collecting ${late.name} at ${ageOf(me, late.season)}.`);
  const tots = honours.find((h) => h.id === "tots");
  if (tots && tots.count >= 6) out.push(`Mr Consistent — named in the Team of the Season ${tots.count} times.`);
  const held = state.records.filter((r) => r.playerId === state.user.playerId && r.id.startsWith("award-"));
  if (held.length) out.push(`Record-setter — ${held.map((r) => r.label.toLowerCase()).join(" and ")}.`);
  return out;
}
