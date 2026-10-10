import { clubName } from "../data/world";
import { formatMoney } from "../players/economy";
import { ageOf } from "../players/generate";
import { clamp, type Rng } from "../rng";
import type { GameState, Player, Relationships } from "../types";
import { addNews, addTimeline, nextId, userPlayer } from "../world/helpers";
import { rememberCaptaincy, rememberDecision } from "../memory/detect";
import { careerProfile } from "../traits/effects";
import { resolveSagaDecision } from "./saga/engine";
import { resolveInvitation } from "../national/allegiance";
import { resolveJerseyDecision } from "../jersey/numbers";
import { receiveIncome } from "./money";
import { addStintEvent } from "../managers/history";
import { adjustRel } from "./relationships";
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
    // Only for players with a name for it, and only when there is a story to tell: a poor run or a fraying relationship.
    id: "media-controversy", weight: 1.3, cooldown: 40,
    when: (s, p) => !!p.clubId && careerProfile(p).controversy >= 0.35 && p.reputation >= 25 && s.turn > 6 && s.turn < 44 && (p.form < 6.5 || s.user.relationships.manager < 55),
    title: () => "Headlines for the wrong reasons",
    body: () => "A remark, a night out, a leaked message: the papers have found a story about you while results are poor.",
    options: [
      { id: "apologise", label: "Apologise publicly", hint: "Calms it down; pride dented", effect: (s, p) => ({ rel: { manager: 2, supporters: 1 }, morale: -1, reputation: -0.3 * careerProfile(p).amp }) },
      { id: "ignore", label: "Say nothing", hint: "It may blow over", effect: () => ({ rel: { manager: -3, supporters: -2 } }) },
      { id: "hit-back", label: "Hit back", hint: "Fans like the fire; the club doesn't", effect: (s, p) => ({ rel: { supporters: 3, manager: -6, board: -3 }, reputation: 0.5 * careerProfile(p).amp }) },
    ],
    fallback: "apologise",
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
    id: "rival-fan-taunts", weight: 1, cooldown: 30,
    when: (s, p) => !!p.clubId && p.reputation > 20 && s.turn > 6,
    title: () => "Rival fans target you online",
    body: (s, p) => `A wave of abuse from rival supporters is flooding ${p.lastName}'s social media after the weekend.`,
    options: [
      { id: "log-off", label: "Log off for a while", hint: "Protects your head", effect: () => ({ morale: 2, sharpness: -1 }) },
      { id: "reply", label: "Fire back with a joke", hint: "Fans love it, the club winces", effect: () => ({ rel: { supporters: 4, board: -2 }, morale: 2 }) },
      { id: "report", label: "Let the club handle it", hint: "Board appreciates it", effect: () => ({ rel: { board: 3 }, morale: -1 }) },
    ],
    fallback: "log-off",
  },
  {
    id: "young-fan-letter", weight: 1.2, cooldown: 40,
    when: (s, p) => !!p.clubId && p.reputation > 25,
    title: () => "A young fan's letter",
    body: (s, p) => `A kid wearing ${p.lastName}'s shirt has written to say you're their hero. The club press office has passed it on.`,
    options: [
      { id: "meet", label: "Invite them to training", hint: "Supporters love it", effect: () => ({ rel: { supporters: 6 }, morale: 3, fitness: -1 }) },
      { id: "reply", label: "Send a signed shirt", hint: "Small, warm gesture", effect: () => ({ rel: { supporters: 3 }, morale: 1 }) },
      { id: "skip", label: "Leave it to the press office", effect: () => ({}) },
    ],
    fallback: "reply",
  },
  {
    id: "extra-training", weight: 1.5, cooldown: 24,
    when: (s, p) => !!p.clubId && !p.injury && s.turn > 5 && s.turn < 44,
    title: () => "A coach offers extra sessions",
    body: () => "An assistant coach has spotted something in your game and offers to work with you one-on-one after training.",
    options: [
      { id: "accept", label: "Put in the extra hours", hint: "Sharper, but tired legs", effect: () => ({ sharpness: 6, fitness: -5, rel: { manager: 3 } }) },
      { id: "balance", label: "Do a short session", hint: "A modest gain", effect: () => ({ sharpness: 3, fitness: -2 }) },
      { id: "rest", label: "Save your energy", effect: () => ({ fitness: 3 }) },
    ],
    fallback: "balance",
  },
  {
    id: "teammate-birthday", weight: 1, cooldown: 36,
    when: (s, p) => !!p.clubId,
    title: () => "A teammate's birthday dinner",
    body: () => "The squad is booking a table for a teammate's birthday the night before a training week begins.",
    options: [
      { id: "join", label: "Join the whole night", hint: "Bonding, a late finish", effect: () => ({ rel: { teammates: 5 }, morale: 3, fitness: -3 }) },
      { id: "short", label: "Stay for dinner, leave early", hint: "Best of both", effect: () => ({ rel: { teammates: 2 }, morale: 1 }) },
      { id: "skip", label: "Stay home and rest", hint: "Professional, a bit distant", effect: () => ({ rel: { teammates: -2 }, fitness: 2 }) },
    ],
    fallback: "short",
  },
  {
    id: "homesick", weight: 1, cooldown: 50,
    when: (s, p) => !!p.clubId && s.turn > 4 && p.morale < 70 && ageOf(p, s.season) <= 26 && careerProfile(p).home >= 0.3,
    title: () => "Missing home",
    body: () => "A rough few weeks have left you homesick. Your family are on the phone every night.",
    options: [
      { id: "visit", label: "Ask for a few days at home", hint: "Recharge, miss some training", effect: () => ({ morale: 8, sharpness: -6, rel: { manager: -2 } }) },
      { id: "family", label: "Fly your family out", hint: "A touch of home", effect: () => ({ morale: 5 }) },
      { id: "tough", label: "Tough it out", hint: "Manager respects it", effect: () => ({ morale: -3, rel: { manager: 3 } }) },
    ],
    fallback: "tough",
  },
  {
    id: "documentary", weight: 0.9, cooldown: 60,
    when: (s, p) => !!p.clubId && p.reputation > 45,
    title: () => "A documentary crew wants access",
    body: (s, p) => `A streaming company wants to follow ${p.lastName} behind the scenes for a season.`,
    options: [
      { id: "yes", label: "Open the doors", hint: "Profile up, distraction up", effect: () => ({ reputation: 2.5, sharpness: -3, rel: { manager: -2 } }) },
      { id: "limited", label: "Agree to a few interviews", hint: "A measured step", effect: () => ({ reputation: 1, rel: { board: 1 } }) },
      { id: "no", label: "Decline", hint: "Focus stays on the pitch", effect: () => ({ rel: { manager: 3 } }) },
    ],
    fallback: "limited",
  },
  {
    id: "supporters-event", weight: 1.2, cooldown: 36,
    when: (s, p) => !!p.clubId && s.user.relationships.supporters < 75,
    title: () => "Supporters' club dinner",
    body: (s, p) => `The ${clubName(p.clubId)} supporters' club invites ${p.lastName} to their annual dinner.`,
    options: [
      { id: "attend", label: "Attend and mingle", hint: "Fans warm to you", effect: () => ({ rel: { supporters: 6 }, fitness: -1 }) },
      { id: "brief", label: "Pop in for a speech", hint: "Short and sweet", effect: () => ({ rel: { supporters: 3 } }) },
      { id: "decline", label: "Send your apologies", effect: () => ({ rel: { supporters: -2 } }) },
    ],
    fallback: "brief",
  },
  {
    id: "captain-advice", weight: 1, cooldown: 40,
    when: (s, p) => !!p.clubId && ageOf(p, s.season) <= 24 && s.turn > 6,
    title: () => "A veteran offers advice",
    body: () => "A senior player pulls you aside after training and offers to share what they've learned about handling the big matches.",
    options: [
      { id: "listen", label: "Listen carefully", hint: "Teammates and manager notice", effect: () => ({ rel: { teammates: 4, manager: 2 }, morale: 2 }) },
      { id: "politely", label: "Nod politely, do it your way", effect: () => ({ rel: { teammates: -1 } }) },
    ],
    fallback: "listen",
  },
  {
    id: "dressing-room-prank", weight: 0.9, cooldown: 36,
    when: (s, p) => !!p.clubId && ageOf(p, s.season) <= 25,
    title: () => "The rookie initiation",
    body: () => "The squad expects you to sing a song in front of everyone, as every new face before you has done.",
    options: [
      { id: "sing", label: "Give it everything", hint: "Instant dressing-room favourite", effect: () => ({ rel: { teammates: 5 }, morale: 2 }) },
      { id: "dodge", label: "Make an excuse", hint: "Awkward", effect: () => ({ rel: { teammates: -3 } }) },
      { id: "deflect", label: "Offer to buy the coffees", hint: "Safe, a little dull", effect: () => ({ rel: { teammates: 1 } }) },
    ],
    fallback: "deflect",
  },
  {
    id: "board-meeting", weight: 1, cooldown: 50,
    when: (s, p) => !!p.clubId && p.reputation > 35,
    title: () => "The board wants a word",
    body: (s, p) => `${clubName(p.clubId)} directors ask for your thoughts on the club's direction.`,
    options: [
      { id: "honest", label: "Be honest about the squad", hint: "Respected, but ruffles feathers", effect: () => ({ rel: { board: 4, manager: -3 } }) },
      { id: "diplomatic", label: "Stay diplomatic", hint: "Everyone's happy", effect: () => ({ rel: { board: 2, manager: 1 } }) },
      { id: "decline", label: "Say it's not your place", effect: () => ({ rel: { manager: 2 } }) },
    ],
    fallback: "diplomatic",
  },
  {
    id: "ambition-comments", weight: 0.9, cooldown: 50,
    when: (s, p) => !!p.clubId && p.hidden.ambition > 65 && p.reputation > 40,
    title: () => "Asked about your future",
    body: () => "A reporter asks in a press conference whether you see your long-term future at the club.",
    options: [
      { id: "committed", label: "Say you're fully committed", hint: "Fans and board are pleased", effect: () => ({ rel: { supporters: 4, board: 3 }, morale: -1 }) },
      { id: "open", label: "Keep your options open", hint: "Honest, but stirs rumours", effect: () => ({ rel: { supporters: -3, board: -2 }, reputation: 0.5 }) },
      { id: "nocomment", label: "Deflect the question", effect: () => ({}) },
    ],
    fallback: "nocomment",
  },
  {
    id: "return-injured", weight: 1.2, cooldown: 30,
    when: (s, p) => !!p.clubId && !!p.injury && p.injury.weeksLeft >= 2,
    title: () => "Rushing back from injury?",
    body: () => "The physio says you're ahead of schedule, and the manager hints he'd love you back early.",
    options: [
      { id: "patient", label: "Follow the physio's plan", hint: "Safe and steady", effect: () => ({ rel: { manager: 1 }, morale: -1 }) },
      { id: "push", label: "Push the rehab harder", hint: "Faster, but exhausting", effect: () => ({ fitness: -4, sharpness: 3, morale: 2, rel: { manager: 3 } }) },
    ],
    fallback: "patient",
  },
  {
    id: "social-media-ban", weight: 0.9, cooldown: 50,
    when: (s, p) => !!p.clubId && p.reputation > 30 && s.turn > 4,
    title: () => "Social media row",
    body: () => "A post you shared is being misread. Journalists are asking what you meant.",
    options: [
      { id: "clarify", label: "Post a clarification", hint: "Stops it spreading", effect: () => ({ rel: { supporters: 1 }, morale: -1 }) },
      { id: "delete", label: "Delete it quietly", hint: "Might look worse", effect: () => ({ rel: { supporters: -2, board: -1 } }) },
      { id: "leave", label: "Leave it", hint: "Risky", effect: () => ({ rel: { supporters: -3, board: -2 }, reputation: 0.3 }) },
    ],
    fallback: "clarify",
  },
  {
    id: "penalty-taker", weight: 1.2, cooldown: 36,
    when: (s, p) => !!p.clubId && p.attrs.finishing > 60 && s.turn > 6,
    title: () => "Who takes the penalties?",
    body: () => "The regular penalty taker has missed twice. The manager asks if you want the responsibility.",
    options: [
      { id: "take", label: "Step up", hint: "Pressure, but the manager trusts you", effect: () => ({ rel: { manager: 4, supporters: 2 }, morale: 2 }) },
      { id: "share", label: "Suggest sharing duties", hint: "Safe, team-first", effect: () => ({ rel: { teammates: 3 } }) },
      { id: "pass", label: "Leave it to someone else", effect: () => ({ morale: 1 }) },
    ],
    fallback: "share",
  },
  {
    id: "new-signing-rival", weight: 1.3, cooldown: 36,
    when: (s, p) => !!p.clubId && s.turn > 3 && s.turn < 40 && s.user.relationships.manager < 85,
    title: () => "A new signing in your position",
    body: () => "The club has brought in a player who plays where you do. The dressing room is watching how you react.",
    options: [
      { id: "welcome", label: "Welcome them warmly", hint: "Teammates respect it", effect: () => ({ rel: { teammates: 5, manager: 2 } }) },
      { id: "compete", label: "Treat it as a challenge", hint: "Sharper, a little tense", effect: () => ({ sharpness: 4, morale: 1, rel: { teammates: -1 } }) },
      { id: "complain", label: "Ask the manager about your role", hint: "Risky", effect: () => ({ rel: { manager: -4 }, morale: 1 }) },
    ],
    fallback: "welcome",
  },
  {
    id: "school-visit", weight: 1.3, cooldown: 30,
    when: (s, p) => !!p.clubId && p.reputation > 12,
    title: () => "School visit request",
    body: (s, p) => `A local school asks ${p.firstName} to give a talk about making it as a footballer.`,
    options: [
      { id: "go", label: "Give the talk", hint: "Supporters love it", effect: () => ({ rel: { supporters: 4, board: 2 }, morale: 2 }) },
      { id: "video", label: "Record a video message", hint: "Quick and kind", effect: () => ({ rel: { supporters: 2 } }) },
      { id: "decline", label: "Decline", effect: () => ({}) },
    ],
    fallback: "video",
  },
  {
    id: "referee-dispute", weight: 1, cooldown: 36,
    when: (s, p) => !!p.clubId && p.yellowAccum >= 2,
    title: () => "Words with the referee",
    body: () => "Your protests during the last match have drawn attention. The club wants to know how you'll handle officials.",
    options: [
      { id: "calm", label: "Promise to keep calm", hint: "Manager appreciates it", effect: () => ({ rel: { manager: 3, board: 1 } }) },
      { id: "defend", label: "Defend your corner", hint: "Fans like the fire", effect: () => ({ rel: { supporters: 3, manager: -3 } }) },
      { id: "apologise", label: "Send an apology", hint: "Humble, a touch dented", effect: () => ({ rel: { manager: 2 }, morale: -1 }) },
    ],
    fallback: "calm",
  },
  {
    id: "pre-season-fitness", weight: 1.2, cooldown: 40,
    when: (s, p) => !!p.clubId && !p.injury && s.turn <= 6 && p.fitness < 85,
    title: () => "Fitness coach's challenge",
    body: () => "The fitness coach has set a punishing running programme for those who want to arrive sharp.",
    options: [
      { id: "all-in", label: "Go all in", hint: "Fitter, but sore", effect: () => ({ fitness: 6, sharpness: 3, morale: -1 }) },
      { id: "steady", label: "Build up gradually", hint: "Lower risk", effect: () => ({ fitness: 3, sharpness: 1 }) },
      { id: "skip", label: "Follow your own plan", hint: "Coach unimpressed", effect: () => ({ rel: { manager: -2 } }) },
    ],
    fallback: "steady",
  },
  {
    id: "derby-week", weight: 1.3, cooldown: 30,
    when: (s, p) => !!p.clubId && s.turn > 5 && s.turn < 42 && s.user.relationships.supporters > 40,
    title: () => "Derby week",
    body: (s, p) => `The city is buzzing. ${clubName(p.clubId)} fans want to know if ${p.lastName} understands what the derby means.`,
    options: [
      { id: "speak", label: "Talk it up to the press", hint: "Fans are fired up", effect: () => ({ rel: { supporters: 5 }, morale: 3 }) },
      { id: "calm", label: "Keep a low profile", hint: "Focused, quieter", effect: () => ({ sharpness: 2, rel: { manager: 2 } }) },
      { id: "wind-up", label: "Wind up the rivals", hint: "Entertaining, risky", effect: () => ({ rel: { supporters: 6, manager: -4, board: -2 }, morale: 2 }) },
    ],
    fallback: "calm",
  },
  {
    id: "squad-rotation", weight: 1.2, cooldown: 30,
    when: (s, p) => !!p.clubId && !p.injury && p.fitness < 70 && s.turn > 8 && s.turn < 44,
    title: () => "Tired legs",
    body: () => "A heavy run of fixtures has caught up with you. The medical team suggests a lighter week.",
    options: [
      { id: "rest", label: "Take the rest", hint: "Fitness recovers", effect: () => ({ fitness: 10, sharpness: -3 }) },
      { id: "play", label: "Tell them you're fine", hint: "Manager likes the spirit", effect: () => ({ rel: { manager: 3 }, fitness: -3, morale: 1 }) },
    ],
    fallback: "rest",
  },
  {
    id: "retire-tribute", weight: 0.9, cooldown: 60,
    when: (s, p) => !!p.clubId && ageOf(p, s.season) >= 27 && s.turn > 10,
    title: () => "A club legend's farewell",
    body: () => "A long-serving club legend is retiring, and the players have been asked to say a few words at the tribute.",
    options: [
      { id: "speech", label: "Give a heartfelt speech", hint: "A moment to remember", effect: () => ({ rel: { supporters: 4, teammates: 3 }, morale: 3 }) },
      { id: "gift", label: "Organise a squad gift", hint: "Thoughtful leadership", effect: () => ({ rel: { teammates: 5 } }) },
      { id: "attend", label: "Just attend", effect: () => ({}) },
    ],
    fallback: "attend",
  },
  {
    id: "tactical-clash", weight: 1.1, cooldown: 36,
    when: (s, p) => !!p.clubId && s.turn > 8 && s.turn < 42 && s.user.relationships.manager < 70,
    title: () => "Disagreement over tactics",
    body: () => "You think the team's approach is holding you back, and you aren't sure whether to say it.",
    options: [
      { id: "speak", label: "Raise it with the manager", hint: "Honest, a gamble", effect: () => ({ rel: { manager: -3, teammates: 2 }, morale: 2 }) },
      { id: "adapt", label: "Adapt your game", hint: "Manager notices", effect: () => ({ rel: { manager: 4 }, morale: -1 }) },
      { id: "captain", label: "Voice it through the captain", hint: "Measured", effect: () => ({ rel: { manager: 1, teammates: 2 } }) },
    ],
    fallback: "adapt",
  },
  {
    id: "waste-time", weight: 0.9, cooldown: 40,
    when: (s, p) => !!p.clubId && ageOf(p, s.season) >= 25 && p.hidden.professionalism > 50,
    title: () => "A tough dressing-room joker",
    body: () => "A teammate's constant pranks are wearing on a few people. Others think it keeps spirits high.",
    options: [
      { id: "laugh", label: "Join in", hint: "Fun, but loose", effect: () => ({ rel: { teammates: 3 }, morale: 2, sharpness: -1 }) },
      { id: "word", label: "Have a quiet word", hint: "Fair, a little awkward", effect: () => ({ rel: { teammates: 1, manager: 2 } }) },
      { id: "ignore", label: "Stay out of it", effect: () => ({}) },
    ],
    fallback: "ignore",
  },
  {
    id: "fan-banner", weight: 1, cooldown: 36,
    when: (s, p) => !!p.clubId && s.user.relationships.supporters > 60,
    title: () => "A banner in the stands",
    body: (s, p) => `Supporters unfurl a huge banner of ${p.lastName} before kick-off. The cameras linger on it.`,
    options: [
      { id: "wave", label: "Applaud the fans", hint: "A warm moment", effect: () => ({ rel: { supporters: 5 }, morale: 3 }) },
      { id: "nod", label: "Give a quiet nod", effect: () => ({ rel: { supporters: 2 }, morale: 1 }) },
    ],
    fallback: "nod",
  },
  {
    id: "sleep-routine", weight: 1, cooldown: 36,
    when: (s, p) => !!p.clubId && p.hidden.professionalism < 70,
    title: () => "The sports scientist's report",
    body: () => "Data shows your sleep and recovery have slipped. The sports scientist offers a routine.",
    options: [
      { id: "follow", label: "Follow the routine", hint: "Better recovery", effect: () => ({ fitness: 5, morale: 1, rel: { manager: 2 } }) },
      { id: "tweak", label: "Make small changes", effect: () => ({ fitness: 2 }) },
      { id: "dismiss", label: "Wave it off", hint: "Manager notes it", effect: () => ({ rel: { manager: -2 } }) },
    ],
    fallback: "tweak",
  },
  {
    id: "international-break", weight: 0.9, cooldown: 40,
    when: (s, p) => !!p.clubId && p.intl.caps > 0 && !p.injury && s.turn > 5,
    title: () => "Heavy international schedule",
    body: () => "Your country is asking a lot of you. The club worries about how tired you'll be on return.",
    options: [
      { id: "go", label: "Give everything for your country", hint: "Pride, but tired", effect: () => ({ morale: 4, fitness: -5, rel: { manager: -2 } }) },
      { id: "manage", label: "Agree a managed schedule", hint: "A compromise", effect: () => ({ fitness: -1, rel: { manager: 2 } }) },
    ],
    fallback: "manage",
  },
  {
    id: "training-rival", weight: 1.1, cooldown: 36,
    when: (s, p) => !!p.clubId && ageOf(p, s.season) <= 23 && !p.injury,
    title: () => "A friendly training rivalry",
    body: () => "A teammate your age is matching you drill for drill, and the coaches are encouraging it.",
    options: [
      { id: "push", label: "Push each other harder", hint: "Both improve, tired legs", effect: () => ({ sharpness: 5, fitness: -3, rel: { teammates: 2 } }) },
      { id: "share", label: "Share tips and workouts", hint: "Team-spirited", effect: () => ({ sharpness: 2, rel: { teammates: 4 } }) },
      { id: "ignore", label: "Keep to yourself", effect: () => ({}) },
    ],
    fallback: "share",
  },
  {
    id: "awards-night", weight: 0.9, cooldown: 50,
    when: (s, p) => !!p.clubId && p.reputation > 50 && p.form > 6.8,
    title: () => "Invited to an awards night",
    body: () => "A national awards ceremony has invited you to attend and say a few words.",
    options: [
      { id: "go", label: "Attend and enjoy it", hint: "Profile boost, a late night", effect: () => ({ reputation: 1.5, morale: 3, fitness: -2 }) },
      { id: "send", label: "Send a video message", effect: () => ({ reputation: 0.5 }) },
      { id: "decline", label: "Stay focused on training", hint: "Manager approves", effect: () => ({ rel: { manager: 3 } }) },
    ],
    fallback: "send",
  },
  {
    id: "goal-celebration", weight: 1, cooldown: 36,
    when: (s, p) => !!p.clubId && Object.values(p.season).reduce((g, x) => g + x.goals, 0) >= 3,
    title: () => "That celebration",
    body: () => "Your goal celebration at the weekend is the talk of the town, with opinions split on whether it went too far.",
    options: [
      { id: "own-it", label: "Own it and do it again", hint: "Fans love it, the manager is less keen", effect: () => ({ rel: { supporters: 4, manager: -2 }, morale: 3 }) },
      { id: "tone-down", label: "Tone it down", hint: "Safe", effect: () => ({ rel: { manager: 2 } }) },
      { id: "dedicate", label: "Dedicate it to someone special", hint: "A heartfelt story", effect: () => ({ rel: { supporters: 3, teammates: 1 }, morale: 2 }) },
    ],
    fallback: "tone-down",
  },
  {
    id: "team-bonding-trip", weight: 1, cooldown: 50,
    when: (s, p) => !!p.clubId && s.user.relationships.teammates < 80 && s.turn > 6,
    title: () => "Squad bonding trip",
    body: () => "The club is organising a team-bonding trip, and the squad is split on whether it's a good use of time.",
    options: [
      { id: "organise", label: "Help organise it", hint: "Dressing room draws together", effect: () => ({ rel: { teammates: 6, manager: 2 }, fitness: -2 }) },
      { id: "attend", label: "Just go along", effect: () => ({ rel: { teammates: 3 }, morale: 2 }) },
      { id: "skip", label: "Skip it", hint: "Some will notice", effect: () => ({ rel: { teammates: -3 } }) },
    ],
    fallback: "attend",
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
      addStintEvent(s, "captain");
      return { morale: 8, reputation: 2, rel: { board: 5 } };
    },
  },
];

