/**
 * Memory recall: once a week, pick at most one memory worth bringing back —
 * an anniversary, or something that matters for this week's match — and
 * post it as news and as the dashboard's "From the vault". Quiet by design:
 * high bar, cooldowns and decay stop it turning into spam. No random numbers.
 */
import { clubName, stadium, staticClub } from "../data/world";
import type { GameState, Memory, RecallReason, VaultItem } from "../types";
import { addNews, userPlayer } from "../world/helpers";
import { traitDef } from "../traits/registry";
import { describeMemory } from "./describe";

const ANNIVERSARIES = [1, 5, 10, 15, 20];
const MIN_WEIGHT = 48;
const GAP_WEEKS = 3;
const NEWS_GAP_WEEKS = 6;
const SAME_MEMORY_WEEKS = 52;
const NEVER_RECALLED: Memory["kind"][] = ["retirement", "final-match"];

interface Candidate {
  memory: Memory;
  reason: RecallReason;
  weight: number;
  fixtureId?: string;
  years?: number;
}

const WORDS: Record<number, string> = { 1: "One year", 5: "Five years", 10: "Ten years", 15: "Fifteen years", 20: "Twenty years" };

/** What the memory is, as the end of "N years since …". */
export function recallPhrase(m: Memory): string {
  const comp = m.compName ?? "the trophy";
  const club = m.clubId ? clubName(m.clubId, true) : "";
  switch (m.kind) {
    case "debut": return "your professional debut";
    case "first-goal": return "your first professional goal";
    case "intl-debut": return "your international debut";
    case "first-intl-goal": return "your first international goal";
    case "derby-winner": return "that derby winner";
    case "late-winner": return "that stoppage-time winner";
    case "winner-goal": return "that winning goal";
    case "hat-trick": return "your hat-trick";
    case "haul": return "that goal-fest";
    case "comeback": return "that famous comeback";
    case "final-goal": return `your goal in the ${comp} final`;
    case "final-winner": return `the goal that won the ${comp}`;
    case "famous-upset": return "that famous upset";
    case "trophy": case "continental-trophy": case "intl-trophy": return `winning the ${comp}`;
    case "first-title": return "your first league title";
    case "record": return "that record";
    case "award": return `winning ${String(m.data?.name ?? "that award")}`;
    case "major-injury": return "that long injury";
    case "injury-comeback": return "your comeback";
    case "big-transfer": return `your move to ${club}`;
    case "controversial-transfer": return "that controversial move";
    case "transfer-rejected": return "turning down a bigger club";
    case "return-to-club": return `coming home to ${club}`;
    case "captaincy": return "being named captain";
    case "promotion": return "that promotion";
    case "relegation": return "that relegation";
    case "contract-dispute": return "that contract dispute";
    case "financial-exit": return "leaving a club in crisis";
    case "manager-conflict": return "that falling-out";
    case "career-decision": return "that defining decision";
    case "identity": return m.data?.event === "evolved" ? "reinventing your game" : m.data?.event === "earned" ? `earning a name as ${traitDef(String(m.data?.trait ?? ""))?.name ?? "a talent"}` : `becoming a signature ${traitDef(String(m.data?.trait ?? ""))?.name ?? "talent"}`;
    default: return "that moment";
  }
}

function freshness(state: GameState, m: Memory): number {
  const r = m.recall;
  if (!r) return 1;
  if (r.lastTurnIndex !== undefined && state.turnIndex - r.lastTurnIndex < SAME_MEMORY_WEEKS) return 0;
  return Math.pow(0.6, r.shown);
}

function candidates(state: GameState): Candidate[] {
  const u = userPlayer(state);
  const out: Candidate[] = [];
  const mems = state.user.memories.filter((m) => !NEVER_RECALLED.includes(m.kind));

  // Anniversaries: the same week of the year, a round number of seasons on.
  for (const m of mems) {
    const years = state.season - m.season;
    if (m.importance < 55 || !ANNIVERSARIES.includes(years) || Math.abs(state.turn - m.turn) > 1) continue;
    out.push({ memory: m, reason: "anniversary", weight: m.importance * (1 + years / 40), years });
  }

  // This week's match: who and where.
  const pend = state.pending[0];
  const fixture = pend ? Object.values(state.competitions).flatMap((c) => c.fixtures).find((f) => f.id === pend.fixtureId) : undefined;
  const comp = fixture ? state.competitions[fixture.compId] : undefined;
  if (fixture && comp && (comp.kind === "league" || comp.kind === "cup" || comp.kind === "continental") && u.clubId) {
    const opp = fixture.home === u.clubId ? fixture.away : fixture.home;
    const oppClub = state.clubs[opp];
    const played = u.history.filter((h) => h.clubId === opp && h.stats.apps > 0).length;
    for (const m of mems) {
      if (m.clubId === opp && opp !== u.clubId && m.importance >= 50 && m.kind !== "relegation") {
        const origin = opp === state.user.startClubId && m.kind === "debut";
        out.push({ memory: m, reason: origin ? "origin" : played ? "former-club" : "opponent-history", weight: m.importance * (origin ? 1.35 : 1.2), fixtureId: fixture.id });
      } else if (m.opponentId === opp && m.fixtureId && m.importance >= 45) {
        out.push({ memory: m, reason: "opponent-history", weight: m.importance * 0.95, fixtureId: fixture.id });
      } else if (m.venueClubId === fixture.home && fixture.home !== u.clubId && m.clubId !== fixture.home && m.importance >= 55) {
        out.push({ memory: m, reason: "venue", weight: m.importance * 1.05, fixtureId: fixture.id });
      } else if (m.kind === "manager-conflict" && m.manager && oppClub && oppClub.manager.name === m.manager.name && m.clubId !== opp) {
        out.push({ memory: m, reason: "grudge", weight: m.importance * 1.5, fixtureId: fixture.id });
      }
    }
  }
  return out.map((c) => ({ ...c, weight: c.weight * freshness(state, c.memory) })).filter((c) => c.weight >= MIN_WEIGHT);
}

