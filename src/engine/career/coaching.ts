/**
 * Coaching career: after retirement the same save carries on in the dugout. Youth coach, then assistant, then
 * manager. The world keeps simulating; the user's club is coached by them.
 *
 * - Youth coach: a focus for the academy (technical, physical or mental) nudges the club's youngsters along, and
 *   academy debuts count as graduates.
 * - Assistant: a match-preparation focus sharpens the first team on match days.
 * - Manager: the user's own formation and playing style, a coaching rating that lifts the team, board confidence
 *   that rises and falls with results against expectations, the sack, and job offers from other clubs.
 *
 * Randomness comes from streams seeded by the save and the week, so coaching never moves the world's RNG.
 */
import { BALANCE } from "../balance";
import { leagueCompId } from "../competitions/setup";
import { clubName, staticLeague } from "../data/world";
import type { MatchPlayerInput } from "../match/engine";
import { FORMATIONS } from "../match/lineup";
import { fill, vacate } from "../managers/movement";
import { closeTenure, openTenure, registerManager } from "../managers/registry";
import { ageOf } from "../players/generate";
import { clamp, Rng } from "../rng";
import type { AttrKey, ClubId, ClubState, CoachCareer, CoachOffer, CoachRole, CoachStint, FormationId, GameState, PrepFocus, YouthFocus } from "../types";
import { addNews, fullName, nextId, removeFromSquad, userPlayer, withRng } from "../world/helpers";
import { legacyTier } from "./legacy";

export const ROLE_LABEL: Record<CoachRole, string> = { youth: "Youth coach", assistant: "Assistant manager", manager: "Manager" };
export const YOUTH_FOCUS: Record<YouthFocus, { label: string; attrs: AttrKey[]; note: string }> = {
  technical: { label: "Technical", attrs: ["firstTouch", "passing", "dribbling", "technique", "finishing"], note: "Touch, passing and finishing." },
  physical: { label: "Physical", attrs: ["pace", "acceleration", "stamina", "strength", "jumping"], note: "Speed, engine and power." },
  mental: { label: "Mental", attrs: ["decisions", "positioning", "anticipation", "composure", "workRate"], note: "Reading the game and nerve." },
};
export const PREP_FOCUS: Record<PrepFocus, { label: string; attrs: AttrKey[]; note: string }> = {
  balanced: { label: "Balanced", attrs: ["decisions", "workRate"], note: "A little sharper everywhere." },
  attack: { label: "Attack", attrs: ["finishing", "offBall", "passing", "creativity"], note: "Movement and finishing drills." },
  defence: { label: "Defence", attrs: ["positioning", "marking", "tackling", "interceptions"], note: "Shape, marking and pressing triggers." },
  "set-pieces": { label: "Set pieces", attrs: ["heading", "crossing", "jumping"], note: "Corners, free kicks and long throws." },
};

/** Coaching XP needed before the next step up is offered. */
export const XP_FOR = { assistant: 45, manager: 110 } as const;
const ACADEMY_AGE = 20;
const SACK_CONFIDENCE = 12;

export function coaching(state: GameState): CoachCareer | null {
  const c = state.user.coach;
  return c && c.active ? c : null;
}

export function canStartCoaching(state: GameState): boolean {
  return !!state.user.retired && !state.user.coach;
}

/** The club the user coaches, if any. */
export function coachClub(state: GameState): ClubState | null {
  const c = coaching(state);
  return c?.clubId ? state.clubs[c.clubId] ?? null : null;
}

export function isUserManagedClub(state: GameState, clubId: string): boolean {
  const c = coaching(state);
  return !!c && c.role === "manager" && c.clubId === clubId;
}

function stint(c: CoachCareer): CoachStint | undefined {
  return c.stints.find((s) => !s.to);
}

