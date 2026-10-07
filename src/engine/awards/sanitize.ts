import type { AwardNominee, AwardNomination, AwardResult, CeremonyStatus, GameState, SeasonCeremony, TeamOfSeasonSlot } from "../types";
import { POSITIONS } from "../types";
import { buildScenes } from "./ceremony";

const STATUSES: readonly CeremonyStatus[] = ["not-ready", "ready", "in-progress", "completed"];
const TIERS = ["statistical", "special", "major"] as const;
const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);

function nominees(v: unknown, state: GameState): AwardNominee[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((n) => n && typeof n === "object" && typeof n.playerId === "string" && state.players[n.playerId])
    .map((n) => ({
      playerId: n.playerId as string,
      clubId: typeof n.clubId === "string" && state.clubs[n.clubId] ? n.clubId : null,
      position: POSITIONS.includes(n.position) ? n.position : state.players[n.playerId].position,
      age: Math.max(0, num(n.age)),
      apps: Math.max(0, num(n.apps)),
      goals: Math.max(0, num(n.goals)),
      assists: Math.max(0, num(n.assists)),
      cleanSheets: Math.max(0, num(n.cleanSheets)),
      saves: Math.max(0, num(n.saves)),
      avgRating: Math.max(0, num(n.avgRating)),
      reason: str(n.reason),
    }));
}

/**
 * Keeps the ceremony usable whatever a save holds. Results whose players no longer exist are dropped; a ceremony
 * with nothing left to show is closed without consequences being applied twice; the step is clamped; an applied
 * ceremony can never be completed again.
 */
export function sanitizeCeremony(state: GameState): void {
  const raw = state.ceremony as Partial<SeasonCeremony> | undefined;
  if (!raw || typeof raw !== "object") {
    delete state.ceremony;
    return;
  }
  const results: AwardResult[] = (Array.isArray(raw.results) ? raw.results : [])
    .filter((r) => r && typeof r === "object" && typeof r.id === "string")
    .map((r) => ({ ...r, nominees: nominees(r.nominees, state) }) as AwardResult)
    .filter((r) => r.nominees.length > 0 && TIERS.includes(r.tier))
    .map((r) => ({ ...r, winnerId: r.nominees[0].playerId, margin: [1, 3, 9].includes(num(r.margin)) ? num(r.margin) : 9, scope: str(r.scope), name: str(r.name, r.id), leagueId: str(r.leagueId), compId: str(r.compId) }));
  const team: TeamOfSeasonSlot[] = (Array.isArray(raw.team) ? raw.team : [])
    .filter((t) => t && typeof t === "object" && typeof t.playerId === "string" && state.players[t.playerId])
    .map((t) => ({ slot: str(t.slot), label: str(t.label), playerId: t.playerId as string, clubId: typeof t.clubId === "string" && state.clubs[t.clubId] ? t.clubId : null, position: POSITIONS.includes(t.position) ? t.position : state.players[t.playerId].position, reason: str(t.reason) }));
  const others = (Array.isArray(raw.others) ? raw.others : [])
    .filter((o) => o && typeof o === "object" && typeof o.playerId === "string")
    .map((o) => ({ id: str(o.id), name: str(o.name), scope: str(o.scope), leagueId: str(o.leagueId), playerId: o.playerId as string }));
  const applied = raw.applied === true;
  let status: CeremonyStatus = STATUSES.includes(raw.status as CeremonyStatus) ? (raw.status as CeremonyStatus) : "completed";
  if (applied) status = "completed";
  if (!results.length && !team.length) status = "completed";
  const c: SeasonCeremony = {
    season: num(raw.season, state.season),
    leagueId: str(raw.leagueId),
    leagueName: str(raw.leagueName),
    status,
    step: 0,
    results,
    team,
    formation: str(raw.formation, "4-3-3"),
    others,
    // A ceremony that is finished, or that has nothing left to give, must never apply its consequences again.
    applied: applied || status === "completed",
    how: raw.how === "watched" || raw.how === "skipped" || raw.how === "auto" ? raw.how : undefined,
    turnIndex: num(raw.turnIndex, state.turnIndex),
  };
  c.step = Math.max(0, Math.min(Math.round(num(raw.step)), buildScenes(c).length - 1));
  state.ceremony = c;

  const noms: AwardNomination[] = (Array.isArray(state.user.awardNoms) ? state.user.awardNoms : [])
    .filter((n) => n && typeof n === "object" && typeof n.id === "string")
    .map((n) => ({ season: num(n.season, state.season), id: n.id, name: str(n.name, n.id), scope: str(n.scope), place: Math.max(2, Math.min(4, Math.round(num(n.place, 2)))) }));
  state.user.awardNoms = noms.slice(-60);
}
