import { z } from "zod";
import { leaguesInPlay } from "./data/world";
import type { GameState } from "./types";

/** Structural check used when importing saves (deep game rules are checked by checkInvariants). */
export const GameStateShape = z.object({
  schemaVersion: z.number().int().min(1),
  id: z.string().min(1),
  name: z.string(),
  seed: z.string(),
  rng: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  season: z.number().int().min(2000).max(2200),
  turn: z.number().int().min(1).max(60),
  clubs: z.record(z.string(), z.object({ id: z.string(), leagueId: z.string(), squad: z.array(z.string()) }).passthrough()),
  players: z.record(z.string(), z.object({ id: z.string(), firstName: z.string(), lastName: z.string(), clubId: z.string().nullable() }).passthrough()),
  competitions: z.record(z.string(), z.object({ id: z.string(), fixtures: z.array(z.object({ id: z.string(), home: z.string(), away: z.string() }).passthrough()) }).passthrough()),
  user: z.object({ playerId: z.string(), timeline: z.array(z.unknown()), offers: z.array(z.unknown()) }).passthrough(),
}).passthrough();

export interface Invariant {
  ok: boolean;
  issues: string[];
}

/** Game-rule invariants: squads, contracts, leagues and fixtures must agree. */
export function checkInvariants(state: GameState): Invariant {
  const issues: string[] = [];
  const seen = new Map<string, string>();
  for (const club of Object.values(state.clubs)) {
    for (const id of club.squad) {
      const p = state.players[id];
      if (!p) {
        issues.push(`club ${club.id} lists missing player ${id}`);
        continue;
      }
      if (p.clubId !== club.id) issues.push(`player ${id} in ${club.id} squad but clubId=${p.clubId}`);
      if (seen.has(id)) issues.push(`player ${id} in two squads (${seen.get(id)}, ${club.id})`);
      seen.set(id, club.id);
    }
  }
  for (const p of Object.values(state.players)) {
    if (p.clubId && !state.clubs[p.clubId]) issues.push(`player ${p.id} at unknown club ${p.clubId}`);
    if (p.clubId && !state.clubs[p.clubId]?.squad.includes(p.id)) issues.push(`player ${p.id} not in squad of ${p.clubId}`);
    if (p.contract && !state.clubs[p.contract.clubId]) issues.push(`player ${p.id} contract with unknown club`);
    if (p.contract && !p.loan && p.clubId && p.contract.clubId !== p.clubId) issues.push(`player ${p.id} contract/club mismatch`);
    if (p.virtual && p.clubId) issues.push(`virtual player ${p.id} attached to a club`);
  }
  for (const l of leaguesInPlay(state)) {
    const ids = state.leagueClubs[l.id] ?? [];
    if (ids.length !== l.size) issues.push(`league ${l.id} has ${ids.length} clubs (expected ${l.size})`);
    for (const id of ids) if (state.clubs[id]?.leagueId !== l.id) issues.push(`club ${id} leagueId mismatch for ${l.id}`);
  }
  for (const comp of Object.values(state.competitions)) {
    for (const f of comp.fixtures) {
      if (f.home === f.away) issues.push(`fixture ${f.id} has same team twice`);
      if (f.result && (f.result.hg < 0 || f.result.ag < 0)) issues.push(`fixture ${f.id} negative score`);
      if (f.result) {
        const hg = f.result.goals.filter((g) => g.side === "home").length;
        const ag = f.result.goals.filter((g) => g.side === "away").length;
        if (hg !== f.result.hg || ag !== f.result.ag) issues.push(`fixture ${f.id} goal events (${hg}-${ag}) != score (${f.result.hg}-${f.result.ag})`);
      }
    }
  }
  const sagas = state.user.sagas ?? [];
  const active = sagas.filter((s) => s.stage !== "completed" && s.stage !== "failed");
  if (active.length > 1) issues.push(`${active.length} active transfer sagas (at most one allowed)`);
  for (const s of active) {
    for (const id of s.offerIds) if (!state.user.offers.some((o) => o.id === id)) issues.push(`saga ${s.id} references missing offer ${id}`);
    if (s.deadlineIndex < state.turnIndex) issues.push(`saga ${s.id} is active past its deadline`);
  }
  if (!state.players[state.user.playerId]) issues.push("user player missing");
  return { ok: issues.length === 0, issues };
}
