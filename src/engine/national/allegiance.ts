/**
 * Invitations to represent another nation.
 *
 * A player eligible for two nations is never moved from one to the other by the simulation. The other nation may
 * *approach* the player, at most once in a while and only when the football makes sense (they would be picked there,
 * the player is not a certainty at home). The player answers: accept (one switch, before being cap-tied), decline, or
 * decide later. Silence never accepts: a deferred or unanswered invitation lapses and the allegiance stays as it was.
 *
 * Call-ups for the nation the player already represents are a different thing and never come through here.
 */
import { country } from "../data/world";
import { overallFor, positionGroup } from "../players/attributes";
import { ageOf } from "../players/generate";
import { Factors } from "../memory/score";
import { recordMemory } from "../memory/store";
import type { Rng } from "../rng";
import type { CareerDecision, CountryCode, GameState, IntlInvitation, IntlState, Player, PositionGroup } from "../types";
import { addNews, addTimeline, nextId, userPlayer } from "../world/helpers";
import { canSwitchAllegiance, commitment, intlTeam } from "./identity";
import { eligibleFor, selectionScore } from "./national";

/** Three weeks before each international window. */
export const INVITE_CHECK_TURNS: readonly number[] = [6, 11, 16, 30];
/** How long an invitation stays open, in turns. */
export const INVITE_LIFETIME = 36;
export const DEFER_WEEKS = 12;
export const MAX_DEFERRALS = 2;
export const DECLINE_COOLDOWN = 80;
export const EXPIRE_COOLDOWN = 40;
/** Overall rise since a declined approach that counts as a material change. */
export const MATERIAL_OVR = 3;
/** Fewest overall rating a player needs before national teams take notice. */
export const MIN_OVR = 50;

const SLOTS: Record<PositionGroup, number> = { GK: 3, DEF: 9, MID: 8, ATT: 6 };
const GROUP_NAME: Record<PositionGroup, string> = { GK: "goalkeeper", DEF: "defender", MID: "midfielder", ATT: "forward" };

export interface Outlook {
  code: CountryCode;
  group: PositionGroup;
  /** Zero-based place among the eligible players of the same kind. */
  rank: number;
  slots: number;
  pool: number;
  inSquad: boolean;
  tier: "strong" | "fringe" | "unlikely";
  strength: number;
}

const nameOf = (code: string) => country(code)?.name ?? code;
const ordinal = (n: number) => {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
};

/** How the user would fare in a nation's squad, from the real eligible pool and the same scoring squads are picked with. */
export function outlookFor(state: GameState, code: CountryCode): Outlook {
  const u = userPlayer(state);
  const group = positionGroup(u.position);
  const mine = scoreForOutlook(state, u);
  let ahead = 0;
  let pool = 0;
  for (const p of Object.values(state.players)) {
    if (p.isUser || positionGroup(p.position) !== group) continue;
    if (!nationEligibleForPool(p, code)) continue;
    pool++;
    if (scoreForOutlook(state, p) > mine + 0.5) ahead++;
  }
  const slots = SLOTS[group];
  return {
    code,
    group,
    rank: ahead,
    slots,
    pool,
    inSquad: !!state.nationalTeams[code]?.squad.includes(u.id),
    tier: ahead < slots * 0.5 ? "strong" : ahead < slots ? "fringe" : "unlikely",
    strength: state.nationalTeams[code]?.strength ?? 0,
  };
}

/** Pool membership uses the nation's own rules for everyone but the user, who is what is being measured. */
function nationEligibleForPool(p: Player, code: string): boolean {
  if (p.retired || p.intl.retired) return false;
  if (p.injury && p.injury.weeksLeft > 8) return false;
  return eligibleFor(p, code);
}

function scoreForOutlook(state: GameState, p: Player): number {
  return selectionScore(state, p);
}

export function intlStateOf(state: GameState): IntlState {
  return (state.user.intl ??= { history: [], cooldownUntil: 0 });
}

const pendingDecision = (state: GameState) => state.user.decisions.find((d) => d.intlCode);

/** Nations that could approach: eligible, but not the one the player already represents. */
export function approachableNations(state: GameState): CountryCode[] {
  const u = userPlayer(state);
  const cur = intlTeam(u);
  return [u.nationality, u.altNationality].filter((c): c is string => !!c && c !== cur);
}

