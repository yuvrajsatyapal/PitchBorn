import { beforeAll, describe, expect, it } from "vitest";
import { adjustRel, relReasons } from "../src/engine/career/relationships";
import { ROLE_LABEL } from "../src/engine/career/offers";
import { clubHistory, clubIdentity, competitionRuns, departments, finances, recentMoves, relationshipInsights, userTacticalFit } from "../src/engine/club/overview";
import { currentObjectives, deriveObjectives, ensureObjectives, objectiveLabel, progressOf, settleObjectives, youthMinutesShare, YOUTH_MINUTES_SHARE } from "../src/engine/club/objectives";
import { rolePromiseBroken, roleView, selectionTrend } from "../src/engine/club/role";
import { continentalSlots, standingOf } from "../src/engine/club/standing";
import { WORLD, staticLeague } from "../src/engine/data/world";
import { partsTotal, scoreParts, selectionScore, tacticalFit, fitFor } from "../src/engine/match/lineup";
import { advanceTurn } from "../src/engine/season/advance";
import type { GameState } from "../src/engine/types";
import { squadOf, userPlayer } from "../src/engine/world/helpers";
import { newCareer, strongUser } from "./helpers";

describe("league position and season context", () => {
  it("is a preseason state before any league game, with no invented position", () => {
    const s = newCareer({ seed: "cl-pre" });
    const st = standingOf(s, userPlayer(s).clubId as string)!;
    expect(st.preseason).toBe(true);
    expect(st.position).toBeNull();
    expect(st.zone).toBe("preseason");
    expect(st.situation).toMatch(/Preseason|under way/);
    expect(st.points).toBe(0);
  });

  it("reads position, points and goal difference from the live table", () => {
    const s = newCareer({ seed: "cl-live" });
    for (let i = 0; i < 16; i++) advanceTurn(s);
    const club = userPlayer(s).clubId as string;
    const st = standingOf(s, club)!;
    const comp = st.comp!;
    const idx = comp.table!.findIndex((r) => r.team === club);
    expect(st.position).toBe(idx + 1);
    expect(st.points).toBe(comp.table![idx].points);
    expect(st.goalDifference).toBe(comp.table![idx].gf - comp.table![idx].ga);
    expect(st.played).toBe(comp.table![idx].played);
    expect(st.form).toEqual(comp.table![idx].form);
    expect(st.situation.length).toBeGreaterThan(5);
  });

  it("describes the zones a club is in from the division's rules", () => {
    const s = newCareer({ seed: "cl-zone" });
    for (let i = 0; i < 16; i++) advanceTurn(s);
    const top = Object.values(s.competitions).find((c) => c.kind === "league" && c.tier === 1)!;
    const lg = staticLeague(top.id.replace(/-\d{4}$/, ""))!;
    const names = top.table!.map((r) => r.team);
    expect(standingOf(s, names[0])!.zone).toBe("title");
    expect(standingOf(s, names[names.length - 1])!.zone).toBe("relegation");
    expect(standingOf(s, names[names.length - 1])!.situation).toMatch(/relegation/);
    const slots = continentalSlots(lg.countryCode, 1);
    expect(standingOf(s, names[1])!.zone).toBe(slots.champions >= 2 ? "continental" : "safe");
    const second = Object.values(s.competitions).find((c) => c.kind === "league" && c.tier === 2)!;
    expect(standingOf(s, second.table![0].team)!.zone).toBe("promotion");
    expect(continentalSlots("ENG", 2)).toEqual({ champions: 0, continental: 0 });
  });

  it("lists the user's cup runs from the real draw", () => {
    const s = newCareer({ seed: "cl-runs" });
    for (let i = 0; i < 20; i++) advanceTurn(s);
    const runs = competitionRuns(s, userPlayer(s).clubId as string);
    expect(runs.every((r) => r.journey.entered)).toBe(true);
    expect(runs.some((r) => r.name === "FA Cup")).toBe(true);
  });
});

