/**
 * Every manager's career, by stable id. A record holds only tenures (club, when, why it ended, honours): small,
 * written once when something happens, and never rewritten when a manager moves on, so past appointments stay
 * available to every system that needs them.
 */
import type { ClubId, ClubState, CountryCode, DepartureReason, GameState, ManagerId, ManagerRecord, Tenure, TenureHonours } from "../types";
import { nextId } from "../world/helpers";

export const emptyHonours = (): TenureHonours => ({ league: 0, cup: 0, continental: 0, promotions: 0, relegations: 0 });

export const registryOf = (state: GameState): Record<ManagerId, ManagerRecord> => (state.managers ??= {});

export const recordOf = (state: GameState, id: ManagerId | undefined): ManagerRecord | undefined => (id ? state.managers?.[id] : undefined);

export function registerManager(state: GameState, info: { name: string; nationality: CountryCode; born?: number }): ManagerId {
  const id = nextId(state, "m");
  registryOf(state)[id] = { id, name: info.name, nationality: info.nationality, born: info.born, tenures: [] };
  return id;
}

export function openTenure(state: GameState, id: ManagerId, clubId: ClubId, opts: { season?: number; turn?: number; inherited?: boolean } = {}): Tenure | null {
  const rec = recordOf(state, id);
  if (!rec) return null;
  const open = rec.tenures.find((t) => !t.to);
  // A manager runs one club at a time: an open tenure elsewhere is closed (as a move) before another begins.
  if (open && open.clubId === clubId) return open;
  if (open) closeTenure(state, id, "moved", clubId);
  const t: Tenure = { clubId, from: { season: opts.season ?? state.season, turn: opts.turn ?? state.turn }, honours: emptyHonours() };
  if (opts.inherited) t.inherited = true;
  rec.tenures.push(t);
  // Compact: the oldest completed tenures are dropped past a limit, never an open or recent one.
  if (rec.tenures.length > 14) rec.tenures.splice(0, rec.tenures.length - 14);
  return t;
}

export function closeTenure(state: GameState, id: ManagerId, reason: DepartureReason, movedTo?: ClubId): Tenure | null {
  const t = openTenureOf(state, id);
  if (!t) return null;
  t.to = { season: state.season, turn: state.turn };
  t.reason = reason;
  if (movedTo && reason !== "sacked") t.movedTo = movedTo;
  return t;
}

export function openTenureOf(state: GameState, id: ManagerId | undefined): Tenure | undefined {
  const rec = recordOf(state, id);
  return rec?.tenures.find((t) => !t.to);
}

/** The tenure of this manager at this club that covers a given moment, if any. */
export function tenureAt(state: GameState, id: ManagerId, clubId: ClubId, season: number, turn: number): Tenure | undefined {
  const rec = recordOf(state, id);
  if (!rec) return undefined;
  const at = season * 100 + turn;
  return rec.tenures.find((t) => t.clubId === clubId && t.from.season * 100 + t.from.turn <= at && (!t.to || at <= t.to.season * 100 + t.to.turn));
}

export function creditHonour(state: GameState, clubId: ClubId, kind: keyof TenureHonours): void {
  const club = state.clubs[clubId];
  const t = openTenureOf(state, club?.manager.id);
  if (t && t.clubId === clubId) t.honours[kind]++;
}

export const seasonsOf = (t: Tenure, now: { season: number; turn: number }): number => Math.max(0, (t.to ?? now).season - t.from.season + ((t.to ?? now).turn > 4 ? 1 : 0));

/** Give every manager in the world an id and, if missing, the tenure already under way. Idempotent; used on load. */
export function ensureManagerIds(state: GameState): void {
  const reg = registryOf(state);
  const byKey = new Map<string, ManagerId>();
  for (const r of Object.values(reg)) byKey.set(`${r.name}|${r.born ?? ""}`, r.id);
  const idFor = (m: { id?: ManagerId; name: string; nationality: CountryCode; born?: number }): ManagerId => {
    if (m.id && reg[m.id]) return m.id;
    const key = `${m.name}|${m.born ?? ""}`;
    const known = byKey.get(key);
    if (known) return known;
    const id = registerManager(state, m);
    byKey.set(key, id);
    return id;
  };
  for (const club of Object.values(state.clubs).sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const m = club.manager;
    m.id = idFor(m);
    const open = openTenureOf(state, m.id);
    if (!open) reg[m.id].tenures.push({ clubId: club.id, from: { season: Math.min(m.since, state.season), turn: 1 }, honours: emptyHonours(), inherited: true });
    else if (open.clubId !== club.id) {
      // Corrupt data: one manager listed at two clubs. The club that lists him keeps him; the stale tenure is closed.
      open.to = { season: state.season, turn: state.turn };
      open.reason = "moved";
      reg[m.id].tenures.push({ clubId: club.id, from: { season: Math.min(m.since, state.season), turn: 1 }, honours: emptyHonours(), inherited: true });
    }
  }
  for (const pm of state.managerPool ?? []) {
    pm.id = idFor(pm);
    const open = openTenureOf(state, pm.id);
    if (open) {
      open.to = { season: state.season, turn: state.turn };
      open.reason ??= "sacked";
    }
  }
}

/** One club per manager: returns the ids that appear as the current manager of more than one club (should be none). */
export function duplicateManagers(state: GameState): ManagerId[] {
  const seen = new Set<ManagerId>();
  const dup = new Set<ManagerId>();
  for (const c of Object.values(state.clubs)) {
    const id = c.manager.id;
    if (!id) continue;
    if (seen.has(id)) dup.add(id);
    seen.add(id);
  }
  return [...dup];
}

/** The club a manager runs now, by way of his open tenure (no scan of the clubs). */
export const managerClub = (state: GameState, id: ManagerId): ClubState | undefined => {
  const t = openTenureOf(state, id);
  const c = t ? state.clubs[t.clubId] : undefined;
  return c && c.manager.id === id ? c : undefined;
};
