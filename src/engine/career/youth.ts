/**
 * Starting as a youth player: age 15 on an academy scholarship. Youth-league games are the development-squad games
 * (against U18 opposition while under 17), other clubs invite the player on trial, and at the end of the season he
 * turns 16 the first professional contract is decided: sign with the academy, sign for a club that was impressed on
 * trial, or, if nobody wants him, leave as a free agent.
 *
 * Randomness comes from `Rng.fromSeed(seed:youth:…)` streams so the world RNG never moves.
 */
import { BALANCE } from "../balance";
import { clubName } from "../data/world";
import { overallFor } from "../players/attributes";
import { playerWage } from "../players/economy";
import { ageOf } from "../players/generate";
import { clamp, Rng } from "../rng";
import type { CareerDecision, GameState, TransferOffer, YouthState } from "../types";
import { clubLevel } from "../world/create";
import { addNews, addTimeline, nextId, userPlayer } from "../world/helpers";
import { negotiate } from "./offers";
import { adjustRel } from "./relationships";

const Y = {
  trialFrom: 10,
  trialTo: 38,
  trialChance: 0.07,
  maxTrialsPerSeason: 2,
  /** Compensation a club pays the academy for a youth player, per point of its level above 40. */
  compensationPerLevel: 12_000,
};

const C = BALANCE.calendar;
const rng = (state: GameState, tag: string) => Rng.fromSeed(`${state.seed}:youth:${tag}:${state.turnIndex}`);

export function youthOf(state: GameState): YouthState | undefined {
  return state.user.youth;
}

export function inAcademy(state: GameState): boolean {
  return state.user.youth?.stage === "academy" && !state.user.retired;
}

/** Weekly: trial invitations during the season; the first professional contract when the player is about to turn 17. */
export function youthWeekly(state: GameState): void {
  const y = state.user.youth;
  if (!y || y.stage !== "academy" || state.user.retired) return;
  const p = userPlayer(state);
  const age = ageOf(p, state.season);
  if (!p.clubId) return;
  if (age >= 16 && state.turn >= C.endOfSeasonTurn && y.proDecisionSeason !== state.season) {
    proDecision(state);
    return;
  }
  const trialsNow = y.trials.filter((t) => t.season === state.season).length;
  if (state.turn < Y.trialFrom || state.turn > Y.trialTo || trialsNow >= Y.maxTrialsPerSeason) return;
  if (state.user.decisions.some((d) => d.handler === "youth")) return;
  const r = rng(state, "invite");
  const res = state.user.reserves;
  const form = res && res.season === state.season && res.apps ? res.ratingSum / res.apps : 6.5;
  if (!r.chance(Y.trialChance * clamp(1 + (form - 6.6), 0.5, 2))) return;
  const home = state.clubs[p.clubId];
  const tried = new Set(y.trials.map((t) => t.clubId));
  const pool = Object.values(state.clubs).filter((c) => c.id !== home.id && !tried.has(c.id) && c.reputation >= home.reputation - 8 && c.reputation <= home.reputation + 25);
  if (!pool.length) return;
  const club = r.pick(pool);
  state.user.decisions.push({
    id: nextId(state, "d"), kind: "event", handler: "youth", ref: `trial:${club.id}`, eventId: "youth-trial",
    title: `Trial invitation from ${clubName(club.id)}`,
    body: `${clubName(club.id)}'s academy scouts have watched you in the youth league and invite you for a week's trial. Your own academy would rather you stayed focused.`,
    options: [
      { id: "go", label: "Go on trial", hint: "Impress them and they may offer your first pro contract" },
      { id: "stay", label: "Stay focused at your academy", hint: "Your coaches will appreciate the loyalty" },
    ],
    fallback: "stay", expiresTurn: state.turn + 2, season: state.season,
  });
}

/** How a trial goes: ability and promise against the club's level, plus a bit of luck. */
function trialScore(state: GameState, clubId: string, r: Rng): number {
  const p = userPlayer(state);
  const o = overallFor(p.attrs, p.position);
  const promise = (p.hidden.potential - o) * 0.35;
  return o + promise - (clubLevel(state.clubs[clubId].reputation) - 14) + r.normal(0, 3);
}

function academyWants(state: GameState): boolean {
  const p = userPlayer(state);
  const home = p.clubId ? state.clubs[p.clubId] : undefined;
  if (!home) return false;
  const o = overallFor(p.attrs, p.position);
  return o + (p.hidden.potential - o) * 0.4 >= clubLevel(home.reputation) - 12 || state.user.relationships.manager >= 60;
}

