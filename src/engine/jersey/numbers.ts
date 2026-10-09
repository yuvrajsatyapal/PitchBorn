/**
 * Squad numbers. One documented abstraction: a club squad number is 1–99, unique among the players registered to the
 * club, and belongs to the player's CURRENT club registration. A national-team number is separate (it belongs to a
 * picked international squad). Numbers never change how a player plays: #9 does not finish better than #14.
 *
 * Ownership is computed from the squad itself (who is registered and wears what), so a number is free the moment its
 * wearer leaves, and the engine, not the UI, enforces uniqueness (`repairSquad`).
 */
import { BALANCE } from "../balance";
import { clubName } from "../data/world";
import { Factors } from "../memory/score";
import { recordMemory } from "../memory/store";
import { overallFor } from "../players/attributes";
import { ageOf } from "../players/generate";
import type { ClubId, ClubState, GameState, JerseyState, NationalTeamState, NumberTenure, Player, PlayerId, Position } from "../types";
import { addNews, userPlayer } from "../world/helpers";

export const SQUAD_NO_MIN = 1;
export const SQUAD_NO_MAX = 99;
/** Numbers that go with standing, so they are not handed to every prospect. */
export const PRESTIGE_NUMBERS: readonly number[] = [7, 9, 10];
const HISTORY_CAP = 24;

/** Suggestions, not rules: a striker may wear any free number. */
export const POSITION_NUMBERS: Record<Position, number[]> = {
  GK: [1, 13, 12, 25, 31],
  RB: [2, 12, 22, 20],
  LB: [3, 15, 21, 23],
  CB: [4, 5, 15, 16, 24],
  DM: [6, 4, 14, 16],
  CM: [8, 6, 14, 16, 18],
  AM: [10, 8, 17, 11],
  RW: [7, 11, 17, 19],
  LW: [11, 7, 19, 17],
  ST: [9, 10, 19, 18, 20],
};

export const isValidNumber = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= SQUAD_NO_MIN && n <= SQUAD_NO_MAX;

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export const squadMembers = (state: GameState, clubId: ClubId): Player[] => {
  const out: Player[] = [];
  for (const id of state.clubs[clubId]?.squad ?? []) {
    const p = state.players[id];
    if (p && !p.retired) out.push(p);
  }
  return out;
};

export const numberOwner = (state: GameState, clubId: ClubId, no: number): Player | undefined => squadMembers(state, clubId).find((p) => p.squadNo === no);

export const isRetiredNumber = (club: ClubState | undefined, no: number): boolean => !!club?.retiredNumbers?.some((r) => r.no === no);

/** The one place that says whether a number can be worn. */
export function isSquadNumberAvailable(state: GameState, clubId: ClubId, no: number, playerId?: PlayerId): boolean {
  if (!isValidNumber(no) || !state.clubs[clubId]) return false;
  if (isRetiredNumber(state.clubs[clubId], no)) return false;
  const owner = numberOwner(state, clubId, no);
  return !owner || owner.id === playerId;
}

const roleOf = (p: Player) => p.contract?.role ?? "backup";
const ovr = (p: Player) => overallFor(p.attrs, p.position);

/** Number of whole seasons a tenure covers (a tenure that ended in the first weeks of a season does not count that one). */
export function tenureSeasons(t: NumberTenure, now: { season: number; turn: number }): number {
  const end = t.to ?? now;
  return Math.max(1, end.season - t.from.season + (end.turn > 4 && end.season > t.from.season ? 1 : 0));
}

/** The number the user has worn most, if long enough to call it theirs. Derived from history, so nothing extra is stored. */
export function preferredNumber(state: GameState): number | undefined {
  const j = state.user.jersey;
  if (!j) return undefined;
  const now = { season: state.season, turn: state.turn };
  const by = new Map<number, number>();
  for (const t of j.history) by.set(t.no, (by.get(t.no) ?? 0) + tenureSeasons(t, now));
  let best: [number, number] | undefined;
  for (const [no, seasons] of by) if (seasons >= 2 && (!best || seasons > best[1])) best = [no, seasons];
  return best?.[0];
}

