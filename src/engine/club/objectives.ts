/**
 * Season ambitions. What the board asks of a club comes from where the club stands (its reputation rank in the
 * league, the division, the money, the academy), so a title challenger, a promotion hopeful and a relegation
 * candidate are asked different things. Progress is read from the live standings; the result is settled once at the
 * end of the season and moves the board's confidence.
 */
import { CUP_STAGES } from "../competitions/setup";
import { journeyOf } from "../competitions/bracket";
import { staticLeague } from "../data/world";
import type { ClubObjectives, GameState, ObjectiveKind, SeasonObjective } from "../types";
import { adjustRel } from "../career/relationships";
import { addNews, addTimeline, squadOf, userPlayer } from "../world/helpers";
import { standingOf } from "./standing";

const LABEL: Record<ObjectiveKind, string> = {
  title: "Win the league",
  promotion: "Challenge for promotion",
  continental: "Qualify for continental football",
  "top-half": "Finish in the top half",
  survive: "Avoid relegation",
  "cup-run": "Make a cup run",
  develop: "Give young players minutes",
};

/** Share of league minutes that should go to players aged 21 or under to meet the youth ambition. */
export const YOUTH_MINUTES_SHARE = 0.1;

export function objectiveLabel(o: SeasonObjective): string {
  if (o.kind === "cup-run" && o.round !== undefined) return `Reach the ${CUP_STAGES[o.round] ?? "later rounds"} of the cup`;
  if (o.kind === "title") return LABEL.title;
  if (o.kind === "develop") return `${LABEL.develop} (${Math.round(YOUTH_MINUTES_SHARE * 100)}% of league minutes to under-22s)`;
  return LABEL[o.kind];
}

/** The ambitions that fit this club this season. Pure: the same state always gives the same list. */
export function deriveObjectives(state: GameState, clubId: string): ClubObjectives | null {
  const club = state.clubs[clubId];
  const lg = club ? staticLeague(club.leagueId) : undefined;
  if (!club || !lg) return null;
  const n = lg.size;
  const exp = club.expectation ?? rankByReputation(state, clubId);
  const items: SeasonObjective[] = [];
  const add = (kind: ObjectiveKind, extra: Partial<SeasonObjective> = {}) => items.push({ id: `${kind}`, kind, status: "open", ...extra });
  const standing = standingOf(state, clubId);
  const contSlots = standing ? standing.slots.champions + standing.slots.continental : 0;

  if (lg.tier === 1) {
    if (exp <= 2) add("title", { target: 1 });
    else if (exp <= contSlots) add("continental", { target: contSlots });
    else if (exp <= Math.ceil(n * 0.5)) add("top-half", { target: Math.floor(n / 2) });
    else add("survive", { target: n - lg.relegated });
  } else {
    if (exp <= lg.promoted + 1) add("promotion", { target: lg.promoted });
    else if (exp <= Math.ceil(n * 0.5)) add("top-half", { target: Math.floor(n / 2) });
    else if (lg.relegated > 0) add("survive", { target: n - lg.relegated });
    else add("top-half", { target: Math.floor(n / 2) });
  }
  // A cup run is asked of clubs that can plausibly make one, deeper for bigger clubs.
  const cupTier = exp <= Math.ceil(n * 0.25) ? 4 : exp <= Math.ceil(n * 0.6) ? 3 : 0;
  if (cupTier && lg.tier <= 2) add("cup-run", { round: cupTier });
  // A club with a strong academy that is not chasing honours is expected to blood youngsters.
  if (club.youth >= 62 && exp > Math.ceil(n * 0.25)) add("develop", { target: YOUTH_MINUTES_SHARE });
  return { season: state.season, clubId, items };
}

function rankByReputation(state: GameState, clubId: string): number {
  const lid = state.clubs[clubId]?.leagueId;
  const ids = [...(state.leagueClubs[lid] ?? [])].sort((a, b) => state.clubs[b].reputation - state.clubs[a].reputation);
  return Math.max(1, ids.indexOf(clubId) + 1);
}

/** Persist this season's ambitions for the user's club if they are missing or belong to another club or season. */
export function ensureObjectives(state: GameState): ClubObjectives | null {
  const u = userPlayer(state);
  if (!u.clubId || state.user.retired) return null;
  const cur = state.user.objectives;
  if (cur && cur.season === state.season && cur.clubId === u.clubId) return cur;
  const made = deriveObjectives(state, u.clubId);
  state.user.objectives = made ?? undefined;
  return made;
}

/** What the user sees: stored ambitions if they are current, otherwise what would be set. */
export function currentObjectives(state: GameState): ClubObjectives | null {
  const u = userPlayer(state);
  if (!u.clubId) return null;
  const cur = state.user.objectives;
  if (cur && cur.season === state.season && cur.clubId === u.clubId) return cur;
  return deriveObjectives(state, u.clubId);
}

