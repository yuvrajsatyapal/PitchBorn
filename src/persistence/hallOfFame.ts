/**
 * Hall of Fame storage: a list of entries in the key-value store, so careers stay in the Hall after their save is
 * deleted. A career is inducted when the player retires; retired saves from before the Hall existed are inducted the
 * first time it opens. A career the player takes out of the Hall stays out.
 */
import { hallOfFameEntry, upsertEntry, type HallOfFameEntry } from "../engine/career/hallOfFame";
import type { GameState } from "../engine/types";
import { getKv, listSaves, loadSave, setKv } from "./saves";

const KEY = "hallOfFame";
const REMOVED = "hallOfFame:removed";

export async function listHallOfFame(): Promise<HallOfFameEntry[]> {
  const v = await getKv<HallOfFameEntry[]>(KEY, []);
  return Array.isArray(v) ? v : [];
}

async function removedIds(): Promise<Set<string>> {
  const v = await getKv<string[]>(REMOVED, []);
  return new Set(Array.isArray(v) ? v : []);
}

/** Induct (or refresh) a retired career. Does nothing for a career still going, or one taken out of the Hall. */
export async function inductCareer(state: GameState): Promise<void> {
  const entry = hallOfFameEntry(state);
  if (!entry || (await removedIds()).has(entry.saveId)) return;
  await setKv(KEY, upsertEntry(await listHallOfFame(), entry));
}

export async function removeFromHallOfFame(saveId: string): Promise<void> {
  await setKv(KEY, (await listHallOfFame()).filter((e) => e.saveId !== saveId));
  const removed = await removedIds();
  removed.add(saveId);
  await setKv(REMOVED, [...removed]);
}

/** Induct retired saves that are not in the Hall yet, then return every entry. */
export async function syncHallOfFame(): Promise<HallOfFameEntry[]> {
  let entries = await listHallOfFame();
  const have = new Set(entries.map((e) => e.saveId));
  const removed = await removedIds();
  const todo = (await listSaves()).filter((m) => m.retired && !have.has(m.id) && !removed.has(m.id));
  let changed = false;
  for (const meta of todo) {
    try {
      const { state } = await loadSave(meta.id);
      const entry = hallOfFameEntry(state);
      if (entry) {
        entries = upsertEntry(entries, entry);
        changed = true;
      }
    } catch (err) {
      console.warn("Hall of Fame: could not read a retired save", err);
    }
  }
  if (changed) await setKv(KEY, entries);
  return entries;
}
