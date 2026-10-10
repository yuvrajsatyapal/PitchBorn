/**
 * Game-state schema migrations. Each step upgrades a raw decoded state by one
 * version. Never edit a released step — add a new one and bump
 * SCHEMA_VERSION in engine/world/helpers.ts.
 */
import { fromLegacy, isLegacyAppearance, sanitizeAppearance } from "../engine/appearance/generate";
import type { GameState, LegacyAppearance } from "../engine/types";
import { agentRating, agentWeeklyFee, tierFor } from "../engine/career/agents";
import { sanitizeCeremony } from "../engine/awards/sanitize";
import { sanitizeRivalry } from "../engine/career/rivalry/sanitize";
import { sanitizeSagas } from "../engine/career/saga/sanitize";
import { backfillMemories } from "../engine/memory/backfill";
import { expandAllAttributes } from "../engine/players/expansion";
import { NO_FOCUS } from "../engine/players/focus";
import { AMBI_MIN, AMBIDEXTROUS, isFoot, migrateFoot } from "../engine/players/foot";
import { derivedTraits, initialTraits } from "../engine/traits/assign";
import { sanitizeTraits, seedDerivedTraits } from "../engine/traits/sanitize";
import { SCHEMA_VERSION } from "../engine/world/helpers";
import { sanitizeCareerData } from "../engine/world/sanitize";

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

MIGRATIONS[2] = (s) => {
  // v2 → v3: agents become a market with fees; money becomes a bank balance.
  const user = (s.user ?? {}) as Record<string, unknown>;
  const old = (user.agent ?? {}) as { name?: string; quality?: number };
  if (typeof old.quality === "number") {
    const q = old.quality;
    const skills = { negotiation: q, connections: q, media: Math.max(10, q - 8), care: Math.max(10, q - 8) };
    const rating = agentRating(skills);
    user.agent = {
      id: "legacy",
      name: old.name ?? "Your agent",
      nationality: "",
      tier: tierFor(rating),
      rating,
      skills,
      weeklyFee: agentWeeklyFee(rating, 0.04),
      commission: 0.04,
      minReputation: 0,
    };
  }
  user.bank ??= Math.max(5000, Math.round(Number(user.earnings ?? 0)));
  s.user = user;
  return s;
};

MIGRATIONS[3] = (s) => {
  // v3 → v4: career memories, rebuilt from what older saves recorded.
  const user = (s.user ?? {}) as Record<string, unknown>;
  user.memories ??= [];
  s.user = user;
  try {
    backfillMemories(s as unknown as GameState);
  } catch {
    user.memories = []; // never let memories block loading a career
  }
  return s;
};

MIGRATIONS[4] = (s) => {
  // v4 → v5: player traits. Everyone gets a deterministic starting set; the user starts with temperament only.
  const state = s as unknown as GameState;
  const user = (s.user ?? {}) as Record<string, unknown>;
  user.traitLog ??= [];
  s.user = user;
  try {
    for (const p of Object.values(state.players ?? {})) {
      if (p.traits) continue;
      p.traits = initialTraits(p, state.season, { tier: p.isUser ? "user" : "npc" });
      if (!p.traits.length) delete p.traits;
    }
  } catch {
    // Traits are an enhancement: a save must always load.
  }
  return s;
};

MIGRATIONS[5] = (s) => {
  // v5 → v6: illustrated portraits. The old five-value avatar becomes a full face, keeping what was chosen.
  const state = s as unknown as GameState;
  try {
    for (const p of Object.values(state.players ?? {})) {
      if (isLegacyAppearance(p.look)) p.look = fromLegacy(p.look as unknown as LegacyAppearance, p.id);
      else p.look = sanitizeAppearance(p.look);
    }
  } catch {
    // A save must always load; players without a valid face are given one on demand.
  }
  return s;
};

MIGRATIONS[6] = (s) => {
  // v6 → v7: transfer sagas. Old saves have none; the list starts empty.
  const user = (s.user ?? {}) as Record<string, unknown>;
  user.sagas ??= [];
  s.user = user;
  return s;
};

MIGRATIONS[7] = (s) => {
  // v7 → v8: emergent player rivalries. Old saves start with none; the transfer scan starts from today.
  const user = (s.user ?? {}) as Record<string, unknown>;
  const log = Array.isArray((s as { transferLog?: unknown[] }).transferLog) ? (s as { transferLog: unknown[] }).transferLog.length : 0;
  user.rivalry ??= { rivals: [], candidates: {}, transferScan: log, lastFormedIndex: -999 };
  s.user = user;
  return s;
};

MIGRATIONS[8] = (s) => {
  // v8 → v9: the awards ceremony. Old saves have no ceremony and no missed nominations.
  const user = (s.user ?? {}) as Record<string, unknown>;
  user.awardNoms ??= [];
  s.user = user;
  return s;
};

