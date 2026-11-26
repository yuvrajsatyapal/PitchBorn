/**
 * Share codes for the weekly challenge: a short text like `PB-26W48-UD-W-2K9-ALEXTESTER-7F` that carries the week, the
 * challenge, how it went, a score and a name, with a checksum so typos are caught. Friends paste each other's codes to
 * compare, with no server. A code is a claim, not proof: it is easy to read and could be forged, which is fine for
 * friendly comparison.
 */
import type { GameState } from "../types";
import { userPlayer } from "../world/helpers";
import { CHALLENGES, challengeView } from "./challenges";

export interface ShareResult {
  week: string;
  challengeId: string;
  status: "won" | "failed" | "active";
  score: number;
  name: string;
}

const STATUS = { won: "W", failed: "F", active: "A" } as const;
const FROM_STATUS: Record<string, ShareResult["status"]> = { W: "won", F: "failed", A: "active" };

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Two upper-case letters/digits per challenge, from its id. */
export function challengeTag(id: string): string {
  const parts = id.split("-");
  const tag = (parts.length > 1 ? parts[0][0] + parts[1][0] : id.slice(0, 2)).toUpperCase();
  // Keep tags unique even if two ids share initials.
  const clash = CHALLENGES.filter((c) => (c.id.split("-").length > 1 ? c.id.split("-")[0][0] + c.id.split("-")[1][0] : c.id.slice(0, 2)).toUpperCase() === tag);
  return clash.length > 1 ? `${tag[0]}${CHALLENGES.findIndex((c) => c.id === id)}` : tag;
}

const checksum = (body: string) => (hash(body) % 1296).toString(36).toUpperCase().padStart(2, "0");
const cleanName = (n: string) => n.normalize("NFD").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 12) || "PLAYER";

/** "2026-W48" → "26W48". */
const shortWeek = (w: string) => w.replace(/^\d\d(\d\d)-W(\d\d)$/, "$1W$2");
const longWeek = (w: string) => w.replace(/^(\d\d)W(\d\d)$/, "20$1-W$2");

/** A score for comparing runs of the same challenge: winning matters most, then the career built along the way. */
export function challengeScore(state: GameState): number {
  const v = challengeView(state);
  const p = userPlayer(state);
  const won = v?.state.status === "won" ? 1000 : 0;
  return Math.max(0, Math.round(won + state.user.peakOverall * 4 + state.user.trophies.length * 30 + p.career.goals + p.career.assists + p.career.apps / 5 + (state.user.legacy?.score ?? 0)));
}

export function encodeShare(r: ShareResult): string {
  const body = `PB-${shortWeek(r.week)}-${challengeTag(r.challengeId)}-${STATUS[r.status]}-${r.score.toString(36).toUpperCase()}-${cleanName(r.name)}`;
  return `${body}-${checksum(body)}`;
}

/** Parse a pasted code; returns null for anything malformed or with a wrong checksum. */
export function decodeShare(code: string): ShareResult | null {
  const c = code.trim().toUpperCase().replace(/\s+/g, "");
  const m = /^PB-(\d\dW\d\d)-([A-Z0-9]{2})-([WFA])-([0-9A-Z]{1,6})-([A-Z]{1,12})-([0-9A-Z]{2})$/.exec(c);
  if (!m) return null;
  const body = c.slice(0, c.lastIndexOf("-"));
  if (checksum(body) !== m[6]) return null;
  const def = CHALLENGES.find((x) => challengeTag(x.id) === m[2]);
  if (!def) return null;
  return { week: longWeek(m[1]), challengeId: def.id, status: FROM_STATUS[m[3]], score: parseInt(m[4], 36), name: m[5] };
}

/** This career's share code, when it is a weekly challenge. */
export function shareCodeFor(state: GameState): string | null {
  const v = challengeView(state);
  if (!v?.state.weekly) return null;
  const p = userPlayer(state);
  return encodeShare({ week: v.state.weekly, challengeId: v.def.id, status: v.state.status, score: challengeScore(state), name: `${p.firstName}${p.lastName}` });
}

/** Best first; won runs above the rest, then by score. Duplicate codes count once. */
export function rankShares(codes: readonly string[]): { code: string; r: ShareResult }[] {
  const seen = new Set<string>();
  const out: { code: string; r: ShareResult }[] = [];
  for (const code of codes) {
    const r = decodeShare(code);
    const key = code.trim().toUpperCase();
    if (!r || seen.has(key)) continue;
    seen.add(key);
    out.push({ code: key, r });
  }
  return out.sort((a, b) => Number(b.r.status === "won") - Number(a.r.status === "won") || b.r.score - a.r.score);
}
