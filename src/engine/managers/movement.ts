/**
 * Managers changing clubs, kept light. Mid-season sackings stay as they were; at the season boundary every club's
 * manager is reviewed once: his standing moves a little with results, the old retire, a few are sacked or resign
 * after a poor season, and the vacancies are filled by an available coach or by an overachiever from a smaller club.
 * One manager runs one club: a tenure is closed before another is opened, and the registry is the record.
 */
import { clubName, staticClub } from "../data/world";
import { leagueCompId } from "../competitions/setup";
import { clamp, type Rng } from "../rng";
import type { ClubState, DepartureReason, GameState, ManagerId } from "../types";
import { addNews } from "../world/helpers";
import { hireManager, managerPool, releaseManager, removeFromPool } from "../world/managers";
import { closeTenure, openTenure, openTenureOf, recordOf } from "./registry";
import { onFormerManagerMoved, onManagerChangedAtUserClub } from "./story";

const RETIRE_FROM = 65;
/** Most clubs that may lose a manager in one off-season, as a share of all clubs. */
const MAX_TURNOVER = 0.07;

const rollStyle = (rng: Rng) => ({ pressing: rng.next(), tempo: rng.next(), directness: rng.next() });
const homeNation = (club: ClubState) => staticClub(club.id)?.countryCode ?? "ENG";

/** Ends a manager's time at a club for a reason the simulation knows, and sends him where he belongs (pool, or retirement). */
export function vacate(state: GameState, club: ClubState, reason: DepartureReason, movedTo?: string): ManagerId | undefined {
  const m = club.manager;
  if (!m.id) return undefined;
  closeTenure(state, m.id, reason, movedTo);
  if (reason === "retired") {
    const rec = recordOf(state, m.id);
    if (rec) rec.retired = state.season;
  } else if (reason !== "moved") releaseManager(state, m);
  return m.id;
}

/** Puts a new manager in charge, opens his tenure, and tells whoever it matters to. */
export function fill(state: GameState, rng: Rng, club: ClubState, oldId: ManagerId | undefined, reason: DepartureReason, successor?: ClubState["manager"]): void {
  const next = successor ?? hireManager(state, rng, club, rng.chance(0.6) ? homeNation(club) : rng.pick(["ESP", "POR", "ITA", "GER", "FRA", "NED", "ARG"]));
  next.since = state.season;
  club.manager = next;
  if (next.id) {
    removeFromPool(state, next.id);
    openTenure(state, next.id, club.id);
  }
  // A new manager brings his own way of playing.
  club.style = rollStyle(rng);
  onManagerChangedAtUserClub(state, club, oldId, reason);
  if (next.id) onFormerManagerMoved(state, next.id, undefined, club, "moved");
}

/** Sack (or accept the resignation of) a manager mid-season and appoint a successor. */
export function replaceManager(state: GameState, rng: Rng, club: ClubState, reason: DepartureReason): void {
  const oldId = vacate(state, club, reason);
  const old = club.manager;
  fill(state, rng, club, oldId, reason);
  if (club.reputation > 80 && state.user && userClubIs(state, club.id) === false) {
    addNews(state, { kind: "world", title: `${clubName(club.id)} ${reason === "resigned" ? "lose" : "part ways with"} ${old.name}`, body: `${club.manager.name} is the new manager.` });
  }
}

const userClubIs = (state: GameState, clubId: string) => state.players[state.user.playerId]?.clubId === clubId;

export interface MovementReport {
  retired: number;
  sacked: number;
  resigned: number;
  moved: number;
}

const ageOf = (state: GameState, born?: number) => (born ? state.season - born : 50);

/**
 * The season-boundary review. Called once as a season ends (before the counters roll over), so tenures end in the
 * season they belong to.
 */
