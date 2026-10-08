import { describe, expect, it } from "vitest";
import { advanceTurn } from "../src/engine/season/advance";
import { affinityAt, closeStint, currentStint, formerManagerAt, influentialManager, markSeen, noteStintMatch, playedUnder, relLabel, sanitizeManagerState, stintsWith, withManager, DEFINING, IMPORTANT } from "../src/engine/managers/history";
import { replaceManager, vacate, fill, seasonBoundaryManagers } from "../src/engine/managers/movement";
import { duplicateManagers, ensureManagerIds, openTenureOf, recordOf, registerManager, openTenure } from "../src/engine/managers/registry";
import { announceFormerManagers, onManagerChangedAtUserClub, onMatchAgainstFormerManager, onUserJoinedClub } from "../src/engine/managers/story";
import { assessSaga } from "../src/engine/career/saga/eligibility";
import { generateUserOffers } from "../src/engine/career/offers";
import { formerManagerContext, matchContext } from "../src/engine/season/preview";
import { hireManager, managerPool, releaseManager } from "../src/engine/world/managers";
import { Rng } from "../src/engine/rng";
import type { Fixture, GameState } from "../src/engine/types";
import { addToSquad, removeFromSquad, userPlayer } from "../src/engine/world/helpers";
import { decodeState, encodeState } from "../src/persistence/codec";
import { migrateState } from "../src/persistence/migrations";
import { computeLegacy } from "../src/engine/career/legacy";
import { newCareer, strongUser } from "./helpers";

const rng = () => Rng.fromSeed("mgr");
const clubOf = (s: GameState) => s.clubs[userPlayer(s).clubId as string];

/** Plays n senior games under whoever is in charge now. */
function play(s: GameState, n: number, starts = true) {
  for (let i = 0; i < n; i++) noteStintMatch(s, userPlayer(s).clubId as string, starts, i % 5 === 0 ? 1 : 0);
}

/** Moves the user to another club the way a transfer does: leave, join, then the club-specific hooks. */
function transferTo(s: GameState, clubId: string) {
  const p = userPlayer(s);
  removeFromSquad(s, p.id);
  addToSquad(s, p.id, clubId);
  p.contract = { ...p.contract!, clubId };
  s.user.relationships.manager = 52;
  onUserJoinedClub(s, clubId);
}

const otherClub = (s: GameState, not: string[] = []) => Object.values(s.clubs).find((c) => c.id !== userPlayer(s).clubId && !not.includes(c.id))!;

