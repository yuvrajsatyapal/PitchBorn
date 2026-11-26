/**
 * Generational saves: after retiring, the player's child starts a career in the same world. The child inherits the
 * parent's nationality, some of their looks and, sometimes, a playing trait in its first stage; the parent can be the
 * child's agent (loyal, no fee, as connected as the parent was famous) or, if the parent manages a club, the child
 * starts in that club's academy under them. The parent's whole career is kept in `state.lineage`; the save keeps going.
 *
 * Draws come from `Rng.fromSeed(seed:generation:<n>)`, so the choice never moves the world RNG.
 */
import { generateAppearance } from "../appearance/generate";
import { clubName, staticClub } from "../data/world";
import { recordNumber, repairAllSquads } from "../jersey/numbers";
import { openStint } from "../managers/history";
import { overallFor } from "../players/attributes";
import { ageOf } from "../players/generate";
import { clamp, Rng } from "../rng";
import { traitDef } from "../traits/registry";
import { STAGE_XP } from "../traits/types";
import type { Agent, Appearance, GameState, LineageEntry, Position } from "../types";
import { createUserPlayer, freshUserCareer, signForStanding } from "../world/create";
import { addNews, addTimeline, fullName, removeFromSquad, userPlayer } from "../world/helpers";
import { startYouth } from "./youth";

export type ParentRole = "agent" | "coach" | "none";

export interface NextGenInput {
  firstName: string;
  position: Position;
  foot: "L" | "R";
  height: number;
  /** "coach" only when the parent manages a club. */
  role: ParentRole;
  /** The club to start at (ignored when the parent coaches: the child starts at the parent's club). */
  clubId: string;
  path: "youth" | "academy";
}

/** Looks a child takes from the parent (the rest are their own). */
const INHERITED: (keyof Appearance)[] = ["skin", "eyeColor", "hairColor", "browColor", "face", "nose", "ear", "eyes"];

export function childLook(parent: Appearance, seed: string): Appearance {
  const own = generateAppearance(seed);
  const r = Rng.fromSeed(`look-inherit:${seed}`);
  const out: Appearance = { ...own };
  for (const k of INHERITED) if (k === "skin" || r.chance(0.6)) (out as Record<string, number>)[k] = (parent as Record<string, number>)[k];
  out.facial = 0;
  out.scar = 0;
  out.aging = 0;
  return out;
}

export function canStartNextGeneration(state: GameState): boolean {
  return state.user.retired;
}

/** The club the parent manages, when they do. */
export function parentClub(state: GameState): string | null {
  const c = state.user.coach;
  return c?.active && c.role === "manager" && c.clubId ? c.clubId : null;
}

function parentAgent(state: GameState, entry: LineageEntry): Agent {
  const fame = clamp(entry.legacyScore / 1.4, 30, 92);
  const skills = { negotiation: Math.round(fame * 0.85), connections: Math.round(fame), media: Math.round(fame * 0.95), care: 95 };
  return {
    id: `family-${state.generation ?? 1}`,
    name: entry.name,
    nationality: entry.nationality,
    tier: fame >= 75 ? "top" : fame >= 55 ? "established" : "rookie",
    rating: Math.round((skills.negotiation + skills.connections + skills.media + skills.care) / 4),
    skills,
    weeklyFee: 0,
    commission: 0,
    minReputation: 0,
  };
}