function proDecision(state: GameState): void {
  const y = state.user.youth as YouthState;
  const p = userPlayer(state);
  y.proDecisionSeason = state.season;
  const impressed = y.trials.filter((t) => t.impressed && state.clubs[t.clubId]);
  const options: CareerDecision["options"] = [];
  const home = academyWants(state);
  if (home) options.push({ id: "home", label: `Sign pro with ${clubName(p.clubId)}`, hint: "Stay where you grew up" });
  for (const t of impressed.slice(0, 3)) options.push({ id: `club:${t.clubId}`, label: `Sign for ${clubName(t.clubId)}`, hint: "They were impressed on trial" });
  options.push({ id: "free", label: "Leave and find your own club", hint: "Start next season as a free agent" });
  state.user.decisions.push({
    id: nextId(state, "d"), kind: "event", handler: "youth", ref: "pro", eventId: "youth-pro",
    title: "Your first professional contract",
    body: home
      ? `You turn 17 this summer and ${clubName(p.clubId)} want to make you a professional. ${impressed.length ? "Clubs who saw you on trial are interested too." : "Nobody else has come calling yet."}`
      : `You turn 17 this summer, and ${clubName(p.clubId)} won't be offering a professional contract. ${impressed.length ? "Clubs who saw you on trial still want you." : "You'll have to find a club yourself."}`,
    options,
    fallback: options[0].id,
    // The summer break: the decision waits until just before the new season.
    expiresTurn: C.turnsPerSeason - 1,
    season: state.season,
  });
  addNews(state, { kind: "contract", title: "Decision time: your first pro contract", important: true });
}

function signWith(state: GameState, clubId: string, kind: TransferOffer["kind"]): string {
  const p = userPlayer(state);
  const club = state.clubs[clubId];
  const role = "prospect" as const;
  const wage = Math.round(playerWage(p, state.season, club.reputation, role) / 100) * 100;
  const fee = kind === "free" ? Math.max(0, Math.round((clubLevel(club.reputation) - 40) * Y.compensationPerLevel / 50000) * 50000) : 0;
  const offer: TransferOffer = {
    id: nextId(state, "o"), kind, fromClubId: clubId, toPlayerClubId: p.clubId, fee,
    terms: { wage, years: 3, role, signingBonus: 0, goalBonus: 0 },
    maxWage: wage, patience: 1, status: "terms", createdTurn: state.turn, expiresTurn: state.turn + 2, season: state.season,
    history: [kind === "renewal" ? "Your first professional contract." : `First professional contract${fee ? `, with ${fee.toLocaleString("en-GB")} compensation to your academy` : ""}.`],
  };
  state.user.offers.unshift(offer);
  const res = negotiate(state, offer.id, { type: "accept" }, rng(state, "sign"));
  return res.message;
}

export function resolveYouth(state: GameState, d: CareerDecision, optionId: string): string {
  const y = state.user.youth;
  const p = userPlayer(state);
  if (!y) return "Nothing to decide.";
  if (d.ref?.startsWith("trial:")) {
    const clubId = d.ref.slice(6);
    if (optionId !== "go" || !state.clubs[clubId]) {
      adjustRel(state, "manager", 3, "Turned down a trial to stay focused");
      adjustRel(state, "board", 2, "Turned down a trial elsewhere");
      y.trials.push({ clubId, season: state.season, impressed: false, declined: true });
      return "You stay and keep working.";
    }
    const impressed = trialScore(state, clubId, rng(state, `trial-${clubId}`)) >= 0;
    y.trials.push({ clubId, season: state.season, impressed });
    adjustRel(state, "manager", -2, `Went on trial at ${clubName(clubId)}`);
    p.morale = clamp(p.morale + (impressed ? 6 : -3), 0, 100);
    addNews(state, { kind: "career", title: impressed ? `Trial at ${clubName(clubId)}: they want you` : `Trial at ${clubName(clubId)}: not this time`, body: impressed ? "Their academy staff were impressed. They'll be in touch when it's time to turn professional." : "A good experience, but they won't be taking it further.", important: impressed });
    return impressed ? "They were impressed." : "It didn't go your way.";
  }
  y.stage = "pro";
  if (optionId === "home" && p.clubId) {
    return signWith(state, p.clubId, "renewal");
  }
  if (optionId.startsWith("club:")) {
    const clubId = optionId.slice(5);
    if (state.clubs[clubId]) {
      return signWith(state, clubId, "free");
    }
  }
  // Released: the scholarship runs out at the end of the season and he starts the next one as a free agent.
  if (p.contract) p.contract.expires = Math.min(p.contract.expires, state.season);
  addTimeline(state, { kind: "contract", title: `Left the ${clubName(p.clubId)} academy`, detail: "Looking for a first professional club" });
  return "You'll look for a club as a free agent.";
}

export function startYouth(state: GameState): void {
  state.user.youth = { stage: "academy", trials: [], startSeason: state.season };
}
