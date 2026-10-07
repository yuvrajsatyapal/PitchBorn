import { noteRecord } from "../career/rivalry/engine";
import { rememberRecord } from "../memory/detect";
import type { AwardRecord, GameState, WorldRecord } from "../types";
import { addNews, addTimeline, fullName, userPlayer } from "../world/helpers";

export const AWARD_RECORD_PREFIX = "award-";
/** A tally is only a record once someone has done it more than once. */
const MIN_COUNT = 2;

function leader(awards: AwardRecord[], id: string): { playerId: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const a of awards) if (a.id === id) counts.set(a.playerId, (counts.get(a.playerId) ?? 0) + 1);
  let best: { playerId: string; count: number } | null = null;
  for (const [playerId, count] of counts) if (!best || count > best.count || (count === best.count && playerId < best.playerId)) best = { playerId, count };
  return best && best.count >= MIN_COUNT ? best : null;
}

/**
 * Award records the game really knows: derived only from the season archive. Most wins of an award, and the youngest
 * Player of the Season. (Team of the Season is archived for one league only, so it is not a record.)
 */
export function updateAwardRecords(state: GameState): void {
  const awards = state.archive.flatMap((a) => a.awards);
  const out: WorldRecord[] = [];
  const nameOf = (id: string) => (state.players[id] ? fullName(state.players[id]) : state.legends.find((l) => l.id === id)?.name ?? "Retired player");
  const pots = leader(awards, "pots");
  if (pots) out.push({ id: `${AWARD_RECORD_PREFIX}pots-wins`, label: "Most Player of the Season awards", value: pots.count, playerId: pots.playerId, name: nameOf(pots.playerId) });
  const boots = leader(awards, "topscorer");
  if (boots) out.push({ id: `${AWARD_RECORD_PREFIX}golden-boots`, label: "Most Golden Boots", value: boots.count, playerId: boots.playerId, name: nameOf(boots.playerId) });
  const aged = awards.filter((a) => a.id === "pots" && typeof a.age === "number").sort((a, b) => (a.age as number) - (b.age as number) || a.season - b.season)[0];
  if (aged && awards.filter((a) => a.id === "pots").length >= 3) out.push({ id: `${AWARD_RECORD_PREFIX}youngest-pots`, label: "Youngest Player of the Season", value: aged.age as number, playerId: aged.playerId, name: nameOf(aged.playerId), season: aged.season });

  const uid = state.user.playerId;
  const me = userPlayer(state);
  for (const r of out) {
    const prev = state.records.find((x) => x.id === r.id);
    if (r.playerId === uid && prev?.playerId !== uid) {
      addTimeline(state, { kind: "record", title: `Record: ${r.label}`, detail: String(r.value) });
      rememberRecord(state, r.label, r.id.endsWith("youngest-pots") ? 40 : r.value * 10);
      addNews(state, { kind: "career", title: r.id.endsWith("youngest-pots") ? `Youngest ever winner: ${r.label}` : `New record: ${r.label}`, body: r.id.endsWith("youngest-pots") ? `Aged ${r.value}` : `${r.value}`, important: true });
      if (prev && prev.playerId !== uid) noteRecord(state, prev.playerId, true, r.label);
    } else if (prev?.playerId === uid && r.playerId !== uid) {
      noteRecord(state, r.playerId, false, r.label);
    }
  }
  void me;
  state.records = [...state.records.filter((r) => !r.id.startsWith(AWARD_RECORD_PREFIX)), ...out];
}
