/**
 * Player agents: a small market of representatives with different strengths,
 * a weekly retainer and a commission on new contracts. Better agents cost more
 * and the best ones only take on players with enough reputation or promise.
 */
import { BALANCE } from "../balance";
import { formatMoney } from "../players/economy";
import { addNews } from "../world/helpers";
import { randomName } from "../players/generate";
import { ageOf } from "../players/generate";
import { clamp, Rng } from "../rng";
import type { Agent, AgentSkills, AgentTier, GameState } from "../types";
import { userPlayer } from "../world/helpers";

const A = BALANCE.agents;

export const AGENT_SKILL_LABEL: Record<keyof AgentSkills, { label: string; blurb: string }> = {
  negotiation: { label: "Negotiation", blurb: "Higher wage ceilings and bigger signing bonuses" },
  connections: { label: "Connections", blurb: "More offers, and interest from bigger clubs" },
  media: { label: "Media", blurb: "Faster reputation growth and better sponsorships" },
  care: { label: "Player care", blurb: "Morale support and better loan searches" },
};

export const AGENT_TIER_LABEL: Record<AgentTier, string> = {
  none: "No agent",
  rookie: "Rookie",
  established: "Established",
  top: "Top agent",
  super: "Super-agent",
};

/** Representing yourself: free, but you get no help. */
export const NO_AGENT: Agent = {
  id: "none",
  name: "No agent",
  nationality: "",
  tier: "none",
  rating: 0,
  skills: { negotiation: 15, connections: 15, media: 10, care: 10 },
  weeklyFee: 0,
  commission: 0,
  minReputation: 0,
};

export function agentRating(s: AgentSkills): number {
  return Math.round(s.negotiation * 0.3 + s.connections * 0.3 + s.media * 0.2 + s.care * 0.2);
}

export function tierFor(rating: number): AgentTier {
  return rating >= 85 ? "super" : rating >= 70 ? "top" : rating >= 50 ? "established" : "rookie";
}

/** Weekly retainer: grows with ability; agents taking a bigger commission charge less up front. */
export function agentWeeklyFee(rating: number, commission: number): number {
  if (rating <= 0) return 0;
  const base = A.feeBase * Math.exp((rating - 30) / A.feeCurve);
  return Math.max(50, Math.round((base * (1.3 - commission * 6)) / 50) * 50);
}

function makeAgent(rng: Rng, id: string, target: number): Agent {
  const keys: (keyof AgentSkills)[] = ["negotiation", "connections", "media", "care"];
  const skills = {} as AgentSkills;
  for (const k of keys) skills[k] = Math.round(clamp(target + rng.normal(0, 7), 20, 97));
  // Everyone has a specialty and a blind spot.
  const [strong, weak] = rng.shuffle([...keys]);
  skills[strong] = Math.round(clamp(skills[strong] + 12, 20, 98));
  skills[weak] = Math.round(clamp(skills[weak] - 10, 15, 95));
  const rating = agentRating(skills);
  const tier = tierFor(rating);
  const commission = Math.round(rng.range(A.commission[0], A.commission[1]) * 1000) / 1000;
  const nat = rng.pick(["ENG", "ESP", "ITA", "GER", "FRA", "POR", "NED", "BRA", "ARG", "BEL"]);
  const n = randomName(rng, nat);
  return {
    id,
    name: `${n.firstName} ${n.lastName}`,
    nationality: nat,
    tier,
    rating,
    skills,
    weeklyFee: agentWeeklyFee(rating, commission),
    commission,
    minReputation: A.minReputation[tier],
    specialty: strong,
  };
}

/** The agent market, generated once per career from its own seed so it never disturbs the world's dice. */
export function agentMarket(state: GameState): Agent[] {
  if (!state.agents) {
    const rng = Rng.fromSeed(`${state.seed}:agents`);
    const targets = [36, 40, 44, 48, 54, 58, 63, 67, 72, 75, 78, 82, 88, 92];
    state.agents = targets.map((t, i) => makeAgent(rng, `ag${i + 1}`, t)).sort((a, b) => a.rating - b.rating);
  }
  return state.agents;
}