function apply(state: GameState, p: Player, e: Effect, cause = "A career event") {
  if (e.morale) p.morale = clamp(p.morale + e.morale, 0, 100);
  if (e.fitness) p.fitness = clamp(p.fitness + e.fitness, 10, 100);
  if (e.sharpness) p.sharpness = clamp(p.sharpness + e.sharpness, 0, 100);
  if (e.reputation) p.reputation = clamp(p.reputation + e.reputation, 0, 100);
  if (e.earnings) {
    if (e.earnings > 0) receiveIncome(state, e.earnings, "other");
    else {
      state.user.earnings += e.earnings;
      state.user.bank = Math.max(0, state.user.bank + e.earnings);
    }
  }
  if (e.hireAgentId) hireAgent(state, e.hireAgentId, { force: true });
  if (e.agentBoost && state.user.agent.id !== "none") {
    const sk = state.user.agent.skills;
    for (const k of Object.keys(sk) as (keyof typeof sk)[]) sk[k] = clamp(sk[k] + e.agentBoost, 0, 100);
    state.user.agent.rating = agentRating(sk);
  }
  if (e.rel) for (const k in e.rel) {
    const key = k as keyof Relationships;
    adjustRel(state, key, e.rel[key] ?? 0, cause);
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
    apply(state, p, ev.effect?.(state, p) ?? {}, ev.title(state, p));
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
  if (d.jerseyNo !== undefined) {
    state.user.decisions = state.user.decisions.filter((x) => x.id !== decisionId);
    return resolveJerseyDecision(state, d.jerseyNo, optionId);
  }
  if (d.intlCode) {
    state.user.decisions = state.user.decisions.filter((x) => x.id !== decisionId);
    const msg = resolveInvitation(state, optionId);
    return msg;
  }
  const ev = EVENTS.find((e) => e.id === d.eventId);
  const opt = ev?.options?.find((o) => o.id === optionId) ?? ev?.options?.find((o) => o.id === d.fallback);
  state.user.decisions = state.user.decisions.filter((x) => x.id !== decisionId);
  if (!ev || !opt) return "Nothing happens.";
  apply(state, userPlayer(state), opt.effect(state, userPlayer(state)), `${d.title}: ${opt.label}`);
  addNews(state, { kind: "event", title: d.title, body: `You chose: ${opt.label}.` });
  rememberDecision(state, ev.id, opt.id, d.title);
  if (ev.id === "playing-time" && (opt.id === "demand" || opt.id === "leave")) addStintEvent(state, "playing-dispute");
  if (ev.id === "touchline-row" && opt.id === "stand") addStintEvent(state, "fallout");
  return `You chose: ${opt.label}.`;
}

export function expireDecisions(state: GameState): void {
  for (const d of [...state.user.decisions]) {
    if (state.turn > d.expiresTurn || d.season !== state.season) resolveDecision(state, d.id, d.fallback);
  }
}
