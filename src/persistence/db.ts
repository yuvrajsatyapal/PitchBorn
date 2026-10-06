import Dexie, { type Table } from "dexie";
import type { EncodedState } from "./codec";

export interface SaveMeta {
  id: string;
  name: string;
  playerName: string;
  position: string;
  nationality: string;
  clubId: string | null;
  season: number;
  turn: number;
  overall: number;
  age: number;
  retired: boolean;
  legacyTier?: string;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  sizeBytes?: number;
}

export interface SaveRow {
  id: string;
  data: EncodedState;
  updatedAt: string;
}

export interface BackupRow {
  id: string;
  saveId: string;
  data: EncodedState;
  createdAt: string;
  label: string;
}

export interface KvRow {
  key: string;
  value: unknown;
}

/** IndexedDB database (Dexie). Bump the version + add an upgrade for structural changes. */
export class PitchbornDB extends Dexie {
  meta!: Table<SaveMeta, string>;
  saves!: Table<SaveRow, string>;
  backups!: Table<BackupRow, string>;
  kv!: Table<KvRow, string>;

  constructor(name = "pitchborn") {
    super(name);
    this.version(1).stores({
      meta: "id, updatedAt",
      saves: "id",
      backups: "id, saveId, createdAt",
      kv: "key",
    });
  }
}

let instance: PitchbornDB | null = null;
export function db(): PitchbornDB {
  if (!instance) instance = new PitchbornDB();
  return instance;
}

/** Tests can inject an isolated database. */
export function setDb(next: PitchbornDB | null): void {
  instance = next;
}
