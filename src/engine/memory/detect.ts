/**
 * Moment detectors. Each one looks at something that just happened, builds a
 * list of context points (competition, rivalry, minute, age…) and hands a draft
 * to recordMemory, which turns it into an importance score and stores it.
 * Nothing here uses random numbers.
 */
import { staticClub } from "../data/world";
import type { MatchResult } from "../match/engine";
import { overallFor } from "../players/attributes";
import { traitDef } from "../traits/registry";
import { ageOf } from "../players/generate";
import type { Competition, Fixture, GameState, Memory, MemoryKind, TransferOffer, TransferSaga } from "../types";
import { userPlayer } from "../world/helpers";
import { addStintEvent } from "../managers/history";
import { rivalMatchBonus } from "../career/rivalry/engine";
import { bumpRivalHeat, rivalryLevel } from "./rivalry";
import { agePoints, Factors, stagePoints } from "./score";
import { recordMemory } from "./store";

type Line = MatchResult["lines"][number];

const isNational = (comp: Competition) => comp.kind === "international" || comp.kind === "friendly";

function clubRep(state: GameState, id?: string | null): number {
  return id ? state.clubs[id]?.reputation ?? staticClub(id)?.prestige ?? 0 : 0;
}

/** One memory per match: its strongest aspect names it, every other aspect adds to the score and the tags. */
export function detectMatchMemory(state: GameState, fixture: Fixture, comp: Competition, res: MatchResult, line: Line): Memory | null {
  const u = userPlayer(state);
  const nat = isNational(comp);
  const side = line.side;
  const mine = side === "home" ? fixture.home : fixture.away;
  const opp = side === "home" ? fixture.away : fixture.home;
  const myGoals = side === "home" ? res.homeGoals : res.awayGoals;
  const theirGoals = side === "home" ? res.awayGoals : res.homeGoals;
  const outcome: Memory["outcome"] = myGoals > theirGoals ? "win" : myGoals < theirGoals ? "loss" : "draw";
  const minutes = Math.max(0, (line.minuteOff ?? 90) - line.minuteOn);
  const age = ageOf(u, state.season);

  // Replay the goals to find the lead changes.
  let diff = 0;
  let maxDeficit = 0;
  let winningGoal: { minute: number; byUser: boolean } | null = null;
  for (const g of res.goals) {
    const before = diff;
    diff += g.side === side ? 1 : -1;
    maxDeficit = Math.max(maxDeficit, -diff);
    if (before <= 0 && diff > 0) winningGoal = { minute: g.minute, byUser: g.scorer === u.id && g.side === side };
  }
  if (outcome !== "win") winningGoal = null;
  const decisive = winningGoal?.byUser ? winningGoal : null;

  const goals = line.goals;
  const involvement = goals + line.assists > 0 ? 1 : minutes >= 60 ? 0.55 : 0.3;
  const level = nat ? 0 : rivalryLevel(state, mine, opp);
  const stage = fixture.stage ?? "";
  const isFinal = /final/i.test(stage) && !/semi|quarter/i.test(stage);

  const f = new Factors();
  const tags: string[] = [];
  let aspects = 0;
  const aspect = (label: string, pts: number, tag: string) => {
    f.add(label, pts);
    tags.push(tag);
    aspects++;
  };

  if (!nat && u.career.apps === 1) aspect("Professional debut", 18, "debut");
  if (nat && u.intl.caps === 1) aspect("International debut", 22, "intl-debut");
  if (goals > 0 && u.career.goals === goals) aspect("First senior goal", 20, "first-goal");
  if (nat && goals > 0 && u.intl.goals === goals) aspect("First international goal", 24, "first-intl-goal");
  if (goals >= 5) aspect("Five or more goals", 61, "haul");
  else if (goals === 4) aspect("Four goals", 51, "haul");
  else if (goals === 3) aspect("Hat-trick", 36, "hat-trick");
  else if (goals === 2) f.add("Brace", 16), tags.push("brace");
  else if (goals === 1) f.add("A goal", 6);
  if (decisive) {
    aspect("Winning goal", 10, "winner");
    if (decisive.minute >= 90) f.add("Winner in stoppage time", 16), tags.push("late");
    else if (decisive.minute >= 80) f.add("Late winner", 10), tags.push("late");
  }
  if (outcome === "win" && maxDeficit >= 2) aspect(maxDeficit >= 3 ? "Comeback from three down" : "Comeback from two down", (maxDeficit >= 3 ? 26 : 16) * involvement, "comeback");
  else if (outcome === "draw" && maxDeficit >= 3) aspect("Rescued a draw from three down", 14 * involvement, "comeback");
  const oppRep = clubRep(state, opp);
  const myRep = clubRep(state, mine);
  if (!nat && outcome === "win" && oppRep - myRep >= 15 && minutes >= 45) aspect("Famous upset", Math.min(22, 10 + (oppRep - myRep - 15) * 0.7) * involvement, "upset");

  if (aspects === 0) return null;

  // Context: only counts once there is something to remember.
  const compPts = stagePoints(comp, stage);
  f.add(isFinal ? `${comp.shortName} final` : `${comp.shortName} ${stage ? stage.toLowerCase() : "tie"}`, compPts);
  if (isFinal) tags.push("final");
  if (comp.kind === "cup" || comp.kind === "continental" || comp.kind === "international") tags.push(comp.kind);
  if (level >= 0.5) {
    f.add("Derby / rivalry", level * 24);
    tags.push("derby");
  } else if (level > 0) f.add("Local rivalry", level * 10);
  const duel = rivalMatchBonus(state, fixture.id);
  if (duel) {
    f.add(`Face to face with your rival, ${duel.rival.name}`, duel.bonus);
    tags.push("rivalry");
  }
  if (!nat && oppRep >= 85) f.add("Elite opponent", 4);
  else if (!nat && oppRep >= 75) f.add("Strong opponent", 2);
  f.add("Young talent", agePoints(age) && age <= 21 ? agePoints(age) : 0);
  f.add("Veteran moment", age >= 34 ? agePoints(age) : 0);
  if (res.homeGoals + res.awayGoals >= 5) f.add("Thriller", 4);

  // Primary kind: the strongest aspect names the memory.
  const has = (t: string) => tags.includes(t);
  let kind: MemoryKind;
  if (decisive && isFinal) kind = "final-winner";
  else if (goals > 0 && isFinal) kind = "final-goal";
  else if (decisive && level >= 0.5) kind = "derby-winner";
  else if (decisive && decisive.minute >= 90) kind = "late-winner";
  else if (has("haul")) kind = "haul";
  else if (has("hat-trick")) kind = "hat-trick";
  else if (decisive && decisive.minute >= 80) kind = "winner-goal";
  else if (has("comeback")) kind = "comeback";
  else if (has("upset")) kind = "famous-upset";
  else if (has("first-intl-goal")) kind = "first-intl-goal";
  else if (has("intl-debut")) kind = "intl-debut";
  else if (has("first-goal")) kind = "first-goal";
  else if (has("debut")) kind = "debut";
  else if (decisive) kind = "winner-goal";
  else return null;

  const milestone = kind === "debut" || kind === "first-goal" || kind === "intl-debut" || kind === "first-intl-goal";
  const m = recordMemory(state, {
    kind,
    clubId: nat ? undefined : mine,
    opponentId: opp,
    compId: comp.id,
    compName: comp.name,
    stage: stage || undefined,
    fixtureId: fixture.id,
    minute: decisive?.minute ?? res.goals.find((g) => g.scorer === u.id)?.minute,
    score: [myGoals, theirGoals],
    outcome,
    venueClubId: !nat && state.clubs[fixture.home] ? fixture.home : undefined,
    participants: res.goals.filter((g) => g.scorer === u.id && g.assist).map((g) => g.assist as string),
    rivalId: level >= 0.5 ? opp : undefined,
    tags,
    // A heroic game in a lost match is remembered, but less warmly.
    factors: outcome === "loss" ? scaled(f, 0.7) : f,
    keepAlways: milestone,
    data: { goals, assists: line.assists, rating: Math.round(line.rating * 10) / 10, deficit: maxDeficit, ...(res.extraTime ? { et: true } : {}) },
  });
  if (m && (decisive || goals >= 3) && !nat) bumpRivalHeat(state, opp, level >= 0.5 ? 0.1 : 0.04);
  return m;
}

