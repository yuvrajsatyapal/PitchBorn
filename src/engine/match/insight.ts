/**
 * Reads of a player's match for the screen: which numbers to show for his position, how he is doing, why he may be quiet, what the
 * manager asked of him, why his rating is what it is, and the summary at full time. Everything is derived from what the engine
 * counted (see `Involvement` and `PlayerLine`); nothing is drawn and nothing is invented. Pure functions: no state, no randomness.
 */
import type { PlayerLine, RatingReason } from "./engine";
import type { FlowContext } from "./moments";
import type { Position } from "../types";

export type PositionGroup = "GK" | "DEF" | "FB" | "MID" | "ATT";

export function groupOf(slot: Position): PositionGroup {
  if (slot === "GK") return "GK";
  if (slot === "CB") return "DEF";
  if (slot === "RB" || slot === "LB") return "FB";
  if (slot === "DM" || slot === "CM" || slot === "AM") return "MID";
  return "ATT";
}

export function minutesOf(line: PlayerLine, now: number): number {
  if (line.minuteOn < 0) return 0;
  return Math.max(0, (line.minuteOff ?? now) - line.minuteOn);
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const frac = (a: number, b: number) => `${a}/${b}`;

export interface StatCell {
  label: string;
  /** A shorter name for tight spaces. */
  short?: string;
  value: string;
  /** A second, smaller figure (e.g. an accuracy). */
  sub?: string;
}

/**
 * The figures that matter for a position, from what the engine counts. The short list is for the card; the full one for the stats tab.
 * Anything the engine does not track is simply absent.
 */
export function statCells(line: PlayerLine, now: number, full = false): StatCell[] {
  const iv = line.inv;
  if (!iv) return [];
  const mins = minutesOf(line, now);
  const passes: StatCell = { label: "Passes", value: frac(iv.passesOk, iv.passes), sub: iv.passes ? `${pct(iv.passesOk, iv.passes)}%` : undefined };
  const touches: StatCell = { label: "Touches", value: String(iv.touches) };
  const duels: StatCell = { label: "Duels won", short: "Duels", value: frac(iv.duelsWon, iv.duels) };
  const aerials: StatCell = { label: "Aerials won", short: "Aerials", value: frac(iv.aerialsWon, iv.aerials) };
  const lost: StatCell = { label: "Possession lost", short: "Lost ball", value: String(iv.possLost) };
  const g = groupOf(line.slot);
  let cells: StatCell[];
  if (g === "ATT") {
    cells = [
      touches,
      passes,
      { label: "Shots", value: String(line.shots), sub: line.shots ? `${line.onTarget} on target` : undefined },
      { label: "xG", value: iv.xg.toFixed(2) },
      { label: "Dribbles won", short: "Dribbles", value: frac(iv.dribblesWon, iv.dribbles) },
      { label: "Chances created", short: "Chances", value: String(line.keyPasses) },
    ];
    if (full) cells.push({ label: "Goals", value: String(line.goals) }, { label: "Assists", value: String(line.assists) }, duels, lost, { label: "Box touches", value: String(iv.boxTouches) });
  } else if (g === "MID") {
    cells = [
      touches,
      passes,
      { label: "Chances created", short: "Chances", value: String(line.keyPasses) },
      { label: "Recoveries", value: String(iv.recoveries) },
      duels,
      lost,
    ];
    if (full) cells.push({ label: "Interceptions", value: String(iv.interceptions) }, { label: "Tackles", value: String(line.tackles) }, { label: "Dribbles won", value: frac(iv.dribblesWon, iv.dribbles) }, { label: "Goals", value: String(line.goals) }, { label: "Assists", value: String(line.assists) });
  } else if (g === "FB") {
    cells = [
      touches,
      passes,
      { label: "Crosses", value: frac(iv.crossesOk, iv.crosses) },
      { label: "Tackles", value: String(line.tackles) },
      { label: "Recoveries", value: String(iv.recoveries) },
      duels,
    ];
    if (full) cells.push({ label: "Interceptions", value: String(iv.interceptions) }, { label: "Clearances", value: String(iv.clearances) }, { label: "Dribbles won", value: frac(iv.dribblesWon, iv.dribbles) }, { label: "Chances created", value: String(line.keyPasses) }, lost);
  } else if (g === "DEF") {
    cells = [
      passes,
      { label: "Tackles", value: String(line.tackles) },
      { label: "Interceptions", short: "Intercepts", value: String(iv.interceptions) },
      { label: "Clearances", value: String(iv.clearances) },
      duels,
      aerials,
    ];
    if (full) cells.push(touches, { label: "Recoveries", value: String(iv.recoveries) }, { label: "Errors", value: String(iv.errors) }, lost);
  } else {
    cells = [
      { label: "Saves", value: String(line.saves) },
      { label: "Conceded", value: String(line.conceded) },
      { label: "xG faced", value: (line.xgFaced ?? 0).toFixed(2) },
      { label: "Claims", value: String(iv.claims) },
      { label: "Distribution", value: frac(iv.passesOk, iv.passes), sub: iv.passes ? `${pct(iv.passesOk, iv.passes)}%` : undefined },
      { label: "1v1 saves", value: String(Math.round(line.acts?.save1v1 ?? 0)) },
    ];
    if (full) cells.push(touches, { label: "Errors", value: String(iv.errors) });
  }
  if (full) cells.unshift({ label: "Minutes", value: String(mins) });
  return cells;
}

// ───────────────────────────── rating visibility and trend

/** No appearance, no rating; and not a figure for a player who has barely touched the match. */
export function ratingVisible(line: PlayerLine | undefined, now: number, finished: boolean): boolean {
  if (!line || line.minuteOn < 0) return false;
  if (finished) return true;
  const mins = minutesOf(line, now);
  const iv = line.inv;
  const actions = iv ? iv.touches + line.shots + line.tackles + iv.recoveries : 0;
  return mins >= 10 || actions >= 5 || line.goals + line.assists > 0;
}

// ───────────────────────────── how he is doing

/** About how many touches a player at each position has in a full match (from the match calibration). */
const TYPICAL_TOUCHES: Record<Position, number> = { GK: 33, CB: 20, RB: 20, LB: 20, DM: 28, CM: 34, AM: 29, RW: 22, LW: 22, ST: 16 };

export type Tone = "good" | "neutral" | "bad";
export interface Performance {
  label: string;
  tone: Tone;
}

/** Share of the touches a player at his position usually has by this point of the match (1 = typical). */
function involvement(line: PlayerLine, now: number): number | undefined {
  const mins = minutesOf(line, now);
  if (!line.inv || mins < 12) return undefined;
  return line.inv.touches / Math.max(1, (TYPICAL_TOUCHES[line.slot] * mins) / 90);
}

export function performance(line: PlayerLine, now: number, ctx?: FlowContext): Performance {
  const iv = line.inv;
  const mins = minutesOf(line, now);
  if (!iv || mins < 8) return { label: "Settling in", tone: "neutral" };
  const g = groupOf(line.slot);
  const r = line.rating;
  const defensive = iv.interceptions + iv.clearances + line.tackles + iv.duelsWon;
  const attacking = line.shots + line.keyPasses + iv.dribblesWon + line.goals + line.assists;
  if (r >= 7.8 || line.goals + line.assists >= 2) return { label: "Excellent impact", tone: "good" };
  if (iv.possLost >= 6 && iv.passes >= 8 && iv.passesOk / iv.passes < 0.7) return { label: "Under pressure", tone: "bad" };
  if (mins < 20 && r > 4.8) return { label: "Settling in", tone: "neutral" };
  if (r <= 5.3) return { label: "Struggling", tone: "bad" };
  if (g === "ATT" || line.slot === "AM") {
    if (attacking >= 4 && r >= 6.4) return { label: "Dangerous going forward", tone: "good" };
  } else if (g !== "GK" && defensive >= 6 && iv.possLost <= 4) return { label: "Strong defensively", tone: "good" };
  if (g === "GK" && line.saves >= 3 && r >= 6.4) return { label: "Commanding in goal", tone: "good" };
  if (r >= 7) return { label: "Playing well", tone: "good" };
  const inv = involvement(line, now);
  if (inv !== undefined && inv < 0.55) return { label: ctx && ctx.possession < 45 ? "Struggling for involvement" : "Quiet so far", tone: "neutral" };
  if (ctx?.ratingTrend !== undefined && ctx.ratingTrend >= 0.3 && r >= 6.2) return { label: "Growing into the game", tone: "good" };
  if (r < 6) return { label: "Not at his best", tone: "bad" };
  return { label: "Solid so far", tone: "neutral" };
}

/** Why the ball is not coming to him, only when the counted match supports it. */
export function lowInvolvementReason(line: PlayerLine, now: number, ctx?: FlowContext): string | undefined {
  const inv = involvement(line, now);
  const iv = line.inv;
  if (inv === undefined || !iv || !ctx || inv >= 0.7) return undefined;
  if (iv.possLost >= 4 && iv.passes >= 6 && iv.passesOk / iv.passes < 0.7) return "You're being closed down quickly.";
  if (ctx.possession < 42) return `Your team has only ${ctx.possession}% possession.`;
  if (ctx.attacks >= 10 && ctx.laneShare !== undefined && ctx.laneShare < 0.22) {
    const [l, c, r] = ctx.flanks;
    const best = Math.max(l, c, r);
    const where = best === l ? "left" : best === r ? "right" : "through the middle";
    return best === (ctx.lane === "left" ? l : ctx.lane === "right" ? r : c) ? undefined : `Most attacks are going ${where === "through the middle" ? where : `down the ${where}`}.`;
  }
  if (ctx.recentPossession !== undefined && ctx.recentPossession < 38) return "Your side has barely had the ball in the last few minutes.";
  return undefined;
}

// ───────────────────────────── manager instruction

export interface Instruction {
  title: string;
  detail: string;
  progress: string;
  /** 0..1+ — how far along the instruction is, against what a full match would ask. */
  score: number;
}

const clampScore = (x: number) => Math.max(0, Math.min(1.5, x));

/** What the manager asked of this position, and how it is going: only things the engine counts. */
export function instruction(line: PlayerLine, now: number, ctx?: FlowContext): Instruction | undefined {
  const iv = line.inv;
  if (!iv) return undefined;
  const mins = minutesOf(line, now);
  // A cameo is asked for less than a full match.
  const k = Math.max(0.35, Math.min(1, mins / 90));
  const trailing = ctx ? ctx.goalsFor < ctx.goalsAgainst : false;
  const leading = ctx ? ctx.goalsFor > ctx.goalsAgainst : false;
  const rate = (a: number, b: number, target: number) => (b > 0 ? Math.min(1, a / b / target) : 0);
  switch (line.slot) {
    case "RW":
    case "LW":
      return {
        title: "Attack the full-back",
        detail: trailing ? "We need goals: take him on and get at the line." : "Isolate him and run at him.",
        progress: iv.dribbles ? `${frac(iv.dribblesWon, iv.dribbles)} successful dribbles` : "No dribbles yet",
        score: iv.dribbles ? clampScore((iv.dribblesWon / (2 * k)) * rate(iv.dribblesWon, iv.dribbles, 0.5)) : 0,
      };
    case "ST":
      return {
        title: "Attack the box",
        detail: trailing ? "Get on the end of everything." : "Be in the area when it arrives.",
        progress: `${iv.boxTouches} box touches · ${line.shots} shots`,
        score: clampScore((iv.boxTouches / (3 * k) + line.shots / (2 * k)) / 2),
      };
    case "AM":
      return {
        title: "Create for the others",
        detail: "Find the pockets of space and pick the pass.",
        progress: `${line.keyPasses} chances created · ${iv.touches} touches`,
        score: clampScore(line.keyPasses / (2 * k)),
      };
    case "CM":
      return {
        title: "Keep possession moving",
        detail: leading ? "Control the tempo." : "Keep the ball and move them around.",
        progress: `${frac(iv.passesOk, iv.passes)} passes`,
        score: clampScore(Math.min(1, iv.passes / (15 * k)) * rate(iv.passesOk, iv.passes, 0.85)),
      };
    case "DM":
      return {
        title: "Protect the defence",
        detail: leading ? "Sit in front of the back four." : "Win it back early and screen the back line.",
        progress: `${iv.recoveries} recoveries · ${iv.interceptions} interceptions`,
        score: clampScore(iv.recoveries / (5 * k)),
      };
    case "CB": {
      const won = iv.duelsWon + iv.aerialsWon;
      const total = iv.duels + iv.aerials;
      return {
        title: "Win your duels",
        detail: "Be first to the ball, on the ground and in the air.",
        progress: `${frac(won, total)} duels`,
        score: clampScore(Math.min(1, total / (4 * k)) * rate(won, total, 0.6)),
      };
    }
    case "RB":
    case "LB":
      return {
        title: "Support the flank",
        detail: trailing ? "Get forward and put the ball in." : "Give the winger width, then get back.",
        progress: `${iv.crosses} crosses · ${iv.recoveries} recoveries`,
        score: clampScore((iv.crosses / (2 * k) + iv.recoveries / (3 * k)) / 2),
      };
    case "GK":
      return {
        title: "Distribute safely",
        detail: "Start moves from the back without gambling.",
        progress: `${frac(iv.passesOk, iv.passes)} passes`,
        score: clampScore(Math.min(1, iv.passes / (10 * k)) * rate(iv.passesOk, iv.passes, 0.75)),
      };
  }
}

export type InstructionResult = "met" | "partly" | "missed" | "none";

export function instructionResult(line: PlayerLine, now: number): InstructionResult {
  if (!line.inv || minutesOf(line, now) < 20) return "none";
  const i = instruction(line, now);
  if (!i) return "none";
  return i.score >= 1 ? "met" : i.score >= 0.5 ? "partly" : "missed";
}

// ───────────────────────────── why the rating is what it is

export interface RatingReasonLine {
  text: string;
  delta: number;
}

/** The kinds of action behind a rating, worded from the counts that produced them. */
export function ratingReasons(line: PlayerLine): { good: RatingReasonLine[]; bad: RatingReasonLine[] } {
  const iv = line.inv;
  const why = line.why ?? {};
  const label = (r: RatingReason, d: number): string | undefined => {
    switch (r) {
      case "goal": return line.goals ? `${line.goals} goal${line.goals > 1 ? "s" : ""}` : undefined;
      case "assist": return line.assists ? `${line.assists} assist${line.assists > 1 ? "s" : ""}` : undefined;
      case "chance": return line.keyPasses ? `${line.keyPasses} chance${line.keyPasses > 1 ? "s" : ""} created` : undefined;
      case "shot": return line.onTarget ? `${line.onTarget} shot${line.onTarget > 1 ? "s" : ""} on target` : undefined;
      case "save": return d >= 0 ? (line.saves ? `${line.saves} save${line.saves > 1 ? "s" : ""}` : "Kept the goal safe") : "Let in more than expected";
      case "cleanSheet": return "Clean sheet";
      case "defence": return iv ? `${iv.interceptions + iv.clearances + line.tackles} defensive actions` : undefined;
      case "duel": return iv && iv.duels ? `${d >= 0 ? "Won" : "Lost"} ground duels (${frac(iv.duelsWon, iv.duels)})` : undefined;
      case "dribble": return iv && iv.dribbles ? `Dribbling ${frac(iv.dribblesWon, iv.dribbles)}` : undefined;
      case "pass": return iv && iv.passes ? (d >= 0 ? `Accurate passing (${frac(iv.passesOk, iv.passes)})` : `Lost possession ${iv.possLost} time${iv.possLost > 1 ? "s" : ""}`) : undefined;
      case "cross": return iv && iv.crosses ? `Crossing ${frac(iv.crossesOk, iv.crosses)}` : undefined;
      case "aerial": return iv && iv.aerials ? `Aerial duels ${frac(iv.aerialsWon, iv.aerials)}` : undefined;
      case "missed": return "Missed a big chance";
      case "error": return "A costly error";
      case "card": return line.red ? "Sent off" : line.yellow ? "Booked" : "Fouls";
      case "conceded": return line.conceded ? `${line.conceded} goal${line.conceded > 1 ? "s" : ""} conceded` : undefined;
      case "decision": return d >= 0 ? "Good choices at key moments" : "Key-moment choices that went wrong";
      default: return undefined;
    }
  };
  const good: RatingReasonLine[] = [];
  const bad: RatingReasonLine[] = [];
  for (const k of Object.keys(why) as RatingReason[]) {
    const d = why[k] ?? 0;
    if (Math.abs(d) < 0.05) continue;
    const text = label(k, d);
    if (!text) continue;
    (d > 0 ? good : bad).push({ text, delta: d });
  }
  good.sort((a, b) => b.delta - a.delta);
  bad.sort((a, b) => a.delta - b.delta);
  return { good: good.slice(0, 4), bad: bad.slice(0, 4) };
}

// ───────────────────────────── full time

export interface PostMatch {
  rating: number;
  minutes: number;
  headline: string[];
  wentWell: string[];
  improve: string[];
  instruction?: { title: string; result: InstructionResult; progress: string };
  manager: string;
}

/** The player's match in a few lines, from his counts. The manager's words come from his rating, role and instruction. */
export function postMatch(line: PlayerLine, now: number, won: boolean | null): PostMatch {
  const iv = line.inv;
  const mins = minutesOf(line, now);
  const headline: string[] = [];
  if (line.goals) headline.push(`${line.goals} goal${line.goals > 1 ? "s" : ""}`);
  if (line.assists) headline.push(`${line.assists} assist${line.assists > 1 ? "s" : ""}`);
  if (line.keyPasses) headline.push(`${line.keyPasses} chance${line.keyPasses > 1 ? "s" : ""} created`);
  if (iv?.dribbles) headline.push(`${frac(iv.dribblesWon, iv.dribbles)} dribbles`);
  if (iv && iv.duels + iv.aerials > 0) headline.push(`${frac(iv.duelsWon + iv.aerialsWon, iv.duels + iv.aerials)} duels`);
  if (line.slot === "GK") headline.push(`${line.saves} save${line.saves === 1 ? "" : "s"}`);
  else if (line.tackles) headline.push(`${line.tackles} tackle${line.tackles > 1 ? "s" : ""}`);
  if (iv && iv.passes >= 10) headline.push(`${frac(iv.passesOk, iv.passes)} passes`);
  const well: string[] = [];
  const bad: string[] = [];
  if (iv) {
    if (line.keyPasses >= 2) well.push(`Created ${line.keyPasses} dangerous chances`);
    if (iv.dribbles >= 3 && iv.dribblesWon / iv.dribbles >= 0.6) well.push("Beat your marker consistently");
    if (iv.recoveries >= 6) well.push(`Worked hard defensively: ${iv.recoveries} recoveries`);
    if (iv.interceptions >= 3) well.push(`Read the game well: ${iv.interceptions} interceptions`);
    if (iv.duels + iv.aerials >= 4 && (iv.duelsWon + iv.aerialsWon) / (iv.duels + iv.aerials) >= 0.65) well.push(`Won ${iv.duelsWon + iv.aerialsWon} of ${iv.duels + iv.aerials} duels`);
    if (iv.clearances >= 4) well.push(`Cleared the danger ${iv.clearances} times`);
    if (iv.passes >= 25 && iv.passesOk / iv.passes >= 0.88) well.push(`Kept the ball moving: ${frac(iv.passesOk, iv.passes)} passes`);
    if (line.slot === "GK" && line.saves >= 3) well.push(`Made ${line.saves} saves`);
    if (line.conceded === 0 && mins >= 60 && ["GK", "CB", "RB", "LB", "DM"].includes(line.slot)) well.push("Kept a clean sheet");
    if (iv.possLost >= 6) bad.push(`Lost possession ${iv.possLost} times`);
    if (iv.crosses >= 3 && iv.crossesOk / iv.crosses < 0.34) bad.push(`Only ${frac(iv.crossesOk, iv.crosses)} crosses found a teammate`);
    if (iv.duels >= 4 && iv.duelsWon / iv.duels < 0.4) bad.push(`Beaten in ${iv.duels - iv.duelsWon} of ${iv.duels} duels`);
    if (iv.passes >= 15 && iv.passesOk / iv.passes < 0.7) bad.push(`Passing was loose: ${frac(iv.passesOk, iv.passes)}`);
    if (iv.errors >= 1) bad.push(line.slot === "ST" || line.slot === "AM" || line.slot === "RW" || line.slot === "LW" ? "Wasted a big chance" : "Made a costly error");
  }
  if (line.goals) well.unshift(line.goals > 1 ? `Scored ${line.goals} goals` : "Got on the scoresheet");
  if (line.assists) well.push(`Set up ${line.assists > 1 ? `${line.assists} goals` : "a goal"}`);
  if (line.red) bad.unshift("Sent off");
  else if (line.yellow) bad.push("Picked up a booking");
  const inst = iv ? instruction(line, now) : undefined;
  const result = iv ? instructionResult(line, now) : "none";
  const r = line.rating;
  const cameo = !line.started && mins < 45;
  let manager: string;
  if (mins <= 0) manager = "Stay ready. Your chance will come.";
  else if (cameo && r >= 6.8) manager = "Good impact after coming on.";
  else if (cameo) manager = r >= 6 ? "Thanks for coming on and keeping it tidy." : "Not the cameo I wanted.";
  else if (r >= 7.8) manager = "Outstanding. That's the standard I want.";
  else if (r >= 7) manager = result === "met" && inst ? `Really good. You did exactly what I asked: ${inst.title.toLowerCase()}.` : "A really good performance.";
  else if (r >= 6.4) manager = result === "missed" && inst ? `Solid, but I wanted more on ${inst.title.toLowerCase()}.` : "Solid. Nothing to complain about.";
  else if (r >= 5.8) manager = won === false ? "A quiet night when we needed more from you." : "Quiet. I need more from you.";
  else manager = "That wasn't good enough. Work on it this week.";
  return {
    rating: r,
    minutes: mins,
    headline: headline.slice(0, 6),
    wentWell: well.slice(0, 3),
    improve: bad.slice(0, 3),
    instruction: inst && result !== "none" ? { title: inst.title, result, progress: inst.progress } : undefined,
    manager,
  };
}