describe("manager identity and tenure", () => {
  it("gives every club's manager a stable id and one open tenure at that club", () => {
    const s = newCareer({ seed: "mt-1" });
    for (const c of Object.values(s.clubs)) {
      expect(c.manager.id).toBeTruthy();
      const t = openTenureOf(s, c.manager.id);
      expect(t?.clubId).toBe(c.id);
      expect(t?.inherited).toBe(true);
      expect(recordOf(s, c.manager.id)?.name).toBe(c.manager.name);
    }
    expect(duplicateManagers(s)).toEqual([]);
    expect(new Set(Object.values(s.clubs).map((c) => c.manager.id)).size).toBe(Object.keys(s.clubs).length);
  });

  it("records an appointment and a departure, and keeps the finished tenure", () => {
    const s = newCareer({ seed: "mt-2" });
    const club = otherClub(s);
    const oldId = club.manager.id as string;
    s.season = 2028;
    s.turn = 20;
    replaceManager(s, rng(), club, "sacked");
    const old = recordOf(s, oldId)!;
    const done = old.tenures[old.tenures.length - 1];
    expect(done.to).toEqual({ season: 2028, turn: 20 });
    expect(done.reason).toBe("sacked");
    expect(done.clubId).toBe(club.id);
    const next = openTenureOf(s, club.manager.id)!;
    expect(next.clubId).toBe(club.id);
    expect(next.from).toEqual({ season: 2028, turn: 20 });
    expect(club.manager.id).not.toBe(oldId);
    expect(managerPool(s).some((m) => m.id === oldId)).toBe(true);
    expect(openTenureOf(s, oldId)).toBeUndefined();
  });

  it("lets a manager move club without losing the previous tenure, and never run two clubs", () => {
    const s = newCareer({ seed: "mt-3" });
    const a = otherClub(s);
    const b = otherClub(s, [a.id]);
    const mover = { ...a.manager };
    const moverId = mover.id as string;
    vacate(s, a, "moved", b.id);
    vacate(s, b, "sacked");
    fill(s, rng(), b, b.manager.id, "sacked", mover);
    fill(s, rng(), a, moverId, "moved");
    const rec = recordOf(s, moverId)!;
    expect(rec.tenures.map((t) => t.clubId)).toEqual([a.id, b.id]);
    expect(rec.tenures[0].reason).toBe("moved");
    expect(rec.tenures[0].movedTo).toBe(b.id);
    expect(rec.tenures.filter((t) => !t.to).length).toBe(1);
    expect(duplicateManagers(s)).toEqual([]);
    expect(a.manager.id).not.toBe(moverId);
  });

  it("closes an open tenure before opening another for the same manager", () => {
    const s = newCareer({ seed: "mt-4" });
    const a = otherClub(s);
    const id = a.manager.id as string;
    const b = otherClub(s, [a.id]);
    openTenure(s, id, b.id);
    const rec = recordOf(s, id)!;
    expect(rec.tenures.filter((t) => !t.to).length).toBe(1);
    expect(rec.tenures[0].reason).toBe("moved");
  });

  it("retires a manager for good: no pool, no new job", () => {
    const s = newCareer({ seed: "mt-5" });
    const club = otherClub(s);
    const id = club.manager.id as string;
    vacate(s, club, "retired");
    expect(recordOf(s, id)?.retired).toBe(s.season);
    expect(managerPool(s).some((m) => m.id === id)).toBe(false);
    expect(recordOf(s, id)!.tenures[0].reason).toBe("retired");
  });

  it("reviews standing a little at a time, and ends the season's tenures in the season they belong to", () => {
    const s = newCareer({ seed: "mt-6" });
    for (let i = 0; i < 46; i++) advanceTurn(s);
    const before = Object.fromEntries(Object.values(s.clubs).map((c) => [c.id, c.manager.quality]));
    const report = seasonBoundaryManagers(s, rng(), new Set(), new Set());
    for (const c of Object.values(s.clubs)) if (before[c.id] !== undefined && c.manager.id) expect(Math.abs(c.manager.quality - before[c.id])).toBeLessThanOrEqual(8);
    expect(report.sacked + report.resigned + report.retired + report.moved).toBeLessThan(Object.keys(s.clubs).length * 0.3);
    expect(duplicateManagers(s)).toEqual([]);
    for (const c of Object.values(s.clubs)) expect(openTenureOf(s, c.manager.id)?.clubId).toBe(c.id);
  });
});