/** The first match after a long injury becomes a comeback memory. */
export function detectInjuryComeback(state: GameState, fixture: Fixture, comp: Competition, line: Line): Memory | null {
  const c = state.user.comebackFrom;
  if (!c) return null;
  const minutes = Math.max(0, (line.minuteOff ?? 90) - line.minuteOn);
  if (minutes < 20) return null;
  state.user.comebackFrom = undefined;
  const f = new Factors().add("Back from a long injury", 18 + Math.min(14, (c.weeks - 12) * 0.9)).add("Time out", Math.min(10, c.weeks * 0.3));
  if (line.goals > 0) f.add("Scored on the return", 12 + line.goals * 4);
  const u = userPlayer(state);
  const mine = line.side === "home" ? fixture.home : fixture.away;
  return recordMemory(state, {
    kind: "injury-comeback",
    clubId: isNational(comp) ? undefined : mine,
    opponentId: line.side === "home" ? fixture.away : fixture.home,
    compId: comp.id,
    compName: comp.name,
    fixtureId: fixture.id,
    tags: ["injury", "comeback"],
    factors: f.add("Young talent", ageOf(u, state.season) <= 21 ? 5 : 0),
    data: { weeks: c.weeks, type: c.type, goals: line.goals },
  });
}

/** Record the user's latest match so a retirement can recall a "final match". */
export function noteLastMatch(state: GameState, fixture: Fixture, line: Line, myGoals: number, theirGoals: number): void {
  state.user.lastMatch = {
    fixtureId: fixture.id,
    compId: fixture.compId,
    opponentId: line.side === "home" ? fixture.away : fixture.home,
    score: [myGoals, theirGoals],
    minutes: Math.max(0, (line.minuteOff ?? 90) - line.minuteOn),
    goals: line.goals,
    assists: line.assists,
    rating: line.rating,
    season: state.season,
    turn: state.turn,
  };
}

