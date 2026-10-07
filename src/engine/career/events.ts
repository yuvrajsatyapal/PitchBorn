import { clubName } from "../data/world";
import { formatMoney } from "../players/economy";
import { ageOf } from "../players/generate";
import { clamp, type Rng } from "../rng";
import type { GameState, Player, Relationships } from "../types";
import { addNews, addTimeline, nextId, userPlayer } from "../world/helpers";
import { rememberCaptaincy, rememberDecision } from "../memory/detect";
import { careerProfile } from "../traits/effects";
import { resolveSagaDecision } from "./saga/engine";
import { agentMarket, agentRating, agentSkill, hireAgent } from "./agents";

const superAgent = (s: GameState) => agentMarket(s).find((a) => a.tier === "super" && a.id !== s.user.agent.id);
const sponsorValue = (s: GameState, p: Player) => Math.round(p.reputation * p.reputation * 120 * (0.8 + agentSkill(s, "media") / 150) * careerProfile(p).media);

interface Effect {
  morale?: number;
  fitness?: number;
  sharpness?: number;
  reputation?: number;
  earnings?: number;
  rel?: Partial<Relationships>;
  /** Sign with this market agent (sign-on fee comes out of `earnings`). */
  hireAgentId?: string;
  /** Current agent works harder for you: +skill on every skill. */
  agentBoost?: number;
  transferRequest?: boolean;
  news?: string;
}

interface CareerEventDef {
  id: string;
  weight: number;
  cooldown: number;
  when: (s: GameState, p: Player) => boolean;
  title: (s: GameState, p: Player) => string;
  body: (s: GameState, p: Player) => string;
  /** No options → immediate effect. */
  effect?: (s: GameState, p: Player) => Effect;
  options?: { id: string; label: string; hint?: string; effect: (s: GameState, p: Player) => Effect }[];
  fallback?: string;
}

function minutesThisSeason(p: Player): number {
  let m = 0;
  for (const k in p.season) m += p.season[k].minutes;
  return m;
}