function rangeFree(state: GameState, clubId: ClubId, p: Player, lo: number, hi: number, offset = 0): number | undefined {
  const span = hi - lo + 1;
  for (let i = 0; i < span; i++) {
    const n = lo + ((i + offset) % span);
    if (isSquadNumberAvailable(state, clubId, n, p.id)) return n;
  }
  return undefined;
}

/** Ordered numbers that would be sensible for this player at this club, all of them currently available. */
export function suggestNumbers(state: GameState, clubId: ClubId, p: Player, limit = 12): number[] {
  const out: number[] = [];
  const add = (n: number | undefined) => {
    if (n !== undefined && !out.includes(n) && isSquadNumberAvailable(state, clubId, n, p.id)) out.push(n);
  };
  if (p.isUser) add(preferredNumber(state));
  add(p.squadNo);
  const role = roleOf(p);
  const senior = role === "star" || role === "first";
  for (const n of POSITION_NUMBERS[p.position].filter((x) => senior || !PRESTIGE_NUMBERS.includes(x))) add(n);
  for (let n = 12; n <= 40 && out.length < limit; n++) add(n);
  for (let n = 41; n <= SQUAD_NO_MAX && out.length < limit; n++) add(n);
  for (let n = 1; n <= 11 && out.length < limit; n++) if (!PRESTIGE_NUMBERS.includes(n)) add(n);
  return out.slice(0, limit);
}

/** The number a player is given when none is chosen: stable, football-sensible, and not a prestige shirt for a prospect. */
export function pickNumber(state: GameState, clubId: ClubId, p: Player): number {
  const role = roleOf(p);
  const young = ageOf(p, state.season) <= 19;
  const prospect = role === "prospect" || (young && role !== "star" && role !== "first");
  if (p.isUser) {
    const pref = preferredNumber(state);
    if (pref !== undefined && isSquadNumberAvailable(state, clubId, pref, p.id) && (!PRESTIGE_NUMBERS.includes(pref) || role === "star" || role === "first")) return pref;
  }
  // The number already worn stays, unless it is a prestige shirt that does not fit the player's standing.
  if (isValidNumber(p.squadNo) && isSquadNumberAvailable(state, clubId, p.squadNo, p.id) && (!PRESTIGE_NUMBERS.includes(p.squadNo) || role === "star" || role === "first" || role === "rotation")) return p.squadNo;
  const conventional = POSITION_NUMBERS[p.position];
  if (role === "star" || role === "first") for (const n of conventional) if (isSquadNumberAvailable(state, clubId, n, p.id)) return n;
  if (role === "rotation") for (const n of conventional) if (!PRESTIGE_NUMBERS.includes(n) && isSquadNumberAvailable(state, clubId, n, p.id)) return n;
  const off = hash(p.id);
  const n = prospect ? rangeFree(state, clubId, p, 30, 49, off % 20) : rangeFree(state, clubId, p, 12, 29, off % 18);
  return n ?? rangeFree(state, clubId, p, 12, SQUAD_NO_MAX) ?? rangeFree(state, clubId, p, 1, 11) ?? SQUAD_NO_MAX;
}

/** Makes one squad valid: numbers in range, unique, not retired. Stable: a valid number is never changed. */
export function repairSquad(state: GameState, clubId: ClubId): void {
  const club = state.clubs[clubId];
  if (!club) return;
  const members = squadMembers(state, clubId).sort((a, b) => (a.isUser ? -1 : b.isUser ? 1 : ovr(b) - ovr(a) || (a.id < b.id ? -1 : 1)));
  const seen = new Set<number>();
  const need: Player[] = [];
  for (const p of members) {
    if (isValidNumber(p.squadNo) && !seen.has(p.squadNo) && !isRetiredNumber(club, p.squadNo)) seen.add(p.squadNo);
    else need.push(p);
  }
  for (const p of need) p.squadNo = undefined;
  for (const p of need) p.squadNo = pickNumber(state, clubId, p);
}

export function repairAllSquads(state: GameState): void {
  for (const id of Object.keys(state.clubs).sort()) repairSquad(state, id);
}