/** The club the former player is most associated with: where he played the most games. */
function homeClub(state: GameState): ClubId | null {
  const p = userPlayer(state);
  const apps = new Map<string, number>();
  for (const h of p.history) if (h.clubId && state.clubs[h.clubId]) apps.set(h.clubId, (apps.get(h.clubId) ?? 0) + h.stats.apps);
  return [...apps.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? Object.keys(state.clubs)[0] ?? null;
}

/** Retired: take the boots off the squad list, then start as a youth coach at the club he is most tied to. */
export function startCoaching(state: GameState): string {
  if (!canStartCoaching(state)) return "You can start a coaching career once you have retired.";
  const p = userPlayer(state);
  // The player leaves every squad: he will never be picked again.
  if (p.clubId) removeFromSquad(state, p.id);
  for (const nt of Object.values(state.nationalTeams)) nt.squad = nt.squad.filter((id) => id !== p.id);
  p.clubId = null;
  p.contract = null;
  p.loan = undefined;
  p.intl.retired = true;
  p.retired = true;
  const legacy = state.user.legacy?.score ?? 0;
  const club = homeClub(state);
  const managerId = registerManager(state, { name: fullName(p), nationality: p.nationality, born: p.birthYear });
  const c: CoachCareer = {
    active: true,
    role: null,
    clubId: null,
    managerId,
    // A great playing career buys a head start, not a finished coach.
    rating: Math.round(clamp(38 + legacy / 30, 38, 60)),
    reputation: Math.round(clamp(18 + legacy / 12, 15, 70)),
    xp: 0,
    youthFocus: "technical",
    prepFocus: "balanced",
    confidence: 60,
    stints: [],
    offers: [],
    trophies: [],
    startedSeason: state.season,
    watch: [],
  };
  state.user.coach = c;
  if (club) joinClub(state, club, "youth");
  addNews(state, { kind: "career", title: "📋 Back in the dugout", body: `${legacyTier(legacy)} turned coach: you start as ${ROLE_LABEL.youth.toLowerCase()}${club ? ` at ${clubName(club)}` : ""}.`, important: true });
  return club ? `Welcome back to ${clubName(club)}, coach.` : "Your coaching career begins.";
}

function joinClub(state: GameState, clubId: ClubId, role: CoachRole): void {
  const c = state.user.coach;
  const club = state.clubs[clubId];
  if (!c || !club) return;
  leaveClub(state, "moved");
  c.role = role;
  c.clubId = clubId;
  c.unemployedSince = undefined;
  c.stints.push({ clubId, role, from: { season: state.season, turn: state.turn }, games: 0, won: 0, drawn: 0, lost: 0, trophies: [], graduates: 0 });
  c.watch = academy(state, clubId).filter((x) => x.career.apps === 0).map((x) => x.id);
  if (role === "manager") {
    const oldId = vacate(state, club, "sacked");
    void oldId;
    const p = userPlayer(state);
    club.manager = { id: c.managerId, name: fullName(p), quality: c.rating, since: state.season, nationality: p.nationality, born: p.birthYear };
    openTenure(state, c.managerId, clubId);
    c.confidence = 60;
    c.formation = club.formation;
  }
}

/** Ends the current job. A manager's club appoints a successor straight away. */
function leaveClub(state: GameState, reason: NonNullable<CoachStint["reason"]>): void {
  const c = state.user.coach;
  if (!c?.clubId) return;
  const s = stint(c);
  if (s) {
    s.to = { season: state.season, turn: state.turn };
    s.reason = reason;
  }
  const club = state.clubs[c.clubId];
  if (c.role === "manager" && club && club.manager.id === c.managerId) {
    closeTenure(state, c.managerId, reason === "sacked" ? "sacked" : reason === "resigned" ? "resigned" : "moved");
    withRng(state, (rng) => fill(state, rng, club, c.managerId, reason === "sacked" ? "sacked" : "resigned"));
  }
  c.role = null;
  c.clubId = null;
  c.unemployedSince = state.turnIndex;
}

function academy(state: GameState, clubId: ClubId) {
  return (state.clubs[clubId]?.squad ?? []).map((id) => state.players[id]).filter((p) => !!p && !p.isUser && ageOf(p, state.season) <= ACADEMY_AGE);
}

/** Final whistle on a week: academy work, XP, the board's mood, offers. */
export function coachWeekly(state: GameState): void {
  const c = coaching(state);
  if (!c) return;
  const rng = Rng.fromSeed(`${state.seed}:coach:${state.turnIndex}`);
  const C = BALANCE.calendar;
  const inSeason = state.turn >= C.seasonStart && state.turn <= C.seasonEnd;
  if (c.clubId) {
    const club = state.clubs[c.clubId];
    if (!club) {
      leaveClub(state, "resigned");
    } else {
      c.xp += c.role === "manager" ? 1.2 : 1;
      if (c.role === "youth") academyWork(state, c, rng);
      trackGraduates(state, c);
      if (inSeason) clubResultsThisWeek(state, c);
      if (c.role === "manager" && inSeason) boardReview(state, c);
    }
  }
  generateOffers(state, c, rng, false);
  c.offers = c.offers.filter((o) => o.expiresIndex >= state.turnIndex);
}

function academyWork(state: GameState, c: CoachCareer, rng: Rng): void {
  const attrs = YOUTH_FOCUS[c.youthFocus].attrs;
  const chance = 0.03 + c.rating / 1500;
  for (const p of academy(state, c.clubId as string)) {
    if (!rng.chance(chance)) continue;
    const k = rng.pick(attrs);
    if (p.attrs[k] < Math.min(99, p.hidden.potential + 5)) p.attrs[k] = Math.min(99, p.attrs[k] + 1);
  }
}

function trackGraduates(state: GameState, c: CoachCareer): void {
  const s = stint(c);
  if (!s || !c.clubId) return;
  const still: string[] = [];
  for (const id of c.watch ?? []) {
    const p = state.players[id];
    if (!p || p.clubId !== c.clubId) continue;
    if (p.career.apps > 0) {
      s.graduates++;
      c.xp += 4;
      if (c.role === "youth") addNews(state, { kind: "club", title: `🎓 Academy graduate: ${fullName(p)}`, body: `Your youngster made his first-team debut for ${clubName(c.clubId)}.` });
    } else still.push(id);
  }
  for (const p of academy(state, c.clubId)) if (p.career.apps === 0 && !still.includes(p.id)) still.push(p.id);
  c.watch = still;
}

/** Results of the club's matches played this week go on the stint's record. */
function clubResultsThisWeek(state: GameState, c: CoachCareer): void {
  const s = stint(c);
  if (!s || !c.clubId) return;
  for (const comp of Object.values(state.competitions)) {
    if (comp.season !== state.season || comp.kind === "international" || comp.kind === "friendly") continue;
    for (const f of comp.fixtures) {
      if (f.turn !== state.turn || !f.result || (f.home !== c.clubId && f.away !== c.clubId)) continue;
      const home = f.home === c.clubId;
      const us = home ? f.result.hg : f.result.ag;
      const them = home ? f.result.ag : f.result.hg;
      const pens = f.result.pens;
      const won = us > them || (us === them && !!pens && (home ? pens[0] > pens[1] : pens[1] > pens[0]));
      const lost = us < them || (us === them && !!pens && !won);
      s.games++;
      if (won) s.won++;
      else if (lost) s.lost++;
      else s.drawn++;
      if (c.role !== "youth") c.xp += won ? 1 : lost ? 0 : 0.4;
    }
  }
}

/** League position against the board's expectation drives confidence; a long slump costs the job. */
function boardReview(state: GameState, c: CoachCareer): void {
  const club = state.clubs[c.clubId as string];
  const table = state.competitions[leagueCompId(club.leagueId, state.season)]?.table;
  const idx = table?.findIndex((r) => r.team === club.id) ?? -1;
  if (!table || idx < 0 || table[idx].played < 4) return;
  const pos = idx + 1;
  const exp = club.expectation ?? pos;
  const formBoost = club.form.slice(-5).reduce((n, r) => n + (r === "W" ? 2 : r === "L" ? -2 : 0), 0);
  // Slow to move, so a bad month at a club sitting where it should doesn't cost the job on its own.
  const target = clamp(55 + ((exp - pos) / table.length) * 120 + formBoost * 1.5, 0, 100);
  c.confidence = Math.round(clamp(c.confidence + (target - c.confidence) * 0.13, 0, 100));
  const s = stint(c);
  const weeksIn = s ? (state.season - s.from.season) * BALANCE.calendar.turnsPerSeason + state.turn - s.from.turn : 99;
  if (c.confidence < SACK_CONFIDENCE && weeksIn >= 10) {
    const name = clubName(club.id);
    leaveClub(state, "sacked");
    c.reputation = Math.round(clamp(c.reputation - 6, 5, 100));
    addNews(state, { kind: "career", title: `🚪 Sacked by ${name}`, body: "The board has lost patience. Offers will come; they always do.", important: true });
  } else if (c.confidence < 30 && state.turn % 4 === 0) {
    addNews(state, { kind: "club", title: "⚠️ The board is watching", body: `Confidence in your management at ${clubName(club.id)} is low (${c.confidence}/100). Results must improve.` });
  }
}

/** The board ends the job at the season's end after a missed league target (see career/board.ts). */
export function sackedByBoard(state: GameState): void {
  const c = coaching(state);
  const club = coachClub(state);
  if (!c || !club || c.role !== "manager") return;
  const name = clubName(club.id);
  leaveClub(state, "sacked");
  c.reputation = Math.round(clamp(c.reputation - 6, 5, 100));
  addNews(state, { kind: "career", title: `🚪 Sacked by ${name}`, body: "The board's season review: the league target was missed by too much.", important: true });
}

/** Clubs that would hire the coach for a role: around his reputation, best first. */
function suitors(state: GameState, c: CoachCareer, role: CoachRole, rng: Rng): ClubState[] {
  const cap = c.reputation + (role === "manager" ? 8 : 18);
  const floor = c.reputation - 30;
  const pool = Object.values(state.clubs).filter((x) => x.id !== c.clubId && x.reputation <= cap && x.reputation >= floor && !c.offers.some((o) => o.clubId === x.id));
  return pool.sort((a, b) => b.reputation - a.reputation + rng.range(-8, 8)).slice(0, 4);
}

function offer(state: GameState, c: CoachCareer, clubId: ClubId, role: CoachRole, note: string): CoachOffer {
  // Summer offers wait through the break; mid-season ones need an answer within a month.
  const weeks = state.turn >= BALANCE.calendar.endOfSeasonTurn ? 8 : 4;
  const o: CoachOffer = { id: nextId(state, "co"), clubId, role, expiresIndex: state.turnIndex + weeks, note };
  c.offers.push(o);
  addNews(state, { kind: "career", title: `📨 ${clubName(clubId)} want you as ${ROLE_LABEL[role].toLowerCase()}`, body: note, important: true });
  return o;
}

/** Step-ups at the season's end; jobs for the unemployed any week. */
function generateOffers(state: GameState, c: CoachCareer, rng: Rng, seasonEnd: boolean): void {
  if (c.offers.length >= 3) return;
  const next: CoachRole | null = c.xp >= XP_FOR.manager ? "manager" : c.xp >= XP_FOR.assistant ? "assistant" : null;
  if (!c.clubId) {
    const weeks = state.turnIndex - (c.unemployedSince ?? state.turnIndex);
    if (weeks >= 1 && rng.chance(0.35)) {
      // A coach whose name has slipped below every manager's job still hears from clubs: a step down, but back in the game.
      const ladder: CoachRole[] = next === "manager" ? ["manager", "assistant", "youth"] : next === "assistant" ? ["assistant", "youth"] : ["youth"];
      for (const role of ladder) {
        const club = suitors(state, c, role, rng)[0];
        if (!club) continue;
        offer(state, c, club.id, role, role === "manager" ? "The board wants a fresh voice in the dugout." : "A chance to get back into the game.");
        break;
      }
    }
    return;
  }
  if (!seasonEnd) return;
  const club = state.clubs[c.clubId];
  if (c.role === "youth" && next) {
    offer(state, c, c.clubId, "assistant", "The manager has noticed your work with the kids and wants you on his staff.");
    if (rng.chance(0.5)) {
      const other = suitors(state, c, "assistant", rng)[0];
      if (other) offer(state, c, other.id, "assistant", "A first-team role elsewhere.");
    }
  } else if (c.role === "assistant" && next === "manager") {
    const jobs = suitors(state, c, "manager", rng).slice(0, 2);
    for (const j of jobs) offer(state, c, j.id, "manager", "Your first chance to be the boss.");
  } else if (c.role === "manager" && club) {
    const table = state.competitions[leagueCompId(club.leagueId, state.season)]?.table;
    const pos = (table?.findIndex((r) => r.team === club.id) ?? -1) + 1;
    const over = pos > 0 && (club.expectation ?? pos) - pos >= 3;
    if (over || rng.chance(0.15)) {
      const bigger = Object.values(state.clubs).filter((x) => x.id !== club.id && x.reputation > club.reputation + 4 && x.reputation <= c.reputation + 15).sort((a, b) => b.reputation - a.reputation + rng.range(-10, 10))[0];
      if (bigger) offer(state, c, bigger.id, "manager", `${clubName(bigger.id)} were impressed by your season at ${clubName(club.id)}.`);
    }
  }
}

/** Season end for the coach: trophies, a verdict on the year, growth, and offers. Call after the season's awards. */
export function coachSeasonEnd(state: GameState): void {
  const c = coaching(state);
  if (!c) return;
  const rng = Rng.fromSeed(`${state.seed}:coach-season:${state.season}`);
  if (c.clubId && c.role !== "youth") {
    const club = state.clubs[c.clubId];
    const s = stint(c);
    for (const comp of Object.values(state.competitions)) {
      if (comp.season !== state.season || comp.winner !== c.clubId || comp.kind === "international" || comp.kind === "friendly") continue;
      if (c.trophies.some((t) => t.season === state.season && t.name === comp.name)) continue;
      c.trophies.push({ season: state.season, name: comp.name, clubId: c.clubId, role: c.role as CoachRole, kind: comp.kind });
      s?.trophies.push(comp.name);
      c.reputation = Math.round(clamp(c.reputation + (comp.kind === "league" ? 8 : comp.kind === "continental" ? 10 : 4), 1, 100));
      addNews(state, { kind: "career", title: `🏆 ${comp.name} won${c.role === "manager" ? " as manager" : " from the bench"}`, body: `${clubName(c.clubId)} lift the trophy.`, important: true });
    }
    const table = state.competitions[leagueCompId(club.leagueId, state.season)]?.table;
    const pos = (table?.findIndex((r) => r.team === club.id) ?? -1) + 1;
    if (pos > 0 && table) {
      const exp = club.expectation ?? pos;
      if (s) s.bestFinish = Math.min(s.bestFinish ?? 99, pos);
      const verdict = ((exp - pos) / table.length) * 10;
      c.reputation = Math.round(clamp(c.reputation + verdict * (c.role === "manager" ? 1 : 0.4), 1, 100));
      c.rating = Math.round(clamp(c.rating + 1 + Math.max(0, verdict) * 0.5, 1, 95));
      addNews(state, { kind: "career", title: `Coaching review ${state.season}/${String((state.season + 1) % 100).padStart(2, "0")}`, body: `${clubName(club.id)} finished ${ordinal(pos)} (expected ${ordinal(exp)}) in the ${staticLeague(club.leagueId)?.name ?? "league"}.` });
    }
    if (c.role === "manager" && club.manager.id === c.managerId) club.manager.quality = c.rating;
  } else if (c.role === "youth") {
    const s = stint(c);
    c.rating = Math.round(clamp(c.rating + 1 + (s?.graduates ?? 0) * 0.3, 1, 95));
    c.reputation = Math.round(clamp(c.reputation + 1, 1, 100));
  }
  generateOffers(state, c, rng, true);
}

const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;

export function acceptCoachOffer(state: GameState, offerId: string): string {
  const c = coaching(state);
  const o = c?.offers.find((x) => x.id === offerId);
  if (!c || !o) return "That offer is no longer on the table.";
  if (!state.clubs[o.clubId]) return "That club no longer exists.";
  c.offers = c.offers.filter((x) => x.id !== offerId);
  if (o.clubId === c.clubId) {
    // A promotion at the same club: the stint record carries on in the new role.
    const s = stint(c);
    if (s) {
      s.to = { season: state.season, turn: state.turn };
      s.reason = "promoted";
    }
    c.clubId = null;
    c.role = null;
  }
  joinClub(state, o.clubId, o.role);
  if (o.role === "manager") c.offers = [];
  addNews(state, { kind: "career", title: `✍️ New ${ROLE_LABEL[o.role].toLowerCase()} of ${clubName(o.clubId)}`, body: o.note, important: true });
  return `You're the new ${ROLE_LABEL[o.role].toLowerCase()} of ${clubName(o.clubId)}.`;
}

export function declineCoachOffer(state: GameState, offerId: string): void {
  const c = coaching(state);
  if (c) c.offers = c.offers.filter((x) => x.id !== offerId);
}

export function resignCoachJob(state: GameState): string {
  const c = coaching(state);
  if (!c?.clubId) return "You don't have a job to resign from.";
  const name = clubName(c.clubId);
  leaveClub(state, "resigned");
  c.reputation = Math.round(clamp(c.reputation - 2, 1, 100));
  addNews(state, { kind: "career", title: `You leave ${name}`, body: "Time for a new challenge.", important: true });
  return `You've left ${name}.`;
}

export function setYouthFocus(state: GameState, f: YouthFocus): void {
  const c = coaching(state);
  if (c && YOUTH_FOCUS[f]) c.youthFocus = f;
}

export function setPrepFocus(state: GameState, f: PrepFocus): void {
  const c = coaching(state);
  if (c && PREP_FOCUS[f]) c.prepFocus = f;
}

/** The manager's formation and style for his club. */
export function setTactics(state: GameState, t: { formation?: FormationId; style?: Partial<ClubState["style"]> }): string {
  const c = coaching(state);
  const club = coachClub(state);
  if (!c || !club || c.role !== "manager") return "Only the manager picks the tactics.";
  if (t.formation && FORMATIONS[t.formation]) {
    club.formation = t.formation;
    c.formation = t.formation;
  }
  if (t.style) for (const k of ["pressing", "tempo", "directness"] as const) if (Number.isFinite(t.style[k])) club.style[k] = clamp(t.style[k] as number, 0, 1);
  return "Tactics updated.";
}

/**
 * Match-day effect of the coaching staff on the user's club: the preparation focus (assistant or manager) and the
 * manager's own coaching rating, as small attribute shifts on copied inputs.
 */
export function applyCoaching(state: GameState, teamId: string, starters: MatchPlayerInput[]): void {
  const c = coaching(state);
  if (!c || c.clubId !== teamId || c.role === "youth" || !c.role) return;
  const prep = PREP_FOCUS[c.prepFocus]?.attrs ?? [];
  const lift = c.role === "manager" ? Math.round(clamp((c.rating - 60) / 12, -2, 3)) : 0;
  for (const s of starters) {
    const attrs = { ...s.attrs };
    for (const k of prep) attrs[k] = clamp(attrs[k] + 1, 1, 99);
    if (lift) for (const k of ["decisions", "positioning", "composure", "workRate"] as AttrKey[]) attrs[k] = clamp(attrs[k] + lift, 1, 99);
    s.attrs = attrs;
  }
}

export function sanitizeCoaching(state: GameState): void {
  const u = state.user;
  const c = u?.coach;
  if (!c) return;
  if (typeof c !== "object" || typeof c.managerId !== "string") {
    u.coach = undefined;
    return;
  }
  c.offers = Array.isArray(c.offers) ? c.offers.filter((o) => o && state.clubs[o.clubId]) : [];
  c.stints = Array.isArray(c.stints) ? c.stints : [];
  c.trophies = Array.isArray(c.trophies) ? c.trophies : [];
  c.watch = Array.isArray(c.watch) ? c.watch.filter((id) => typeof id === "string") : [];
  for (const k of ["rating", "reputation", "xp", "confidence"] as const) if (!Number.isFinite(c[k])) c[k] = k === "xp" ? 0 : 50;
  if (!YOUTH_FOCUS[c.youthFocus]) c.youthFocus = "technical";
  if (!PREP_FOCUS[c.prepFocus]) c.prepFocus = "balanced";
  if (c.clubId && !state.clubs[c.clubId]) {
    c.clubId = null;
    c.role = null;
  }
}