/** Weekly tick: choose this week's single recall (or none) and, rarely, post it to the news feed. */
export function refreshRecall(state: GameState): void {
  const u = state.user;
  if (u.retired || u.memories.length === 0) {
    u.vault = undefined;
    return;
  }
  if (u.vault && u.vault.turnIndex === state.turnIndex) return;
  const last = u.vault;
  const tooSoon = last && state.turnIndex - last.turnIndex < GAP_WEEKS;
  const best = candidates(state).sort((a, b) => b.weight - a.weight)[0];
  // Stories about this week's opponent may break the quiet period; plain anniversaries may not.
  if (!best || (tooSoon && best.reason === "anniversary")) return;
  const item: VaultItem = { memoryId: best.memory.id, reason: best.reason, turnIndex: state.turnIndex, fixtureId: best.fixtureId, years: best.years };
  u.vault = item;
  best.memory.recall = { shown: (best.memory.recall?.shown ?? 0) + 1, lastTurnIndex: state.turnIndex };
  const newsOk = u.memoryNewsTurnIndex === undefined || state.turnIndex - u.memoryNewsTurnIndex >= NEWS_GAP_WEEKS;
  if (newsOk && (best.reason === "anniversary" || best.reason === "origin" || best.reason === "former-club" || best.reason === "grudge")) {
    const text = recallText(state, item);
    addNews(state, { kind: "memory", title: text.headline, body: text.body, memoryId: item.memoryId });
    u.memoryNewsTurnIndex = state.turnIndex;
  }
}

export interface RecallText {
  headline: string;
  body: string;
  icon: string;
}

/** Presentation of a recall, built from the stored memory and the reason it resurfaced. */
export function recallText(state: GameState, item: VaultItem): RecallText {
  const m = state.user.memories.find((x) => x.id === item.memoryId);
  if (!m) return { headline: "", body: "", icon: "🎞️" };
  const v = describeMemory(state, m);
  const u = userPlayer(state);
  const fixture = item.fixtureId ? Object.values(state.competitions).flatMap((c) => c.fixtures).find((f) => f.id === item.fixtureId) : undefined;
  const oppId = fixture ? (fixture.home === u.clubId ? fixture.away : fixture.home) : m.clubId;
  const opp = oppId ? clubName(oppId, true) : "";
  switch (item.reason) {
    case "anniversary": {
      const n = item.years ?? state.season - m.season;
      return { headline: `${WORDS[n] ?? `${n} years`} since ${recallPhrase(m)}`, body: `${v.line} (age ${m.age}, ${v.seasonLabel})`, icon: v.icon };
    }
    case "origin":
      return { headline: `Facing the club where it began`, body: `${opp} gave you your debut. ${v.line}`, icon: "🌱" };
    case "former-club": {
      const seasons = u.history.filter((h) => h.clubId === oppId && h.stats.apps > 0).length;
      return { headline: `Back against ${opp}`, body: `You spent ${seasons || "some"} season${seasons === 1 ? "" : "s"} there. ${v.title}: ${v.line}`, icon: "❤️" };
    }
    case "opponent-history":
      return { headline: `History with ${opp}`, body: `${v.title}: ${v.line}`, icon: v.icon };
    case "venue": {
      const ground = m.venueClubId ? stadium(staticClub(m.venueClubId)?.stadiumId ?? "")?.name : undefined;
      return { headline: `Back at ${ground ?? clubName(m.venueClubId, true)}`, body: `Last time you made a mark here: ${v.title} (${v.seasonLabel}).`, icon: "🏟️" };
    }
    case "grudge":
      return { headline: "A manager you once fell out with", body: `Your first meeting since the rift at ${clubName(m.clubId, true)}.`, icon: "😤" };
  }
}

/** The vault item to show right now (only this week's). */
export function currentVault(state: GameState): VaultItem | undefined {
  const v = state.user.vault;
  return v && v.turnIndex === state.turnIndex ? v : undefined;
}
