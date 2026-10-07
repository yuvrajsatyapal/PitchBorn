/**
 * Rebuilds the memories an older save can still support: debut, firsts, trophies,
 * awards, moves, promotions and retirement. Match details (minutes, scorelines,
 * opponents) were never recorded, so those memories are simpler and flagged `backfilled`.
 */
import type { GameState } from "../types";
import { userPlayer } from "../world/helpers";
import { rememberAward, rememberPromotionOrRelegation, rememberRecord, rememberRetirement, rememberTransfer, rememberTrophy } from "./detect";
import { agePoints, Factors } from "./score";
import { recordMemory } from "./store";

export function backfillMemories(state: GameState): void {
  const u = state.user;
  const p = userPlayer(state);
  if (!p || u.memories?.length) return;
  u.memories = [];
  const keep = { season: state.season, turn: state.turn };
  const trophies = u.trophies;
  const clubIn = (season: number) => p.history.find((h) => h.season === season)?.clubId ?? (season === keep.season ? p.clubId : null);
  try {
    const at = (season: number, turn = 1) => {
      state.season = season;
      state.turn = turn;
    };
    for (const ev of u.timeline) {
      at(ev.season, ev.turn);
      const title = ev.title.toLowerCase();
      if (ev.kind === "debut") recordMemory(state, { kind: "debut", clubId: clubIn(ev.season), tags: ["debut"], factors: new Factors().add("Professional debut", 18).add("Young talent", agePoints(ev.season - p.birthYear)), key: "debut", keepAlways: true });
      else if (ev.kind === "first-goal") recordMemory(state, { kind: "first-goal", clubId: clubIn(ev.season), tags: ["first-goal"], factors: new Factors().add("First senior goal", 28).add("Young talent", agePoints(ev.season - p.birthYear)), key: "first-goal", keepAlways: true });
      else if (ev.kind === "international" && title.includes("debut")) recordMemory(state, { kind: "intl-debut", tags: ["intl-debut"], factors: new Factors().add("International debut", 30), key: "intl-debut", keepAlways: true });
      else if (ev.kind === "international" && title.includes("first international goal")) recordMemory(state, { kind: "first-intl-goal", tags: ["first-intl-goal"], factors: new Factors().add("First international goal", 32), key: "first-intl-goal", keepAlways: true });
      else if (ev.kind === "promotion" || ev.kind === "relegation") rememberPromotionOrRelegation(state, ev.kind === "promotion", clubIn(ev.season) ?? "", 20);
      else if (ev.kind === "record") rememberRecord(state, ev.title.replace(/^Record:\s*/, ""), Number(ev.detail) || 1);
    }
    trophies.forEach((t, i) => {
      at(t.season, 1);
      u.trophies = trophies.slice(0, i);
      const comp = state.competitions[t.compId];
      rememberTrophy(state, { id: t.compId, kind: t.kind, name: t.name, shortName: t.name, season: t.season, winner: t.clubId ?? t.country, prestige: comp?.prestige ?? 5, tier: comp?.tier ?? (t.compId.includes("-1-") ? 1 : 2), teams: [], fixtures: [], complete: true } as never, 12);
    });
    u.trophies = trophies;
    for (const a of u.awards) {
      at(a.season, 1);
      rememberAward(state, a.id, a.name, a.scope, a.clubId);
    }
    u.transfers.forEach((t) => {
      at(t.season, t.turn);
      if (t.kind !== "loan") rememberTransfer(state, t.from, t.to, t.fee);
    });
    if (u.retired) {
      at(u.retiredSeason ?? keep.season, 1);
      rememberRetirement(state);
    }
  } finally {
    state.season = keep.season;
    state.turn = keep.turn;
    u.trophies = trophies;
    for (const m of u.memories) m.backfilled = true;
  }
}
