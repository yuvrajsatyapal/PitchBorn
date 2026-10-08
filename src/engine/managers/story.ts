/**
 * What a manager's coming and going means for the user, as restrained news and the occasional Football Memory.
 * Nothing here runs unless the user has a real shared past with the manager (or the manager is theirs now), and every
 * item is keyed so a save, a reload or a repeated call can never show it twice.
 */
import { clubName } from "../data/world";
import { Factors } from "../memory/score";
import { recordMemory } from "../memory/store";
import { clamp } from "../rng";
import type { ClubState, DepartureReason, Fixture, GameState, Competition } from "../types";
import { addNews, userPlayer } from "../world/helpers";
import { IMPORTANT, closeStint, currentStint, markSeen, meetings, mgrState, openStint, playedUnder, reunionNudge, withManager } from "./history";
import { recordOf, seasonsOf, openTenureOf } from "./registry";

/** A shared past worth a line in the news (a season or so together), below the bar for a Football Memory. */
export const NEWS_MIN = 18;

const REASON_TEXT: Record<DepartureReason, string> = { sacked: "has been sacked by", resigned: "has resigned from", moved: "has left", retired: "has retired from", contract: "has left" };

/** The user's club changed manager: close the old stint, open the new one, and say what matters. */
export function onManagerChangedAtUserClub(state: GameState, club: ClubState, oldId: string | undefined, reason: DepartureReason): void {
  const u = userPlayer(state);
  if (u.clubId !== club.id) return;
  const old = oldId ? recordOf(state, oldId) : undefined;
  const prev = closeStint(state, reason);
  // The relationship belonged to the manager who left; the new one starts from a neutral footing.
  state.user.relationships.manager = 50;
  const stint = openStint(state, club.id);
  const incoming = club.manager.id ? withManager(state, club.manager.id) : null;
  if (stint && incoming) {
    state.user.relationships.manager = clamp(50 + reunionNudge(incoming), 30, 75);
    stint.relStart = Math.round(state.user.relationships.manager);
    stint.relNudged = true;
  }
  const key = `dep:${oldId}:${club.id}:${state.season}:${state.turn}`;
  if (old && markSeen(state, key)) {
    const spent = prev ? Math.max(0, (prev.to?.season ?? state.season) - prev.from.season) : 0;
    addNews(state, {
      kind: "club",
      title: reason === "sacked" ? `${old.name} sacked` : `${old.name} ${reason === "retired" ? "retires" : "departs"}`,
      body: `${old.name} ${REASON_TEXT[reason]} ${clubName(club.id)}${spent ? ` after ${spent} season${spent === 1 ? "" : "s"} together` : ""}. ${club.manager.name} takes charge.${reason === "sacked" ? " A fresh start for everyone." : ""}`,
      important: true,
    });
    rememberDeparture(state, club, oldId as string);
  }
  if (incoming && incoming.importance >= NEWS_MIN && markSeen(state, `back:${club.manager.id}:${club.id}:${state.season}`)) {
    addNews(state, { kind: "career", title: "Back together", body: `${u.firstName} ${u.lastName} is reunited with ${club.manager.name}, whom ${u.firstName} played under at ${clubName(incoming.clubs[0])}.`, important: true });
    rememberReunited(state, club, incoming.managerId, incoming.importance);
  }
}

/** The user joined a club (transfer, loan, return): open the stint, carry a shared past into the opening relationship. */
export function onUserJoinedClub(state: GameState, clubId: string): void {
  const club = state.clubs[clubId];
  if (!club) return;
  const stint = openStint(state, clubId);
  const w = club.manager.id ? withManager(state, club.manager.id) : null;
  if (!stint || !w || stint.relNudged) return;
  state.user.relationships.manager = clamp(state.user.relationships.manager + reunionNudge(w), 0, 100);
  stint.relStart = Math.round(state.user.relationships.manager);
  stint.relNudged = true;
  if (w.importance >= NEWS_MIN && markSeen(state, `back:${club.manager.id}:${club.id}:${state.season}`)) {
    const u = userPlayer(state);
    addNews(state, { kind: "career", title: "Back together", body: `${u.firstName} ${u.lastName} has reunited with ${club.manager.name}${w.breakthrough ? ", the manager who gave a first-team breakthrough" : ""}.`, important: true });
    rememberReunited(state, club, w.managerId, w.importance);
  }
}

function rememberDeparture(state: GameState, club: ClubState, managerId: string): void {
  const w = withManager(state, managerId);
  if (!w || w.importance < IMPORTANT) return;
  const f = new Factors().add("A defining manager leaves", w.importance * 0.9).add("Won together", w.honours.league * 8 + w.honours.continental * 10 + w.honours.cup * 4);
  recordMemory(state, { kind: "manager-bond", clubId: club.id, manager: { name: w.name, clubId: club.id }, tags: ["manager", "departure"], factors: f, key: `dep-${managerId}-${club.id}`, data: { event: "departure", name: w.name, seasons: w.seasons } });
}

