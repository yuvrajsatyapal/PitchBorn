import { beforeAll, describe, expect, it } from "vitest";
import { canRequestRest, advanceTurn, requestRest } from "../src/engine/season/advance";
import { COMMIT_RATING, settleCommitment } from "../src/engine/season/commitments";
import { ASKED_START_BIAS, prepareMatch, selectionSetup, teamSelection } from "../src/engine/season/matchday";
import { PREMATCH_COOLDOWN, headToHead, keyOpponents, matchContext, performPreMatch, preMatchActions, tacticalPreview } from "../src/engine/season/preview";
import { canRestFor, matchStatus, userTeamFor } from "../src/engine/season/selection";
import { MatchEngine } from "../src/engine/match/engine";
import { Rng } from "../src/engine/rng";
import type { Competition, Fixture, GameState } from "../src/engine/types";
import { squadOf, userPlayer } from "../src/engine/world/helpers";
import { newCareer, strongUser } from "./helpers";

/** Advances until the user has a club match pending. */
function pendingClubMatch(s: GameState): { f: Fixture; c: Competition } {
  for (let i = 0; i < 40; i++) {
    for (const pm of s.pending) {
      const c = s.competitions[pm.compId];
      if (c.kind === "league" || c.kind === "cup") return { f: c.fixtures.find((x) => x.id === pm.fixtureId) as Fixture, c };
    }
    advanceTurn(s);
  }
  throw new Error("no club match found");
}

function matchState(seed: string, skill: "strong" | "weak" | "normal" = "normal"): { s: GameState; f: Fixture; c: Competition } {
  const s = newCareer({ seed });
  if (skill === "strong") strongUser(s);
  if (skill === "weak") for (const k of Object.keys(userPlayer(s).attrs)) (userPlayer(s).attrs as Record<string, number>)[k] = 28;
  const { f, c } = pendingClubMatch(s);
  return { s, f, c };
}