describe("the user's history with managers", () => {
  it("opens a stint for the manager in charge when the career starts", () => {
    const s = newCareer({ seed: "pm-1" });
    const st = currentStint(s)!;
    expect(st.managerId).toBe(clubOf(s).manager.id);
    expect(st.clubId).toBe(clubOf(s).id);
    expect(st.apps).toBe(0);
    expect(playedUnder(s, st.managerId)).toBe(false); // no appearance yet: not a former manager
  });

  it("only counts a manager the user genuinely played under", () => {
    const s = newCareer({ seed: "pm-2" });
    const first = clubOf(s).manager.id as string;
    expect(formerManagerAt(s, clubOf(s).id)).toBeNull();
    play(s, 12);
    expect(playedUnder(s, first)).toBe(true);
    // The manager who was at the next club before the user arrived is not a former manager.
    const dest = otherClub(s);
    const before = dest.manager.id as string;
    transferTo(s, dest.id);
    expect(playedUnder(s, before)).toBe(false);
    play(s, 3);
    expect(playedUnder(s, before)).toBe(true);
    // A manager who arrives after the user left never counts.
    const left = s.clubs[currentStint(s)!.clubId];
    transferTo(s, otherClub(s, [dest.id]).id);
    replaceManager(s, rng(), left, "sacked");
    expect(playedUnder(s, left.manager.id)).toBe(false);
  });

  it("keeps separate stints for successive managers at one club", () => {
    const s = newCareer({ seed: "pm-3" });
    const club = clubOf(s);
    const m1 = club.manager.id as string;
    play(s, 10);
    s.turn = 20;
    replaceManager(s, rng(), club, "sacked");
    const m2 = club.manager.id as string;
    play(s, 4);
    const stints = s.user.mgr!.stints;
    expect(stints.map((x) => x.managerId)).toEqual([m1, m2]);
    expect(stints[0].apps).toBe(10);
    expect(stints[0].ended).toBe("sacked");
    expect(stints[0].to).toEqual({ season: s.season, turn: 20 });
    expect(stints[1].apps).toBe(4);
    expect(currentStint(s)?.managerId).toBe(m2);
  });

  it("joins a manager's two spells at different clubs into one shared history", () => {
    const s = newCareer({ seed: "pm-4" });
    const a = clubOf(s);
    const m = a.manager.id as string;
    play(s, 20);
    const b = otherClub(s);
    // The manager moves to B (B's manager goes); the user later joins B and plays under him again.
    const mover = { ...a.manager };
    vacate(s, a, "moved", b.id);
    vacate(s, b, "sacked");
    fill(s, rng(), b, b.manager.id, "sacked", mover);
    fill(s, rng(), a, m, "moved");
    transferTo(s, b.id);
    play(s, 15);
    const w = withManager(s, m)!;
    expect(w.clubs).toEqual([a.id, b.id]);
    expect(w.apps).toBe(35);
    expect(w.reunited).toBe(true);
    expect(stintsWith(s, m).length).toBe(2);
  });

  it("gives a manager with whom there is no real history no standing at all", () => {
    const s = newCareer({ seed: "pm-5" });
    play(s, 4);
    expect(influentialManager(s)).toBeNull();
    expect(withManager(s, otherClub(s).manager.id as string)).toBeNull();
  });
});

describe("historical and active relationships", () => {
  it("keeps the relationship as it stood when the two parted, and resets the active one for the successor", () => {
    const s = newCareer({ seed: "rl-1" });
    const club = clubOf(s);
    const m1 = club.manager.id as string;
    play(s, 12);
    s.user.relationships.manager = 81;
    replaceManager(s, rng(), club, "sacked");
    const old = stintsWith(s, m1)[0];
    expect(old.relEnd).toBe(81);
    expect(relLabel(81)).toBe("Excellent");
    expect(s.user.relationships.manager).toBe(50); // active: the new manager starts neutral
    // The bar now belongs to the new manager: moving it does not touch history.
    s.user.relationships.manager = 12;
    expect(stintsWith(s, m1)[0].relEnd).toBe(81);
    expect(withManager(s, m1)!.rel).toBe(81);
    expect(withManager(s, m1)!.label).toBe("Excellent");
  });

  it("starts a reunion warm after a strong past, cool after a poor one, and lets it move after that", () => {
    const warm = newCareer({ seed: "rl-2" });
    const a = clubOf(warm);
    const m = a.manager.id as string;
    play(warm, 30);
    warm.user.relationships.manager = 85;
    const b = otherClub(warm);
    const mover = { ...a.manager };
    vacate(warm, a, "moved", b.id);
    vacate(warm, b, "sacked");
    fill(warm, rng(), b, b.manager.id, "sacked", mover);
    fill(warm, rng(), a, m, "moved");
    transferTo(warm, b.id);
    expect(warm.user.relationships.manager).toBeGreaterThan(52);
    expect(currentStint(warm)!.reunion).toBe(true);
    warm.user.relationships.manager = 30; // a bad run: the new relationship is free to fall
    expect(warm.user.relationships.manager).toBe(30);

    const cold = newCareer({ seed: "rl-3" });
    const ca = clubOf(cold);
    const cm = ca.manager.id as string;
    play(cold, 30);
    cold.user.relationships.manager = 15;
    const cb = otherClub(cold);
    const cmover = { ...ca.manager };
    vacate(cold, ca, "moved", cb.id);
    vacate(cold, cb, "sacked");
    fill(cold, rng(), cb, cb.manager.id, "sacked", cmover);
    fill(cold, rng(), ca, cm, "moved");
    transferTo(cold, cb.id);
    expect(cold.user.relationships.manager).toBeLessThan(52);
    expect(cold.user.relationships.manager).toBeGreaterThanOrEqual(40);
  });

  it("never reapplies the old relationship to the active bar after he has gone", () => {
    const s = newCareer({ seed: "rl-4" });
    const club = clubOf(s);
    play(s, 12);
    replaceManager(s, rng(), club, "resigned");
    const act = s.user.relationships.manager;
    for (let i = 0; i < 6; i++) advanceTurn(s);
    expect(Math.abs(s.user.relationships.manager - act)).toBeLessThan(25);
  });
});