// ------------------------------------------------------------------------------------------------ the user's numbers

export const jerseyOf = (state: GameState): JerseyState => (state.user.jersey ??= { history: [], intl: [] });

const stamp = (state: GameState) => ({ season: state.season, turn: state.turn });

/** Records the number in the user's history, only when the club or the number changes. */
export function recordNumber(state: GameState, clubId: ClubId, no: number): void {
  const j = jerseyOf(state);
  const last = j.history[j.history.length - 1];
  if (last && !last.to && last.clubId === clubId && last.no === no) return;
  if (last && !last.to) last.to = stamp(state);
  j.history.push({ clubId, no, from: stamp(state) });
  if (j.history.length > HISTORY_CAP) j.history.splice(0, j.history.length - HISTORY_CAP);
}

export function endNumberTenure(state: GameState): void {
  const last = state.user.jersey?.history[state.user.jersey.history.length - 1];
  if (last && !last.to) last.to = stamp(state);
}

/** A player was registered to a club: keep a valid number, or give one. The user also gets a free choice. */
export function onSquadJoin(state: GameState, p: Player, clubId: ClubId): void {
  if (!state.clubs[clubId]) return;
  p.squadNo = pickNumber(state, clubId, p);
  if (!p.isUser) return;
  const j = jerseyOf(state);
  const before = j.history.filter((t) => t.clubId === clubId);
  recordNumber(state, clubId, p.squadNo);
  j.choice = true;
  const now = stamp(state);
  const returning = before.some((t) => t.no === p.squadNo && tenureSeasons(t, now) >= 3);
  if (returning && state.turn >= 1) {
    addNews(state, { kind: "career", title: "Returning number", body: `${p.firstName} ${p.lastName} will once again wear #${p.squadNo} at ${clubName(clubId)}.` });
    numberMemory(state, clubId, p.squadNo, "return", 28);
  }
}

export function onSquadLeave(state: GameState, p: Player): void {
  if (p.isUser) endNumberTenure(state);
}

function numberMemory(state: GameState, clubId: ClubId, no: number, event: "iconic" | "return", pts: number): void {
  const f = new Factors().add(event === "iconic" ? `Took the #${no} shirt as a star` : `Back in the #${no} shirt`, pts);
  recordMemory(state, { kind: "shirt-number", clubId, tags: ["shirt-number", event], factors: f, key: `no-${clubId}-${no}-${event}`, data: { event, no } });
}

export interface ChangeRule {
  ok: boolean;
  reason?: string;
}

/** The dashboard prompt for a free number lapses a month (4 weeks) after joining, even if never used. */
export const NUMBER_PROMPT_WEEKS = 4;

export function numberPromptOpen(state: GameState): boolean {
  const j = state.user.jersey;
  const last = j?.history[j.history.length - 1];
  if (!j?.choice || !last || last.to) return false;
  const weeks = (state.season - last.from.season) * BALANCE.calendar.turnsPerSeason + state.turn - last.from.turn;
  return weeks < NUMBER_PROMPT_WEEKS;
}

/** Numbers are changed when joining a club or at the start of a season, not before every match. */
export function canChangeNumber(state: GameState): ChangeRule {
  const u = userPlayer(state);
  if (!u.clubId || state.user.retired) return { ok: false, reason: "You have no club." };
  const j = jerseyOf(state);
  if (j.choice) return { ok: true };
  if (state.turn <= 9 && j.changedSeason !== state.season) return { ok: true };
  return { ok: false, reason: j.changedSeason === state.season && state.turn <= 9 ? "You have already changed your number this season." : "Numbers can be changed when you join a club or at the start of a season." };
}

export interface ChangeResult {
  ok: boolean;
  message: string;
}