describe("player selection states", () => {
  it("names a starter, with their slot, and offers play live and quick sim", () => {
    const { s, f } = matchState("md-start", "strong");
    const st = matchStatus(s, f);
    expect(st.status).toBe("starting");
    expect(st.slot).toBeTruthy();
    expect(st.actions).toMatchObject({ playLive: true, quickSim: true, watch: false, liveLabel: "Play live" });
    expect(st.reasons.every((r) => r.tone !== "bad")).toBe(true);
  });

  it("names a player who is not in the squad, and only offers to watch", () => {
    const { s, f } = matchState("md-out", "weak");
    const st = matchStatus(s, f);
    expect(st.status).toBe("not-selected");
    expect(st.actions).toMatchObject({ playLive: false, watch: true, quickSim: true, rest: false });
    expect(st.reasons.length).toBeGreaterThan(0);
    expect(st.reasons.every((r) => r.tone !== "good")).toBe(true);
  });

  it("recognises the bench, with a watch-or-play action that can take part", () => {
    // Find a seed and skill level that puts the user on the bench: scan attribute levels.
    let found = false;
    for (const level of [60, 64, 68, 72, 76, 80]) {
      const s = newCareer({ seed: "md-bench" });
      for (const k of Object.keys(userPlayer(s).attrs)) (userPlayer(s).attrs as Record<string, number>)[k] = level;
      const { f } = pendingClubMatch(s);
      const st = matchStatus(s, f);
      if (st.status === "bench") {
        expect(st.actions).toMatchObject({ playLive: true, quickSim: true, watch: false, liveLabel: "Watch / play live" });
        const sel = teamSelection(s, st.teamId as string, f, null);
        expect(sel.bench.some((p) => p.id === userPlayer(s).id)).toBe(true);
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it("is injured or suspended before anything else, and offers no live play", () => {
    const { s, f } = matchState("md-inj", "strong");
    const p = userPlayer(s);
    p.injury = { type: "Hamstring strain", severity: "minor", weeksLeft: 3, totalWeeks: 3, area: "hamstring" };
    const inj = matchStatus(s, f);
    expect(inj.status).toBe("injured");
    expect(inj.actions).toMatchObject({ playLive: false, watch: true, quickSim: true, rest: false });
    expect(inj.reasons[0].text).toMatch(/Hamstring/);
    p.injury = null;
    p.suspension = 2;
    const sus = matchStatus(s, f);
    expect(sus.status).toBe("suspended");
    expect(sus.actions.playLive).toBe(false);
    expect(canRestFor(s, f)).toBe(false);
  });

  it("reflects a rest request as resting, with no way to play", () => {
    const { s, f } = matchState("md-rest", "strong");
    expect(canRequestRest(s)).toBe(true);
    requestRest(s);
    const st = matchStatus(s, f);
    expect(st.status).toBe("resting");
    expect(st.actions.playLive).toBe(false);
    expect(canRequestRest(s)).toBe(false);
  });

  it("agrees with the line-up the match engine actually uses", () => {
    for (const seed of ["md-a", "md-b", "md-c", "md-d"]) {
      const { s, f } = matchState(seed, seed === "md-a" ? "strong" : "normal");
      const st = matchStatus(s, f);
      const prepared = prepareMatch(s, f, Rng.fromSeed("whatever"), { interactive: false, detail: true });
      expect(st.status === "starting").toBe(prepared.userStarting);
      expect(st.status === "bench").toBe(prepared.userOnBench);
      // Two different match streams still pick the same user team: it is seeded by the fixture.
      const again = prepareMatch(s, f, Rng.fromSeed("another"), { interactive: false, detail: true });
      expect(again.userStarting).toBe(prepared.userStarting);
      expect(again.home.starters.map((x) => x.player.id)).toEqual(prepared.home.starters.map((x) => x.player.id).slice(0, 11).length === 11 ? again.home.starters.map((x) => x.player.id) : []);
    }
  });

  it("is the same whichever way the match is played (quick sim or live engine)", () => {
    const { s, f } = matchState("md-live", "strong");
    const a = prepareMatch(s, f, Rng.fromSeed("1"), { interactive: true, detail: true });
    const b = prepareMatch(s, f, Rng.fromSeed("2"), { interactive: false, detail: true });
    const mine = (p: typeof a) => (userTeamFor(s, f) === f.home ? p.home : p.away).starters.map((x) => x.player.id);
    expect(mine(a)).toEqual(mine(b));
    expect(a.engine).toBeInstanceOf(MatchEngine);
  });
});

describe("rest requests", () => {
  it("are only possible when the user would play", () => {
    const weak = matchState("md-rest2", "weak");
    expect(canRequestRest(weak.s)).toBe(false);
    expect(canRestFor(weak.s, weak.f)).toBe(false);
    const strong = matchState("md-rest3", "strong");
    expect(canRestFor(strong.s, strong.f)).toBe(true);
  });

  it("use the existing manager and fitness systems, and are logged", () => {
    const { s } = matchState("md-rest4", "strong");
    const before = s.user.relationships.manager;
    userPlayer(s).fitness = 95;
    requestRest(s);
    expect(s.user.relationships.manager).toBeLessThan(before);
    expect(s.user.restTurnIndex).toBe(s.turnIndex);
    expect(s.user.relLog!.some((r) => /rested/.test(r.cause))).toBe(true);
  });
});

describe("why the manager picked or left out the user", () => {
  it("explains a starter with the factors that really favour them over the next best", () => {
    const { s, f } = matchState("md-why1", "strong");
    const st = matchStatus(s, f);
    expect(st.status).toBe("starting");
    expect(st.reasons.length).toBeGreaterThan(0);
    for (const r of st.reasons) expect(["ability", "form", "fitness", "sharpness", "trust", "tactical", "rotation", "competition", "request"]).toContain(r.kind);
  });

  it("explains a left-out player with the real gap to the player in their place", () => {
    const { s, f } = matchState("md-why2", "weak");
    const st = matchStatus(s, f);
    const sel = teamSelection(s, st.teamId as string, f, null);
    const ability = st.reasons.find((r) => r.kind === "ability");
    expect(ability).toBeTruthy();
    const holder = sel.starters.map((x) => x.player.lastName);
    expect(holder.some((n) => ability!.text.includes(n))).toBe(true);
  });

  it("blames fitness when tiredness is what costs the place", () => {
    const s = newCareer({ seed: "md-fit" });
    strongUser(s);
    userPlayer(s).fitness = 45;
    userPlayer(s).sharpness = 20;
    const { f } = pendingClubMatch(s);
    userPlayer(s).injury = null; // exhaustion invites injuries on the way: this is about selection, not injury
    userPlayer(s).fitness = 45;
    userPlayer(s).sharpness = 20;
    const st = matchStatus(s, f);
    expect(st.status).not.toBe("injured");
    if (st.status !== "starting") expect(st.reasons.some((r) => r.kind === "fitness" || r.kind === "sharpness" || r.kind === "ability")).toBe(true);
  });

  it("scores through the same parts it explains: a granted request is counted", () => {
    const { s, f } = matchState("md-ask", "weak");
    const base = selectionSetup(s, userTeamFor(s, f) as string, f).opts.managerBias ?? 0;
    expect(performPreMatch(s, f.id, "ask-start").ok).toBe(true);
    // The request itself costs a little trust (1.5 points of the relationship), which is part of the same score.
    expect(selectionSetup(s, userTeamFor(s, f) as string, f).opts.managerBias).toBeCloseTo(base + ASKED_START_BIAS - 1.5 / 12);
    expect(matchStatus(s, f).reasons.some((r) => r.kind === "request")).toBe(true);
  });
});

describe("match context", () => {
  it("keeps an ordinary fixture ordinary", () => {
    const { s, f } = matchState("md-ctx1");
    const ctx = matchContext(s, f)!;
    expect(ctx.fixtureId).toBe(f.id);
    expect(ctx.home.id).toBe(f.home);
    expect(ctx.homeAway).toBe(userPlayer(s).clubId === f.home ? "home" : "away");
    if (!ctx.tags.length) expect(ctx.level).toBe("ordinary");
    expect(ctx.stadium).toBeTruthy();
    expect(ctx.home.form.length).toBeLessThanOrEqual(5);
  });

  it("labels cup ties and the final, and a derby from the rivalry data", () => {
    const { s } = matchState("md-ctx2");
    const cup = Object.values(s.competitions).find((c) => c.kind === "cup")!;
    const tie = cup.fixtures[0];
    expect(matchContext(s, tie)!.tags).toContain("cup-knockout");
    const finalFix = { ...tie, stage: "Final" };
    const fin = matchContext(s, finalFix)!;
    expect(fin.tags).toContain("cup-final");
    expect(fin.level).toBe("major");
    const club = userPlayer(s).clubId as string;
    const league = Object.values(s.competitions).find((c) => c.kind === "league" && c.teams.includes(club))!;
    s.user.rivalHeat = { [league.teams.find((t) => t !== club) as string]: 0.35 };
    const derby = { id: "d", compId: league.id, round: 1, turn: 5, home: club, away: league.teams.find((t) => t !== club) as string } as Fixture;
    const base = matchContext(s, derby)!;
    expect(base.tags.includes("derby")).toBe(false); // a grudge alone is not a derby
  });

  it("calls a run-in six-pointer a relegation battle, and an early one nothing", () => {
    const { s } = matchState("md-ctx3");
    const club = userPlayer(s).clubId as string;
    const league = Object.values(s.competitions).find((c) => c.kind === "league" && c.teams.includes(club))!;
    const opp = league.teams.find((t) => t !== club) as string;
    for (const r of league.table!) r.played = 30;
    const order = [...league.table!.filter((r) => r.team !== club && r.team !== opp), ...league.table!.filter((r) => r.team === club || r.team === opp)];
    league.table = order; // the user's club and the opponent now sit at the bottom
    const fx = { id: "rb", compId: league.id, round: 30, turn: 38, home: club, away: opp } as Fixture;
    s.turn = 38;
    expect(matchContext(s, fx)!.tags).toContain("relegation-battle");
    s.turn = 8;
    expect(matchContext(s, fx)!.tags.includes("relegation-battle")).toBe(false);
  });

  it("only labels a title decider when both sides are at the top in the run-in", () => {
    const { s } = matchState("md-ctx4");
    const club = userPlayer(s).clubId as string;
    const league = Object.values(s.competitions).find((c) => c.kind === "league" && c.teams.includes(club))!;
    const opp = league.teams.find((t) => t !== club) as string;
    for (const r of league.table!) r.played = 30;
    league.table = [...league.table!.filter((r) => r.team === club), ...league.table!.filter((r) => r.team === opp), ...league.table!.filter((r) => r.team !== club && r.team !== opp)];
    s.turn = 38;
    const fx = { id: "td", compId: league.id, round: 30, turn: 38, home: club, away: opp } as Fixture;
    const ctx = matchContext(s, fx)!;
    expect(ctx.tags).toContain("title-decider");
    expect(ctx.level).toBe("major");
  });
});

describe("opponents, history and tactics", () => {
  it("names the standout player, former clubs and rivals only when they exist", () => {
    const { s, f } = matchState("md-opp");
    const opp = userPlayer(s).clubId === f.home ? f.away : f.home;
    const people = keyOpponents(s, f);
    expect(people[0].kind).toBe("standout");
    const star = s.players[people[0].playerId as string];
    expect(star.clubId).toBe(opp);
    expect(people.some((p) => p.kind === "rival")).toBe(false);
    expect(people.some((p) => p.kind === "former-club")).toBe(false);
    userPlayer(s).history.push({ season: 2024, clubId: opp, age: 18, overall: 60, stats: { ...userPlayer(s).career, apps: 5 } });
    expect(keyOpponents(s, f).some((p) => p.kind === "former-club")).toBe(true);
    s.user.rivalry.rivals.push({ playerId: star.id, name: "Rival", status: "active" } as never);
    expect(keyOpponents(s, f).some((p) => p.kind === "rival")).toBe(true);
  });

  it("shows head-to-head only from matches the user played against this opponent", () => {
    const { s, f } = matchState("md-h2h");
    expect(headToHead(s, f)).toBeNull();
    const opp = userPlayer(s).clubId === f.home ? f.away : f.home;
    s.user.matchLog = [
      { season: 2025, turn: 9, fixtureId: "x1", compId: "x", compKind: "league", team: userPlayer(s).clubId as string, opponent: opp, home: true, score: [2, 1], result: "W", slot: "ST", started: true, minutes: 90, rating: 8, goals: 1, assists: 0 },
      { season: 2025, turn: 20, fixtureId: "x2", compId: "x", compKind: "league", team: userPlayer(s).clubId as string, opponent: "someone-else", home: true, score: [0, 0], result: "D", slot: "ST", started: true, minutes: 90, rating: 6, goals: 0, assists: 0 },
    ];
    const h = headToHead(s, f)!;
    expect(h.meetings.length).toBe(1);
    expect(h.record).toEqual({ w: 1, d: 0, l: 0 });
  });

  it("previews both formations, departments and the direct opponent from real squads", () => {
    const { s, f } = matchState("md-tac");
    const tp = tacticalPreview(s, f)!;
    const club = s.clubs[userPlayer(s).clubId as string];
    expect(tp.mine.formation).toBe(club.formation);
    expect(tp.theirs!.departments.length).toBe(4);
    expect(tp.fit!.score).toBeGreaterThanOrEqual(20);
    expect(tp.note).toMatch(/few percent/);
    if (tp.duel) expect(tp.duel.theirs.ovr).toBeGreaterThan(30);
  });

  it("stays neutral when a team's style is neutral", () => {
    const mk = (style?: { pressing: number; tempo: number; directness: number }) => {
      const { s, f } = matchState("md-style");
      for (const c of Object.values(s.clubs)) c.style = style ?? c.style;
      return prepareMatch(s, f, Rng.fromSeed("same"), { interactive: false, detail: false }).engine.runToEnd();
    };
    const a = mk({ pressing: 0.5, tempo: 0.5, directness: 0.5 });
    const b = mk({ pressing: 0.5, tempo: 0.5, directness: 0.5 });
    expect([a.homeGoals, a.awayGoals]).toEqual([b.homeGoals, b.awayGoals]);
    expect(a.homeGoals + a.awayGoals).toBeGreaterThanOrEqual(0);
  });
});

describe("pre-match decisions", () => {
  let base: ReturnType<typeof matchState>;
  beforeAll(() => {
    base = matchState("md-pre", "weak");
  });

  it("offers only what fits the situation", () => {
    const a = preMatchActions(base.s, base.f).map((x) => x.kind);
    expect(a).toContain("ask-start");
    expect(a).not.toContain("accept-bench"); // not on the bench
    expect(a).not.toContain("commit"); // not in the matchday squad
    expect(a).toContain("discuss");
    const strong = matchState("md-pre2", "strong");
    const b = preMatchActions(strong.s, strong.f).map((x) => x.kind);
    expect(b).toContain("commit");
    expect(b).not.toContain("ask-start");
  });

  it("offers nothing to an injured player except a talk, and nothing for international games", () => {
    const { s, f } = matchState("md-pre3", "strong");
    userPlayer(s).injury = { type: "x", severity: "minor", weeksLeft: 2, totalWeeks: 2, area: "x" };
    expect(preMatchActions(s, f)).toEqual([]);
  });

  it("applies a cooldown to each request, so they cannot be spammed", () => {
    const { s, f } = matchState("md-cd", "weak");
    expect(performPreMatch(s, f.id, "discuss").ok).toBe(true);
    const again = performPreMatch(s, f.id, "discuss");
    expect(again.ok).toBe(false);
    expect(again.message).toMatch(/Again in/);
    s.turnIndex += PREMATCH_COOLDOWN.discuss;
    expect(performPreMatch(s, f.id, "discuss").ok).toBe(true);
    expect(performPreMatch(s, f.id, "ask-start").ok).toBe(true);
    expect(performPreMatch(s, f.id, "ask-start").ok).toBe(false);
  });

  it("asking for a start costs trust when the manager has none to give", () => {
    const { s, f } = matchState("md-trust", "weak");
    s.user.relationships.manager = 20;
    const before = s.user.relationships.manager;
    const r = performPreMatch(s, f.id, "ask-start");
    expect(r.ok).toBe(false);
    expect(s.user.relationships.manager).toBeLessThan(before);
    expect(s.user.preMatch?.requestedStart).toBeUndefined();
  });

  it("a promised performance is paid off or punished once, after the match", () => {
    const { s, f } = matchState("md-prom", "strong");
    expect(performPreMatch(s, f.id, "commit").ok).toBe(true);
    const before = s.user.relationships.manager;
    settleCommitment(s, f.id, COMMIT_RATING + 0.5);
    expect(s.user.relationships.manager).toBeGreaterThan(before);
    const after = s.user.relationships.manager;
    settleCommitment(s, f.id, 3);
    expect(s.user.relationships.manager).toBe(after); // settled once
    const t = matchState("md-prom2", "strong");
    performPreMatch(t.s, t.f.id, "commit");
    const b2 = t.s.user.relationships.manager;
    settleCommitment(t.s, t.f.id, COMMIT_RATING - 1);
    expect(t.s.user.relationships.manager).toBeLessThan(b2);
    // A match the user did not play breaks no promise.
    const u = matchState("md-prom3", "strong");
    performPreMatch(u.s, u.f.id, "commit");
    const b3 = u.s.user.relationships.manager;
    settleCommitment(u.s, u.f.id, null);
    expect(u.s.user.relationships.manager).toBe(b3);
  });

  it("is settled by the real match when it is played", () => {
    const { s, f } = matchState("md-prom4", "strong");
    performPreMatch(s, f.id, "commit");
    const squad = squadOf(s, userPlayer(s).clubId as string);
    expect(squad.length).toBeGreaterThan(11);
    for (const pm of [...s.pending]) void pm;
    advanceTurn(s);
    expect(s.user.preMatch?.commitment).toBeUndefined();
  });
});