export interface ObjectiveProgress {
  objective: SeasonObjective;
  label: string;
  /** met / missed once the season is settled; otherwise a live read of whether the club is on course. */
  state: "met" | "missed" | "on-course" | "off-course" | "open";
  detail: string;
}

/** Share of league minutes played by players aged 21 or under for the club, this season. */
export function youthMinutesShare(state: GameState, clubId: string): number {
  const lid = state.clubs[clubId]?.leagueId;
  const compId = lid ? `${lid}-${state.season}` : "";
  let young = 0;
  let total = 0;
  for (const p of squadOf(state, clubId)) {
    const m = p.season[compId]?.minutes ?? 0;
    total += m;
    if (state.season - p.birthYear <= 21) young += m;
  }
  return total ? young / total : 0;
}

const cupStageIndex = (stage: string | undefined | null) => (stage ? CUP_STAGES.findIndex((s) => s === stage) : -1);

export function progressOf(state: GameState, clubId: string, o: SeasonObjective): ObjectiveProgress {
  const st = standingOf(state, clubId);
  const label = objectiveLabel(o);
  const settled = o.status !== "open";
  const base = { objective: o, label };
  if (settled) return { ...base, state: o.status === "met" ? "met" : "missed", detail: o.status === "met" ? "Achieved." : "Not achieved." };
  if (o.kind === "cup-run") {
    const comp = Object.values(state.competitions).find((c) => c.kind === "cup" && c.season === state.season && c.teams.includes(clubId));
    if (!comp) return { ...base, state: "open", detail: "No cup draw yet." };
    const j = journeyOf(comp, clubId);
    const reached = Math.max(-1, ...j.played.map((f) => cupStageIndex(f.stage)), ...(j.next ? [cupStageIndex(j.next.stage)] : []));
    const target = o.round ?? 3;
    if (j.status === "champion" || reached >= target) return { ...base, state: "on-course", detail: `Reached the ${CUP_STAGES[Math.min(reached, CUP_STAGES.length - 1)]}.` };
    if (j.status === "eliminated") return { ...base, state: "off-course", detail: `Knocked out in the ${j.stage}.` };
    return { ...base, state: "open", detail: j.next ? `Next: ${j.next.stage}.` : "Awaiting the draw." };
  }
  if (o.kind === "develop") {
    const share = youthMinutesShare(state, clubId);
    return { ...base, state: share >= (o.target ?? YOUTH_MINUTES_SHARE) ? "on-course" : "off-course", detail: `${Math.round(share * 100)}% of league minutes so far.` };
  }
  if (!st || st.preseason || st.position === null) return { ...base, state: "open", detail: "The season hasn't started." };
  const pos = st.position;
  const target = o.target ?? 1;
  const ok = o.kind === "survive" ? pos <= target : pos <= target;
  const left = st.comp ? Math.max(0, (st.size - 1) * 2 - st.played) : 0;
  const text = o.kind === "title" ? `${pos === 1 ? "Top" : `${pos}th`} with ${left} games left.` : `Currently ${pos}${pos === 1 ? "st" : pos === 2 ? "nd" : pos === 3 ? "rd" : "th"}, target ${o.kind === "survive" ? `${target} or better` : `top ${target}`}.`;
  return { ...base, state: ok ? "on-course" : "off-course", detail: text };
}

/** At the end of the season: decide each ambition from the final table and move the board's confidence, once. */
export function settleObjectives(state: GameState): void {
  const u = userPlayer(state);
  const obj = state.user.objectives;
  if (!obj || obj.settled || obj.season !== state.season || !u.clubId || obj.clubId !== u.clubId) return;
  const st = standingOf(state, obj.clubId);
  if (!st || st.position === null) return;
  let met = 0;
  let missed = 0;
  for (const o of obj.items) {
    const p = progressOf(state, obj.clubId, o);
    const ok = p.state === "on-course" || p.state === "met";
    o.status = ok ? "met" : "missed";
    if (o.kind === "cup-run" || o.kind === "develop") {
      met += ok ? 0.5 : 0;
      missed += ok ? 0 : 0.5;
    } else {
      met += ok ? 1 : 0;
      missed += ok ? 0 : 1;
    }
  }
  obj.settled = true;
  const names = obj.items.map((o) => `${objectiveLabel(o)}: ${o.status === "met" ? "met" : "missed"}`);
  if (met > missed) {
    adjustRel(state, "board", 5 + met, "The club met its season ambitions");
    addNews(state, { kind: "club", title: "Season ambitions met", body: names.join(" · ") });
  } else if (missed > 0) {
    adjustRel(state, "board", -(4 + missed * 2), "The club missed its season ambitions");
    addNews(state, { kind: "club", title: "Season ambitions missed", body: names.join(" · "), important: true });
    if (obj.items.some((o) => o.kind === "title" && o.status === "missed")) addTimeline(state, { kind: "event", title: "Title challenge fell short" });
  }
}
