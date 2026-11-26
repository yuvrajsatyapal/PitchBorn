/**
 * The board of the club the user manages: season objectives, a wage cap, and the academy pipeline.
 *
 *  - Objectives are set at the start of each season (or on taking the job): a league finish, a cup run, academy debuts
 *    and staying inside the wage cap. Met objectives lift board confidence, missed ones cut it; finishing the season far
 *    below the league target with confidence already low costs the job. Mid-season, a failing league objective with low
 *    confidence brings an ultimatum.
 *  - The wage cap is the share of revenue the board lets the squad's wages take. Signings that would break it are
 *    refused (see coachMarket.ts).
 *  - Academy intake day (in spring) brings the manager two extra prospects shaped by the club's academy; he can promote
 *    any academy player into the first-team squad, which makes a debut more likely.
 *
 * No world RNG: intake draws from `Rng.fromSeed(seed:board:…)`.
 */
import { BALANCE } from "../balance";
import { annualRevenue } from "../club/ownership";
import { cupCompId, CUP_STAGES, leagueCompId } from "../competitions/setup";
import { clubName, staticClub } from "../data/world";
import { marketValue, playerWage } from "../players/economy";
import { ageOf, generatePlayer } from "../players/generate";
import { clamp, Rng } from "../rng";
import type { BoardObjective, ClubState, GameState, Player, PlayerId, Position } from "../types";
import { clubLevel } from "../world/create";
import { addNews, fullName, nextId, squadOf } from "../world/helpers";
import { coachClub, coaching } from "./coaching";

const B = {
  /** Share of yearly revenue the board lets wages take. */
  wageShare: 0.58,
  intakeTurn: 36,
  intakeSize: 2,
  met: 8,
  missed: -10,
  leagueMissed: -16,
  ultimatumConfidence: 38,
};

export function managedClub(state: GameState): ClubState | null {
  const c = coaching(state);
  return c?.role === "manager" ? coachClub(state) : null;
}

export function wageBill(state: GameState, clubId: string): number {
  return squadOf(state, clubId).reduce((s, p) => s + (p.contract?.wage ?? 0), 0);
}

/** Weekly wage ceiling the board sets; never below the bill the manager inherited. */
export function wageCap(state: GameState, club: ClubState): number {
  const b = coaching(state)?.board;
  if (b?.clubId === club.id && b.wageCap) return b.wageCap;
  return computeCap(state, club);
}

function computeCap(state: GameState, club: ClubState): number {
  const byRevenue = (annualRevenue(club) * B.wageShare) / 52;
  return Math.round(Math.max(byRevenue, wageBill(state, club.id) * 1.05) / 1000) * 1000;
}

function cupStageIndex(state: GameState, clubId: string, cc: string): number {
  const cup = state.competitions[cupCompId(cc, state.season)];
  if (!cup) return -1;
  let best = -1;
  for (const f of cup.fixtures) if (f.home === clubId || f.away === clubId) best = Math.max(best, CUP_STAGES.indexOf(f.stage ?? ""));
  if (cup.winner === clubId) best = CUP_STAGES.length;
  return best;
}

/** Objectives for the season: set once per season and club. */
export function ensureBoard(state: GameState): void {
  const c = coaching(state);
  const club = managedClub(state);
  if (!c || !club) return;
  if (c.board && c.board.clubId === club.id && c.board.season === state.season) return;
  const st = staticClub(club.id);
  const exp = club.expectation ?? 10;
  const tier = st ? (state.competitions[leagueCompId(club.leagueId, state.season)]?.tier ?? 1) : 1;
  const objectives: BoardObjective[] = [
    { id: "league", label: `Finish ${ordinal(exp)} or higher`, target: exp, weight: 2 },
    { id: "cup", label: `Reach the ${tier <= 1 ? "quarter-finals" : "round of 16"} of the cup`, target: CUP_STAGES.indexOf(tier <= 1 ? "Quarter-final" : "Round of 16"), weight: 1 },
    { id: "youth", label: "Give two academy players their debut", target: 2, weight: 1 },
    { id: "wages", label: "Keep the wage bill under the cap", target: 0, weight: 1 },
  ];
  const stint = c.stints[c.stints.length - 1];
  c.board = { season: state.season, clubId: club.id, objectives, wageCap: computeCap(state, club), graduatesAtStart: stint?.graduates ?? 0, promoted: c.board?.clubId === club.id ? c.board.promoted : [] };
}