export function chooseSquadNumber(state: GameState, no: number, opts: { force?: boolean } = {}): ChangeResult {
  const u = userPlayer(state);
  if (!u.clubId) return { ok: false, message: "You have no club." };
  const rule = opts.force ? { ok: true } : canChangeNumber(state);
  if (!rule.ok) return { ok: false, message: rule.reason ?? "Not now." };
  if (!isValidNumber(no)) return { ok: false, message: `Squad numbers run from ${SQUAD_NO_MIN} to ${SQUAD_NO_MAX}.` };
  if (u.squadNo === no) return { ok: true, message: `You keep #${no}.` };
  const club = state.clubs[u.clubId];
  if (isRetiredNumber(club, no)) return { ok: false, message: `#${no} has been retired by ${clubName(club.id)}.` };
  const owner = numberOwner(state, club.id, no);
  if (owner) return { ok: false, message: `#${no} is worn by ${owner.lastName}.` };
  const j = jerseyOf(state);
  const star = roleOf(u) === "star" || roleOf(u) === "first";
  u.squadNo = no;
  recordNumber(state, club.id, no);
  j.choice = false;
  j.changedSeason = state.season;
  if (PRESTIGE_NUMBERS.includes(no) && star && u.reputation >= 55) {
    addNews(state, { kind: "career", title: "Iconic shirt", body: `${u.firstName} ${u.lastName} has taken the #${no} shirt at ${clubName(club.id)}.`, important: true });
    numberMemory(state, club.id, no, "iconic", 26 + (u.reputation - 55) * 0.4);
  } else if (no <= 11) addNews(state, { kind: "career", title: "New number", body: `${u.firstName} ${u.lastName} will wear the #${no} shirt${state.turn <= 9 ? " this season" : ""}.` });
  return { ok: true, message: `You will wear #${no}.` };
}

export interface NumberOption {
  no: number;
  free: boolean;
  mine: boolean;
  retired: boolean;
  ownerName?: string;
  ownerId?: PlayerId;
  suggested?: boolean;
}

/** Every number with who has it, for the picker. */
export function numberOptions(state: GameState): NumberOption[] {
  const u = userPlayer(state);
  const clubId = u.clubId;
  if (!clubId) return [];
  const club = state.clubs[clubId];
  const owners = new Map<number, Player>();
  for (const p of squadMembers(state, clubId)) if (p.squadNo !== undefined) owners.set(p.squadNo, p);
  const sug = new Set(suggestNumbers(state, clubId, u, 6));
  const out: NumberOption[] = [];
  for (let n = SQUAD_NO_MIN; n <= SQUAD_NO_MAX; n++) {
    const o = owners.get(n);
    const retired = isRetiredNumber(club, n);
    out.push({ no: n, free: !retired && (!o || o.id === u.id), mine: o?.id === u.id, retired, ownerName: o && o.id !== u.id ? `${o.firstName[0]}. ${o.lastName}` : undefined, ownerId: o && o.id !== u.id ? o.id : undefined, suggested: sug.has(n) });
  }
  return out;
}

/** At a registration point, offer a vacated number the player has a real claim on. Once a season, and never spam. */
export function offerVacatedNumber(state: GameState): void {
  const u = userPlayer(state);
  if (!u.clubId || state.user.retired || u.squadNo === undefined) return;
  const j = jerseyOf(state);
  if (state.user.decisions.some((d) => d.jerseyNo !== undefined)) return;
  const declined = j.declined?.season === state.season ? j.declined.nos : [];
  const role = roleOf(u);
  const pref = preferredNumber(state);
  let cand: number | undefined;
  if (pref !== undefined && pref !== u.squadNo && isSquadNumberAvailable(state, u.clubId, pref, u.id)) cand = pref;
  else if ((role === "star" || role === "first") && u.reputation >= 55 && !(u.squadNo <= 11 && PRESTIGE_NUMBERS.includes(u.squadNo))) cand = POSITION_NUMBERS[u.position].find((n) => PRESTIGE_NUMBERS.includes(n) && n !== u.squadNo && isSquadNumberAvailable(state, u.clubId as string, n, u.id));
  if (cand === undefined || declined.includes(cand)) return;
  state.user.decisions.push({
    id: `d-no-${state.season}-${cand}`,
    kind: "event",
    title: "Squad number available",
    body: `The #${cand} shirt is free${pref === cand ? ", the number you have worn most" : ""}. You currently wear #${u.squadNo}.`,
    options: [
      { id: "request", label: `Request #${cand}`, hint: "A one-off change for this season." },
      { id: "keep", label: `Keep #${u.squadNo}` },
    ],
    expiresTurn: Math.min(state.turn + 6, 9),
    season: state.season,
    eventId: "jersey-number",
    fallback: "keep",
    jerseyNo: cand,
  });
}

