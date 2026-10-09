/**
 * "What kind of footballer is this?" — built from the player's actual traits, statistics, attributes
 * and career. Used on the profile, in the retirement documentary and in legacy stories.
 * No random labels: every phrase is earned by something in the record.
 */
import { overallFor } from "../players/attributes";
import type { GameState, OwnedTrait, Player, Position, TraitStage } from "../types";
import { favours, focusOf, focusStrength, NO_FOCUS, type FocusDef } from "../players/focus";
import { STAGE_LABEL, stageOf } from "./effects";
import { TRAIT_BY_ID } from "./registry";
import type { TraitCategory, TraitDef } from "./types";

export interface TraitRow {
  def: TraitDef;
  xp: number;
  stage: TraitStage;
}

export interface TraitGroups {
  style: TraitRow[];
  mindBody: TraitRow[];
  personality: TraitRow[];
  flaws: TraitRow[];
}

const rank = (r: TraitRow) => r.xp;

/** A player's traits grouped for display, strongest first. */
export function groupTraits(p: Pick<Player, "traits">): TraitGroups {
  const g: TraitGroups = { style: [], mindBody: [], personality: [], flaws: [] };
  for (const t of p.traits ?? []) {
    const def = TRAIT_BY_ID.get(t.id);
    const stage = stageOf(t.xp);
    if (!def || !stage) continue;
    const row = { def, xp: t.xp, stage };
    if (def.flaw) g.flaws.push(row);
    else if (def.category === "playstyle" || def.category === "technical") g.style.push(row);
    else if (def.category === "mental" || def.category === "physical") g.mindBody.push(row);
    else g.personality.push(row);
  }
  for (const k of Object.keys(g) as (keyof TraitGroups)[]) g[k].sort((a, b) => rank(b) - rank(a));
  return g;
}

const POSITION_TAG: Record<Position, string> = { GK: "GK", CB: "CB", RB: "FB", LB: "FB", DM: "DM", CM: "CM", AM: "AM", RW: "W", LW: "W", ST: "ST" };
const TAG_ORDER = ["GK", "CB", "FB", "DM", "CM", "AM", "W", "ST"];

/** Where a trait mostly belongs ("ST · W"), or nothing when it fits any outfield player (or any player). */
export function positionTag(def: Pick<TraitDef, "positions">): string {
  if (def.positions.length >= 8) return "";
  const tags = new Set(def.positions.map((p) => POSITION_TAG[p]));
  return TAG_ORDER.filter((t) => tags.has(t)).join(" · ");
}

export const CATEGORY_LABEL: Record<TraitCategory, string> = { playstyle: "Playstyle", technical: "Technical", mental: "Mental", physical: "Physical", personality: "Personality" };

const POSITION_NOUN: Record<Position, string> = {
  GK: "goalkeeper", CB: "centre-back", RB: "full-back", LB: "full-back", DM: "holding midfielder", CM: "midfielder", AM: "attacking midfielder", RW: "winger", LW: "winger", ST: "striker",
};

function outputAdjective(p: Player): string {
  const c = p.career;
  const apps = Math.max(1, c.apps);
  const gpg = c.goals / apps;
  const apg = c.assists / apps;
  const csr = c.cleanSheets / apps;
  switch (p.position) {
    case "ST": return gpg >= 0.6 ? "prolific" : gpg >= 0.42 ? "clinical" : gpg >= 0.28 ? "reliable" : "hard-working";
    case "RW": case "LW": return gpg + apg >= 0.65 ? "devastating" : gpg + apg >= 0.45 ? "dangerous" : "tireless";
    case "AM": return gpg + apg >= 0.6 ? "decisive" : apg >= 0.25 ? "creative" : "intelligent";
    case "CM": return apg >= 0.2 ? "creative" : gpg >= 0.15 ? "driving" : "tireless";
    case "DM": return csr >= 0.35 ? "commanding" : "combative";
    case "GK": return csr >= 0.34 ? "commanding" : csr >= 0.26 ? "dependable" : "gutsy";
    default: return csr >= 0.34 ? "commanding" : csr >= 0.26 ? "dependable" : "committed";
  }
}