export interface ObjectiveProgress {
  objective: BoardObjective;
  state: "met" | "on-course" | "off-course" | "missed" | "open";
  detail: string;
}

export function boardProgress(state: GameState, final = false): ObjectiveProgress[] {
  const c = coaching(state);
  const club = managedClub(state);
  const b = c?.board;
  if (!c || !club || !b || b.clubId !== club.id) return [];
  const table = state.competitions[leagueCompId(club.leagueId, state.season)]?.table;
  const idx = table?.findIndex((r) => r.team === club.id) ?? -1;
  const pos = idx + 1;
  const stint = c.stints[c.stints.length - 1];
  const cc = staticClub(club.id)?.countryCode ?? "";
  return b.objectives.map((o) => {
    switch (o.id) {
      case "league": {
        if (pos <= 0 || !table?.[idx].played) return { objective: o, state: final ? "missed" : "open", detail: "The season hasn't started." };
        const ok = pos <= o.target;
        return { objective: o, state: final ? (ok ? "met" : "missed") : ok ? "on-course" : "off-course", detail: `Currently ${ordinal(pos)}.` };
      }
      case "cup": {
        const reached = cupStageIndex(state, club.id, cc);
        const cup = state.competitions[cupCompId(cc, state.season)];
        const out = !!cup && !cup.alive?.includes(club.id) && !(cup.byes ?? []).includes(club.id) && reached >= 0;
        if (reached >= o.target) return { objective: o, state: "met", detail: reached >= CUP_STAGES.length ? "Won the cup!" : `Reached the ${CUP_STAGES[reached]?.toLowerCase()}.` };
        if (out || final) return { objective: o, state: "missed", detail: reached >= 0 ? `Out in the ${CUP_STAGES[reached]?.toLowerCase()}.` : "No cup run." };
        return { objective: o, state: "open", detail: reached >= 0 ? `Into the ${CUP_STAGES[reached]?.toLowerCase()}.` : "Not played yet." };
      }
      case "youth": {
        const n = (stint?.graduates ?? 0) - b.graduatesAtStart;
        if (n >= o.target) return { objective: o, state: "met", detail: `${n} debut${n === 1 ? "" : "s"}.` };
        return { objective: o, state: final ? "missed" : "open", detail: `${n} of ${o.target} so far.` };
      }
      default: {
        const bill = wageBill(state, club.id);
        const ok = bill <= b.wageCap;
        return { objective: o, state: final ? (ok ? "met" : "missed") : ok ? "on-course" : "off-course", detail: `${Math.round(bill / 1000)}k of ${Math.round(b.wageCap / 1000)}k a week.` };
      }
    }
  });
}

/** Weekly while managing: objectives exist, intake day, ultimatum. */
export function boardWeekly(state: GameState): void {
  const c = coaching(state);
  const club = managedClub(state);
  if (!c || !club) return;
  ensureBoard(state);
  const b = c.board;
  if (!b) return;
  if (state.turn === B.intakeTurn && b.intakeSeason !== state.season) intakeDay(state, club);
  const league = boardProgress(state).find((p) => p.objective.id === "league");
  if (league?.state === "off-course" && c.confidence < B.ultimatumConfidence && b.ultimatumSeason !== state.season && state.turn >= 20) {
    b.ultimatumSeason = state.season;
    addNews(state, { kind: "club", title: "⏳ The board's ultimatum", body: `${clubName(club.id)} are off the board's target. Results must turn now, or the job goes.`, important: true });
  }
}

