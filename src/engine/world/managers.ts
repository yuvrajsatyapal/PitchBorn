/**
 * Managerial merry-go-round: clubs that sack their manager usually hire an
 * unemployed coach of similar standing; the sacked manager joins the pool.
 */
import { WORLD } from "../data/world";
import { clamp, type Rng } from "../rng";
import type { ClubState, CountryCode, GameState, PoolManager } from "../types";
import { managerName } from "./create";

const MAX_POOL = 60;
const RETIRE_AGE = 75;

/** Lazily seeded so older saves pick up the real free agents too. */
export function managerPool(state: GameState): PoolManager[] {
  if (!state.managerPool) {
    const employed = new Set([...Object.values(state.clubs).map((c) => c.manager.name), ...Object.values(state.nationalTeams).map((n) => n.manager)]);
    state.managerPool = (WORLD.freeAgentManagers ?? [])
      .filter((m) => !employed.has(m.name))
      .map((m) => ({ name: m.name, nationality: m.nationality ?? "", quality: m.stature, born: m.born }));
  }
  return state.managerPool;
}

/** Pick a successor: the best available coach a club of this standing could attract, else a generated one. */
export function hireManager(state: GameState, rng: Rng, club: ClubState, fallbackNat: CountryCode): ClubState["manager"] {
  const pool = managerPool(state);
  const ceiling = club.reputation + 8;
  const floor = club.reputation - 25;
  const candidates = pool.filter((m) => m.quality <= ceiling && m.quality >= floor && (!m.born || state.season - m.born < RETIRE_AGE));
  if (candidates.length && rng.chance(0.75)) {
    const pick = rng.weighted(candidates, (m) => Math.pow(Math.max(1, m.quality - floor), 2));
    pool.splice(pool.indexOf(pick), 1);
    return { name: pick.name, quality: pick.quality, since: state.season, nationality: pick.nationality, born: pick.born };
  }
  return { name: managerName(rng, fallbackNat), quality: Math.round(clamp(club.reputation * 0.7 + rng.normal(20, 8), 20, 99)), since: state.season, nationality: fallbackNat };
}

/** A sacked manager becomes available to other clubs. */
export function releaseManager(state: GameState, manager: ClubState["manager"]): void {
  const pool = managerPool(state);
  if (pool.some((m) => m.name === manager.name)) return;
  pool.push({ name: manager.name, nationality: manager.nationality, quality: Math.max(20, manager.quality - 2), born: manager.born });
  if (pool.length > MAX_POOL) {
    pool.sort((a, b) => b.quality - a.quality);
    pool.length = MAX_POOL;
  }
}
