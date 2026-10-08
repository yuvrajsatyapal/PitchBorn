import { clubName, countryName, staticLeague } from "@/engine/data/world";
import { intlTeam } from "@/engine/national/identity";
import { leagueCompId } from "@/engine/competitions/setup";
import { overallFor } from "@/engine/players/attributes";
import { ageOf, avgRating, emptyStat, addStat } from "@/engine/players/generate";
import type { Competition, Fixture, GameState, Player, StatLine } from "@/engine/types";

export const user = (g: GameState): Player => g.players[g.user.playerId];
export const ovr = (p: Player) => overallFor(p.attrs, p.position);
export const age = (g: GameState, p: Player) => ageOf(p, g.season);
export const name = (p: Pick<Player, "firstName" | "lastName">) => `${p.firstName} ${p.lastName}`;

export function teamLabel(id: string, short = false): string {
  return clubName(id, short) || countryName(id);
}

export function userLeague(g: GameState): Competition | undefined {
  const p = user(g);
  const lid = p.clubId ? g.clubs[p.clubId]?.leagueId : undefined;
  return lid ? g.competitions[leagueCompId(lid, g.season)] : undefined;
}

export function teamFixtures(g: GameState, teamId: string): { comp: Competition; f: Fixture }[] {
  const out: { comp: Competition; f: Fixture }[] = [];
  for (const comp of Object.values(g.competitions)) {
    if (comp.season !== g.season) continue;
    for (const f of comp.fixtures) if (f.home === teamId || f.away === teamId) out.push({ comp, f });
  }
  return out.sort((a, b) => a.f.turn - b.f.turn || a.f.round - b.f.round);
}

/** All fixtures for the user: club + national team. */
export function userFixtures(g: GameState): { comp: Competition; f: Fixture }[] {
  const p = user(g);
  const list: { comp: Competition; f: Fixture }[] = [];
  if (p.clubId) list.push(...teamFixtures(g, p.clubId));
  const nat = intlTeam(p);
  for (const x of teamFixtures(g, nat)) if (x.comp.kind === "international") list.push(x);
  return list.sort((a, b) => a.f.turn - b.f.turn || a.f.round - b.f.round);
}

export function seasonTotal(p: Player): StatLine {
  const s = emptyStat();
  for (const k in p.season) addStat(s, p.season[k]);
  return s;
}

export function fmtRating(s: StatLine): string {
  return s.apps ? avgRating(s).toFixed(2) : "–";
}

export function tierOf(g: GameState, clubId: string | null): number | undefined {
  if (!clubId) return undefined;
  return staticLeague(g.clubs[clubId]?.leagueId ?? "")?.tier;
}

export function resultFor(f: Fixture, teamId: string): "W" | "D" | "L" | null {
  if (!f.result) return null;
  const mine = f.home === teamId ? f.result.hg : f.result.ag;
  const theirs = f.home === teamId ? f.result.ag : f.result.hg;
  if (mine > theirs) return "W";
  if (mine < theirs) return "L";
  if (f.result.pens) {
    const [h, a] = f.result.pens;
    return (f.home === teamId ? h > a : a > h) ? "W" : "L";
  }
  return "D";
}

export function scoreText(f: Fixture): string {
  if (!f.result) return "v";
  const base = `${f.result.hg}–${f.result.ag}`;
  return f.result.pens ? `${base} (${f.result.pens[0]}–${f.result.pens[1]}p)` : f.result.et ? `${base} aet` : base;
}

export function moneyPerWeek(v: number): string {
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M/wk`;
  if (v >= 1000) return `€${Math.round(v / 1000)}K/wk`;
  return `€${v}/wk`;
}

export const POS_TONE: Record<string, string> = {
  GK: "bg-sun-2", CB: "bg-sky-2", RB: "bg-sky-2", LB: "bg-sky-2", DM: "bg-pitch-2", CM: "bg-pitch-2", AM: "bg-pitch-2", RW: "bg-coral-2", LW: "bg-coral-2", ST: "bg-coral-2",
};
