import { z } from "zod";
import { overallFor } from "../engine/players/attributes";
import { ageOf } from "../engine/players/generate";
import type { GameState } from "../engine/types";
import { checkInvariants, GameStateShape } from "../engine/validate";
import { decodeState, encodeState, isEncoded, type EncodedState } from "./codec";
import { db, type SaveMeta } from "./db";
import { migrateState } from "./migrations";

const MAX_BACKUPS = 3;
export const EXPORT_FORMAT = "pitchborn-save";

export function metaFor(state: GameState): SaveMeta {
  const p = state.players[state.user.playerId];
  return {
    id: state.id,
    name: state.name,
    playerName: `${p.firstName} ${p.lastName}`,
    position: p.position,
    nationality: p.nationality,
    clubId: p.clubId,
    season: state.season,
    turn: state.turn,
    overall: overallFor(p.attrs, p.position),
    age: ageOf(p, state.season),
    retired: state.user.retired,
    legacyTier: state.user.legacy?.tier,
    schemaVersion: state.schemaVersion,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
  };
}

export async function listSaves(): Promise<SaveMeta[]> {
  return db().meta.orderBy("updatedAt").reverse().toArray();
}

export interface SaveOptions {
  /** Snapshot into the rotating backup set (manual saves, season changes). */
  backup?: boolean;
  label?: string;
}

export async function saveGame(state: GameState, opts: SaveOptions = {}): Promise<SaveMeta> {
  const now = new Date().toISOString();
  state.updatedAt = now;
  const data = encodeState(state);
  const meta = metaFor(state);
  const database = db();
  await database.transaction("rw", database.meta, database.saves, database.backups, async () => {
    await database.saves.put({ id: state.id, data, updatedAt: now });
    await database.meta.put(meta);
    if (opts.backup) {
      await database.backups.put({ id: `${state.id}:${now}`, saveId: state.id, data, createdAt: now, label: opts.label ?? "Backup" });
      const all = await database.backups.where("saveId").equals(state.id).sortBy("createdAt");
      const excess = all.length - MAX_BACKUPS;
      if (excess > 0) await database.backups.bulkDelete(all.slice(0, excess).map((b) => b.id));
    }
  });
  return meta;
}

export class LoadError extends Error {}

/** Decode + migrate + validate a stored/exported state. */
export function hydrate(data: unknown): GameState {
  const decoded = isEncoded(data) ? decodeState(data) : (data as GameState);
  const migrated = migrateState(decoded as unknown as Record<string, unknown>);
  const shape = GameStateShape.safeParse(migrated);
  if (!shape.success) throw new LoadError(`Save data is malformed: ${shape.error.issues[0]?.path.join(".")} ${shape.error.issues[0]?.message}`);
  const inv = checkInvariants(migrated);
  if (!inv.ok && inv.issues.length > 20) throw new LoadError(`Save failed integrity checks (${inv.issues.length} issues).`);
  return migrated;
}

export async function loadSave(id: string): Promise<{ state: GameState; recovered: boolean }> {
  const row = await db().saves.get(id);
  if (row) {
    try {
      return { state: hydrate(row.data), recovered: false };
    } catch (err) {
      console.warn("Primary save failed to load, trying backups", err);
    }
  }
  const backups = (await db().backups.where("saveId").equals(id).sortBy("createdAt")).reverse();
  for (const b of backups) {
    try {
      return { state: hydrate(b.data), recovered: true };
    } catch {
      /* try older */
    }
  }
  throw new LoadError("This save could not be loaded and no usable backup was found.");
}

export async function deleteSave(id: string): Promise<void> {
  const database = db();
  await database.transaction("rw", database.meta, database.saves, database.backups, async () => {
    await database.meta.delete(id);
    await database.saves.delete(id);
    await database.backups.where("saveId").equals(id).delete();
  });
}

export async function listBackups(id: string) {
  return (await db().backups.where("saveId").equals(id).sortBy("createdAt")).reverse().map((b) => ({ id: b.id, createdAt: b.createdAt, label: b.label }));
}

export async function restoreBackup(backupId: string): Promise<GameState> {
  const b = await db().backups.get(backupId);
  if (!b) throw new LoadError("Backup not found.");
  const state = hydrate(b.data);
  await saveGame(state);
  return state;
}

// ----------------------------------------------------------- export/import

const ExportEnvelope = z.object({
  format: z.literal(EXPORT_FORMAT),
  version: z.number().int(),
  exportedAt: z.string(),
  meta: z.object({ id: z.string(), name: z.string() }).passthrough(),
  data: z.unknown(),
});

export function exportPayload(state: GameState): string {
  return JSON.stringify({ format: EXPORT_FORMAT, version: 1, exportedAt: new Date().toISOString(), meta: metaFor(state), data: encodeState(state) });
}

async function gzip(text: string): Promise<Blob> {
  if (typeof CompressionStream === "undefined") return new Blob([text], { type: "application/json" });
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).blob();
}

export async function exportSaveBlob(state: GameState): Promise<{ blob: Blob; filename: string }> {
  const text = exportPayload(state);
  const compressed = typeof CompressionStream !== "undefined";
  const blob = await gzip(text);
  const safe = state.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return { blob, filename: `pitchborn-${safe}-${state.season}.${compressed ? "pbsave" : "json"}` };
}

async function readMaybeGzip(file: Blob): Promise<string> {
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  if (head[0] === 0x1f && head[1] === 0x8b && typeof DecompressionStream !== "undefined") {
    return new Response(file.stream().pipeThrough(new DecompressionStream("gzip"))).text();
  }
  return file.text();
}

export function parseImport(text: string): GameState {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new LoadError("That file is not a Pitchborn save.");
  }
  const env = ExportEnvelope.safeParse(json);
  if (!env.success) throw new LoadError("That file is not a Pitchborn save (missing header).");
  return hydrate(env.data.data as EncodedState);
}

export async function importSaveFile(file: Blob, opts: { asCopy?: boolean } = {}): Promise<GameState> {
  const state = parseImport(await readMaybeGzip(file));
  const existing = await db().meta.get(state.id);
  if (existing && opts.asCopy !== false) {
    state.id = `${state.id}-import-${Date.now().toString(36)}`;
    state.name = `${state.name} (imported)`;
  }
  await saveGame(state, { backup: true, label: "Imported" });
  return state;
}

export async function getKv<T>(key: string, fallback: T): Promise<T> {
  try {
    const row = await db().kv.get(key);
    return (row?.value as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export async function setKv(key: string, value: unknown): Promise<void> {
  try {
    await db().kv.put({ key, value });
  } catch {
    /* storage unavailable (private mode) — non-fatal */
  }
}