describe("club identity and tactics", () => {
  it("labels the numbers it holds and describes only what the engine does with them", () => {
    const s = newCareer({ seed: "cl-id" });
    const club = s.clubs[userPlayer(s).clubId as string];
    club.style = { pressing: 0.9, tempo: 0.1, directness: 0.9 };
    const id = clubIdentity(s, club);
    expect(id.pressing).toBe("High press");
    expect(id.tempo).toBe("Patient tempo");
    expect(id.directness).toBe("Direct play");
    expect(id.effects.length).toBe(3);
    club.style = { pressing: 0.5, tempo: 0.5, directness: 0.5 };
    expect(clubIdentity(s, club).effects).toEqual([]);
  });

  it("lets style shape selection through the same score parts the manager uses", () => {
    const s = newCareer({ seed: "cl-fit" });
    const club = s.clubs[userPlayer(s).clubId as string];
    const squad = squadOf(s, club.id);
    const a = squad.find((p) => p.position !== "GK")!;
    const style = { pressing: 1, tempo: 0.5, directness: 0.5 };
    const parts = scoreParts(a, fitFor(a, a.position), { style });
    expect(parts.tactical).toBeCloseTo((tacticalFit(a, style) - 60) / 25);
    expect(partsTotal(parts)).toBeCloseTo(selectionScore(a, a.position, null, { style }));
    // A pressing side prefers the player with the engine.
    const runner = { ...a, attrs: { ...a.attrs, stamina: 95, tackling: 95, acceleration: 90, strength: 90 } };
    const walker = { ...a, attrs: { ...a.attrs, stamina: 30, tackling: 30, acceleration: 30, strength: 30 } };
    expect(tacticalFit(runner, style)).toBeGreaterThan(tacticalFit(walker, style));
    expect(tacticalFit({ ...a, position: "GK" }, style)).toBe(60);
    expect(userTacticalFit(s, club).score).toBeGreaterThanOrEqual(20);
  });

  it("keeps every club's style inside 0–1 after loading", async () => {
    const { migrateState } = await import("../src/persistence/migrations");
    const raw = JSON.parse(JSON.stringify(newCareer({ seed: "cl-style" })));
    const id = Object.keys(raw.clubs)[0];
    raw.clubs[id].style = { pressing: 7, tempo: -3, directness: Number.NaN };
    const m = migrateState(raw);
    expect(m.clubs[id].style).toEqual({ pressing: 1, tempo: 0, directness: 0.5 });
  });
});

describe("squad strength", () => {
  it("is derived from the squad's own eleven and ranked in the league", () => {
    const s = newCareer({ seed: "cl-str" });
    const club = userPlayer(s).clubId as string;
    const d = departments(s, club);
    expect(d.map((x) => x.key)).toEqual(["attack", "midfield", "defence", "goalkeeping"]);
    for (const x of d) {
      expect(x.value).toBeGreaterThan(30);
      expect(x.value).toBeLessThanOrEqual(99);
      expect(x.rank).toBeGreaterThanOrEqual(1);
      expect(x.rank).toBeLessThanOrEqual(x.of);
    }
  });

  it("moves when the squad changes", () => {
    const s = newCareer({ seed: "cl-str2" });
    const club = userPlayer(s).clubId as string;
    const before = departments(s, club).find((x) => x.key === "goalkeeping")!;
    for (const p of squadOf(s, club).filter((x) => x.position === "GK")) for (const k of ["reflexes", "handling", "diving", "command", "kicking", "positioning", "composure"]) (p.attrs as Record<string, number>)[k] = 99;
    const after = departments(s, club).find((x) => x.key === "goalkeeping")!;
    expect(after.value).toBeGreaterThan(before.value);
    expect(after.rank).toBeLessThanOrEqual(before.rank);
  });
});

describe("squad role", () => {
  it("uses the contract's own role and label", () => {
    const s = newCareer({ seed: "cl-role" });
    const p = userPlayer(s);
    p.contract!.role = "rotation";
    const v = roleView(s)!;
    expect(v.role).toBe("rotation");
    expect(v.label).toBe(ROLE_LABEL.rotation);
    expect(v.expectedShare).toBeLessThan(0.75);
    expect(v.meeting).toBeNull(); // too early to judge
    expect(v.pathway.length).toBeGreaterThan(5);
  });

  it("judges playing time against the role once there are enough games", () => {
    const s = newCareer({ seed: "cl-role2" });
    const p = userPlayer(s);
    for (const k of Object.keys(p.attrs)) (p.attrs as Record<string, number>)[k] = 25; // never picked
    p.contract!.role = "star";
    for (let i = 0; i < 24; i++) advanceTurn(s);
    const v = roleView(s)!;
    expect(v.matches).toBeGreaterThanOrEqual(8);
    expect(v.actualShare).toBe(0);
    expect(v.meeting).toBe(false);
    expect(rolePromiseBroken(s)).toBe(true);
    expect(v.trend.every((d) => d.status === "unused")).toBe(true);
    p.contract!.role = "prospect";
    expect(roleView(s)!.meeting).toBe(true);
    expect(rolePromiseBroken(s)).toBe(false);
  });

  it("shows a starter's selection trend from the match log", () => {
    const s = newCareer({ seed: "cl-role3" });
    strongUser(s);
    for (let i = 0; i < 18; i++) advanceTurn(s);
    const trend = selectionTrend(s);
    expect(trend.length).toBeGreaterThan(0);
    expect(trend.every((d) => ["started", "sub", "unused"].includes(d.status))).toBe(true);
    const v = roleView(s)!;
    expect(v.actualShare).toBeGreaterThan(0.5);
  });
});

