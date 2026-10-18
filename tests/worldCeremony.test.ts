import { beforeAll, describe, expect, it } from "vitest";
import { buildScenes, completeCeremony, setCeremonyStep, startCeremony } from "../src/engine/awards/ceremony";
import { sanitizeCeremony } from "../src/engine/awards/sanitize";
import { calculateWorldAwards, prepareWorldCeremony, settleWorldCeremony, worldCeremonyPending } from "../src/engine/awards/world";
import { ageOf } from "../src/engine/players/generate";
import { advanceTurn, retireUser } from "../src/engine/season/advance";
import { interruptReason, snapshotAttention } from "../src/engine/season/interrupts";
import type { GameState } from "../src/engine/types";
import { checkInvariants } from "../src/engine/validate";
import { userPlayer } from "../src/engine/world/helpers";
import { migrateState } from "../src/persistence/migrations";
import { newCareer } from "./helpers";

let t45: GameState; // the league season has just ended
let t50: GameState; // the last week of the season: the summer final is still to be played
let rolled: GameState; // the first day of the next season

beforeAll(() => {
  const s = newCareer({ seed: "world-gala" });
  for (let i = 0; i < 44; i++) advanceTurn(s);
  t45 = structuredClone(s);
  for (let i = 0; i < 5; i++) advanceTurn(s);
  t50 = structuredClone(s);
  advanceTurn(s);
  rolled = s;
}, 240000);

const fresh = () => structuredClone(rolled);
const world = (s: GameState) => s.worldCeremony!;
const win = (s: GameState, id: string) => world(s).results.find((r) => r.id === id);

describe("why the gala was missing, and when it now happens", () => {
  it("the season is at its last week with no gala yet; it is prepared as the season ends and held on day one of the next", () => {
    expect(t50.turn).toBe(50);
    expect(t50.worldCeremony).toBeUndefined();
    expect(rolled.turn).toBe(1);
    expect(rolled.season).toBe(t50.season + 1);
    expect(world(rolled).kind).toBe("world");
    expect(world(rolled).season).toBe(t50.season);
    expect(world(rolled).status).toBe("ready");
    expect(world(rolled).applied).toBe(false);
    expect(worldCeremonyPending(rolled)).toBe(true);
  });

  it("is separate from the league ceremony, which has long been settled", () => {
    expect(rolled.ceremony?.status).toBe("completed");
    expect(rolled.ceremony?.leagueId).not.toBe("world");
    expect(world(rolled).leagueId).toBe("world");
  });

  it("stops a run on the gala: it outranks the new-season stop it arrives with", () => {
    const s = structuredClone(t50);
    const before = snapshotAttention(s);
    const report = advanceTurn(s, { byDay: true });
    expect(report.newSeason).toBe(true);
    expect(interruptReason(s, before, { newSeason: report.newSeason, stopOnMatch: false })).toBe("world-awards");
  });

  it("a fast-forward from the end of the league season can never run past it unannounced", () => {
    const s = structuredClone(t45);
    const before = snapshotAttention(s);
    let stoppedBy: string | null = null;
    for (let i = 0; i < 12 && !stoppedBy; i++) {
      const report = advanceTurn(s, { byDay: true });
      const why = interruptReason(s, before, { newSeason: report.newSeason, stopOnMatch: false });
      if (report.newSeason && s.season === t50.season + 1) {
        expect(why).toBe("world-awards");
        stoppedBy = why;
      }
    }
    expect(stoppedBy).toBe("world-awards");
    expect(worldCeremonyPending(s)).toBe(true);
  });
});

