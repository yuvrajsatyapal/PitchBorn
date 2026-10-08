import { clubName } from "../data/world";
import type { ClubId, GameState, StintEventKind, TenureHonours } from "../types";
import { relLabel, withManager, type RelLabel } from "./history";
import { recordOf } from "./registry";

export const EVENT_TEXT: Record<StintEventKind, string> = {
  breakthrough: "Gave you your first-team breakthrough",
  captain: "Made you captain",
  "playing-dispute": "A playing-time dispute",
  "transfer-dispute": "A transfer dispute",
  fallout: "A fallout",
  reunion: "Reunited",
  honour: "Won silverware together",
  talk: "A talk about your role",
};

export interface StintRow {
  key: string;
  managerId: string;
  name: string;
  clubId: ClubId;
  span: string;
  relationship: RelLabel;
  /** The relationship now, if this manager is the current one; otherwise how it stood when you parted. */
  current: boolean;
  honoursText: string;
  apps: number;
  starts: number;
  goals: number;
  notes: string[];
  reunion: boolean;
  ended: string | null;
  /** The manager has played a part in the career worth singling out. */
  major: boolean;
}

function honoursText(h: TenureHonours): string {
  const bits: string[] = [];
  if (h.league) bits.push(`League ×${h.league}`);
  if (h.continental) bits.push(`Continental ×${h.continental}`);
  if (h.cup) bits.push(`Cup ×${h.cup}`);
  if (h.promotions) bits.push(h.promotions > 1 ? `Promotion ×${h.promotions}` : "Promotion");
  return bits.join(" · ");
}

const seasonSpan = (a: number, b: number) => (a === b ? `${a}` : `${a}–${b}`);
const ENDED: Record<string, string> = { sacked: "Sacked", resigned: "Resigned", moved: "Left for another club", retired: "Retired", contract: "Contract ended", "player-left": "You left the club" };

/** The user's managers, oldest first, one row per stint. Only managers played under count. */
export function stintRows(state: GameState): StintRow[] {
  const out: StintRow[] = [];
  for (const [i, s] of (state.user.mgr?.stints ?? []).entries()) {
    if (s.apps === 0 && s.to) continue;
    const end = s.to?.season ?? state.season;
    const w = withManager(state, s.managerId);
    out.push({
      key: `${s.managerId}-${s.clubId}-${i}`,
      managerId: s.managerId,
      name: recordOf(state, s.managerId)?.name ?? "Manager",
      clubId: s.clubId,
      span: seasonSpan(s.from.season, s.to ? (s.to.turn <= 4 && end > s.from.season ? end - 1 : end) : state.season),
      relationship: relLabel(s.relEnd ?? Math.round(state.user.relationships.manager)),
      current: !s.to,
      honoursText: honoursText(s.honours),
      apps: s.apps,
      starts: s.starts,
      goals: s.goals,
      notes: [...new Set(s.events.map((e) => EVENT_TEXT[e.k]))],
      reunion: !!s.reunion,
      ended: s.ended ? ENDED[s.ended] ?? null : null,
      major: !!w && w.importance >= 30,
    });
  }
  return out;
}

export interface CurrentManagerView {
  name: string;
  /** "Previously worked together: 2028–2030 · Derby County" */
  past: { span: string; clubs: string; relationship: RelLabel; apps: number; honoursText: string } | null;
  /** The current bar, which belongs to this manager. */
  activeRel: number;
  reunited: boolean;
}

export function currentManagerView(state: GameState, clubId: ClubId): CurrentManagerView | null {
  const club = state.clubs[clubId];
  const id = club?.manager.id;
  if (!id) return null;
  const w = withManager(state, id);
  const prior = (state.user.mgr?.stints ?? []).filter((s) => s.managerId === id && s.apps > 0 && s.to);
  if (!w || !prior.length) return { name: club.manager.name, past: null, activeRel: state.user.relationships.manager, reunited: false };
  const first = prior[0];
  const last = prior[prior.length - 1];
  return {
    name: club.manager.name,
    past: {
      span: seasonSpan(first.from.season, last.to?.season ?? state.season),
      clubs: [...new Set(prior.map((s) => clubName(s.clubId, true)))].join(" · "),
      relationship: relLabel(last.relEnd ?? w.rel),
      apps: prior.reduce((n, s) => n + s.apps, 0),
      honoursText: honoursText(w.honours),
    },
    activeRel: state.user.relationships.manager,
    reunited: prior.some((s) => !s.to) || w.reunited,
  };
}