// --------------------------------------------------------------------------- honours

export function rememberTrophy(state: GameState, comp: Competition, userApps: number): Memory | null {
  const u = userPlayer(state);
  const age = ageOf(u, state.season);
  const nat = comp.kind === "international";
  const tier1 = comp.kind === "league" && comp.tier === 1;
  const world = nat && comp.id.startsWith("world");
  const f = new Factors();
  const prior = state.user.trophies.filter((t) => t.kind === comp.kind);
  let kind: MemoryKind = "trophy";
  if (nat) {
    kind = "intl-trophy";
    f.add(world ? "World champions" : "Continental champions", world ? 70 : 56);
  } else if (comp.kind === "continental") {
    kind = "continental-trophy";
    f.add("Continental trophy", 40 + comp.prestige * 1.6);
  } else if (comp.kind === "league") {
    f.add(tier1 ? "League title" : "League title (lower tier)", tier1 ? 38 : 16);
    if (tier1 && !prior.some((t) => t.compId.includes("-1-"))) {
      kind = "first-title";
      f.add("First league title", 14);
    }
  } else {
    f.add("Cup winner", 14 + comp.prestige * 1.4);
  }
  if (!prior.length) f.add("First trophy", 10);
  f.add("Young talent", age <= 21 ? 8 : 0);
  // Contribution: bit-part winners' medals matter less.
  const share = Math.min(1, userApps / (comp.kind === "league" ? 25 : 4));
  return recordMemory(state, {
    kind,
    clubId: nat ? undefined : comp.winner,
    compId: comp.id,
    compName: comp.name,
    trophy: { season: comp.season, compId: comp.id },
    tags: ["trophy", comp.kind],
    factors: scaled(f, 0.5 + 0.5 * share),
    key: comp.id,
    keepAlways: kind === "first-title",
  });
}

