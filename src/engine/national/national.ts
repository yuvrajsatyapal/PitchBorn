import { BALANCE } from "../balance";
import { tournamentFor } from "../calendar";
import { fixtureLoser, fixtureWinner } from "../competitions/setup";
import { drawKnockout, groupDraw } from "../competitions/fixtures";
import { buildTable, emptyRow } from "../competitions/table";
import { WORLD, country } from "../data/world";
import { overallFor } from "../players/attributes";
import { ageOf } from "../players/generate";
import { clamp, type Rng } from "../rng";
import type { Competition, Fixture, GameState, Player } from "../types";
import { addNews, addTimeline, nextId, userPlayer } from "../world/helpers";

const C = BALANCE.calendar;

export const TOURNAMENTS = {
  world: { name: "World Championship", short: "WCH", prestige: 10 },
  euro: { name: "European Nations Championship", short: "ENC", prestige: 8 },
};

export const intlCompId = (season: number) => `intl-${season}`;

function eligibleFor(p: Player, code: string): boolean {
  if (p.retired || p.intl.retired) return false;
  if (p.intl.tiedTo) return p.intl.tiedTo === code;
  return p.nationality === code || p.altNationality === code;
}

function selectionScore(state: GameState, p: Player): number {
  const ovr = overallFor(p.attrs, p.position);
  const age = ageOf(p, state.season);
  return ovr + (p.form - 6.6) * 1.8 + p.reputation * 0.03 + (age <= 20 ? -2 : 0) + (p.virtual ? -1.5 : 0);
}

/** Pick 23-man squads for every nation (3 GKs, balanced lines). */
export function selectNationalSquads(state: GameState): void {
  const buckets = new Map<string, Player[]>();
  for (const p of Object.values(state.players)) {
    if (p.retired || p.intl.retired || p.injury) continue;
    for (const code of [p.intl.tiedTo ?? p.nationality, p.intl.tiedTo ? null : p.altNationality]) {
      if (!code) continue;
      const list = buckets.get(code) ?? [];
      list.push(p);
      buckets.set(code, list);
    }
  }
  const user = userPlayer(state);
  const wasIn = Object.values(state.nationalTeams).find((nt) => nt.squad.includes(user.id))?.code;
  const takenUser = new Set<string>();
  // Primary nationality chooses first so dual-eligible players are not double-booked.
  const order = [...Object.values(state.nationalTeams)].sort((a, b) => (a.code === user.nationality ? -1 : b.code === user.nationality ? 1 : 0));
  for (const nt of order) {
    const pool = (buckets.get(nt.code) ?? []).filter((p) => eligibleFor(p, nt.code) && !(p.isUser && takenUser.has(p.id)));
    pool.sort((a, b) => selectionScore(state, b) - selectionScore(state, a));
    // Position-balanced 26-man squad: 3 GK, 9 DEF, 8 MID, 6 ATT (best remaining fill gaps).
    const gks = pool.filter((p) => p.position === "GK").slice(0, 3);
    const by = (g: string[], n: number) => pool.filter((p) => g.includes(p.position)).slice(0, n);
    const picked = new Set<Player>([...by(["CB", "RB", "LB"], 9), ...by(["DM", "CM", "AM"], 8), ...by(["RW", "LW", "ST"], 6)]);
    for (const p of pool) {
      if (picked.size >= 23) break;
      if (p.position !== "GK") picked.add(p);
    }
    const outfield = [...picked].sort((a, b) => selectionScore(state, b) - selectionScore(state, a));
    nt.squad = [...gks, ...outfield].map((p) => p.id);
    if (nt.squad.includes(user.id)) takenUser.add(user.id);
    const top = [...gks.slice(0, 1), ...outfield.slice(0, 10)];
    const avg = top.length ? top.reduce((s, p) => s + overallFor(p.attrs, p.position), 0) / top.length : 50;
    const base = country(nt.code)?.strength ?? 60;
    nt.strength = Math.round(clamp(avg * 0.75 + base * 0.25, 30, 99));
  }
  const nowIn = Object.values(state.nationalTeams).find((nt) => nt.squad.includes(user.id))?.code;
  if (nowIn && !wasIn) {
    const first = !state.user.milestones.includes(`callup-${nowIn}`);
    if (first) {
      state.user.milestones.push(`callup-${nowIn}`);
      addTimeline(state, { kind: "international", title: `First call-up: ${country(nowIn)?.name}` });
    }
    addNews(state, { kind: "national", title: `Called up by ${country(nowIn)?.name}!`, body: first ? "Your first senior international call-up." : "You're back in the squad.", important: true });
  } else if (wasIn && !nowIn && !user.injury) {
    addNews(state, { kind: "national", title: `Left out of the ${country(wasIn)?.name} squad`, body: "Keep performing to force your way back in." });
  }
}

/** International window: two matches per nation against similar-strength opponents. */
export function scheduleInternationalWindow(state: GameState, rng: Rng): void {
  const id = intlCompId(state.season);
  let comp = state.competitions[id];
  if (!comp) {
    comp = {
      id, kind: "international", name: "International Matches", shortName: "INT", season: state.season, teams: WORLD.countries.map((c) => c.code),
      fixtures: [], prestige: 3, complete: false,
    };
    state.competitions[id] = comp;
  }
  const next = tournamentFor(state.season);
  const nations = rng.shuffle(Object.values(state.nationalTeams).filter((n) => n.squad.length >= 14).map((n) => n.code));
  for (let leg = 0; leg < 2; leg++) {
    const sorted = [...nations].sort((a, b) => state.nationalTeams[b].strength - state.nationalTeams[a].strength + rng.normal(0, 6));
    for (let i = 0; i + 1 < sorted.length; i += 2) {
      const [home, away] = rng.chance(0.5) ? [sorted[i], sorted[i + 1]] : [sorted[i + 1], sorted[i]];
      const sameConf = country(home)?.confederation === country(away)?.confederation;
      const qualifier = next && sameConf && (next === "world" || country(home)?.confederation === "UEFA");
      comp.fixtures.push({
        id: nextId(state, "f"), compId: id, round: state.turn * 10 + leg, turn: state.turn, home, away, stage: qualifier ? "Qualifier" : "Friendly",
      });
    }
  }
}