export function seasonBoundaryManagers(state: GameState, rng: Rng, promoted: Set<string>, relegated: Set<string>): MovementReport {
  const report: MovementReport = { retired: 0, sacked: 0, resigned: 0, moved: 0 };
  const clubs = Object.values(state.clubs).sort((a, b) => (a.id < b.id ? -1 : 1));
  const cap = Math.max(2, Math.ceil(clubs.length * MAX_TURNOVER));
  const info = new Map<string, { pos: number; size: number; under: number }>();

  // 1. Review: results move a manager's standing a little, and are written onto his tenure.
  for (const club of clubs) {
    const comp = state.competitions[leagueCompId(club.leagueId, state.season)];
    const table = comp?.table;
    const idx = table ? table.findIndex((r) => r.team === club.id) : -1;
    const pos = idx >= 0 ? idx + 1 : 0;
    const size = table?.length ?? 0;
    const t = openTenureOf(state, club.manager.id);
    if (t) {
      if (pos) t.pos = pos;
      if (promoted.has(club.id)) t.honours.promotions++;
      if (relegated.has(club.id)) t.honours.relegations++;
      if (comp?.winner === club.id) t.honours.league++;
    }
    if (pos && size) {
      const exp = club.expectation ?? pos;
      const delta = clamp(((exp - pos) / size) * 4 + (comp?.winner === club.id ? 1 : 0) + (promoted.has(club.id) ? 1 : 0) - (relegated.has(club.id) ? 1.5 : 0), -2.5, 2.5);
      club.manager.quality = Math.round(clamp(club.manager.quality + delta, 15, 99));
      info.set(club.id, { pos, size, under: pos - exp });
    }
  }

  const vacancies: { club: ClubState; oldId: ManagerId | undefined; reason: DepartureReason }[] = [];
  const vacating = new Set<string>();

  // 2. Retirement: older managers step away, employed or not.
  for (const club of clubs) {
    const age = ageOf(state, club.manager.born);
    if (age >= RETIRE_FROM && rng.chance(Math.min(0.55, (age - (RETIRE_FROM - 1)) * 0.07))) {
      vacancies.push({ club, oldId: vacate(state, club, "retired"), reason: "retired" });
      vacating.add(club.id);
      report.retired++;
    }
  }
  for (const m of [...managerPool(state)]) {
    const age = ageOf(state, m.born);
    if (age >= RETIRE_FROM && rng.chance(Math.min(0.55, (age - (RETIRE_FROM - 1)) * 0.07))) {
      removeFromPool(state, m.id ?? "");
      const rec = recordOf(state, m.id);
      if (rec) rec.retired = state.season;
      else managerPool(state).splice(managerPool(state).indexOf(m), 1);
      report.retired++;
    }
  }

  // 3. A poor season costs some their job (or they walk): a year's grace for a new appointment, and a cap on turnover.
  for (const club of clubs) {
    if (vacating.size >= cap || vacating.has(club.id)) continue;
    const i = info.get(club.id);
    if (!i || state.season - club.manager.since < 1) continue;
    const down = relegated.has(club.id);
    if (!down && i.under < 8) continue;
    const p = down ? 0.4 : Math.min(0.35, 0.1 + 0.03 * (i.under - 8));
    if (!rng.chance(p)) continue;
    const reason: DepartureReason = rng.chance(0.25) ? "resigned" : "sacked";
    vacancies.push({ club, oldId: vacate(state, club, reason), reason });
    vacating.add(club.id);
    report[reason === "sacked" ? "sacked" : "resigned"]++;
  }

  // 4. Fill the vacancies, biggest club first. A club may tempt an overachiever from a smaller one; that club then hires in turn.
  vacancies.sort((a, b) => b.club.reputation - a.club.reputation);
  const over = clubs.filter((c) => {
    const i = info.get(c.id);
    return !!i && !vacating.has(c.id) && i.under <= -3 && state.season - c.manager.since >= 1 && c.manager.quality >= 45 && ageOf(state, c.manager.born) < RETIRE_FROM;
  });
  const taken = new Set<string>();
  const knock: { club: ClubState; oldId: ManagerId | undefined }[] = [];
  for (const v of vacancies) {
    const options = over.filter((c) => !taken.has(c.id) && c.id !== v.club.id && c.reputation <= v.club.reputation - 6 && c.reputation >= v.club.reputation - 35);
    if (options.length && rng.chance(0.4)) {
      const pick = rng.weighted(options, (c) => Math.max(1, c.manager.quality - 30));
      taken.add(pick.id);
      const mover = { ...pick.manager };
      const oldId = vacate(state, pick, "moved", v.club.id);
      knock.push({ club: pick, oldId });
      fill(state, rng, v.club, v.oldId, v.reason, mover);
      report.moved++;
    } else fill(state, rng, v.club, v.oldId, v.reason);
  }
  for (const k of knock) fill(state, rng, k.club, k.oldId, "moved");
  return report;
}
