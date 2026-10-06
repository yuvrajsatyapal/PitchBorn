import { Rng } from "../rng";
import type { ClubState, GameState, NewsItem, Player, TimelineEvent } from "../types";

export const SCHEMA_VERSION = 2;

export function nextId(state: GameState, prefix: string): string {
  state.idCounter++;
  return `${prefix}${state.idCounter.toString(36)}`;
}

/** Run a function with the state's RNG and persist the advanced RNG state. */
export function withRng<T>(state: GameState, fn: (rng: Rng) => T): T {
  const rng = new Rng(state.rng);
  const out = fn(rng);
  state.rng = rng.state();
  return out;
}

export function addNews(state: GameState, item: Omit<NewsItem, "id" | "season" | "turn">): void {
  state.news.unshift({ ...item, id: nextId(state, "n"), season: state.season, turn: state.turn });
  if (state.news.length > 160) state.news.length = 160;
}

export function addTimeline(state: GameState, ev: Omit<TimelineEvent, "season" | "turn">): void {
  state.user.timeline.push({ ...ev, season: state.season, turn: state.turn });
}

export function userPlayer(state: GameState): Player {
  return state.players[state.user.playerId];
}

export function userClub(state: GameState): ClubState | null {
  const p = userPlayer(state);
  return p.clubId ? state.clubs[p.clubId] ?? null : null;
}

export function squadOf(state: GameState, clubId: string): Player[] {
  const club = state.clubs[clubId];
  if (!club) return [];
  const out: Player[] = [];
  for (const id of club.squad) {
    const p = state.players[id];
    if (p && !p.retired) out.push(p);
  }
  return out;
}

export function fullName(p: Pick<Player, "firstName" | "lastName">): string {
  return `${p.firstName} ${p.lastName}`;
}

export function removeFromSquad(state: GameState, playerId: string): void {
  const p = state.players[playerId];
  if (!p?.clubId) return;
  const club = state.clubs[p.clubId];
  if (club) club.squad = club.squad.filter((id) => id !== playerId);
}

export function addToSquad(state: GameState, playerId: string, clubId: string): void {
  const club = state.clubs[clubId];
  if (club && !club.squad.includes(playerId)) club.squad.push(playerId);
  state.players[playerId].clubId = clubId;
}

/** Absolute turn index helper for cooldowns that span seasons. */
export function absTurn(season: number, turn: number, startSeason: number): number {
  return (season - startSeason) * 50 + turn;
}