export function resolveJerseyDecision(state: GameState, no: number, optionId: string): string {
  if (optionId === "request") {
    const r = chooseSquadNumber(state, no, { force: true });
    return r.message;
  }
  const j = jerseyOf(state);
  j.declined = { season: state.season, nos: [...(j.declined?.season === state.season ? j.declined.nos : []), no] };
  return `You keep #${userPlayer(state).squadNo}.`;
}

// ------------------------------------------------------------------------------------------------- national numbers

const NAT_CONVENTIONAL: Record<Position, number[]> = {
  GK: [1, 12, 23, 26],
  RB: [2, 12, 22, 21],
  LB: [3, 15, 21, 24],
  CB: [4, 5, 15, 16, 20],
  DM: [6, 14, 16, 4],
  CM: [8, 6, 14, 16, 18],
  AM: [10, 8, 17, 25],
  RW: [7, 11, 17, 19],
  LW: [11, 7, 19, 17],
  ST: [9, 10, 19, 18, 20],
};

/** Numbers for a nation's picked squad. Separate from club numbers; previous numbers are kept while still valid. */
export function assignNationalNumbers(state: GameState, nt: NationalTeamState): void {
  const prev = nt.numbers ?? {};
  const squad = nt.squad.map((id) => state.players[id]).filter((p): p is Player => !!p).sort((a, b) => (a.isUser ? -1 : b.isUser ? 1 : ovr(b) - ovr(a) || (a.id < b.id ? -1 : 1)));
  const numbers: Record<PlayerId, number> = {};
  const used = new Set<number>();
  for (const p of squad) {
    const n = prev[p.id];
    if (isValidNumber(n) && !used.has(n)) {
      numbers[p.id] = n;
      used.add(n);
    }
  }
  const free = (n: number) => isValidNumber(n) && !used.has(n);
  for (const p of squad) {
    if (numbers[p.id] !== undefined) continue;
    let pick: number | undefined;
    if (p.isUser) {
      const pref = preferredNumber(state);
      if (pref !== undefined && free(pref)) pick = pref;
    }
    pick ??= NAT_CONVENTIONAL[p.position].find(free);
    if (pick === undefined) for (let n = 2; n <= SQUAD_NO_MAX; n++) if (free(n) && n !== 1) { pick = n; break; }
    numbers[p.id] = pick ?? SQUAD_NO_MAX;
    used.add(numbers[p.id]);
  }
  nt.numbers = numbers;
  const u = userPlayer(state);
  if (numbers[u.id] !== undefined) noteIntlNumber(state, nt.code, numbers[u.id]);
}

function noteIntlNumber(state: GameState, code: string, no: number): void {
  const j = jerseyOf(state);
  const same = j.intl.find((e) => e.code === code && e.season === state.season);
  if (same) same.no = no;
  else j.intl.push({ code, no, season: state.season });
  if (j.intl.length > 16) j.intl.splice(0, j.intl.length - 16);
}

export function intlNumberOf(state: GameState): { code: string; no: number } | undefined {
  const u = userPlayer(state);
  for (const nt of Object.values(state.nationalTeams)) if (nt.squad.includes(u.id) && nt.numbers?.[u.id] !== undefined) return { code: nt.code, no: nt.numbers[u.id] };
  return undefined;
}

export function chooseIntlNumber(state: GameState, no: number): ChangeResult {
  const u = userPlayer(state);
  const cur = intlNumberOf(state);
  if (!cur) return { ok: false, message: "You are not in an international squad." };
  const nt = state.nationalTeams[cur.code];
  if (!isValidNumber(no)) return { ok: false, message: `Numbers run from ${SQUAD_NO_MIN} to ${SQUAD_NO_MAX}.` };
  const holder = Object.entries(nt.numbers ?? {}).find(([id, n]) => n === no && id !== u.id);
  if (holder) return { ok: false, message: `#${no} is taken in the squad.` };
  (nt.numbers ??= {})[u.id] = no;
  noteIntlNumber(state, nt.code, no);
  return { ok: true, message: `You will wear #${no} for your country.` };
}