function scaled(f: Factors, k: number): Factors {
  const out = new Factors();
  for (const [l, p] of f.list) out.add(l, p * k);
  return out;
}

const AWARD_POINTS: Record<string, number> = {
  "golden-pitch": 78, "golden-pitch-podium": 44, "rising-star": 38, pots: 40, ypots: 22, topscorer: 36, topassist: 16, goldenglove: 30, "world-glove": 42,
};

export function rememberAward(state: GameState, id: string, name: string, scope: string, clubId?: string | null): Memory | null {
  const pts = AWARD_POINTS[id];
  if (!pts) return null;
  const u = userPlayer(state);
  const f = new Factors().add(name, pts).add("Young talent", ageOf(u, state.season) <= 21 ? 8 : 0);
  return recordMemory(state, { kind: "award", clubId, tags: ["award", id], factors: f, key: `${id}-${scope}`, data: { award: id, name, scope } });
}

const SEASON_AWARD_POINTS: Record<string, number> = { pots: 40, ypots: 22, topscorer: 36, topassist: 16, goldenglove: 30, breakthrough: 24, tots: 10 };

export interface AwardContext {
  /** The first time the player has won this award. */
  first: boolean;
  /** Consecutive seasons including this one. */
  streak: number;
  /** Total wins including this one. */
  total: number;
  overRival?: string;
  /** Won on the same night as at least two other individual awards. */
  sweep?: boolean;
}

/**
 * A season award as a memory. Ordinary repeats stay in career history; firsts, streaks, wins over a rival and
 * sweeps make the story. The existing importance system decides whether it is kept.
 */
export function rememberSeasonAward(state: GameState, award: { id: string; name: string; scope: string; clubId?: string | null }, ctx: AwardContext): Memory | null {
  const base = SEASON_AWARD_POINTS[award.id];
  if (!base) return null;
  const u = userPlayer(state);
  const f = new Factors().add(award.name, base);
  f.add("Your first", ctx.first ? 16 : 0);
  f.add(ctx.streak >= 3 ? `${ctx.streak} in a row` : "Back to back", ctx.streak >= 3 ? 14 + Math.min(12, (ctx.streak - 3) * 4) : ctx.streak === 2 ? 6 : 0);
  f.add("A landmark total", ctx.total >= 5 && ctx.total % 5 === 0 ? 10 : 0);
  f.add("Won over your rival", ctx.overRival ? 12 : 0);
  f.add("An awards sweep", ctx.sweep ? 14 : 0);
  f.add("Young talent", ageOf(u, state.season) <= 21 && (ctx.first || base >= 22) ? 8 : 0);
  return recordMemory(state, { kind: "award", clubId: award.clubId, tags: ["award", award.id, ...(ctx.overRival ? ["rivalry"] : [])], factors: f, key: `${award.id}-${award.scope}`, data: { award: award.id, name: award.name, scope: award.scope, streak: ctx.streak, total: ctx.total } });
}

export function rememberRecord(state: GameState, label: string, value: number): Memory | null {
  const f = new Factors().add("Record broken", 46 + Math.min(20, Math.log10(Math.max(1, value)) * 6));
  const u = userPlayer(state);
  return recordMemory(state, { kind: "record", clubId: u.clubId, tags: ["record"], factors: f, key: label, data: { label, value } });
}

export function rememberPromotionOrRelegation(state: GameState, up: boolean, clubId: string, apps: number): Memory | null {
  if (apps < 10) return null;
  const f = new Factors().add(up ? "Promotion" : "Relegation", up ? 26 : 32).add("A season's contribution", Math.min(10, apps / 4));
  return recordMemory(state, { kind: up ? "promotion" : "relegation", clubId, tags: [up ? "promotion" : "relegation"], factors: f, key: clubId, data: { apps } });
}

// --------------------------------------------------------------------------- injuries