describe("Match Day: former manager", () => {
  function reunionSetup(seed: string) {
    const s = newCareer({ seed });
    strongUser(s);
    const a = clubOf(s);
    const m = a.manager.id as string;
    play(s, 40);
    s.user.relationships.manager = 80;
    s.user.mgr!.stints[0].honours.league = 2;
    const b = otherClub(s);
    const mover = { ...a.manager };
    vacate(s, a, "moved", b.id);
    vacate(s, b, "sacked");
    fill(s, rng(), b, b.manager.id, "sacked", mover);
    fill(s, rng(), a, m, "moved");
    // The user is now with A under a new manager; B is managed by the old boss.
    return { s, a, b, m };
  }
  const fixture = (s: GameState, opp: string): Fixture => {
    const club = clubOf(s);
    const league = Object.values(s.competitions).find((c) => c.kind === "league" && c.teams.includes(club.id))!;
    return { id: `fx-${opp}`, compId: league.id, round: 1, turn: 6, home: club.id, away: opp };
  };

  it("shows the former manager with real facts, and recognises the first meeting", () => {
    const { s, b } = reunionSetup("md-fm1");
    const ctx = formerManagerContext(s, fixture(s, b.id))!;
    expect(ctx).toBeTruthy();
    expect(ctx.name).toBe(b.manager.name);
    expect(ctx.together).toMatch(/You played under/);
    expect(ctx.apps).toBe(40);
    expect(ctx.honours.league).toBe(2);
    expect(ctx.honoursText).toMatch(/2 league titles/);
    expect(ctx.relationship).toBe("Excellent");
    expect(ctx.first).toBe(true);
    expect(ctx.headline).toMatch(/first time since leaving/);
    expect(matchContext(s, fixture(s, b.id))!.tags).toContain("former-boss");
  });

  it("does not appear for an ordinary manager or for the user's own manager", () => {
    const { s, a, b } = reunionSetup("md-fm2");
    const other = otherClub(s, [a.id, b.id]);
    expect(formerManagerContext(s, fixture(s, other.id))).toBeNull();
    expect(matchContext(s, fixture(s, other.id))!.tags).not.toContain("former-boss");
  });

  it("counts repeat meetings and words them differently", () => {
    const { s, b } = reunionSetup("md-fm3");
    const f = fixture(s, b.id);
    const league = s.competitions[f.compId];
    onMatchAgainstFormerManager(s, f, league, 1, true);
    onMatchAgainstFormerManager(s, { ...f, id: "fx2" }, league, 0, false);
    const ctx = formerManagerContext(s, { ...f, id: "fx3" })!;
    expect(ctx.first).toBe(false);
    expect(ctx.meeting).toBe(3);
    expect(ctx.headline).toMatch(/Third meeting/);
  });

  it("notes when the opposition is also a former club", () => {
    const { s, b } = reunionSetup("md-fm4");
    userPlayer(s).history.push({ season: 2025, clubId: b.id, age: 19, overall: 60, stats: { ...userPlayer(s).career, apps: 6 } });
    expect(formerManagerContext(s, fixture(s, b.id))!.alsoFormerClub).toBe(true);
  });

  it("does not treat a manager from a few weeks as a big event", () => {
    const s = newCareer({ seed: "md-fm5" });
    const a = clubOf(s);
    play(s, 2);
    const b = otherClub(s);
    const mover = { ...a.manager };
    vacate(s, a, "moved", b.id);
    vacate(s, b, "sacked");
    fill(s, rng(), b, b.manager.id, "sacked", mover);
    fill(s, rng(), a, mover.id, "moved");
    const ctx = formerManagerContext(s, fixture(s, b.id))!;
    expect(ctx.importance).toBeLessThan(IMPORTANT);
    expect(matchContext(s, fixture(s, b.id))!.tags).not.toContain("former-boss");
    expect(s.user.memories.some((m) => m.kind === "manager-bond")).toBe(false);
  });
});