describe("season ambitions", () => {
  let s: GameState;
  beforeAll(() => {
    s = newCareer({ seed: "cl-obj" });
  });

  it("fit the club: contenders, strugglers and second-tier clubs get different asks", () => {
    const top = Object.values(s.competitions).find((c) => c.kind === "league" && c.tier === 1)!;
    const byRep = [...top.teams].sort((a, b) => s.clubs[b].reputation - s.clubs[a].reputation);
    const kinds = (id: string) => deriveObjectives(s, id)!.items.map((i) => i.kind);
    for (const [i, id] of byRep.entries()) s.clubs[id].expectation = i + 1;
    expect(kinds(byRep[0])).toContain("title");
    expect(kinds(byRep[byRep.length - 1])).toContain("survive");
    expect(kinds(byRep[5])).toEqual(expect.arrayContaining(["continental"]));
    const second = Object.values(s.competitions).find((c) => c.kind === "league" && c.tier === 2)!;
    const rep2 = [...second.teams].sort((a, b) => s.clubs[b].reputation - s.clubs[a].reputation);
    for (const [i, id] of rep2.entries()) s.clubs[id].expectation = i + 1;
    expect(kinds(rep2[0])).toContain("promotion");
    const all = new Set([...byRep, ...rep2].map((id) => kinds(id).join(",")));
    expect(all.size).toBeGreaterThan(2);
  });

  it("are deterministic and persisted once per season and club", () => {
    const a = deriveObjectives(s, userPlayer(s).clubId as string);
    const b = deriveObjectives(s, userPlayer(s).clubId as string);
    expect(a).toEqual(b);
    const made = ensureObjectives(s)!;
    expect(ensureObjectives(s)).toBe(made);
    expect(currentObjectives(s)).toBe(made);
    expect(made.items.every((i) => i.status === "open")).toBe(true);
  });

  it("read progress from the live table, and settle once at the end of the season", () => {
    const t = newCareer({ seed: "cl-obj2" });
    for (let i = 0; i < 16; i++) advanceTurn(t);
    const obj = t.user.objectives!;
    const club = obj.clubId;
    const league = obj.items.find((i) => ["title", "promotion", "continental", "top-half", "survive"].includes(i.kind))!;
    const p = progressOf(t, club, league);
    expect(["on-course", "off-course"]).toContain(p.state);
    expect(p.detail.length).toBeGreaterThan(3);
    const before = t.user.relationships.board;
    while (t.turn < 44) advanceTurn(t);
    // The season end settles the ambitions during the turn-44 step.
    advanceTurn(t);
    const settled = t.user.objectives!;
    expect(settled.settled).toBe(true);
    expect(settled.items.every((i) => i.status !== "open")).toBe(true);
    const board = t.user.relationships.board;
    settleObjectives(t);
    expect(t.user.relationships.board).toBe(board); // never twice
    expect(board).not.toBe(before);
    expect(t.user.relLog!.some((r) => r.rel === "board" && /ambitions/.test(r.cause))).toBe(true);
  });

  it("labels and measures a youth ambition", () => {
    const t = newCareer({ seed: "cl-obj3" });
    const club = userPlayer(t).clubId as string;
    expect(objectiveLabel({ id: "develop", kind: "develop", status: "open" })).toMatch(/young/i);
    expect(youthMinutesShare(t, club)).toBe(0);
    expect(YOUTH_MINUTES_SHARE).toBeGreaterThan(0);
  });
});