export function rememberMajorInjury(state: GameState, type: string, weeks: number): Memory | null {
  if (weeks < 12) return null;
  state.user.comebackFrom = { type, weeks, season: state.season };
  const u = userPlayer(state);
  const f = new Factors().add("Long-term injury", 22 + Math.min(18, (weeks - 12) * 0.9)).add("Young talent", ageOf(u, state.season) <= 21 ? 5 : 0);
  return recordMemory(state, { kind: "major-injury", clubId: u.clubId, tags: ["injury"], factors: f, key: type, data: { type, weeks } });
}

// --------------------------------------------------------------------------- career moves

/** A completed move: classifies it as big, controversial, a homecoming, or a financial exit. */
export function rememberTransfer(state: GameState, from: string | null, to: string, fee: number): Memory[] {
  const out: Memory[] = [];
  const u = userPlayer(state);
  const age = ageOf(u, state.season);
  const toRep = clubRep(state, to);
  const fromRep = clubRep(state, from);
  const transfer = { from, to, fee };
  const requested = state.user.transferRequest;
  const rival = from ? Math.max(rivalryLevel(state, from, to), 0) : 0;
  const pastClubs = new Set(u.history.filter((h) => h.clubId && h.stats.apps > 0).map((h) => h.clubId as string));
  const sinceLeft = [...u.history].reverse().find((h) => h.clubId === to);
  const returning = pastClubs.has(to) && to !== from;

  const big = new Factors();
  const gap = Math.max(0, toRep - fromRep);
  const feeBoost = fee > 0 ? Math.min(18, Math.log10(Math.max(1, fee / 1e6) + 1) * 14) : 0;
  if (toRep >= 70) {
    big.add("Move to a major club", 18 + Math.max(0, toRep - 70) * 0.9 + gap * 0.4);
    big.add("Big fee", feeBoost);
    big.add("Young talent", age <= 21 ? 6 : 0);
  } else if (gap >= 14) {
    big.add("A step up", 6 + gap * 0.4);
    big.add("Fee", feeBoost * 0.5);
    big.add("Young talent", age <= 21 ? 3 : 0);
  }
  if (big.total > 0) {
    const m = recordMemory(state, { kind: "big-transfer", clubId: to, opponentId: undefined, transfer, tags: ["transfer"], factors: big, key: to });
    if (m) out.push(m);
  }

  if (from) {
    const c = new Factors();
    if (rival >= 0.5) c.add("Crossed the divide to a rival", 22 + rival * 20);
    if (requested) c.add("After a transfer request", 12);
    if (state.user.relationships.supporters < 30) c.add("Fans turned on you", 10);
    if (c.total >= 20 && (rival >= 0.5 || requested)) {
      const m = recordMemory(state, { kind: "controversial-transfer", clubId: to, rivalId: from, transfer, tags: ["transfer", "controversy"], factors: c, key: to });
      if (m) {
        out.push(m);
        bumpRivalHeat(state, from, 0.12);
      }
    }
  }

  if (returning) {
    const apps = u.history.filter((h) => h.clubId === to).reduce((s, h) => s + h.stats.apps, 0);
    const years = sinceLeft ? state.season - sinceLeft.season : 3;
    const f = new Factors().add("Return to a former club", 26).add("Years away", Math.min(14, years * 2)).add("Time at the club", Math.min(14, apps * 0.06));
    const m = recordMemory(state, { kind: "return-to-club", clubId: to, transfer, tags: ["transfer", "homecoming"], factors: f, key: to, data: { years, apps } });
    if (m) out.push(m);
  }

  const old = from ? state.clubs[from] : null;
  if (old && old.balance < 0) {
    const f = new Factors().add("Left a club in financial trouble", 26 + Math.min(14, -old.balance / 2e7));
    const m = recordMemory(state, { kind: "financial-exit", clubId: from, transfer, tags: ["transfer", "finance"], factors: f, key: from ?? "x" });
    if (m) out.push(m);
  }
  return out;
}

