/**
 * Where the user stands for a match: starting, on the bench, left out, or unavailable, and why. The status is read from
 * the same selection the match uses (see teamSelection), and the reasons from the same score parts, so what the screen
 * says can never contradict what the engine did.
 */
import { intlTeam } from "../national/identity";
import { clubName } from "../data/world";
import { FORMATIONS, availability, fitFor, partsTotal, scoreParts, type ScoreParts } from "../match/lineup";
import { overallFor } from "../players/attributes";
import type { Fixture, GameState, Player, Position } from "../types";
import { userPlayer } from "../world/helpers";
import { isNationalComp, selectionSetup, teamSelection } from "./matchday";

export type Availability = "starting" | "bench" | "not-selected" | "injured" | "suspended" | "resting" | "not-called-up";

export type ReasonKind = "ability" | "fitness" | "form" | "sharpness" | "trust" | "tactical" | "rotation" | "formation" | "competition" | "injury" | "suspension" | "request";

export interface Reason {
  kind: ReasonKind;
  tone: "good" | "bad" | "neutral";
  text: string;
  /** Selection-score points behind it (0 for non-score reasons). */
  weight: number;
}

export interface MatchStatus {
  status: Availability;
  slot?: Position;
  /** The team the user would play for in this fixture. */
  teamId: string | null;
  reasons: Reason[];
  /** What the user can do about this match. */
  actions: { playLive: boolean; watch: boolean; quickSim: boolean; rest: boolean; liveLabel: string };
}

const PART_LABEL: Record<Exclude<keyof ScoreParts, "ability">, ReasonKind> = { fitness: "fitness", form: "form", sharpness: "sharpness", rotation: "rotation", trust: "trust", tactical: "tactical" };

/** The user's side in a fixture, if they have one. */
export function userTeamFor(state: GameState, fixture: Fixture): string | null {
  const u = userPlayer(state);
  const comp = state.competitions[fixture.compId];
  if (!isNationalComp(comp)) return u.clubId && (fixture.home === u.clubId || fixture.away === u.clubId) ? u.clubId : null;
  for (const nt of Object.values(state.nationalTeams)) if ((fixture.home === nt.code || fixture.away === nt.code) && nt.squad.includes(u.id)) return nt.code;
  // Not in either squad: the fixture can only involve the user through their own nation.
  const mine = intlTeam(u);
  return fixture.home === mine || fixture.away === mine ? mine : null;
}

function describe(p: Player, slot: Position, other: Player, otherSlot: Position, setup: ReturnType<typeof selectionSetup>, userIsP: boolean): Reason[] {
  const a = scoreParts(p, fitFor(p, slot), setup.opts, slot);
  const b = scoreParts(other, fitFor(other, otherSlot), setup.opts, otherSlot);
  const out: Reason[] = [];
  const diff = (k: keyof ScoreParts) => a[k] - b[k];
  const add = (kind: ReasonKind, d: number, good: string, bad: string, min: number) => {
    if (Math.abs(d) < min) return;
    out.push({ kind, tone: (d > 0) === userIsP ? "good" : "bad", text: d > 0 ? good : bad, weight: Math.abs(d) });
  };
  const o = Math.round(overallFor(p.attrs, slot));
  const q = Math.round(overallFor(other.attrs, otherSlot));
  add("ability", diff("ability"), `Better than ${other.lastName} at ${slot} (${o} v ${q} OVR).`, `${other.lastName} is better at ${otherSlot} (${q} v ${o} OVR).`, 1.2);
  add("form", diff("form"), `In better form than ${other.lastName} (${p.form.toFixed(1)} v ${other.form.toFixed(1)}).`, `${other.lastName} is in better form (${other.form.toFixed(1)} v ${p.form.toFixed(1)}).`, 0.7);
  add("fitness", diff("fitness"), `Fresher than ${other.lastName} (fitness ${Math.round(p.fitness)} v ${Math.round(other.fitness)}).`, `Your fitness is low (${Math.round(p.fitness)}), which costs you a place.`, 0.7);
  add("sharpness", diff("sharpness"), "Sharper after recent games.", `Short of match sharpness (${Math.round(p.sharpness)}).`, 0.5);
  if (userIsP) add("trust", diff("trust"), "The manager trusts you.", "The manager doesn't trust you right now.", 0.6);
  add("tactical", diff("tactical"), "Your attributes suit how the team plays.", `${other.lastName} suits the team's style better.`, 0.4);
  add("rotation", diff("rotation"), "The manager is rotating for this tie.", "The manager is rotating for this tie.", 1);
  return out.sort((x, y) => y.weight - x.weight).slice(0, 3);
}