describe("transfers and sagas", () => {
  function strongBond(seed: string) {
    const s = newCareer({ seed });
    const a = clubOf(s);
    const m = a.manager.id as string;
    play(s, 60);
    s.user.mgr!.stints[0].events.push({ k: "breakthrough", s: 2026, t: 10 });
    s.user.relationships.manager = 85;
    const b = otherClub(s);
    const mover = { ...a.manager };
    vacate(s, a, "moved", b.id);
    vacate(s, b, "sacked");
    fill(s, rng(), b, b.manager.id, "sacked", mover);
    fill(s, rng(), a, m, "moved");
    return { s, a, b, m };
  }

  it("is a small, bounded nudge: warmer for a strong past, cooler for a poor one, nothing for strangers", () => {
    const { s, b } = strongBond("tr-1");
    const strong = affinityAt(s, b.id)!;
    expect(strong.kind).toBe("strong");
    expect(strong.factor).toBeGreaterThan(1);
    expect(strong.factor).toBeLessThanOrEqual(1.2);
    expect(affinityAt(s, otherClub(s, [b.id, clubOf(s).id]).id)).toBeNull();
    s.user.mgr!.stints[0].relEnd = 10;
    const poor = affinityAt(s, b.id)!;
    expect(poor.kind).toBe("poor");
    expect(poor.factor).toBeLessThan(1);
    expect(poor.factor).toBeGreaterThanOrEqual(0.7);
    s.user.mgr!.stints[0].relEnd = 50;
    expect(affinityAt(s, b.id)).toBeNull();
  });

  it("never guarantees an offer: with no ability to interest the club, a strong past still produces nothing", () => {
    const { s, b } = strongBond("tr-2");
    const p = userPlayer(s);
    for (const k of Object.keys(p.attrs)) (p.attrs as Record<string, number>)[k] = 30;
    p.reputation = 5;
    s.turn = 3;
    for (let i = 0; i < 30; i++) generateUserOffers(s, Rng.fromSeed(`o${i}`));
    expect(s.user.offers.some((o) => o.fromClubId === b.id)).toBe(false);
  });

  it("can lift interest modestly for a player the club would want anyway", () => {
    const { s, b } = strongBond("tr-3");
    const p = userPlayer(s);
    strongUser(s);
    p.reputation = 90;
    s.turn = 3;
    for (const c of Object.values(s.clubs)) c.balance = 5e9;
    let withBond = 0;
    let without = 0;
    for (let i = 0; i < 80; i++) {
      s.user.offers = [];
      generateUserOffers(s, Rng.fromSeed(`b${i}`));
      withBond += s.user.offers.filter((o) => o.fromClubId === b.id).length;
    }
    s.user.mgr!.stints[0].relEnd = 50;
    for (let i = 0; i < 80; i++) {
      s.user.offers = [];
      generateUserOffers(s, Rng.fromSeed(`b${i}`));
      without += s.user.offers.filter((o) => o.fromClubId === b.id).length;
    }
    expect(withBond).toBeGreaterThanOrEqual(without);
    expect(withBond).toBeLessThanOrEqual(80);
  });

  it("lets the saga assessment mention a reunion, and a poor past complicate talks, without creating a saga", () => {
    const { s, b } = strongBond("tr-4");
    strongUser(s);
    userPlayer(s).reputation = 90;
    s.turn = 3;
    const good = assessSaga(s, b, "transfer", 20e6);
    expect(good.reasons).toContain("Former manager pushes for a reunion");
    s.user.mgr!.stints[0].relEnd = 12;
    const bad = assessSaga(s, b, "transfer", 20e6);
    expect(bad.reasons).toContain("Previous relationship complicates negotiations");
    expect(bad.score).toBeLessThan(good.score);
    expect(s.user.sagas.length).toBe(0); // assessing never starts one
  });
});