function reasonsFor(state: GameState, alt: Outlook, cur: Outlook): string[] {
  const u = userPlayer(state);
  const g = GROUP_NAME[alt.group];
  const out: string[] = [];
  out.push(
    alt.tier === "strong"
      ? `${nameOf(alt.code)} would pick you: you'd rank ${ordinal(alt.rank + 1)} of ${alt.pool} eligible ${g}s there.`
      : `${nameOf(alt.code)} have a place for you: ${ordinal(alt.rank + 1)} of ${alt.pool} eligible ${g}s, with ${alt.slots} places in a squad.`,
  );
  out.push(
    cur.inSquad
      ? `At home you're in ${nameOf(cur.code)}'s squad, though only ${ordinal(cur.rank + 1)} of ${cur.pool} eligible ${g}s.`
      : cur.tier === "unlikely"
        ? `${nameOf(cur.code)} have ${cur.pool} eligible ${g}s ahead of the places available: you'd rank ${ordinal(cur.rank + 1)}.`
        : `You have not been picked by ${nameOf(cur.code)} yet (ranked ${ordinal(cur.rank + 1)} of ${cur.pool}).`,
  );
  if (ageOf(u, state.season) <= 21) out.push("Early international football would speed up your development.");
  return out;
}

function openDecision(state: GameState, inv: IntlInvitation): void {
  const u = userPlayer(state);
  const cur = intlTeam(u);
  const alt = nameOf(inv.code);
  const home = nameOf(cur);
  const d: CareerDecision = {
    id: nextId(state, "d"),
    kind: "event",
    title: `${alt} national team invitation`,
    body: [
      `${alt} would like you to represent them internationally.`,
      ...inv.reasons,
      `You currently represent ${home}. Accepting switches your international allegiance to ${alt} for upcoming call-ups. You can only switch once, and playing a competitive senior international for ${alt} would make the choice permanent. Your caps so far (${u.intl.caps}) stay on record.`,
      `Do nothing and you stay with ${home}.`,
    ].join("\n\n"),
    options: [
      { id: "accept", label: `Accept — represent ${alt}`, hint: "One switch only. Permanent once you play a competitive senior match." },
      { id: "decline", label: `Decline — stay with ${home}`, hint: `${alt} may ask again if things change.` },
      { id: "later", label: "Decide later", hint: inv.deferrals >= MAX_DEFERRALS - 1 ? "Last chance: if you wait again, the invitation lapses." : `I'll ask again in about ${DEFER_WEEKS} weeks.` },
    ],
    expiresTurn: Math.min(state.turn + 3, 50),
    season: state.season,
    eventId: "intl-invite",
    fallback: "later",
    intlCode: inv.code,
  };
  state.user.decisions.push(d);
}

function record(state: GameState, inv: IntlInvitation, outcome: "accepted" | "declined" | "expired"): void {
  const st = intlStateOf(state);
  st.history.push({ code: inv.code, outcome, index: state.turnIndex, ovr: inv.ovr });
  if (st.history.length > 12) st.history.shift();
  st.cooldownUntil = state.turnIndex + (outcome === "declined" ? DECLINE_COOLDOWN : EXPIRE_COOLDOWN);
  st.invitation = undefined;
}

function dropDecisions(state: GameState): void {
  state.user.decisions = state.user.decisions.filter((d) => !d.intlCode);
}

/** The invitation can no longer be acted on: the player retired, was cap-tied, or already represents that nation. */
function stale(state: GameState, inv: IntlInvitation): boolean {
  const u = userPlayer(state);
  return !canSwitchAllegiance(u).ok || intlTeam(u) === inv.code || !approachableNations(state).includes(inv.code) || state.user.retired;
}

/** Once a turn: bring back a deferred invitation, lapse an old one, and on check turns maybe make a new approach. */
export function stepInvitations(state: GameState, rng: Rng): void {
  const u = userPlayer(state);
  const st = intlStateOf(state);
  const idx = state.turnIndex;
  const inv = st.invitation;
  if (inv) {
    if (stale(state, inv)) {
      st.invitation = undefined;
      dropDecisions(state);
      return;
    }
    if (idx > inv.expiresIndex && !pendingDecision(state)) {
      record(state, inv, "expired");
      addNews(state, { kind: "national", title: `${nameOf(inv.code)}'s invitation lapses`, body: "You never answered, so your allegiance stays as it was." });
      return;
    }
    // An open invitation always has its question on screen unless the player deferred it; a missing one is re-asked.
    if (!pendingDecision(state) && (inv.returnIndex === undefined || idx >= inv.returnIndex)) {
      inv.returnIndex = undefined;
      openDecision(state, inv);
    }
    return;
  }
  if (!INVITE_CHECK_TURNS.includes(state.turn) || state.turn < 4) return;
  if (idx < st.cooldownUntil || state.user.decisions.some((d) => d.intlCode)) return;
  if (!canSwitchAllegiance(u).ok || ageOf(u, state.season) < 17) return;
  const ovr = overallFor(u.attrs, u.position);
  if (ovr < MIN_OVR) return;
  const cur = outlookFor(state, intlTeam(u));
  let best: { code: CountryCode; alt: Outlook; chance: number } | null = null;
  for (const code of approachableNations(state)) {
    const last = [...st.history].reverse().find((h) => h.code === code);
    // After a "no", the same nation needs a reason to ask again: a clear step up in ability, or enough time.
    if (last?.outcome === "declined" && ovr < last.ovr + MATERIAL_OVR && idx < last.index + DECLINE_COOLDOWN * 2) continue;
    const alt = outlookFor(state, code);
    if (alt.tier === "unlikely") continue;
    let chance = alt.tier === "strong" ? 0.55 : 0.3;
    if (cur.inSquad) chance *= cur.tier === "strong" ? 0.35 : 0.6;
    else if (cur.tier === "unlikely") chance *= 1.4;
    if (ageOf(u, state.season) < 19) chance *= 0.6;
    chance = Math.min(0.7, Math.max(0.05, chance));
    if (!best || chance > best.chance) best = { code, alt, chance };
  }
  if (!best || !rng.chance(best.chance)) return;
  const made: IntlInvitation = { code: best.code, createdIndex: idx, expiresIndex: idx + INVITE_LIFETIME, deferrals: 0, reasons: reasonsFor(state, best.alt, cur), ovr: Math.round(ovr) };
  st.invitation = made;
  openDecision(state, made);
  addNews(state, { kind: "national", title: `${nameOf(best.code)} want you`, body: "An invitation to represent them is waiting on your dashboard.", important: true });
}