export function rememberRejection(state: GameState, o: TransferOffer, loyal = false): Memory | null {
  const u = userPlayer(state);
  const cur = clubRep(state, u.clubId);
  const rep = clubRep(state, o.fromClubId);
  if (rep < cur + 10 && rep < 80 && !loyal) return null;
  const f = new Factors().add("Turned down a bigger club", 16 + Math.min(20, Math.max(0, rep - cur) * 0.9)).add("Big fee", o.fee > 0 ? Math.min(10, Math.log10(o.fee / 1e6 + 1) * 8) : 0);
  if (loyal) f.add("Loyalty to the club", 14);
  return recordMemory(state, { kind: "transfer-rejected", clubId: u.clubId, opponentId: o.fromClubId, transfer: { from: u.clubId, to: o.fromClubId, fee: o.fee }, tags: loyal ? ["transfer", "loyalty"] : ["transfer"], factors: f, key: o.id, data: loyal ? { loyal: true } : undefined });
}

/** The story of a finished transfer saga: how dramatic it was decides whether it is worth remembering. */
export function rememberSaga(state: GameState, saga: TransferSaga): Memory | null {
  const completed = saga.outcome === "completed";
  const toRep = clubRep(state, saga.clubId);
  const fromRep = clubRep(state, saga.fromClubId);
  const rival = saga.fromClubId ? rivalryLevel(state, saga.fromClubId, saga.clubId) : 0;
  const eliteRivals = saga.rivals.filter((c) => clubRep(state, c) >= 75).length;
  const f = new Factors();
  f.add("Move to a rival", completed && rival >= 0.4 ? 10 + rival * 14 : 0);
  f.add("Return to a former club", saga.flags.formerClub && completed ? 14 : 0);
  f.add("Rejected bids", Math.min(18, saga.rejections * 6));
  f.add("Transfer request", saga.flags.requested ? 10 : 0);
  f.add("Deadline-day drama", saga.flags.deadline ? (completed ? 10 : 6) : 0);
  f.add("High-value move", saga.fee > 0 ? Math.min(16, Math.log10(saga.fee / 1e6 + 1) * 9) : 0);
  f.add("Loyalty decision", saga.outcome === "player-declined" && saga.flags.committed ? 16 : 0);
  f.add("Competing elite clubs", Math.min(14, eliteRivals * 7));
  f.add("Career-defining step", completed ? Math.min(14, Math.max(0, toRep - fromRep) * 0.4 + (toRep >= 75 ? 4 : 0)) : saga.flags.committed ? 6 : 0);
  f.add("A long saga", saga.entries.length >= 8 ? 6 : 0);
  const weeks = Math.max(0, saga.endedIndex !== undefined ? saga.endedIndex - saga.startIndex : 0);
  return recordMemory(state, {
    kind: "transfer-saga",
    clubId: saga.clubId,
    rivalId: saga.fromClubId ?? undefined,
    transfer: { from: saga.fromClubId, to: saga.clubId, fee: completed ? saga.fee : 0 },
    tags: ["transfer", "saga", ...(saga.flags.committed ? ["loyalty"] : [])],
    factors: f,
    key: saga.id,
    data: { outcome: saga.outcome ?? "failed", bids: saga.bids, rejections: saga.rejections, rivals: saga.rivals.length, weeks, returning: !!saga.flags.formerClub, loyal: !!saga.flags.committed },
  });
}

export function rememberContractDispute(state: GameState, clubId: string | null, detail: string): Memory | null {
  const f = new Factors().add("Contract talks broke down", 24);
  return recordMemory(state, { kind: "contract-dispute", clubId, tags: ["contract", "dispute"], factors: f, key: detail, data: { detail } });
}

export function rememberCaptaincy(state: GameState, clubId: string): Memory | null {
  const u = userPlayer(state);
  const age = ageOf(u, state.season);
  const f = new Factors().add("Named club captain", 28).add("Young captain", age <= 23 ? 12 : age <= 26 ? 5 : 0);
  return recordMemory(state, { kind: "captaincy", clubId, tags: ["leadership"], factors: f, key: clubId });
}