/** Starts the child's career in this save. Returns the message to show. */
export function startNextGeneration(state: GameState, input: NextGenInput): { ok: boolean; reason?: string; msg?: string } {
  if (!state.user.retired) return { ok: false, reason: "Retire first." };
  const first = input.firstName.trim();
  if (first.length < 2) return { ok: false, reason: "Choose a first name." };
  const parent = userPlayer(state);
  const coachClubId = input.role === "coach" ? parentClub(state) : null;
  if (input.role === "coach" && !coachClubId) return { ok: false, reason: "You need to be managing a club to coach your child." };
  const clubId = coachClubId ?? input.clubId;
  if (!state.clubs[clubId]) return { ok: false, reason: "Pick a club." };
  const gen = (state.generation ?? 1) + 1;
  const old = state.user;
  const entry: LineageEntry = {
    generation: gen - 1,
    playerId: parent.id,
    name: fullName(parent),
    nationality: parent.nationality,
    position: parent.position,
    startSeason: old.startSeason,
    retiredSeason: old.retiredSeason ?? state.season,
    legacyScore: Math.round(old.legacy?.score ?? 0),
    legacyTier: old.legacy?.tier ?? "",
    peak: old.peakOverall,
    apps: parent.career.apps,
    goals: parent.career.goals,
    trophies: old.trophies.length,
    look: parent.look,
    coachRole: old.coach?.active ? old.coach.role ?? undefined : undefined,
    coachClubId: old.coach?.active ? old.coach.clubId ?? undefined : undefined,
  };
  // The parent's dugout career goes on without the user: the club keeps them as an ordinary manager.
  if (old.coach) old.coach.active = false;
  // The parent leaves the game's books as a player: no squad, no national pool, no longer the user.
  removeFromSquad(state, parent.id);
  for (const nt of Object.values(state.nationalTeams)) nt.squad = nt.squad.filter((id) => id !== parent.id);
  parent.clubId = null;
  parent.contract = null;
  parent.loan = undefined;
  parent.isUser = false;
  parent.retired = true;
  const r = Rng.fromSeed(`${state.seed}:generation:${gen}`);
  const look = childLook(parent.look, `${state.seed}:child:${gen}`);
  state.lineage = [...(state.lineage ?? []), entry];
  state.generation = gen;
  state.user = freshUserCareer(state.season, {
    saveName: state.name, firstName: first, lastName: parent.lastName, nationality: parent.nationality, birthCountry: parent.altNationality ?? parent.nationality,
    position: input.position, foot: input.foot, height: input.height, look, clubId, path: input.path,
  });
  const child = createUserPlayer(state, r, {
    saveName: state.name, firstName: first, lastName: parent.lastName, nationality: parent.nationality, birthCountry: parent.nationality,
    position: input.position, foot: input.foot, height: input.height, look, clubId, path: input.path, difficulty: state.settings.difficulty,
  });
  // Inherited playing traits arrive in their first stage, only if the child's position can use them.
  const inherited = (parent.traits ?? [])
    .filter((t) => t.xp >= STAGE_XP.established && traitDef(t.id)?.positions.includes(input.position) && !traitDef(t.id)?.flaw)
    .slice(0, 2)
    .filter(() => r.chance(0.5));
  for (const t of inherited) if (!(child.traits ?? []).some((x) => x.id === t.id)) (child.traits ??= []).push({ id: t.id, xp: STAGE_XP.owned + 2, since: state.season });
  state.players[child.id] = child;
  state.user.playerId = child.id;
  state.clubs[clubId].squad.push(child.id);
  state.user.peakOverall = overallFor(child.attrs, child.position);
  if (input.role === "agent") state.user.agent = parentAgent(state, entry);
  openStint(state, clubId);
  signForStanding(state, child);
  repairAllSquads(state);
  if (child.squadNo) recordNumber(state, clubId, child.squadNo);
  if (input.path === "youth") startYouth(state);
  state.pending = [];
  addTimeline(state, { kind: "start", title: `The next generation: joined ${staticClub(clubId)?.shortName ?? clubName(clubId)}`, detail: `Aged ${ageOf(child, state.season)}, child of ${entry.name}` });
  addNews(state, {
    kind: "career",
    title: `${first} ${parent.lastName} follows in the family footsteps`,
    body: input.role === "agent" ? `${entry.name} will be the agent.` : input.role === "coach" ? `${entry.name} is the manager at ${clubName(clubId)}.` : `${entry.name} watches from the stands.`,
    important: true,
  });
  return { ok: true, msg: `${first} ${parent.lastName}'s career begins.` };
}