export function matchStatus(state: GameState, fixture: Fixture): MatchStatus {
  const u = userPlayer(state);
  const teamId = userTeamFor(state, fixture);
  const nat = isNationalComp(state.competitions[fixture.compId]);
  const none = { playLive: false, watch: true, quickSim: true, rest: false, liveLabel: "Watch match" };
  const out = (status: Availability, reasons: Reason[], extra: Partial<MatchStatus> = {}): MatchStatus => ({ status, teamId, reasons, actions: none, ...extra });
  if (!teamId) return out("not-selected", []);
  if (u.injury) return out("injured", [{ kind: "injury", tone: "bad", text: `Out injured: ${u.injury.type}, ${u.injury.weeksLeft} week${u.injury.weeksLeft === 1 ? "" : "s"} to go.`, weight: 0 }]);
  if (u.suspension > 0) return out("suspended", [{ kind: "suspension", tone: "bad", text: `Suspended for ${u.suspension} more match${u.suspension === 1 ? "" : "es"}.`, weight: 0 }]);
  const setup = selectionSetup(state, teamId, fixture);
  if (setup.resting) return out("resting", [{ kind: "request", tone: "neutral", text: "You asked to be rested: you sit this one out and recover.", weight: 0 }]);
  const sel = teamSelection(state, teamId, fixture, null);
  const startIdx = sel.starters.findIndex((s) => s.player.id === u.id);
  const asked = state.user.preMatch?.requestedStart?.fixtureId === fixture.id;
  const askedReason: Reason[] = asked ? [{ kind: "request", tone: "neutral", text: "You asked the manager for a start: it counted for a little.", weight: 0 }] : [];
  const club = !nat;
  if (startIdx >= 0) {
    const mine = sel.starters[startIdx];
    // The nearest rival for the place: the best player left out (or on the bench) who could fill the slot.
    const rivals = setup.squad.filter((p) => p.id !== u.id && availability(p));
    const alt = [...rivals].sort((a, b) => partsTotal(scoreParts(b, fitFor(b, mine.slot), setup.opts, mine.slot)) - partsTotal(scoreParts(a, fitFor(a, mine.slot), setup.opts, mine.slot)))[0];
    // A starter is explained by what went for them; a different gap never contradicts the team sheet.
    const reasons = (alt ? describe(u, mine.slot, alt, mine.slot, setup, true) : []).filter((r) => r.tone === "good");
    if (!reasons.length) reasons.push({ kind: "competition", tone: "neutral", text: `The manager picked you at ${mine.slot}: a close call between you and ${alt?.lastName ?? "the others"}.`, weight: 0 });
    return out("starting", [...askedReason, ...reasons], { slot: mine.slot, actions: { playLive: true, watch: false, quickSim: true, rest: club, liveLabel: "Play live" } });
  }
  const benchIdx = sel.bench.findIndex((p) => p.id === u.id);
  if (!setup.squad.some((p) => p.id === u.id)) return out(nat ? "not-called-up" : "not-selected", nat ? [{ kind: "competition", tone: "bad", text: "You are not in this squad.", weight: 0 }] : []);
  // Whose place was it? The starter in the slot the user fits best.
  const slots = FORMATIONS[setup.formation];
  const bestSlot = [...new Set(slots)].sort((a, b) => fitFor(u, b) - fitFor(u, a))[0];
  const holder = sel.starters.find((s) => s.slot === bestSlot);
  const reasons: Reason[] = [...askedReason];
  if (!slots.includes(u.position) && !u.secondary.some((s) => slots.includes(s))) {
    reasons.push({ kind: "formation", tone: "bad", text: `The ${setup.formation} doesn't use a ${u.position}.`, weight: 5 });
  }
  if (holder) reasons.push(...describe(u, bestSlot, holder.player, holder.slot, setup, true).filter((r) => r.tone === "bad"));
  const ahead = setup.squad.filter((p) => p.id !== u.id && availability(p) && (p.position === u.position) && overallFor(p.attrs, u.position) > overallFor(u.attrs, u.position)).length;
  if (ahead > 0 && !reasons.some((r) => r.kind === "ability")) reasons.push({ kind: "competition", tone: "bad", text: `${ahead} ${u.position}${ahead === 1 ? " is" : "s are"} ahead of you at ${clubName(teamId, true)}.`, weight: 1 });
  if (!reasons.length) reasons.push({ kind: "competition", tone: "neutral", text: "A close call: the manager went with someone else.", weight: 0 });
  if (benchIdx >= 0) return out("bench", reasons, { actions: { playLive: true, watch: false, quickSim: true, rest: club, liveLabel: "Watch / play live" } });
  return out("not-selected", reasons);
}

/** Can the user ask to be rested for this fixture? Only when they would actually play, and not already resting. */
export function canRestFor(state: GameState, fixture: Fixture): boolean {
  const u = userPlayer(state);
  if (!u.clubId || state.user.retired || state.user.restTurnIndex === state.turnIndex) return false;
  const s = matchStatus(state, fixture);
  return s.actions.rest && (s.status === "starting" || s.status === "bench");
}
void PART_LABEL;