/** The skill the user's current agent brings (no agent = weak baseline). */
export function agentSkill(state: GameState, key: keyof AgentSkills): number {
  return (state.user.agent?.skills ?? NO_AGENT.skills)[key];
}

/** Reputation a player needs before this agent will take them on. Promising youngsters get a look-in earlier. */
export function requiredReputation(state: GameState, agent: Agent): number {
  const p = userPlayer(state);
  const promise = ageOf(p, state.season) <= 21 && p.hidden.potential >= 88 ? A.prospectDiscount : 0;
  return Math.max(0, agent.minReputation - promise);
}

export interface HireCheck {
  ok: boolean;
  reason?: string;
}

export function canHireAgent(state: GameState, agent: Agent): HireCheck {
  const u = state.user;
  const p = userPlayer(state);
  if (u.retired) return { ok: false, reason: "Retired" };
  if (u.agent?.id === agent.id) return { ok: false, reason: "Your current agent" };
  if (u.agentChangedSeason === state.season) return { ok: false, reason: "You can change agent once a season" };
  if (p.reputation < requiredReputation(state, agent)) return { ok: false, reason: `Needs reputation ${requiredReputation(state, agent)}` };
  if (u.bank < agent.weeklyFee * A.depositWeeks) return { ok: false, reason: `Needs ${A.depositWeeks} weeks of fees in the bank` };
  return { ok: true };
}

export function hireAgent(state: GameState, agentId: string, opts: { force?: boolean } = {}): HireCheck {
  const agent = agentMarket(state).find((a) => a.id === agentId);
  if (!agent) return { ok: false, reason: "Agent not found" };
  const check = canHireAgent(state, agent);
  if (!check.ok && !opts.force) return check;
  const u = state.user;
  u.agent = { ...agent, skills: { ...agent.skills } };
  u.agentChangedSeason = state.season;
  u.agentUnpaidWeeks = 0;
  u.relationships.agent = 60;
  addNews(state, { kind: "contract", title: `${agent.name} is your new agent`, body: `${AGENT_TIER_LABEL[agent.tier]} · €${agent.weeklyFee.toLocaleString("en")}/wk + ${(agent.commission * 100).toFixed(1)}% commission on new contracts`, important: true });
  return { ok: true };
}

export function releaseAgent(state: GameState, why?: string): void {
  const u = state.user;
  if (!u.agent || u.agent.id === "none") return;
  const name = u.agent.name;
  u.agent = { ...NO_AGENT, skills: { ...NO_AGENT.skills } };
  u.agentUnpaidWeeks = 0;
  addNews(state, { kind: "contract", title: `You part ways with ${name}`, body: why ?? "You now represent yourself.", important: true });
}

/** Weekly retainer. Four unpaid weeks and the agent walks. */
export function payAgent(state: GameState): void {
  const u = state.user;
  const fee = u.agent?.weeklyFee ?? 0;
  if (!fee) return;
  if (u.bank >= fee) {
    u.bank -= fee;
    u.agentUnpaidWeeks = 0;
    return;
  }
  u.agentUnpaidWeeks = (u.agentUnpaidWeeks ?? 0) + 1;
  u.relationships.agent = clamp(u.relationships.agent - 8, 0, 100);
  if (u.agentUnpaidWeeks >= A.unpaidWeeksBeforeLeaving) releaseAgent(state, "After weeks of unpaid fees, your agent has dropped you.");
}

/** Commission on a newly signed contract: a cut of the signing bonus and the first year's wages. */
export function chargeCommission(state: GameState, wage: number, signingBonus: number): number {
  const u = state.user;
  const rate = u.agent?.commission ?? 0;
  if (!rate) return 0;
  const amount = Math.round(rate * (signingBonus + wage * 52));
  if (amount <= 0) return 0;
  u.bank = Math.max(0, u.bank - amount);
  addNews(state, { kind: "contract", title: `Agent commission: ${formatMoney(amount)}`, body: `${u.agent.name} takes ${(rate * 100).toFixed(1)}% of the new deal.` });
  return amount;
}
