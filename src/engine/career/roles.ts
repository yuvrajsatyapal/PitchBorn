/**
 * Tactical roles for the user's player, agreed with the manager: inverted full-back, false nine, box-to-box and the
 * rest. A role reshapes where the player's involvement comes from in the match engine (through the same `MatchFx`
 * hook traits use, so a role is never "free" quality: it shifts preferences, and its few effect terms scale with the
 * attributes it relies on), and it moves selection a little by how well it suits the player and the club's style.
 */
import { overallFor } from "../players/attributes";
import { clamp } from "../rng";
import type { MatchFx } from "../traits/types";
import { ADDITIVE_FX } from "../traits/types";
import type { AttrKey, ClubState, GameState, Player, Position } from "../types";
import { addNews, userPlayer } from "../world/helpers";
import { adjustRel } from "./relationships";

export interface RoleDef {
  id: string;
  name: string;
  positions: readonly Position[];
  blurb: string;
  /** Attributes the role relies on (their average is the fit). */
  attrs: readonly AttrKey[];
  fx: MatchFx;
  /** Club style the role suits (0–1 each); absent means it suits any style. */
  style?: Partial<ClubState["style"]>;
}

const FB = ["RB", "LB"] as const;
const W = ["RW", "LW"] as const;

export const ROLES: RoleDef[] = [
  { id: "sweeper-keeper", name: "Sweeper keeper", positions: ["GK"], blurb: "Starts high and sweeps up balls in behind.", attrs: ["command", "kicking", "acceleration", "anticipation"], fx: { againstFreq1v1: 0.9, againstXgLong: 1.04, claim: 0.98 }, style: { pressing: 0.7 } },
  { id: "shot-stopper", name: "Shot stopper", positions: ["GK"], blurb: "Stays on the line and lives on reflexes.", attrs: ["reflexes", "diving", "handling"], fx: { save: 0.97, againstFreq1v1: 1.05 } },
  { id: "ball-playing", name: "Ball-playing defender", positions: ["CB"], blurb: "Steps into midfield and breaks lines with passes.", attrs: ["passing", "vision", "composure", "firstTouch"], fx: { create: 1.4, createThrough: 1.3, tackle: 0.92, teamMid: 0.004 }, style: { tempo: 0.6, directness: 0.4 } },
  { id: "stopper", name: "Stopper", positions: ["CB"], blurb: "Steps out aggressively to win the ball early.", attrs: ["tackling", "strength", "aggression", "anticipation"], fx: { tackle: 1.3, intercept: 1.15, foul: 1.15, againstXgOpen: 0.985 }, style: { pressing: 0.7 } },
  { id: "overlapping", name: "Overlapping full-back", positions: FB, blurb: "Bombs on outside the winger and crosses.", attrs: ["crossing", "stamina", "pace", "workRate"], fx: { createCross: 1.5, create: 1.15, drain: 1.06, tackle: 0.95 }, style: { directness: 0.6 } },
  { id: "inverted", name: "Inverted full-back", positions: FB, blurb: "Tucks into midfield to add a passer in possession.", attrs: ["passing", "vision", "positioning", "decisions"], fx: { create: 1.2, createOpen: 1.3, createCross: 0.6, teamMid: 0.006 }, style: { tempo: 0.4, directness: 0.3 } },
  { id: "defensive-fb", name: "Defensive full-back", positions: FB, blurb: "Stays home and locks down the flank.", attrs: ["tackling", "marking", "positioning", "strength"], fx: { tackle: 1.2, intercept: 1.1, create: 0.8, againstFreqHeader: 0.97 } },
  { id: "anchor", name: "Anchor", positions: ["DM"], blurb: "Screens the back four and never strays.", attrs: ["positioning", "interceptions", "anticipation", "strength"], fx: { intercept: 1.4, tackle: 1.15, create: 0.85, teamDef: 0.006 } },
  { id: "regista", name: "Deep-lying playmaker", positions: ["DM", "CM"], blurb: "Dictates the tempo from deep.", attrs: ["passing", "vision", "technique", "composure"], fx: { create: 1.3, createThrough: 1.5, tackle: 0.9, teamMid: 0.004 }, style: { tempo: 0.4 } },
  { id: "box-to-box", name: "Box-to-box", positions: ["CM"], blurb: "Gets up and down: arrives in the box and wins it back.", attrs: ["stamina", "workRate", "offBall", "tackling"], fx: { shoot: 1.25, tackle: 1.15, freqLong: 0.004, drain: 1.08 }, style: { pressing: 0.6, tempo: 0.6 } },
  { id: "ball-winner", name: "Ball winner", positions: ["CM", "DM"], blurb: "Hunts the ball and breaks up play.", attrs: ["tackling", "aggression", "workRate", "stamina"], fx: { tackle: 1.4, intercept: 1.2, foul: 1.2, card: 1.15, create: 0.85, counter: 0.004 }, style: { pressing: 0.8 } },
  { id: "number-ten", name: "Number ten", positions: ["AM", "CM"], blurb: "Floats between the lines and makes the final pass.", attrs: ["vision", "creativity", "passing", "firstTouch"], fx: { create: 1.4, createThrough: 1.25, shootLong: 1.15, tackle: 0.8 } },
  { id: "shadow-striker", name: "Shadow striker", positions: ["AM"], blurb: "Runs beyond the striker to finish.", attrs: ["offBall", "finishing", "acceleration", "composure"], fx: { shoot: 1.35, shoot1v1: 1.3, create: 0.85 }, style: { directness: 0.6 } },
  { id: "inside-forward", name: "Inside forward", positions: W, blurb: "Cuts inside onto the stronger foot to shoot.", attrs: ["dribbling", "finishing", "longShots", "agility"], fx: { shoot: 1.4, shootLong: 1.2, createCross: 0.65 } },
  { id: "winger", name: "Traditional winger", positions: W, blurb: "Hugs the line and delivers crosses.", attrs: ["crossing", "pace", "dribbling", "acceleration"], fx: { createCross: 1.6, create: 1.15, shoot: 0.82 }, style: { directness: 0.6 } },
  { id: "poacher", name: "Poacher", positions: ["ST"], blurb: "Lives on the shoulder of the last defender.", attrs: ["finishing", "offBall", "composure", "acceleration"], fx: { shoot: 1.3, shoot1v1: 1.2, create: 0.75, tackle: 0.7 } },
  { id: "false-nine", name: "False nine", positions: ["ST"], blurb: "Drops deep to link play and pulls centre-backs out.", attrs: ["passing", "vision", "firstTouch", "creativity"], fx: { create: 1.5, createThrough: 1.3, shoot: 0.78, teamMid: 0.006 }, style: { tempo: 0.4, directness: 0.3 } },
  { id: "target-man", name: "Target man", positions: ["ST"], blurb: "The focal point for crosses and long balls.", attrs: ["heading", "strength", "jumping", "balance"], fx: { shootHeader: 1.6, freqHeader: 0.008, create: 0.9 }, style: { directness: 0.75 } },
  { id: "pressing-forward", name: "Pressing forward", positions: ["ST", ...W], blurb: "Leads the press from the front.", attrs: ["workRate", "stamina", "aggression", "acceleration"], fx: { tackle: 1.5, counter: 0.008, drain: 1.1, shoot: 0.95 }, style: { pressing: 0.8 } },
];