function standing(peak: number): string {
  return peak >= 90 ? "world-class" : peak >= 84 ? "outstanding" : peak >= 77 ? "high-quality" : "honest";
}

export interface Identity {
  /** "devastating inside forward" */
  label: string;
  /** One sentence per defining feature. */
  lines: string[];
  /** Traits that define the player (strongest first). */
  traits: string[];
}

/** The player's footballing identity. Works at any stage of a career; richest at retirement. */
export function identityOf(state: GameState, p: Player): Identity {
  const g = groupTraits(p);
  const lead = g.style.find((r) => r.def.role) ?? g.style[0];
  const noun = lead?.def.role ?? POSITION_NOUN[p.position];
  const adj = outputAdjective(p);
  const peak = state.user.peakOverall || overallFor(p.attrs, p.position);
  const label = lead && lead.stage !== "emerging" ? `${adj} ${noun}` : `${adj} ${POSITION_NOUN[p.position]}`;
  const lines: string[] = [];
  const first = g.style.slice(0, 3);
  for (const r of first) lines.push(`${STAGE_LABEL[r.stage]} ${r.def.name}: ${r.def.blurb.split(":")[0].replace(/\.$/, "")}.`);
  if (!first.length) lines.push(`A ${standing(peak)} ${POSITION_NOUN[p.position]} who never settled into one defining style.`);
  const mind = [...g.mindBody, ...g.personality].slice(0, 3).map((r) => r.def.name);
  if (mind.length) lines.push(`Off the ball and off the pitch: ${mind.join(", ")}.`);
  if (g.flaws.length) lines.push(`Never quite shook off: ${g.flaws.map((r) => r.def.name).join(", ")}.`);
  const evolved = state.user.traitLog.filter((e) => e.kind === "evolved");
  for (const e of evolved.slice(-2)) {
    const to = TRAIT_BY_ID.get(e.id);
    const from = e.from ? TRAIT_BY_ID.get(e.from) : undefined;
    if (to) lines.push(`Reinvented your game in ${e.season}/${String((e.season + 1) % 100).padStart(2, "0")}${from ? `, as ${from.name} gave way to ${to.name}` : `, becoming a ${to.name}`}.`);
  }
  return { label, lines, traits: [...g.style, ...g.mindBody, ...g.personality, ...g.flaws].map((r) => r.def.id).slice(0, 8) };
}

/** Short form for the dashboard: the one or two traits that best sum the player up. */
export function headlineTraits(p: Pick<Player, "traits">, n = 2): TraitRow[] {
  return groupTraits(p).style.slice(0, n);
}

export const rowOf = (t: OwnedTrait): TraitRow | null => {
  const def = TRAIT_BY_ID.get(t.id);
  const stage = stageOf(t.xp);
  return def && stage ? { def, xp: t.xp, stage } : null;
};

// ─────────────────────────────────────────────────────────────── aspiration vs. what the career shows

export type FocusVerdict = "open" | "early" | "aligned" | "mixed" | "diverged";
export type FocusInfluence = "shaping" | "fading" | "settled";

export interface FocusReading {
  focus: FocusDef;
  influence: FocusInfluence;
  verdict: FocusVerdict;
  /** The traits the career has actually produced, strongest first (playing style, then mind and body). */
  current: TraitRow[];
}

/** How the player's aspiration compares with the habits his career has produced. A reading of the record, never an input to it. */
export function focusReading(p: Pick<Player, "traits" | "position" | "focus" | "birthYear" | "career">, season: number): FocusReading {
  const focus = focusOf(p);
  const strength = focusStrength(p, season);
  const g = groupTraits(p);
  const current = [...g.style, ...g.mindBody];
  const matching = current.filter((r) => favours(p.focus, r.def.id)).length;
  const verdict: FocusVerdict = focus.id === NO_FOCUS ? "open" : !current.length ? "early" : matching * 2 >= current.length ? "aligned" : matching > 0 ? "mixed" : "diverged";
  return { focus, influence: strength >= 0.5 ? "shaping" : strength >= 0.12 ? "fading" : "settled", verdict, current };
}