describe("news and memories", () => {
  it("does not make a memory or loud news for an ordinary manager change", () => {
    const s = newCareer({ seed: "nm-1" });
    const club = clubOf(s);
    play(s, 3);
    const mems = s.user.memories.length;
    replaceManager(s, rng(), club, "sacked");
    expect(s.user.memories.length).toBe(mems);
    expect(s.news.filter((n) => /sacked/.test(n.title)).length).toBe(1);
  });

  it("remembers the departure of a manager who mattered, once", () => {
    const s = newCareer({ seed: "nm-2" });
    const club = clubOf(s);
    play(s, 90);
    s.user.mgr!.stints[0].honours.league = 1;
    s.user.mgr!.stints[0].events.push({ k: "breakthrough", s: 2026, t: 12 });
    s.turn = 30;
    s.season = 2028;
    const id = club.manager.id as string;
    replaceManager(s, rng(), club, "sacked");
    const dep = s.user.memories.filter((m) => m.kind === "manager-bond" && m.data?.event === "departure");
    expect(dep.length).toBe(1);
    expect(dep[0].data?.name).toBe(recordOf(s, id)!.name);
    onManagerChangedAtUserClub(s, club, id, "sacked"); // the same event again
    expect(s.user.memories.filter((m) => m.kind === "manager-bond" && m.data?.event === "departure").length).toBe(1);
    expect(s.news.filter((n) => n.title.includes("sacked")).length).toBe(1);
  });

  it("marks a first reunion on the pitch with one memory, and posts the pre-match news once", () => {
    const s = newCareer({ seed: "nm-3" });
    const a = clubOf(s);
    const m = a.manager.id as string;
    play(s, 90);
    s.user.mgr!.stints[0].honours.league = 2;
    s.user.relationships.manager = 80;
    const b = otherClub(s);
    const mover = { ...a.manager };
    vacate(s, a, "moved", b.id);
    vacate(s, b, "sacked");
    fill(s, rng(), b, b.manager.id, "sacked", mover);
    fill(s, rng(), a, m, "moved");
    const league = Object.values(s.competitions).find((c) => c.kind === "league" && c.teams.includes(a.id))!;
    const f: Fixture = { id: "reun", compId: league.id, round: 3, turn: s.turn, home: a.id, away: b.id };
    league.fixtures.push(f);
    s.pending = [{ fixtureId: "reun", compId: league.id }];
    announceFormerManagers(s);
    announceFormerManagers(s);
    expect(s.news.filter((n) => n.title === "Former boss comes to town").length).toBe(1);
    onMatchAgainstFormerManager(s, f, league, 1, true);
    onMatchAgainstFormerManager(s, { ...f, id: "reun2" }, league, 1, true);
    expect(s.user.memories.filter((x) => x.kind === "manager-bond" && x.data?.event === "reunion-match").length).toBe(1);
    expect(s.user.mgr!.meetings[m]).toBe(2);
  });

  it("tells the user when they are reunited at a club, once", () => {
    const s = newCareer({ seed: "nm-4" });
    const a = clubOf(s);
    const m = a.manager.id as string;
    play(s, 90);
    s.user.mgr!.stints[0].events.push({ k: "breakthrough", s: 2026, t: 12 });
    s.user.mgr!.stints[0].honours.cup = 1;
    const b = otherClub(s);
    const mover = { ...a.manager };
    vacate(s, a, "moved", b.id);
    vacate(s, b, "sacked");
    fill(s, rng(), b, b.manager.id, "sacked", mover);
    fill(s, rng(), a, m, "moved");
    transferTo(s, b.id);
    expect(s.news.some((n) => n.title === "Back together")).toBe(true);
    onUserJoinedClub(s, b.id);
    expect(s.news.filter((n) => n.title === "Back together").length).toBe(1);
    expect(s.user.memories.filter((x) => x.kind === "manager-bond" && x.data?.event === "reunited").length).toBe(1);
  });

  it("dedupes with markSeen", () => {
    const s = newCareer({ seed: "nm-5" });
    expect(markSeen(s, "k")).toBe(true);
    expect(markSeen(s, "k")).toBe(false);
  });
});

