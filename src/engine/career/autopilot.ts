/**
 * A simple decision policy for the user's player. Used by the stress-test
 * simulator (and available as "autopilot" for long holidays). It makes the
 * kind of choices a sensible human player would make.
 */
import { BALANCE } from "../balance";
import { overallFor } from "../players/attributes";
import { ageOf } from "../players/generate";
import type { Rng } from "../rng";
import type { GameState, SquadRole, TrainingFocus } from "../types";
import { userPlayer } from "../world/helpers";
import { agentMarket, canHireAgent, hireAgent, releaseAgent } from "./agents";
import { resolveDecision } from "./events";
import { negotiate, setTransferRequest } from "./offers";

const FOCUS_BY_POS: Record<string, TrainingFocus[]> = {
  GK: ["goalkeeping"], CB: ["defending", "physical"], RB: ["defending", "pace"], LB: ["defending", "pace"], DM: ["defending", "passing"],
  CM: ["passing", "physical"], AM: ["passing", "dribbling"], RW: ["dribbling", "pace", "finishing"], LW: ["dribbling", "pace", "finishing"], ST: ["finishing", "physical"],
};

const ROLE_SCORE: Record<SquadRole, number> = { star: 4, first: 3, rotation: 2, backup: 1, prospect: 1 };

function minutesThisSeason(state: GameState): number {
  const p = userPlayer(state);
  let m = 0;
  for (const k in p.season) m += p.season[k].minutes;
  return m;
}

export function autopilotStep(state: GameState, rng: Rng): void {
  const u = state.user;
  if (u.retired) return;
  const p = userPlayer(state);
  const age = ageOf(p, state.season);
  for (const d of [...u.decisions]) resolveDecision(state, d.id, d.fallback);

  // Training: push young players, protect tired veterans.
  const focuses = FOCUS_BY_POS[p.position] ?? ["balanced"];
  const fitnessLow = p.fitness < 72;
  u.training = {
    focus: fitnessLow ? "recovery" : focuses[state.turn % focuses.length],
    intensity: fitnessLow ? "light" : age <= 23 ? "intense" : age >= 31 ? "light" : "normal",
  };

  const currentRep = p.clubId ? state.clubs[p.clubId]?.reputation ?? 0 : 0;
  const playing = minutesThisSeason(state) > Math.max(0, state.turn - BALANCE.calendar.seasonStart) * 40;
  const ovr = overallFor(p.attrs, p.position);

  for (const o of u.offers.filter((x) => x.status === "terms")) {
    const club = state.clubs[o.fromClubId];
    const roleScore = ROLE_SCORE[o.terms.role];
    if (o.kind === "renewal") {
      const better = u.offers.some((x) => x !== o && x.status === "terms" && x.kind !== "loan" && state.clubs[x.fromClubId].reputation > currentRep + 5);
      if (!better) negotiate(state, o.id, { type: "counter", wage: Math.round(o.terms.wage * 1.1) }, rng);
      continue;
    }
    if (o.kind === "loan") {
      if (age <= 22 && !playing) negotiate(state, o.id, { type: "accept" }, rng);
      continue;
    }
    const repGain = club.reputation - currentRep;
    const settled = p.contract && state.season - p.contract.signed < 2;
    const wantsMove = !p.clubId || (repGain >= 14 && !settled) || repGain >= 22 || (!playing && roleScore >= 3 && repGain >= -8 && !settled) || (u.transferRequest && repGain >= -5);
    if (wantsMove && (roleScore >= 2 || !p.clubId || age <= 21)) {
      const res = negotiate(state, o.id, { type: "counter", wage: Math.round(o.terms.wage * rng.range(1.05, 1.2)) }, rng);
      if (!res.completed && state.user.offers.find((x) => x.id === o.id)?.status === "terms") negotiate(state, o.id, { type: "accept" }, rng);
      if (res.completed || !p.clubId) break;
    }
  }

  // Once a season, upgrade to the best agent the bank comfortably affords.
  if (state.turn === 45 && p.contract) {
    const budget = p.contract.wage * 0.08;
    const better = agentMarket(state)
      .filter((a) => a.rating > u.agent.rating && a.weeklyFee <= budget && canHireAgent(state, a).ok)
      .sort((a, b) => b.rating - a.rating)[0];
    if (better) hireAgent(state, better.id);
    else if (u.agent.id !== "none" && u.agent.weeklyFee > p.contract.wage * 0.25) releaseAgent(state, "Fees are too heavy for your wages.");
  }

  // Ask for a move after a season stuck on the bench.
  const last = p.history[p.history.length - 1];
  if (!u.transferRequest && p.clubId && last && last.stats.minutes < 900 && age >= 21 && state.turn === 45) setTransferRequest(state, true);
  if (u.transferRequest && playing && state.turn === 20) setTransferRequest(state, false);
  u.wantsLoan = age <= 21 && !playing && state.turn >= 44;
  void ovr;
}

/** Retirement policy for simulated careers. */
export function autopilotWantsRetirement(state: GameState): boolean {
  const p = userPlayer(state);
  const age = ageOf(p, state.season);
  const ovr = overallFor(p.attrs, p.position);
  return (age >= 34 && ovr < 70) || age >= 38 || (age >= 33 && !p.clubId);
}