describe("the awards themselves", () => {
  it("names a winner and nominees for every award, best first, with the winner at the top of the nominees", () => {
    const w = world(rolled);
    expect(w.results.map((r) => r.id)).toContain("golden-pitch");
    for (const r of w.results) {
      expect(r.nominees.length).toBeGreaterThan(0);
      expect(r.winnerId).toBe(r.nominees[0].playerId);
      expect(r.leagueId).toBe("world");
    }
    expect(win(rolled, "golden-pitch")!.tier).toBe("major");
  });

  it("Rising Star is an under-21 and World Goalkeeper a goalkeeper", () => {
    const rs = win(rolled, "rising-star");
    const gk = win(rolled, "world-glove");
    for (const n of rs?.nominees ?? []) expect(n.age).toBeLessThanOrEqual(21);
    for (const n of gk?.nominees ?? []) expect(n.position).toBe("GK");
  });

  it("is deterministic: the same finished season always gives the same result", () => {
    expect(JSON.stringify(calculateWorldAwards(t50))).toBe(JSON.stringify(calculateWorldAwards(structuredClone(t50))));
  });

  it("the winners are in the season archive for the honours roll, as before", () => {
    const entry = rolled.archive.find((a) => a.season === world(rolled).season)!;
    expect(entry.awards.find((a) => a.id === "golden-pitch")?.playerId).toBe(win(rolled, "golden-pitch")!.winnerId);
    expect(entry.awards.some((a) => a.id === "rising-star" || a.id === "world-glove")).toBe(true);
  });

  it("preparing the same season again keeps the gala exactly as it is", () => {
    const s = structuredClone(t50);
    s.turnIndex += 0;
    const first = prepareWorldCeremony(s);
    startCeremony(s, "world");
    setCeremonyStep(s, 2, "world");
    const snap = JSON.stringify(s.worldCeremony);
    expect(JSON.stringify(prepareWorldCeremony(s))).toBe(JSON.stringify(first));
    expect(JSON.stringify(s.worldCeremony)).toBe(snap);
  });
});

describe("consequences happen once, whether watched or skipped", () => {
  it("nothing changes until the gala is attended or skipped; then the winner's standing rises once", () => {
    const s = fresh();
    const winner = s.players[win(s, "golden-pitch")!.winnerId];
    const rep = winner.reputation;
    const intl = winner.intlReputation;
    expect(winner.reputation).toBe(rep);
    expect(completeCeremony(s, "watched", "world")).toBe(true);
    expect(winner.reputation).toBe(Math.min(100, rep + 6));
    expect(winner.intlReputation).toBe(Math.min(100, intl + 8));
    const snap = JSON.stringify([s.user.awards, s.news.length, winner.reputation, s.user.memories, s.user.timeline.length]);
    expect(completeCeremony(s, "skipped", "world")).toBe(false);
    settleWorldCeremony(s);
    completeCeremony(s, "auto", "world");
    expect(JSON.stringify([s.user.awards, s.news.length, winner.reputation, s.user.memories, s.user.timeline.length])).toBe(snap);
    expect(world(s).status).toBe("completed");
    expect(world(s).how).toBe("watched");
  });

  it("watching and skipping give the identical world", () => {
    const a = fresh();
    const b = fresh();
    startCeremony(a, "world");
    for (let i = 1; i < buildScenes(world(a)).length; i++) setCeremonyStep(a, i, "world");
    completeCeremony(a, "watched", "world");
    completeCeremony(b, "skipped", "world");
    const key = (s: GameState) => JSON.stringify([s.user.awards, s.user.awardNoms, s.news.map((n) => n.title), Object.values(s.players).map((p) => [p.reputation, p.intlReputation])]);
    expect(key(a)).toBe(key(b));
  });

  it("carrying on without choosing counts as skipping, and the awards are still given", () => {
    const s = fresh();
    advanceTurn(s);
    expect(world(s).status).toBe("completed");
    expect(world(s).how).toBe("auto");
    expect(world(s).applied).toBe(true);
  });

  it("retiring settles a pending gala", () => {
    const s = fresh();
    retireUser(s, "test");
    expect(world(s).applied).toBe(true);
  });

  it("a user who wins is credited to the season it was won, exactly once, with a memory and news", () => {
    const s = fresh();
    const me = userPlayer(s);
    const r = win(s, "golden-pitch")!;
    r.nominees = [{ ...r.nominees[0], playerId: me.id, clubId: me.clubId, position: me.position, reason: "40 apps · 30G 10A" }, ...r.nominees.slice(1)];
    r.winnerId = me.id;
    const count = () => s.user.awards.filter((a) => a.id === "golden-pitch").length;
    completeCeremony(s, "watched", "world");
    completeCeremony(s, "watched", "world");
    expect(count()).toBe(1);
    expect(s.user.awards.find((a) => a.id === "golden-pitch")!.season).toBe(world(s).season);
    expect(s.news.some((n) => n.title.includes("You win Golden Pitch"))).toBe(true);
    expect(s.user.memories.some((m) => m.tags.includes("golden-pitch"))).toBe(true);
  });

  it("a user in the top three of the voting gets the podium honour and a nomination", () => {
    const s = fresh();
    const me = userPlayer(s);
    const r = win(s, "golden-pitch")!;
    r.nominees[1] = { ...r.nominees[1], playerId: me.id };
    world(s).userRank = 2;
    completeCeremony(s, "skipped", "world");
    expect(s.user.awards.some((a) => a.id === "golden-pitch-podium")).toBe(true);
    expect((s.user.awardNoms ?? []).some((n) => n.id === "golden-pitch" && n.place === 2)).toBe(true);
  });
});