/** Resolve the player's answer. Returns the message to show. */
export function resolveInvitation(state: GameState, optionId: string): string {
  const st = intlStateOf(state);
  const inv = st.invitation;
  if (!inv) return "That invitation is no longer open.";
  const u = userPlayer(state);
  const home = nameOf(intlTeam(u));
  const alt = nameOf(inv.code);
  if (optionId === "accept") {
    const can = canSwitchAllegiance(u);
    if (!can.ok) {
      st.invitation = undefined;
      return `You can't switch allegiance: ${can.reason}`;
    }
    const from = intlTeam(u);
    u.intl.allegiance = inv.code;
    u.intl.switches = (u.intl.switches ?? 0) + 1;
    // Leave the old squad now; the new nation picks players at its next window. No cap is given for saying yes.
    const old = state.nationalTeams[from];
    if (old) {
      old.squad = old.squad.filter((id) => id !== u.id);
      if (old.numbers) delete old.numbers[u.id];
    }
    record(state, inv, "accepted");
    addTimeline(state, { kind: "international", title: `Chose to represent ${alt}`, detail: `Switched international allegiance from ${home}. ${u.intl.caps} cap${u.intl.caps === 1 ? "" : "s"} so far.` });
    addNews(state, { kind: "national", title: `You will represent ${alt}`, body: `You turned from ${home}. Selection for ${alt} starts at their next international window.`, important: true });
    recordMemory(state, {
      kind: "career-decision",
      clubId: u.clubId,
      tags: ["decision", "allegiance"],
      factors: new Factors().add("Chose a national team", 38).add("Turned from the country of your citizenship", from === u.nationality ? 6 : 0),
      key: `allegiance-${inv.code}`,
      data: { event: "intl-allegiance", option: "accept", title: `You chose to represent ${alt}`, code: inv.code },
    });
    return `You will represent ${alt}.`;
  }
  if (optionId === "decline") {
    record(state, inv, "declined");
    addNews(state, { kind: "national", title: `You turn down ${alt}`, body: `You stay with ${home}.` });
    return `You stay with ${home}.`;
  }
  // Decide later: it comes back a couple of times, then lapses. It is never accepted for the player.
  inv.deferrals++;
  if (inv.deferrals > MAX_DEFERRALS || state.turnIndex + DEFER_WEEKS > inv.expiresIndex) {
    record(state, inv, "expired");
    addNews(state, { kind: "national", title: `${alt}'s invitation lapses`, body: `You stay with ${home}.` });
    return `${alt}'s invitation has lapsed. You stay with ${home}.`;
  }
  inv.returnIndex = state.turnIndex + DEFER_WEEKS;
  return `You'll decide later. ${alt} will ask again in about ${DEFER_WEEKS} weeks.`;
}

/** Make the stored invitation state safe to load. */
export function sanitizeIntlState(state: GameState): void {
  const u = state.user;
  if (!u.intl) return;
  const st = u.intl;
  if (!Array.isArray(st.history)) st.history = [];
  st.history = st.history.filter((h) => h && typeof h.code === "string" && ["accepted", "declined", "expired"].includes(h.outcome)).slice(-12);
  if (!Number.isFinite(st.cooldownUntil)) st.cooldownUntil = 0;
  const inv = st.invitation;
  if (inv && (typeof inv.code !== "string" || !Number.isFinite(inv.expiresIndex) || !Array.isArray(inv.reasons))) st.invitation = undefined;
  const open = u.decisions.filter((d) => d.intlCode);
  if (!st.invitation) u.decisions = u.decisions.filter((d) => !d.intlCode);
  else if (open.length > 1) u.decisions = u.decisions.filter((d) => !d.intlCode).concat(open[0]);
  void commitment;
}