const EVENTS: CareerEventDef[] = [
  {
    id: "pundit-praise", weight: 3, cooldown: 10,
    when: (s, p) => p.form > 7.25 && !!p.clubId,
    title: () => "Pundits are raving about you",
    body: (s, p) => `TV analysts single out ${p.lastName}'s recent form as among the best in the league.`,
    effect: () => ({ morale: 4, reputation: 1.5 }),
  },
  {
    id: "media-criticism", weight: 2, cooldown: 14,
    when: (s, p) => p.form < 6.25 && p.reputation > 28 && !!p.clubId,
    title: () => "A columnist questions your commitment",
    body: () => "A national newspaper piece calls your recent displays 'lazy'. Reporters want a reaction.",
    options: [
      { id: "respond", label: "Hit back publicly", hint: "Morale up, manager unimpressed", effect: () => ({ morale: 3, rel: { manager: -5, supporters: 2 } }) },
      { id: "quiet", label: "Say nothing", hint: "It stings", effect: () => ({ morale: -3 }) },
      { id: "work", label: "Promise to work harder", hint: "Fans appreciate it", effect: () => ({ rel: { supporters: 4, manager: 2 } }) },
    ],
    fallback: "quiet",
  },
  {
    id: "teammate-conflict", weight: 1.5, cooldown: 20,
    when: (s, p) => !!p.clubId && s.user.relationships.teammates < 70,
    title: () => "Training-ground bust-up",
    body: () => "A heated argument with a senior teammate during a small-sided game has the dressing room talking.",
    options: [
      { id: "clear", label: "Clear the air", hint: "Teammates respect it", effect: () => ({ rel: { teammates: 7 }, morale: 1 }) },
      { id: "manager", label: "Take it to the manager", hint: "Manager on side, dressing room less so", effect: () => ({ rel: { manager: 4, teammates: -5 } }) },
      { id: "ignore", label: "Ignore it", effect: () => ({ rel: { teammates: -3 } }) },
    ],
    fallback: "ignore",
  },
  {
    id: "charity", weight: 1.5, cooldown: 20,
    when: (s, p) => p.reputation > 15,
    title: () => "Charity day invitation",
    body: (s, p) => `A local children's hospital invites ${p.firstName} to open their new ward.`,
    options: [
      { id: "attend", label: "Attend", hint: "Supporters love it", effect: () => ({ rel: { supporters: 6 }, morale: 3, fitness: -2 }) },
      { id: "decline", label: "Politely decline", effect: () => ({}) },
    ],
    fallback: "decline",
  },
  {
    id: "sponsor", weight: 1.2, cooldown: 30,
    when: (s, p) => p.reputation > 40,
    title: () => "Boot sponsor wants you",
    body: (s, p) => `A sportswear brand offers ${formatMoney(sponsorValue(s, p))} for a two-year endorsement.`,
    options: [
      { id: "sign", label: "Sign the deal", hint: "Money, extra media duties", effect: (s, p) => ({ earnings: sponsorValue(s, p), morale: 2, sharpness: -3 }) },
      { id: "refuse", label: "Focus on football", hint: "Manager approves", effect: () => ({ rel: { manager: 3 } }) },
    ],
    fallback: "refuse",
  },
  {
    id: "night-out", weight: 0.6, cooldown: 40,
    when: (s, p) => p.hidden.professionalism < 55 && ageOf(p, s.season) < 27,
    title: () => "Photos from a late night out",
    body: () => "Pictures of you leaving a club at 3am two days before a match appear online.",
    options: [
      { id: "apologise", label: "Apologise to the club", hint: "Limits the damage", effect: () => ({ rel: { manager: -3, supporters: -2, board: -2 } }) },
      { id: "deny", label: "Deny it was a big deal", hint: "Risky", effect: () => ({ rel: { manager: -8, supporters: -6, board: -5 }, morale: 2 }) },
    ],
    fallback: "apologise",
  },
  {
    id: "mentor", weight: 1.2, cooldown: 40,
    when: (s, p) => ageOf(p, s.season) >= 29 && !!p.clubId,
    title: () => "The academy asks for a mentor",
    body: () => "The academy director wants you to mentor a 17-year-old breaking into the first team.",
    options: [
      { id: "yes", label: "Take them under your wing", hint: "Dressing-room leader", effect: () => ({ rel: { teammates: 6, board: 4 }, morale: 3 }) },
      { id: "no", label: "Focus on yourself", effect: () => ({}) },
    ],
    fallback: "yes",
  },
  {
    id: "playing-time", weight: 3, cooldown: 12,
    when: (s, p) => !!p.clubId && s.turn > 12 && s.turn < 40 && minutesThisSeason(p) < (s.turn - 4) * 30 && ageOf(p, s.season) >= 19 && !p.injury,
    title: () => "Frustrated on the bench",
    body: () => "You've barely featured. Your agent asks how you want to handle it.",
    options: [
      { id: "demand", label: "Demand more minutes", hint: "Manager may resent it", effect: () => ({ rel: { manager: -5 }, morale: 3 }) },
      { id: "patience", label: "Be patient, train harder", hint: "Manager notices", effect: () => ({ rel: { manager: 5 }, morale: -2 }) },
      { id: "leave", label: "Ask to leave", hint: "Hand in a transfer request", effect: () => ({ transferRequest: true, morale: 1 }) },
    ],
    fallback: "patience",
  },
  {
    id: "fan-chant", weight: 2, cooldown: 30,
    when: (s, p) => !!p.clubId && Object.values(p.season).reduce((g, x) => g + x.goals, 0) >= 7,
    title: () => "The fans have a new song",
    body: (s, p) => `Supporters of ${clubName(p.clubId)} have written a chant about ${p.lastName}.`,
    effect: () => ({ rel: { supporters: 6 }, morale: 4 }),
  },
  {
    id: "viral", weight: 1.2, cooldown: 30,
    when: (s, p) => p.attrs.dribbling > 65 || p.attrs.finishing > 70,
    title: () => "Your skill goes viral",
    body: () => "A clip of your nutmeg-and-finish from training has millions of views.",
    effect: () => ({ reputation: 2, morale: 2 }),
  },
  {
    id: "illness", weight: 1, cooldown: 30,
    when: (s, p) => !p.injury,
    title: () => "Laid low by a virus",
    body: () => "A bout of flu leaves you weak for a few days.",
    effect: () => ({ fitness: -18, sharpness: -8 }),
  },
  {
    id: "family", weight: 1, cooldown: 40,
    when: (s, p) => ageOf(p, s.season) >= 23,
    title: () => "Family news",
    body: () => "Your family are celebrating a big moment back home this week.",
    options: [
      { id: "go", label: "Fly home for it", hint: "Morale boost, miss training", effect: () => ({ morale: 7, sharpness: -8 }) },
      { id: "stay", label: "Stay with the squad", hint: "Manager appreciates it", effect: () => ({ morale: -3, rel: { manager: 3 } }) },
    ],
    fallback: "go",
  },
  {
    id: "super-agent", weight: 1, cooldown: 60,
    when: (s, p) => p.reputation > 55 && s.user.agent.id !== "none" && s.user.agent.tier !== "super" && !!superAgent(s),
    title: () => "A super-agent comes calling",
    body: (s) => `${superAgent(s)?.name ?? "One of the game's most powerful agents"} wants to represent you. ${s.user.agent.name} has been working for you.`,
    options: [
      { id: "switch", label: "Sign with the super-agent", hint: "Better deals, more interest. Costs a sign-on fee", effect: (s, p) => ({ hireAgentId: superAgent(s)?.id, rel: { agent: -15 }, earnings: -Math.round(p.reputation * 4000) }) },
      { id: "loyal", label: "Stay loyal", hint: "Your agent works harder for you", effect: () => ({ agentBoost: 3, rel: { agent: 12 } }) },
    ],
    fallback: "loyal",
  },
  {
    id: "touchline-row", weight: 1.4, cooldown: 30,
    when: (s, p) => !!p.clubId && careerProfile(p).friction >= 0.4 && s.turn > 8 && s.turn < 42,
    title: () => "Words with the manager",
    body: () => "A heated exchange on the training ground. The manager wants to know where you stand.",
    options: [
      { id: "apologise", label: "Apologise", hint: "Clears the air; pride dented", effect: () => ({ rel: { manager: 5, teammates: 1 }, morale: -1 }) },
      { id: "stand", label: "Stand your ground", hint: "Fans like the fire; the manager doesn't", effect: () => ({ rel: { manager: -8, supporters: 3 }, morale: 3 }) },
      { id: "private", label: "Ask to speak privately", hint: "Calmer, a little progress", effect: () => ({ rel: { manager: 2 } }) },
    ],
    fallback: "private",
  },
  {
    id: "dressing-room-speech", weight: 1.2, cooldown: 36,
    when: (s, p) => !!p.clubId && careerProfile(p).leader >= 0.4 && s.turn > 10 && s.turn < 42 && s.user.relationships.teammates < 85,
    title: () => "The dressing room looks to you",
    body: () => "Results have been mixed and the mood is flat. The younger players are waiting for someone to speak.",
    options: [
      { id: "rally", label: "Rally the squad", hint: "Teammates respond", effect: () => ({ rel: { teammates: 7, manager: 2 }, morale: 2 }) },
      { id: "quiet", label: "A quiet word with the captain", hint: "Low-key", effect: () => ({ rel: { teammates: 3, manager: 3 } }) },
    ],
    fallback: "quiet",
  },
  {
    id: "captaincy", weight: 1, cooldown: 60,
    when: (s, p) => {
      if (!p.clubId || s.clubs[p.clubId]?.captain === p.id) return false;
      const leader = careerProfile(p).leader >= 0.4;
      // Natural leaders are given the armband sooner and with a little less goodwill than others.
      return ageOf(p, s.season) >= (leader ? 22 : 25) && s.user.relationships.teammates > (leader ? 58 : 70) && s.user.relationships.manager > (leader ? 55 : 65);
    },
    title: () => "Handed the captain's armband",
    body: (s, p) => `The manager names you club captain of ${clubName(p.clubId)}.`,
    effect: (s, p) => {
      if (p.clubId) {
        s.clubs[p.clubId].captain = p.id;
        rememberCaptaincy(s, p.clubId);
      }
      addTimeline(s, { kind: "milestone", title: `Named captain of ${clubName(p.clubId)}` });
      return { morale: 8, reputation: 2, rel: { board: 5 } };
    },
  },
];

