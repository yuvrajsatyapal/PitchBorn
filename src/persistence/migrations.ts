/**
 * Game-state schema migrations. Each step upgrades a raw decoded state by one
 * version. Never edit a released step — add a new one and bump
 * SCHEMA_VERSION in engine/world/helpers.ts.
 */
import type { GameState } from "../engine/types";
import { SCHEMA_VERSION } from "../engine/world/helpers";

type RawState = Record<string, unknown> & { schemaVersion?: number };
type Migration = (s: RawState) => RawState;

const MIGRATIONS: Record<number, Migration> = {
  // v1 → v2: training history, free-agent counter, reward cooldowns, cup byes, trophy flags.
  1: (s) => {
    const user = (s.user ?? {}) as Record<string, unknown>;
    user.trainingHistory ??= [];
    user.rewardCooldowns ??= {};
    user.freeSeasons ??= 0;
    user.boosts ??= [];
    s.user = user;
    const comps = (s.competitions ?? {}) as Record<string, Record<string, unknown>>;
    for (const c of Object.values(comps)) {
      if (c.kind === "cup" && !c.byes) c.byes = [];
      if (c.complete && c.winner && c.trophyAwarded === undefined) c.trophyAwarded = true;
    }
    s.pendingMoves ??= [];
    return s;
  },
};

export class MigrationError extends Error {}

export function migrateState(raw: RawState): GameState {
  let s = raw;
  let v = typeof s.schemaVersion === "number" ? s.schemaVersion : 1;
  if (v > SCHEMA_VERSION) throw new MigrationError(`Save is from a newer version of Pitchborn (schema ${v}).`);
  while (v < SCHEMA_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) throw new MigrationError(`No migration from schema ${v}.`);
    s = step(s);
    v++;
    s.schemaVersion = v;
  }
  return s as unknown as GameState;
}