describe("relationships explain themselves", () => {
  it("logs only changes big enough to matter, with their cause, newest first", () => {
    const s = newCareer({ seed: "cl-rel" });
    adjustRel(s, "manager", 0.5, "tiny");
    adjustRel(s, "manager", 4, "Scored a derby winner");
    adjustRel(s, "manager", -6, "Asked for a move");
    adjustRel(s, "agent", 10, "agent changes are not logged");
    expect(s.user.relLog!.map((e) => e.cause)).toEqual(["Scored a derby winner", "Asked for a move"]);
    expect(relReasons(s, "manager").map((r) => r.cause)).toEqual(["Asked for a move", "Scored a derby winner"]);
    expect(s.user.relationships.manager).toBeCloseTo(55 + 0.5 + 4 - 6);
    adjustRel(s, "manager", -500, "Disaster");
    expect(s.user.relationships.manager).toBe(0);
  });

  it("states real consequences and recent causes for each of the four relationships", () => {
    const s = newCareer({ seed: "cl-rel2" });
    strongUser(s);
    for (let i = 0; i < 20; i++) advanceTurn(s);
    const ins = relationshipInsights(s);
    expect(ins.map((i) => i.key)).toEqual(["manager", "teammates", "supporters", "board"]);
    for (const i of ins) {
      expect(i.headline.length).toBeGreaterThan(5);
      expect(i.consequences.length).toBeGreaterThan(0);
      expect(i.value).toBe(s.user.relationships[i.key]);
    }
    const mgr = ins[0];
    const bias = (s.user.relationships.manager - 50) / 12;
    expect(mgr.consequences[0]).toContain(`${bias >= 0 ? "+" : ""}${bias.toFixed(1)}`);
    // Every reason shown came from the log, with the same wording.
    const logged = new Set(s.user.relLog!.map((e) => e.cause));
    for (const i of ins) for (const r of i.reasons) expect(logged.has(r.cause)).toBe(true);
  });

  it("does not make up an explanation when nothing has moved", () => {
    const s = newCareer({ seed: "cl-rel3" });
    for (const i of relationshipInsights(s)) expect(i.reasons).toEqual([]);
  });
});

describe("history, transfers and finances", () => {
  it("keeps real league history apart from what happens in the save", () => {
    const s = newCareer({ seed: "cl-hist" });
    const club = userPlayer(s).clubId as string;
    const real = WORLD.history.flatMap((h) => h.table.filter((r) => r.clubId === club && r.pos === 1 && staticLeague(h.leagueId)?.tier === 1)).length;
    const h = clubHistory(s, club);
    expect(h.real.titles).toBe(real);
    expect(h.simulated).toMatchObject({ leagueTitles: 0, cups: 0, continental: 0, seasons: 0 });
    // A real champion in the dataset has titles; nothing is added to the simulated side.
    const champ = WORLD.history.flatMap((x) => x.table.filter((r) => r.pos === 1 && r.clubId && staticLeague(x.leagueId)?.tier === 1))[0]?.clubId as string;
    if (champ && s.clubs[champ]) expect(clubHistory(s, champ).real.titles).toBeGreaterThan(0);
  });

  it("counts honours won in the simulation, from the archive", () => {
    const s = newCareer({ seed: "cl-hist2" });
    for (let i = 0; i < 46; i++) advanceTurn(s);
    const arch = s.archive[0];
    const [leagueId, c] = Object.entries(arch.champions).find(([id]) => /-1-/.test(id))!;
    void leagueId;
    expect(clubHistory(s, c.winner).simulated.leagueTitles).toBeGreaterThanOrEqual(1);
    expect(clubHistory(s, c.winner).simulated.seasons).toBe(1);
  });

  it("lists recent arrivals and departures from the transfer log and gives a finance verdict", () => {
    const s = newCareer({ seed: "cl-moves" });
    for (let i = 0; i < 12; i++) advanceTurn(s);
    const log = s.transferLog;
    expect(log.length).toBeGreaterThan(0);
    const club = log[0].to;
    const mv = recentMoves(s, club);
    expect(mv.arrivals.every((m) => log.some((t) => t.playerId === m.playerId && t.to === club))).toBe(true);
    const f = finances(s, club)!;
    expect(["Healthy", "Stable", "Tight", "In trouble"]).toContain(f.verdict);
    expect(f.wageBill).toBe(squadOf(s, club).reduce((n, p) => n + (p.contract?.wage ?? 0), 0));
  });
});
