import type { GameState, PlayerRival, RivalCandidate, RivalEvent, RivalEventKind, RivalMeeting, RivalryState } from "../../types";

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const KINDS: readonly RivalEventKind[] = ["formed", "meeting", "race", "award", "transfer", "intl", "incident", "media", "record", "cooled", "ended"];
const MAX_RIVALS = 6;
const MAX_ACTIVE = 3;
const MAX_CANDIDATES = 12;

function meetings(v: unknown, state: GameState): RivalMeeting[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((m) => m && typeof m === "object" && typeof m.fixtureId === "string")
    .map((m) => ({
      season: num(m.season, state.season),
      turn: num(m.turn, 1),
      fixtureId: m.fixtureId,
      compId: str(m.compId),
      compName: str(m.compName),
      stage: typeof m.stage === "string" ? m.stage : undefined,
      intl: !!m.intl,
      score: Array.isArray(m.score) && m.score.length === 2 ? [num(m.score[0], 0), num(m.score[1], 0)] : [0, 0],
      myGoals: Math.max(0, num(m.myGoals, 0)),
      theirGoals: Math.max(0, num(m.theirGoals, 0)),
      result: m.result === "win" || m.result === "loss" ? m.result : "draw",
      weight: Math.max(0, num(m.weight, 0)),
      note: typeof m.note === "string" ? m.note : undefined,
    }) as RivalMeeting)
    .slice(-40);
}

function events(v: unknown, state: GameState): RivalEvent[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((e) => e && typeof e === "object" && typeof e.text === "string")
    .map((e) => ({ season: num(e.season, state.season), turn: num(e.turn, 1), kind: KINDS.includes(e.kind) ? e.kind : "meeting", text: e.text }) as RivalEvent)
    .slice(-50);
}

/**
 * Makes rivalry state safe whatever a save contains: unknown fields are rebuilt, numbers are clamped, the
 * head-to-head is recomputed from the recorded meetings, and no more than three rivalries stay active.
 */
export function sanitizeRivalry(state: GameState): void {
  const raw = (state.user.rivalry ?? {}) as Partial<RivalryState>;
  const rivals: PlayerRival[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(raw.rivals) ? raw.rivals : []) {
    if (!item || typeof item !== "object" || typeof item.playerId !== "string" || seen.has(item.playerId)) continue;
    seen.add(item.playerId);
    const ms = meetings(item.meetings, state);
    const h2h = { meetings: 0, wins: 0, draws: 0, losses: 0, myGoals: 0, theirGoals: 0 };
    for (const m of ms) {
      h2h.meetings++;
      if (m.result === "win") h2h.wins++;
      else if (m.result === "loss") h2h.losses++;
      else h2h.draws++;
      h2h.myGoals += m.myGoals;
      h2h.theirGoals += m.theirGoals;
    }
    const intensity = Math.max(0, Math.min(100, num(item.intensity, 0)));
    rivals.push({
      playerId: item.playerId,
      name: str(item.name, state.players[item.playerId] ? `${state.players[item.playerId].firstName} ${state.players[item.playerId].lastName}` : "A rival"),
      clubId: typeof item.clubId === "string" && state.clubs[item.clubId] ? item.clubId : null,
      since: { season: num(item.since?.season, state.season), turn: num(item.since?.turn, 1) },
      intensity,
      peak: Math.max(intensity, Math.min(100, num(item.peak, intensity))),
      status: item.status === "dormant" || item.status === "ended" ? item.status : "active",
      endedReason: typeof item.endedReason === "string" ? item.endedReason : undefined,
      causes: Array.isArray(item.causes) ? item.causes.filter((c): c is string => typeof c === "string").slice(0, 10) : [],
      lastContactIndex: num(item.lastContactIndex, state.turnIndex),
      media: Math.max(0, Math.min(10, num(item.media, 0))),
      lastNewsIndex: num(item.lastNewsIndex, -999),
      // The head-to-head is kept as stored when more meetings happened than are kept in the list.
      h2h: ms.length >= num(item.h2h?.meetings, 0) ? h2h : { meetings: Math.max(0, num(item.h2h?.meetings, 0)), wins: Math.max(0, num(item.h2h?.wins, 0)), draws: Math.max(0, num(item.h2h?.draws, 0)), losses: Math.max(0, num(item.h2h?.losses, 0)), myGoals: Math.max(0, num(item.h2h?.myGoals, 0)), theirGoals: Math.max(0, num(item.h2h?.theirGoals, 0)) },
      meetings: ms,
      events: events(item.events, state),
    });
  }
  let active = 0;
  for (const r of [...rivals].sort((a, b) => b.intensity - a.intensity)) {
    if (r.status !== "active") continue;
    if (++active > MAX_ACTIVE) r.status = "dormant";
  }

  const candidates: Record<string, RivalCandidate> = {};
  const rawCands = raw.candidates && typeof raw.candidates === "object" ? (raw.candidates as Record<string, Partial<RivalCandidate>>) : {};
  for (const [id, c] of Object.entries(rawCands)) {
    if (!c || typeof c !== "object" || !state.players[id] || seen.has(id)) continue;
    candidates[id] = {
      points: Math.max(0, num(c.points, 0)),
      intl: Math.max(0, num(c.intl, 0)),
      media: Math.max(0, Math.min(4, num(c.media, 0))),
      plain: Math.max(0, Math.min(6, num(c.plain, 0))),
      causes: Array.isArray(c.causes) ? c.causes.filter((x): x is string => typeof x === "string").slice(0, 10) : [],
      lastIndex: num(c.lastIndex, state.turnIndex),
      meetings: meetings(c.meetings, state).slice(-12),
      events: events(c.events, state).slice(-12),
    };
  }
  const kept = Object.entries(candidates).sort((a, b) => b[1].points - a[1].points).slice(0, MAX_CANDIDATES);

  state.user.rivalry = {
    rivals: rivals.slice(-MAX_RIVALS),
    candidates: Object.fromEntries(kept),
    transferScan: Math.max(0, Math.min(state.transferLog.length, Math.round(num(raw.transferScan, 0)))),
    lastFormedIndex: num(raw.lastFormedIndex, -999),
    lastMediaIndex: typeof raw.lastMediaIndex === "number" ? raw.lastMediaIndex : undefined,
  };
}