/** Create the summer tournament after the domestic season (tournament years only). */
export function setupTournament(state: GameState, rng: Rng): void {
  const kind = tournamentFor(state.season);
  if (!kind) return;
  const def = TOURNAMENTS[kind];
  const compId = `${kind}-${state.season}`;
  if (state.competitions[compId]) return;
  selectNationalSquads(state);
  const eligible = Object.values(state.nationalTeams).filter((n) => n.squad.length >= 16 && (kind === "world" || country(n.code)?.confederation === "UEFA"));
  const ranked = eligible.sort((a, b) => b.strength + rng.normal(0, 3) - (a.strength + rng.normal(0, 3)));
  const teams = ranked.slice(0, 16).map((n) => n.code);
  if (teams.length < 16) return;
  const groups = groupDraw(teams, 4, rng, (t) => state.nationalTeams[t].strength);
  const fixtures: Fixture[] = [];
  const pairs: [number, number][][] = [
    [[0, 1], [2, 3]],
    [[0, 2], [1, 3]],
    [[3, 0], [1, 2]],
  ];
  groups.forEach((g, gi) =>
    pairs.forEach((md, mi) => {
      for (const [a, b] of md) {
        fixtures.push({ id: nextId(state, "f"), compId, round: mi + 1, turn: C.tournamentTurns.group[mi], home: g[a], away: g[b], stage: `Group ${"ABCD"[gi]}`, group: gi, neutral: true });
      }
    }),
  );
  const comp: Competition = {
    id: compId, kind: "international", name: def.name, shortName: def.short, season: state.season, teams, fixtures,
    groups: groups.map((g, gi) => ({ name: `Group ${"ABCD"[gi]}`, teams: g, table: g.map(emptyRow) })), alive: [...teams], prestige: def.prestige, complete: false,
  };
  state.competitions[compId] = comp;
  addNews(state, { kind: "national", title: `${def.name} line-up confirmed`, body: `${teams.length} nations will compete this summer.` });
}

export function progressTournament(state: GameState, rng: Rng): void {
  for (const comp of Object.values(state.competitions)) {
    if (comp.kind !== "international" || !comp.groups || comp.complete || comp.season !== state.season) continue;
    const groupF = comp.fixtures.filter((f) => f.group !== undefined);
    for (const g of comp.groups) g.table = buildTable(g.teams, groupF.filter((f) => g.teams.includes(f.home)));
    if (groupF.some((f) => !f.result)) continue;
    const ko = comp.fixtures.filter((f) => f.group === undefined);
    if (!ko.length) {
      const w = comp.groups.map((g) => g.table[0].team);
      const r = comp.groups.map((g) => g.table[1].team);
      comp.alive = [...w, ...r];
      const qf: [string, string][] = [[w[0], r[1]], [w[1], r[0]], [w[2], r[3]], [w[3], r[2]]];
      comp.fixtures.push(...qf.map(([home, away]) => ({ id: nextId(state, "f"), compId: comp.id, round: 4, turn: C.tournamentTurns.QF, home, away, stage: "Quarter-final", neutral: true })));
      continue;
    }
    const last = Math.max(...ko.map((f) => f.round));
    const cur = ko.filter((f) => f.round === last);
    if (cur.some((f) => !f.result)) continue;
    const winners = cur.map(fixtureWinner).filter((x): x is string => Boolean(x));
    comp.alive = winners;
    if (winners.length === 1) {
      comp.winner = winners[0];
      comp.runnerUp = fixtureLoser(cur[0]) ?? undefined;
      comp.complete = true;
      state.nationalTeams[comp.winner].titles.push({ season: state.season, compId: comp.id, name: comp.name });
      addNews(state, { kind: "national", title: `${country(comp.winner)?.name} win the ${comp.name}!`, important: true });
      continue;
    }
    const final = winners.length === 2;
    comp.fixtures.push(
      ...drawKnockout(winners, rng).map(([home, away]) => ({
        id: nextId(state, "f"), compId: comp.id, round: last + 1, turn: final ? C.tournamentTurns.F : C.tournamentTurns.SF, home, away, stage: final ? "Final" : "Semi-final", neutral: true,
      })),
    );
  }
}

/** Veterans step away from international football. */
export function internationalRetirements(state: GameState, rng: Rng): void {
  for (const p of Object.values(state.players)) {
    if (p.isUser || p.intl.retired || p.intl.caps === 0) continue;
    const age = ageOf(p, state.season);
    if (age >= 33 && rng.chance((age - 32) * 0.18)) p.intl.retired = true;
  }
}

export function retireFromInternational(state: GameState): string {
  const p = userPlayer(state);
  if (p.intl.retired) return "Already retired from international football.";
  p.intl.retired = true;
  for (const nt of Object.values(state.nationalTeams)) nt.squad = nt.squad.filter((id) => id !== p.id);
  addTimeline(state, { kind: "international", title: "Retired from international football", detail: `${p.intl.caps} caps, ${p.intl.goals} goals` });
  addNews(state, { kind: "national", title: "You announce your international retirement", body: `${p.intl.caps} caps · ${p.intl.goals} goals`, important: true });
  return "You have retired from international duty.";
}