const ROLE_BY_ID = new Map(ROLES.map((r) => [r.id, r]));
export const roleDef = (id: string | undefined) => (id ? ROLE_BY_ID.get(id) : undefined);

export function rolesFor(pos: Position): RoleDef[] {
  return ROLES.filter((r) => r.positions.includes(pos));
}

/** How well the player's attributes suit the role, against his overall (positive = suits him). */
export function roleFit(p: Player, role: RoleDef): number {
  const avg = role.attrs.reduce((s, k) => s + p.attrs[k], 0) / role.attrs.length;
  return avg - overallFor(p.attrs, p.position);
}

/** How well the role suits the club's style (−1 … 1). */
export function styleMatch(role: RoleDef, style: ClubState["style"] | undefined): number {
  if (!role.style || !style) return 0;
  const keys = Object.keys(role.style) as (keyof ClubState["style"])[];
  const gap = keys.reduce((s, k) => s + Math.abs((role.style?.[k] ?? 0.5) - (style[k] ?? 0.5)), 0) / keys.length;
  return clamp(1 - gap * 3, -1, 1);
}

/** The agreed role, if it still applies (same club, same position family). */
export function activeRole(state: GameState): RoleDef | undefined {
  const r = state.user.tacticalRole;
  const p = userPlayer(state);
  if (!r?.agreed || !p.clubId || r.clubId !== p.clubId) return undefined;
  const def = roleDef(r.id);
  return def && def.positions.includes(p.position) ? def : undefined;
}