describe("retirement and influence", () => {
  it("names a defining manager only when the evidence is strong", () => {
    const s = newCareer({ seed: "rt-1" });
    play(s, 20);
    expect(computeLegacy(s).influentialManager).toBeUndefined();
    const st = s.user.mgr!.stints[0];
    st.apps = 140;
    st.starts = 130;
    st.honours.league = 2;
    st.events.push({ k: "breakthrough", s: 2026, t: 10 }, { k: "captain", s: 2028, t: 5 });
    st.relStart = 60;
    s.season = 2031;
    closeStint(s, "sacked");
    st.relEnd = 82;
    const w = withManager(s, st.managerId)!;
    expect(w.importance).toBeGreaterThanOrEqual(DEFINING);
    const legacy = computeLegacy(s);
    expect(legacy.influentialManager?.managerId).toBe(st.managerId);
    expect(legacy.influentialManager?.lines.join(" ")).toMatch(/breakthrough/);
    expect(legacy.influentialManager?.lines.join(" ")).toMatch(/Relationship: Excellent/);
    expect(legacy.influentialManager?.lines.join(" ")).toMatch(/2 league titles/);
  });

  it("picks the manager with the most shared history, not simply the last one", () => {
    const s = newCareer({ seed: "rt-2" });
    play(s, 5);
    const first = s.user.mgr!.stints[0];
    first.apps = 120;
    first.honours.league = 3;
    first.events.push({ k: "breakthrough", s: 2026, t: 10 });
    first.to = { season: 2030, turn: 5 };
    first.relEnd = 70;
    transferTo(s, otherClub(s).id);
    play(s, 30);
    expect(influentialManager(s)?.managerId).toBe(first.managerId);
  });
});

describe("persistence and sanitising", () => {
  it("survives a save and reload without repeating an appointment or event", () => {
    const s = newCareer({ seed: "ps-1" });
    play(s, 30);
    replaceManager(s, rng(), clubOf(s), "sacked");
    const back = migrateState(JSON.parse(JSON.stringify(decodeState(encodeState(s)))));
    expect(back.user.mgr!.stints).toEqual(JSON.parse(JSON.stringify(s.user.mgr!.stints)));
    expect(back.managers).toEqual(JSON.parse(JSON.stringify(s.managers)));
    const news = back.news.length;
    const tenures = Object.values(back.managers!).reduce((n, r) => n + r.tenures.length, 0);
    migrateState(JSON.parse(JSON.stringify(decodeState(encodeState(back)))));
    expect(back.news.length).toBe(news);
    expect(Object.values(back.managers!).reduce((n, r) => n + r.tenures.length, 0)).toBe(tenures);
  });

  it("upgrades an old save: ids and tenures from today, no invented history, current relationship kept", () => {
    const raw = JSON.parse(JSON.stringify(newCareer({ seed: "ps-2" })));
    raw.schemaVersion = 10;
    delete raw.managers;
    delete raw.user.mgr;
    delete raw.user.jersey;
    for (const c of Object.values(raw.clubs) as { manager: { id?: string } }[]) delete c.manager.id;
    for (const p of Object.values(raw.players) as { squadNo?: number }[]) delete p.squadNo;
    raw.user.relationships.manager = 71;
    const m = migrateState(raw);
    expect(Object.values(m.clubs).every((c) => !!c.manager.id && !!openTenureOf(m, c.manager.id))).toBe(true);
    expect(duplicateManagers(m)).toEqual([]);
    const st = m.user.mgr!.stints;
    expect(st.length).toBe(1);
    expect(st[0].apps).toBe(0);
    expect(st[0].relStart).toBe(71);
    expect(m.user.relationships.manager).toBe(71);
    expect(playedUnder(m, st[0].managerId)).toBe(false); // nothing is claimed about the unrecorded past
    expect(Object.values(m.managers!).every((r) => r.tenures.every((t) => t.inherited || t.to || t.from.season >= m.season - 1))).toBe(true);
  });

  it("sanitises malformed stints and ids deterministically", () => {
    const s = newCareer({ seed: "ps-3" });
    play(s, 5);
    s.user.mgr!.stints.push({ managerId: 5 as never, clubId: "x" } as never, { managerId: "m1", clubId: "c", from: { season: 2026, turn: 1 }, relStart: 400, apps: -2, starts: 9, goals: 1, honours: {}, events: [] } as never);
    s.user.mgr!.meetings = { a: -1, b: 3 } as never;
    sanitizeManagerState(s);
    expect(s.user.mgr!.stints.every((x) => typeof x.managerId === "string" && x.apps >= 0)).toBe(true);
    expect(s.user.mgr!.meetings).toEqual({ b: 3 });
    // A manager listed at two clubs keeps one.
    const a = otherClub(s);
    const b = otherClub(s, [a.id]);
    b.manager = { ...a.manager };
    ensureManagerIds(s);
    expect(openTenureOf(s, a.manager.id)).toBeTruthy();
  });

  it("registers new managers with fresh ids", () => {
    const s = newCareer({ seed: "ps-4" });
    const a = registerManager(s, { name: "A B", nationality: "ENG" });
    const b = registerManager(s, { name: "A B", nationality: "ENG" });
    expect(a).not.toBe(b);
  });
});