MIGRATIONS[9] = (s) => {
  // v9 → v10: match log, income ledger, contract clauses, international allegiance, objectives. The sanitiser that runs
  // on every load builds all of them from what the older save really recorded; nothing is invented.
  const user = (s.user ?? {}) as Record<string, unknown>;
  user.relLog ??= [];
  s.user = user;
  return s;
};

MIGRATIONS[10] = (s) => {
  // v10 → v11: manager history and squad numbers. The sanitiser that runs on every load gives every manager an id and
  // a tenure, every player a valid unique number, and opens the user's first stint and number history from today.
  return s;
};

MIGRATIONS[11] = (s) => {
  // v11 → v12: dominant foot is left or right only; the weak foot is rated separately. Old "both" players become a left or
  // right foot with a strong weak foot, and anyone near-perfect gets the Ambidextrous trait.
  sanitizeFootedness(s as unknown as GameState);
  return s;
};

MIGRATIONS[12] = (s) => {
  // v12 → v13: the trait catalogue grew (record-based and temperament traits, flaws with attribute ceilings) and players now remember
  // when they joined their club. NPCs receive the traits their profile and record already imply; nothing established is re-rolled.
  seedDerivedTraits(s as unknown as GameState);
  return s;
};

MIGRATIONS[13] = (s) => {
  // v13 → v14: development focus and the loyalty record behind One-Club Minded. Nobody's childhood aspiration is invented from the
  // traits they have today: the user's focus is recorded as "no preference" and NPCs simply have none. The loyalty record starts
  // from what each player's recorded seasons show at the next season review. No trait is added, changed or removed here.
  const state = s as unknown as GameState;
  const u = (state.players ?? {})[(state.user as { playerId?: string } | undefined)?.playerId ?? ""];
  if (u && u.focus === undefined) u.focus = NO_FOCUS;
  return s;
};

MIGRATIONS[14] = (s) => {
  // v14 → v15: the attribute model grew from twenty to thirty-three. Every player keeps the original twenty, his potential, traits,
  // identity and history exactly; the new thirteen are derived from them (never rerolled) and fitted so his overall is unchanged.
  expandAllAttributes(s as unknown as GameState);
  return s;
};

MIGRATIONS[15] = (s) => {
  // v15 → v16: sponsorship deals. Starts empty; the engine creates the state on first use.
  return s;
};

/** Every player has a left or right foot and a weak-foot rating; old "both" players are converted (and given the trait if earned). */
function sanitizeFootedness(state: GameState): void {
  for (const p of Object.values(state.players ?? {})) {
    if (isFoot(p.foot) && typeof p.weakFoot === "number" && Number.isFinite(p.weakFoot)) continue;
    migrateFoot(p);
    if (p.weakFoot >= AMBI_MIN && !p.traits?.some((t) => t.id === AMBIDEXTROUS)) {
      const earned = derivedTraits(p, state.season - p.birthYear, state.season).find((t) => t.id === AMBIDEXTROUS);
      if (earned) (p.traits ??= []).push(earned);
    }
  }
}

export class MigrationError extends Error {}

export function migrateState(raw: RawState): GameState {
  let s = raw;
  let v = typeof s.schemaVersion === "number" ? s.schemaVersion : 1;
  if (v > SCHEMA_VERSION) throw new MigrationError(`Save is from a newer version of PitchBorn (schema ${v}).`);
  while (v < SCHEMA_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) throw new MigrationError(`No migration from schema ${v}.`);
    s = step(s);
    v++;
    s.schemaVersion = v;
  }
  const state = s as unknown as GameState;
  // Saga state is cheap to check and the one part of a save the engine reads as a state machine, so it is
  // sanitised on every load, not only when migrating.
  try {
    sanitizeSagas(state);
  } catch {
    if (state.user) state.user.sagas = [];
  }
  try {
    sanitizeCareerData(state);
  } catch {
    // The additions are optional: a save must always load. Engine code treats every one of them as possibly absent.
  }
  try {
    expandAllAttributes(state);
  } catch {
    // A save must always load; a player still missing attributes is completed on the next load.
  }
  try {
    sanitizeFootedness(state);
  } catch {
    // A save must always load; a player without a valid foot is repaired again on the next load.
  }
  try {
    sanitizeTraits(state);
  } catch {
    // A save must always load; traits are re-validated on the next load.
  }
  try {
    sanitizeCeremony(state);
  } catch {
    delete state.ceremony;
  }
  try {
    sanitizeRivalry(state);
  } catch {
    if (state.user) state.user.rivalry = { rivals: [], candidates: {}, transferScan: state.transferLog?.length ?? 0, lastFormedIndex: -999 };
  }
  return state;
}