function apply(state: GameState, p: Player, e: Effect) {
  if (e.morale) p.morale = clamp(p.morale + e.morale, 0, 100);
  if (e.fitness) p.fitness = clamp(p.fitness + e.fitness, 10, 100);
  if (e.sharpness) p.sharpness = clamp(p.sharpness + e.sharpness, 0, 100);
  if (e.reputation) p.reputation = clamp(p.reputation + e.reputation, 0, 100);
  if (e.earnings) {
    state.user.earnings += e.earnings;
    state.user.bank = Math.max(0, state.user.bank + e.earnings);
  }
  if (e.hireAgentId) hireAgent(state, e.hireAgentId, { force: true });
  if (e.agentBoost && state.user.agent.id !== "none") {
    const sk = state.user.agent.skills;
    for (const k of Object.keys(sk) as (keyof typeof sk)[]) sk[k] = clamp(sk[k] + e.agentBoost, 0, 100);
    state.user.agent.rating = agentRating(sk);
  }
  if (e.rel) for (const k in e.rel) {
    const key = k as keyof Relationships;
    state.user.relationships[key] = clamp(state.user.relationships[key] + (e.rel[key] ?? 0), 0, 100);
  }
  if (e.transferRequest) state.user.transferRequest = true;
}

/** Maybe trigger one restrained career event this turn. */
export function maybeCareerEvent(state: GameState, rng: Rng): void {
  const p = userPlayer(state);
  if (state.user.retired || state.user.decisions.length >= 2) return;
  if (!rng.chance(0.11)) return;
  const idx = state.turnIndex;
  const eligible = EVENTS.filter((e) => (state.user.eventCooldowns[e.id] ?? -999) + e.cooldown <= idx && e.when(state, p));
  if (!eligible.length) return;
  const ev = rng.weighted(eligible, (e) => e.weight);
  state.user.eventCooldowns[ev.id] = idx;
  if (!ev.options) {
    apply(state, p, ev.effect?.(state, p) ?? {});
    addNews(state, { kind: "event", title: ev.title(state, p), body: ev.body(state, p) });
    return;
  }
  state.user.decisions.push({
    id: nextId(state, "d"),
    kind: "event",
    title: ev.title(state, p),
    body: ev.body(state, p),
    options: ev.options.map((o) => ({ id: o.id, label: o.label, hint: o.hint })),
    expiresTurn: state.turn + 2,
    season: state.season,
    eventId: ev.id,
    fallback: ev.fallback ?? ev.options[0].id,
  });
}