export function rememberManagerConflict(state: GameState): Memory | null {
  const u = userPlayer(state);
  const club = u.clubId ? state.clubs[u.clubId] : null;
  if (!club) return null;
  // Once per manager: a rift is a single story, not a weekly one.
  if (state.user.memories.some((m) => m.kind === "manager-conflict" && m.manager?.name === club.manager.name && m.clubId === club.id)) return null;
  addStintEvent(state, "fallout");
  const f = new Factors().add("Falling out with the manager", 16 + Math.min(10, (18 - state.user.relationships.manager) * 0.8));
  return recordMemory(state, {
    kind: "manager-conflict",
    clubId: club.id,
    manager: { name: club.manager.name, clubId: club.id },
    tags: ["manager", "conflict"],
    factors: f,
    key: club.manager.name,
  });
}

const DECISION_POINTS: Record<string, number> = { "playing-time:leave": 24, "super-agent:switch": 22, "super-agent:loyal": 14 };

export function rememberDecision(state: GameState, eventId: string, optionId: string, title: string): Memory | null {
  const pts = DECISION_POINTS[`${eventId}:${optionId}`];
  if (!pts) return null;
  const u = userPlayer(state);
  return recordMemory(state, {
    kind: "career-decision",
    clubId: u.clubId,
    tags: ["decision", eventId],
    factors: new Factors().add("A defining decision", pts),
    key: `${eventId}-${optionId}`,
    data: { event: eventId, option: optionId, title },
  });
}

// --------------------------------------------------------------------------- identity

/** A trait reaching its signature stage, a career-earned one arriving, or a player's game evolving: the moments that define what kind of footballer you are. */
export function rememberIdentity(state: GameState, id: string, event: "signature" | "evolved" | "earned", from?: string): Memory | null {
  const def = traitDef(id);
  if (!def) return null;
  const u = userPlayer(state);
  const f = new Factors()
    .add(event === "signature" ? `Signature ${def.name}` : event === "earned" ? `Earned: ${def.name}` : `Reinvention: ${def.name}`, (event === "earned" ? 22 : 28) + def.rarity * 4 + (event === "evolved" ? 4 : 0))
    .add("Young talent", ageOf(u, state.season) <= 23 ? 6 : 0);
  return recordMemory(state, {
    kind: "identity",
    clubId: u.clubId,
    tags: ["identity", event],
    factors: f,
    key: `${id}-${event}`,
    data: { trait: id, event, ...(from ? { from } : {}) },
  });
}

// --------------------------------------------------------------------------- the ending

export function rememberRetirement(state: GameState): Memory[] {
  const u = userPlayer(state);
  const out: Memory[] = [];
  const legacy = state.user.legacy?.score ?? 0;
  const f = new Factors().add("The end of a career", 38).add("A career's worth", Math.min(50, legacy / 8)).add("Playing days", Math.min(14, u.career.apps / 40));
  const r = recordMemory(state, { kind: "retirement", clubId: u.clubId, tags: ["retirement"], factors: f, key: "retire", keepAlways: true, data: { apps: u.career.apps, goals: u.career.goals, legacy } });
  if (r) out.push(r);
  const last = state.user.lastMatch;
  if (last) {
    const lf = new Factors().add("Final match", 36 + Math.min(14, overallFor(u.attrs, u.position) / 8)).add("Left their mark", last.goals * 8 + last.assists * 4);
    const comp = state.competitions[last.compId];
    const m = recordMemory(state, {
      kind: "final-match",
      clubId: u.clubId,
      opponentId: last.opponentId,
      compId: last.compId,
      compName: comp?.name,
      fixtureId: last.fixtureId,
      score: last.score,
      outcome: last.score[0] > last.score[1] ? "win" : last.score[0] < last.score[1] ? "loss" : "draw",
      tags: ["retirement", "final"],
      factors: lf,
      keepAlways: true,
      data: { goals: last.goals, assists: last.assists, rating: Math.round(last.rating * 10) / 10 },
    });
    if (m) out.push(m);
  }
  return out;
}