function rememberReunited(state: GameState, club: ClubState, managerId: string, importance: number): void {
  if (importance < IMPORTANT) return;
  const w = withManager(state, managerId);
  const f = new Factors().add("Back with a manager who mattered", importance * 0.85).add("A warm past", w && w.rel >= 70 ? 6 : 0);
  recordMemory(state, { kind: "manager-bond", clubId: club.id, manager: { name: w?.name ?? "", clubId: club.id }, tags: ["manager", "reunion"], factors: f, key: `reunited-${managerId}-${club.id}`, data: { event: "reunited", name: w?.name ?? "" } });
}

/** A manager the user played under has moved: tell them, if it matters. */
export function onFormerManagerMoved(state: GameState, managerId: string, from: ClubState | undefined, to: ClubState | undefined, reason: DepartureReason): void {
  if (!playedUnder(state, managerId)) return;
  if (to && userPlayer(state).clubId === to.id) return; // handled as a reunion
  if (from && userPlayer(state).clubId === from.id) return; // handled as a departure
  const w = withManager(state, managerId);
  if (!w || w.importance < NEWS_MIN) return;
  if (!markSeen(state, `moved:${managerId}:${state.season}:${state.turn}`)) return;
  const u = userPlayer(state);
  if (to) addNews(state, { kind: "career", title: "Former boss on the move", body: `${w.name}, who managed ${u.firstName} ${u.lastName} at ${clubName(w.clubs[0])}, has taken charge at ${clubName(to.id)}.` });
  else addNews(state, { kind: "career", title: reason === "retired" ? "Former boss retires" : "Former boss out of work", body: `${w.name}, who managed ${u.firstName} ${u.lastName} at ${clubName(w.clubs[0])}, ${reason === "retired" ? "has retired from management" : "has left his post"}.` });
}

/** Once a week: a former manager's side is the opposition this week. */
export function announceFormerManagers(state: GameState): void {
  const u = userPlayer(state);
  if (!u.clubId) return;
  for (const pm of state.pending) {
    const comp = state.competitions[pm.compId];
    const f = comp?.fixtures.find((x) => x.id === pm.fixtureId);
    if (!f || !comp || !["league", "cup", "continental"].includes(comp.kind)) continue;
    const opp = f.home === u.clubId ? f.away : f.home;
    const id = state.clubs[opp]?.manager.id;
    if (!id) continue;
    const w = withManager(state, id);
    if (!w || w.importance < NEWS_MIN || w.together) continue;
    if (markSeen(state, `face:${f.id}`)) {
      const n = meetings(state, id) + 1;
      addNews(state, {
        kind: "career",
        title: "Former boss comes to town",
        body: `${u.firstName} ${u.lastName} faces ${w.name}${n === 1 ? ` for the first time since leaving ${clubName(w.clubs[w.clubs.length - 1])}` : ` again (meeting ${n})`}.`,
        important: w.importance >= IMPORTANT,
      });
    }
  }
}

/** After a match against the side of a manager the user played under: count it, and mark the first meeting. */
export function onMatchAgainstFormerManager(state: GameState, fixture: Fixture, comp: Competition, goals: number, won: boolean): void {
  const u = userPlayer(state);
  if (!u.clubId || !["league", "cup", "continental"].includes(comp.kind)) return;
  const opp = fixture.home === u.clubId ? fixture.away : fixture.home;
  const id = state.clubs[opp]?.manager.id;
  if (!id || !playedUnder(state, id)) return;
  const ms = mgrState(state);
  const first = (ms.meetings[id] ?? 0) === 0;
  ms.meetings[id] = (ms.meetings[id] ?? 0) + 1;
  const w = withManager(state, id);
  if (!first || !w || w.importance < IMPORTANT) return;
  const f = new Factors().add("First meeting with a manager who mattered", w.importance * 0.7).add("You scored against him", goals * 6).add("You beat him", won ? 5 : 0);
  recordMemory(state, { kind: "manager-bond", clubId: u.clubId, opponentId: opp, fixtureId: fixture.id, compId: comp.id, compName: comp.name, stage: fixture.stage, manager: { name: w.name, clubId: opp }, tags: ["manager", "reunion"], factors: f, data: { event: "reunion-match", name: w.name, where: clubName(w.clubs[w.clubs.length - 1]) } });
}

/** Breakthrough memory: the manager who gave the first run of starts. */
export function rememberBreakthrough(state: GameState): void {
  const s = currentStint(state);
  if (!s) return;
  const rec = recordOf(state, s.managerId);
  const u = userPlayer(state);
  const age = state.season - u.birthYear;
  const f = new Factors().add("Given the first-team chance", 28).add("A young breakthrough", age <= 21 ? 10 : age <= 24 ? 4 : 0);
  recordMemory(state, { kind: "manager-bond", clubId: s.clubId, manager: { name: rec?.name ?? "", clubId: s.clubId }, tags: ["manager", "breakthrough"], factors: f, key: `bt-${s.managerId}`, data: { event: "breakthrough", name: rec?.name ?? "the manager" } });
}

export { openTenureOf, seasonsOf };