/** Settle the season's objectives (call before the board's own season-end verdict). Returns true if the manager is sacked. */
export function settleBoard(state: GameState): boolean {
  const c = coaching(state);
  const club = managedClub(state);
  if (!c || !club || !c.board || c.board.settled === state.season) return false;
  c.board.settled = state.season;
  const prog = boardProgress(state, true);
  let delta = 0;
  for (const p of prog) {
    if (p.state === "met") delta += B.met * p.objective.weight * 0.5;
    else if (p.state === "missed") delta += p.objective.id === "league" ? B.leagueMissed : B.missed * 0.6;
  }
  c.confidence = Math.round(clamp(c.confidence + delta, 0, 100));
  const met = prog.filter((p) => p.state === "met").length;
  addNews(state, { kind: "club", title: `📋 Board review: ${met} of ${prog.length} objectives met`, body: prog.map((p) => `${p.state === "met" ? "✔" : "✘"} ${p.objective.label}`).join(" · "), important: true });
  const leagueMissedBadly = prog.some((p) => p.objective.id === "league" && p.state === "missed") && c.confidence < 25;
  return leagueMissedBadly;
}

function intakeDay(state: GameState, club: ClubState): void {
  const c = coaching(state);
  const b = c?.board;
  if (!c || !b) return;
  b.intakeSeason = state.season;
  if (squadOf(state, club.id).length >= BALANCE.squad.max) {
    addNews(state, { kind: "club", title: "🎓 Academy intake day", body: "No room in the squad for this year's academy intake." });
    return;
  }
  const r = Rng.fromSeed(`${state.seed}:board:intake:${state.season}:${club.id}`);
  const level = clubLevel(club.reputation);
  const focus = c.youthFocus;
  const names: string[] = [];
  for (let i = 0; i < B.intakeSize && squadOf(state, club.id).length < BALANCE.squad.max; i++) {
    const position = r.pick<Position>(["GK", "CB", "RB", "LB", "DM", "CM", "AM", "RW", "LW", "ST"]);
    const age = r.int(16, 17);
    const potential = clamp(level + r.normal(0, 5) + (club.youth - 50) / 6 + c.rating / 25, 55, 96);
    const p = generatePlayer(r, { id: nextId(state, "p"), nationality: staticClub(club.id)?.countryCode ?? "ENG", position, age, season: state.season, overall: clamp(potential - 25 + r.normal(0, 3), 42, 68), potential, clubId: club.id });
    // The academy's focus shows in the youngsters it produces.
    const lean = focus === "physical" ? (["pace", "stamina", "strength"] as const) : focus === "mental" ? (["decisions", "composure", "anticipation"] as const) : (["passing", "firstTouch", "technique"] as const);
    for (const k of lean) p.attrs[k] = Math.min(99, p.attrs[k] + 3);
    p.contract = { clubId: club.id, wage: playerWage(p, state.season, club.reputation, "prospect"), expires: state.season + 2, signed: state.season, role: "prospect", youth: true };
    p.value = marketValue(p, state.season);
    p.reputation = 3;
    state.players[p.id] = p;
    club.squad.push(p.id);
    names.push(`${fullName(p)} (${position}, ${age})`);
  }
  if (names.length) addNews(state, { kind: "club", title: "🎓 Academy intake day", body: `New prospects join the squad: ${names.join(", ")}.`, important: true });
}

/** Academy players at the managed club, youngest first. */
export function academyPlayers(state: GameState): Player[] {
  const club = managedClub(state);
  if (!club) return [];
  return squadOf(state, club.id).filter((p) => !p.isUser && ageOf(p, state.season) <= 19 && p.career.apps === 0).sort((a, b) => a.birthYear - b.birthYear);
}

/** Promote an academy player into first-team plans: a rotation role, so he is picked when he is good enough. */
export function promoteAcademyPlayer(state: GameState, id: PlayerId): { ok: boolean; reason?: string; msg?: string } {
  const c = coaching(state);
  const club = managedClub(state);
  const p = state.players[id];
  if (!c || !club || !p || p.clubId !== club.id) return { ok: false, reason: "Only your own academy players." };
  if (!p.contract) return { ok: false, reason: "He has no contract." };
  if (p.contract.role === "rotation" || !p.contract.youth) return { ok: false, reason: "He is already in first-team plans." };
  p.contract.role = "rotation";
  p.contract.youth = false;
  ensureBoard(state);
  c.board?.promoted.push(id);
  addNews(state, { kind: "club", title: `⬆️ ${fullName(p)} promoted to the first team`, body: "He trains with the senior squad from now on." });
  return { ok: true, msg: `${fullName(p)} joins the first-team squad.` };
}

const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;