describe("simulation sanity over several seasons", () => {
  it("keeps turnover sensible, managers unique, and some moving between clubs", () => {
    const s = newCareer({ seed: "sim-m1" });
    const seasons = 9;
    for (let i = 0; i < seasons * 50; i++) {
      advanceTurn(s);
      if (i % 25 === 0) expect(duplicateManagers(s)).toEqual([]);
    }
    const clubs = Object.keys(s.clubs).length;
    const ended = Object.values(s.managers!).flatMap((r) => r.tenures).filter((t) => t.to);
    const perSeason = ended.length / seasons / clubs;
    expect(perSeason).toBeGreaterThan(0.06);
    expect(perSeason).toBeLessThan(0.38);
    const reasons = new Set(ended.map((t) => t.reason));
    expect(reasons.has("sacked")).toBe(true);
    const mobile = Object.values(s.managers!).filter((r) => new Set(r.tenures.map((t) => t.clubId)).size > 1).length;
    expect(mobile).toBeGreaterThan(0);
    for (const c of Object.values(s.clubs)) {
      expect(openTenureOf(s, c.manager.id)?.clubId).toBe(c.id);
      expect(recordOf(s, c.manager.id)!.tenures.filter((t) => !t.to).length).toBe(1);
    }
    // Completed tenures stay put.
    for (const t of ended) expect(t.reason).toBeTruthy();
    // Every pool manager is unemployed.
    const employed = new Set(Object.values(s.clubs).map((c) => c.manager.id));
    for (const m of managerPool(s)) expect(employed.has(m.id)).toBe(false);
  }, 300_000);
});

describe("manager market", () => {
  it("seeds the pool with real free agents who are not already employed", () => {
    const s = newCareer({ countries: ["ENG"] });
    const names = managerPool(s).map((m) => m.name);
    expect(names).toContain("Pep Guardiola");
    expect(names).not.toContain("Graham Potter"); // coaching Sweden in the snapshot
  });

  it("clubs hire coaches of similar standing and sacked managers become available", () => {
    const s = newCareer({ countries: ["ENG"] });
    const r = Rng.fromSeed("hire");
    const small = Object.values(s.clubs).sort((a, b) => a.reputation - b.reputation)[0];
    for (let i = 0; i < 20; i++) expect(hireManager(s, r, small, "ENG").quality).toBeLessThanOrEqual(small.reputation + 8 + 30);
    expect(managerPool(s).some((m) => m.name === "Pep Guardiola")).toBe(true);
    const big = Object.values(s.clubs).sort((a, b) => b.reputation - a.reputation)[0];
    const old = big.manager;
    releaseManager(s, old);
    expect(managerPool(s).some((m) => m.name === old.name)).toBe(true);
  });
});