describe("persistence and rollover", () => {
  it("a reload in the middle of the gala resumes where it was", () => {
    const s = fresh();
    startCeremony(s, "world");
    setCeremonyStep(s, 3, "world");
    const back = migrateState(JSON.parse(JSON.stringify(s)));
    expect(back.worldCeremony!.status).toBe("in-progress");
    expect(back.worldCeremony!.step).toBe(3);
    expect(back.worldCeremony!.kind).toBe("world");
    expect(back.ceremony?.kind).toBeUndefined();
  });

  it("a reload after completion can never apply the consequences again", () => {
    const s = fresh();
    completeCeremony(s, "watched", "world");
    const back = migrateState(JSON.parse(JSON.stringify(s)));
    const awards = JSON.stringify(back.user.awards);
    expect(completeCeremony(back, "watched", "world")).toBe(false);
    expect(JSON.stringify(back.user.awards)).toBe(awards);
  });

  it("old saves with no gala load cleanly", () => {
    const s = fresh();
    delete s.worldCeremony;
    sanitizeCeremony(s);
    expect(s.worldCeremony).toBeUndefined();
    expect(worldCeremonyPending(s)).toBe(false);
  });

  it("sanitizes invalid gala data instead of trusting it", () => {
    const s = fresh();
    (s as unknown as Record<string, unknown>).worldCeremony = { season: "x", results: [{ id: "golden-pitch", nominees: [{ playerId: "ghost" }] }], status: "nonsense", step: 99 };
    sanitizeCeremony(s);
    expect(world(s).status).toBe("completed");
    expect(world(s).applied).toBe(true);
    expect(world(s).results).toHaveLength(0);
    (s as unknown as Record<string, unknown>).worldCeremony = "garbage";
    sanitizeCeremony(s);
    expect(s.worldCeremony).toBeUndefined();
  });

  it("each season gets its own gala, the earlier one is kept in the archive, and nothing is awarded twice", () => {
    const s = fresh();
    const first = world(s).season;
    const winnerId = win(s, "golden-pitch")!.winnerId;
    completeCeremony(s, "skipped", "world");
    for (let i = 0; i < 50; i++) advanceTurn(s);
    expect(s.season).toBe(first + 2);
    expect(world(s).season).toBe(first + 1);
    expect(world(s).status).toBe("ready");
    const wins = s.archive.flatMap((a) => a.awards).filter((a) => a.id === "golden-pitch");
    expect(wins.map((a) => a.season).sort()).toEqual([first, first + 1]);
    expect(wins.find((a) => a.season === first)!.playerId).toBe(winnerId);
    expect(checkInvariants(s).issues).toEqual([]);
  }, 240000);

  it("ages are measured for the season the awards belong to", () => {
    for (const n of win(rolled, "rising-star")?.nominees ?? []) expect(ageOf(rolled.players[n.playerId], world(rolled).season)).toBe(n.age);
  });
});