/** Free numbers in the squad the user is in, for the picker. */
export function intlNumberOptions(state: GameState): { no: number; free: boolean; mine: boolean }[] {
  const cur = intlNumberOf(state);
  if (!cur) return [];
  const nt = state.nationalTeams[cur.code];
  const taken = new Set(Object.entries(nt.numbers ?? {}).filter(([id]) => id !== userPlayer(state).id).map(([, n]) => n));
  return Array.from({ length: 40 }, (_, i) => i + 1).map((no) => ({ no, free: !taken.has(no), mine: no === cur.no }));
}

// ----------------------------------------------------------------------------------------------------- sanitising

export function sanitizeJersey(state: GameState): void {
  const u = state.user;
  const ok = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
  repairAllSquads(state);
  for (const nt of Object.values(state.nationalTeams)) {
    if (!nt.numbers || typeof nt.numbers !== "object") continue;
    const used = new Set<number>();
    for (const id of nt.squad) {
      const n = nt.numbers[id];
      if (!isValidNumber(n) || used.has(n)) delete nt.numbers[id];
      else used.add(n);
    }
    for (const id of Object.keys(nt.numbers)) if (!nt.squad.includes(id)) delete nt.numbers[id];
  }
  const me = state.players[u.playerId];
  if (!u.jersey || typeof u.jersey !== "object") u.jersey = { history: [], intl: [] };
  const j = u.jersey;
  j.history = Array.isArray(j.history) ? j.history.filter((t) => t && typeof t.clubId === "string" && isValidNumber(t.no) && t.from && ok(t.from.season)) : [];
  j.intl = Array.isArray(j.intl) ? j.intl.filter((e) => e && typeof e.code === "string" && isValidNumber(e.no) && ok(e.season)).slice(-16) : [];
  // Tenures run one after another: an earlier one that was left open ends where the next begins.
  j.history.sort((a, b) => a.from.season * 100 + a.from.turn - (b.from.season * 100 + b.from.turn));
  for (let i = 0; i < j.history.length - 1; i++) if (!j.history[i].to || j.history[i].to!.season * 100 + j.history[i].to!.turn > j.history[i + 1].from.season * 100 + j.history[i + 1].from.turn) j.history[i].to = j.history[i + 1].from;
  j.history = j.history.slice(-HISTORY_CAP);
  if (me?.clubId && me.squadNo !== undefined) {
    const last = j.history[j.history.length - 1];
    // Old saves start their history here: the current number, from now, with nothing invented before it.
    if (!last || last.to || last.clubId !== me.clubId || last.no !== me.squadNo) recordNumber(state, me.clubId, me.squadNo);
  }
}

// ---------------------------------------------------------------------------------------------------- history rows

export interface JerseyRow {
  clubId: ClubId;
  span: string;
  numbers: { no: number; span: string }[];
}

const spanOf = (a: { season: number }, b: { season: number }) => (a.season === b.season ? `${a.season}` : `${a.season}–${b.season}`);

/** Club tenures, with a change of number inside one club shown as "#37 → #9". Compact: read straight from the history. */
export function jerseyRows(state: GameState): JerseyRow[] {
  const rows: JerseyRow[] = [];
  const now = stamp(state);
  for (const t of jerseyOf(state).history) {
    const end = t.to ?? now;
    const last = rows[rows.length - 1];
    const lastEnd = t.to ? end : now;
    const numSpan = spanOf(t.from, lastEnd);
    if (last && last.clubId === t.clubId) {
      last.numbers.push({ no: t.no, span: numSpan });
      last.span = `${last.span.split("–")[0]}–${lastEnd.season}`.replace(/^(\d+)–\1$/, "$1");
    } else rows.push({ clubId: t.clubId, span: numSpan, numbers: [{ no: t.no, span: numSpan }] });
  }
  return rows;
}
