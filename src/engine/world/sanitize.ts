/**
 * Safety nets for the data the improvement pass added (match log, income ledger, contract clauses, international
 * allegiance, objectives). Run on every load, so an old or hand-edited save can never feed the engine a bad value.
 */
import { sanitizeClauses } from "../career/contracts";
import { sanitizeIntlState } from "../national/allegiance";
import { sanitizeIntl } from "../national/identity";
import { ensureManagerIds } from "../managers/registry";
import { currentStint, openStint, sanitizeManagerState } from "../managers/history";
import { sanitizeJersey } from "../jersey/numbers";
import { backfillMatchLog, MATCH_LOG_CAP, RESERVE_LOG_CAP } from "../stats/matchlog";
import type { GameState, MatchLogEntry } from "../types";

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

function validEntry(e: MatchLogEntry): boolean {
  return !!e && typeof e.fixtureId === "string" && finite(e.rating) && e.rating >= 0 && e.rating <= 10 && finite(e.season) && finite(e.turn) && finite(e.goals) && finite(e.assists) && Array.isArray(e.score);
}

export function sanitizeCareerData(state: GameState): void {
  const u = state.user;
  if (!u) return;
  // Match log: drop malformed entries, de-duplicate by fixture, keep the newest.
  if (Array.isArray(u.matchLog)) {
    const seen = new Set<string>();
    u.matchLog = u.matchLog.filter((e) => validEntry(e) && !seen.has(e.fixtureId) && !!seen.add(e.fixtureId)).slice(-MATCH_LOG_CAP);
  } else backfillMatchLog(state);
  u.reserveLog = Array.isArray(u.reserveLog) ? u.reserveLog.filter((e) => e && finite(e.rating) && finite(e.season) && finite(e.turn)).slice(-RESERVE_LOG_CAP) : [];
  u.relLog = Array.isArray(u.relLog) ? u.relLog.filter((e) => e && finite(e.delta) && typeof e.rel === "string").slice(-60) : [];

  // Income ledger: whatever was earned before itemising is kept as one honest "earlier" line.
  if (!u.pay || typeof u.pay !== "object" || !u.pay.career || !Array.isArray(u.pay.paid)) {
    u.pay = { career: u.earnings > 0 ? { earlier: u.earnings } : {}, season: { season: state.season, amounts: {} }, paid: [] };
  }
  if (!u.pay.season || !finite(u.pay.season.season)) u.pay.season = { season: state.season, amounts: {} };

  // Contract clauses on the player and on every stored offer.
  for (const p of Object.values(state.players)) sanitizeClauses(p.contract);
  for (const o of u.offers ?? []) {
    sanitizeClauses(o.terms);
    if (!finite(o.terms?.signingBonus) || o.terms.signingBonus < 0) o.terms.signingBonus = 0;
    if (!finite(o.terms?.goalBonus) || o.terms.goalBonus < 0) o.terms.goalBonus = 0;
  }

  // International identity for the user (and anyone with contradictory fields).
  for (const p of Object.values(state.players)) if (p.isUser || p.intl?.allegiance !== undefined || p.intl?.switches !== undefined) sanitizeIntl(p);
  const me = state.players[u.playerId];
  if (me) sanitizeIntl(me);
  sanitizeIntlState(state);

  // Objectives belong to a season and a club; anything stale is rebuilt on demand.
  if (u.objectives && (!Array.isArray(u.objectives.items) || !finite(u.objectives.season))) u.objectives = undefined;
  if (u.preMatch && (typeof u.preMatch !== "object" || typeof u.preMatch.last !== "object")) u.preMatch = undefined;

  // Managers: every one has an id and a tenure; the user's stints are valid, with one open for the current club.
  // Old saves begin tracking here: nothing is invented about the time before.
  ensureManagerIds(state);
  sanitizeManagerState(state);
  if (me && !u.retired && me.clubId) {
    const open = currentStint(state);
    if (!open || open.clubId !== me.clubId || open.managerId !== state.clubs[me.clubId]?.manager.id) openStint(state, me.clubId);
  }
  sanitizeJersey(state);

  // Clubs: play style stays inside 0–1.
  for (const c of Object.values(state.clubs)) {
    if (!c.style) c.style = { pressing: 0.5, tempo: 0.5, directness: 0.5 };
    for (const k of ["pressing", "tempo", "directness"] as const) c.style[k] = finite(c.style[k]) ? Math.min(1, Math.max(0, c.style[k])) : 0.5;
  }
}