/** Selection points the role is worth for the user at his club: positive when it suits him and the team. */
export function roleSelectionBonus(state: GameState): number {
  const def = activeRole(state);
  if (!def) return 0;
  const p = userPlayer(state);
  const club = p.clubId ? state.clubs[p.clubId] : undefined;
  return clamp(roleFit(p, def) / 4 + styleMatch(def, club?.style) * 1.2, -2, 2);
}

/** Merge the role's fx into the player's trait fx (roles scale their effect terms by fit). */
export function withRoleFx(base: MatchFx | undefined, def: RoleDef | undefined, fit: number): MatchFx | undefined {
  if (!def) return base;
  const out: Record<string, number> = { ...(base as Record<string, number> | undefined) };
  const strength = clamp(0.8 + fit / 25, 0.5, 1.1);
  for (const [k, v] of Object.entries(def.fx) as [keyof MatchFx, number][]) {
    if (ADDITIVE_FX.has(k)) out[k] = (out[k] ?? 0) + v * strength;
    else out[k] = (out[k] ?? 1) * (1 + (v - 1) * strength);
  }
  return out as MatchFx;
}

export const ROLE_REQUEST_COOLDOWN = 6;

/** Ask the manager to play a role. He agrees when it suits you and the team, or when he trusts you. */
export function requestRole(state: GameState, roleId: string): { ok: boolean; reason?: string; msg?: string } {
  const p = userPlayer(state);
  const def = roleDef(roleId);
  if (!def || !def.positions.includes(p.position)) return { ok: false, reason: "That role isn't for your position." };
  if (!p.clubId) return { ok: false, reason: "You need a club first." };
  const prev = state.user.tacticalRole;
  if (prev && prev.clubId === p.clubId && state.turnIndex - prev.askedTurn < ROLE_REQUEST_COOLDOWN) return { ok: false, reason: "You asked recently. Give the manager a few weeks." };
  const club = state.clubs[p.clubId];
  const fit = roleFit(p, def);
  const match = styleMatch(def, club?.style);
  const trust = state.user.relationships.manager;
  const score = fit / 3 + match * 2 + (trust - 50) / 10;
  const agreed = score >= 0 || trust >= 70;
  state.user.tacticalRole = { id: def.id, clubId: p.clubId, season: state.season, askedTurn: state.turnIndex, agreed: agreed || (prev?.agreed && prev.id === def.id) || false };
  if (!agreed && prev?.agreed && prev.clubId === p.clubId) state.user.tacticalRole = { ...prev, askedTurn: state.turnIndex };
  if (agreed) {
    addNews(state, { kind: "club", title: `New role: ${def.name}`, body: `The manager agrees to try you as a ${def.name.toLowerCase()}.` });
    return { ok: true, msg: `The manager agrees: you'll play as a ${def.name.toLowerCase()}.` };
  }
  adjustRel(state, "manager", -1, `Asked to play as a ${def.name.toLowerCase()}`);
  return { ok: false, reason: fit < -4 ? `The manager doesn't think your game suits a ${def.name.toLowerCase()}.` : `The manager wants a different shape from that position.` };
}

/** Drop back to the manager's default instructions. */
export function clearRole(state: GameState): void {
  state.user.tacticalRole = undefined;
}

/** For the UI: each role for the user's position with its fit and style match. */
export function roleOptions(state: GameState): { def: RoleDef; fit: number; style: number; active: boolean }[] {
  const p = userPlayer(state);
  const club = p.clubId ? state.clubs[p.clubId] : undefined;
  const active = activeRole(state)?.id;
  return rolesFor(p.position).map((def) => ({ def, fit: roleFit(p, def), style: styleMatch(def, club?.style), active: def.id === active }));
}