export function resolveDecision(state: GameState, decisionId: string, optionId: string): string {
  const d = state.user.decisions.find((x) => x.id === decisionId);
  if (!d) return "Decision not found.";
  if (d.sagaId) {
    state.user.decisions = state.user.decisions.filter((x) => x.id !== decisionId);
    const msg = resolveSagaDecision(state, d, optionId);
    addNews(state, { kind: "event", title: d.title, body: msg });
    return msg;
  }
  const ev = EVENTS.find((e) => e.id === d.eventId);
  const opt = ev?.options?.find((o) => o.id === optionId) ?? ev?.options?.find((o) => o.id === d.fallback);
  state.user.decisions = state.user.decisions.filter((x) => x.id !== decisionId);
  if (!ev || !opt) return "Nothing happens.";
  apply(state, userPlayer(state), opt.effect(state, userPlayer(state)));
  addNews(state, { kind: "event", title: d.title, body: `You chose: ${opt.label}.` });
  rememberDecision(state, ev.id, opt.id, d.title);
  return `You chose: ${opt.label}.`;
}

export function expireDecisions(state: GameState): void {
  for (const d of [...state.user.decisions]) {
    if (state.turn > d.expiresTurn || d.season !== state.season) resolveDecision(state, d.id, d.fallback);
  }
}
