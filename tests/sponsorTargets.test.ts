import { describe, expect, it } from "vitest";
import { BALANCE } from "../src/engine/balance";
import { acceptSponsorOffer, sponsorState, sponsorWeekly, targetKindFor, targetProgress } from "../src/engine/career/sponsors";
import { emptyStat } from "../src/engine/players/generate";
import type { GameState, SponsorDeal } from "../src/engine/types";
import { userPlayer } from "../src/engine/world/helpers";
import { decodeState, encodeState } from "../src/persistence/codec";
import { migrateState } from "../src/persistence/migrations";
import { newCareer } from "./helpers";

const SP = BALANCE.sponsors;
const CAL = BALANCE.calendar;

/** Move to a week of the season and run the weekly sponsor step (same as a turn, without the matches). */
function week(s: GameState, turn: number, played = true) {
  s.turn = turn;
  if (played) s.user.lastMatchTurn = turn;
  s.turnIndex++;
  sponsorWeekly(s);
}

function deal(s: GameState, extra: Partial<SponsorDeal> = {}): SponsorDeal {
  const d: SponsorDeal = { id: `t${sponsorState(s).deals.length}`, brandId: "kickara", annual: 100_000, startIndex: s.turnIndex, endIndex: s.turnIndex + 200, paidThrough: s.turnIndex, ...extra };
  sponsorState(s).deals.push(d);
  return d;
}

function score(s: GameState, goals: number) {
  const p = userPlayer(s);
  const line = (p.season["test-comp"] ??= emptyStat());
  line.goals += goals;
  line.apps += 1;
}

describe("sponsor season targets", () => {
  it("asks forwards for goals, midfielders for assists, keepers for clean sheets and defenders for games", () => {
    expect(targetKindFor({ position: "ST" })).toBe("goals");
    expect(targetKindFor({ position: "LW" })).toBe("goals");
    expect(targetKindFor({ position: "AM" })).toBe("involvements");
    expect(targetKindFor({ position: "CM" })).toBe("assists");
    expect(targetKindFor({ position: "GK" })).toBe("cleanSheets");
    expect(targetKindFor({ position: "CB" })).toBe("apps");
  });

  it("a regular gets a bigger target than a backup, and a full last season is the guide once there is one", () => {
    const s = newCareer({ seed: "tg-r" });
    const p = userPlayer(s);
    const d = deal(s);
    p.contract!.role = "star";
    week(s, CAL.seasonStart);
    const starNeed = d.target!.need;
    d.target = undefined;
    p.contract!.role = "backup";
    week(s, CAL.seasonStart);
    expect(d.target!.need).toBeLessThan(starNeed);
    d.target = undefined;
    const last = emptyStat();
    last.apps = 30;
    last.goals = 20;
    p.history.push({ season: s.season - 1, clubId: p.clubId, age: 24, overall: 70, stats: last });
    week(s, CAL.seasonStart);
    expect(d.target!.need).toBe(Math.round(20 * SP.stretch));
  });

  it("sets a target once the season is under way, pro-rated for a deal signed late", () => {
    const s = newCareer({ seed: "tg-1" });
    const d = deal(s);
    week(s, 2);
    expect(d.target).toBeUndefined();
    week(s, CAL.seasonStart);
    const role = userPlayer(s).contract?.role ?? "rotation";
    const need = Math.max(SP.minTarget.goals, Math.round(SP.defaultTarget.goals * SP.roleScale[role] * SP.stretch));
    expect(d.target).toMatchObject({ season: s.season, kind: "goals", need, status: "open", bonus: 25_000 });
    const late = newCareer({ seed: "tg-1b" });
    const d2 = deal(late);
    week(late, 30);
    expect(d2.target?.need).toBeLessThanOrEqual(d.target?.need ?? 0);
    expect(d2.target?.need).toBeGreaterThanOrEqual(SP.minTarget.goals);
  });

  it("counts only what happens after the target is set, pays the bonus once, then waits for next season", () => {
    const s = newCareer({ seed: "tg-2" });
    score(s, 3);
    const d = deal(s);
    week(s, 10);
    const t = d.target;
    expect(t?.baseline).toBe(3);
    expect(targetProgress(s, t!)[0]).toBe(0);
    const paid = () => s.user.pay?.career.sponsor ?? 0;
    const weekly = Math.round(d.annual / CAL.turnsPerSeason);
    let before = paid();
    score(s, t!.need);
    week(s, 11);
    expect(t?.status).toBe("met");
    expect(paid() - before).toBe(weekly + t!.bonus);
    before = paid();
    score(s, 5);
    week(s, 12);
    expect(paid() - before).toBe(weekly);
    expect(s.news.filter((n) => n.title.includes("bonus")).length).toBe(1);
  });

  it("a target not reached by the end of the season is missed, and a new season brings a new one", () => {
    const s = newCareer({ seed: "tg-3" });
    const d = deal(s);
    week(s, 10);
    week(s, CAL.endOfSeasonTurn);
    expect(d.target?.status).toBe("missed");
    expect(s.news.some((n) => n.title.includes("target missed"))).toBe(true);
    s.season++;
    week(s, CAL.seasonStart);
    expect(d.target).toMatchObject({ season: s.season, status: "open" });
  });

  it("a renewal keeps this season's target, so the same brand never pays twice in a season", () => {
    const s = newCareer({ seed: "tg-4" });
    const d = deal(s);
    week(s, 10);
    d.target!.status = "met";
    sponsorState(s).offers.push({ id: "renew", brandId: d.brandId, annual: 150_000, years: 2, expiresIndex: s.turnIndex + 5, renewsDealId: d.id });
    acceptSponsorOffer(s, "renew");
    const now = sponsorState(s).deals.find((x) => x.id === "renew");
    expect(now?.target?.status).toBe("met");
  });

  it("deals from older saves pick up a target and survive a save and reload", () => {
    const s = newCareer({ seed: "tg-5" });
    const d = deal(s); // no target, no clause: how deals looked before targets existed
    week(s, 12);
    expect(d.target?.status).toBe("open");
    const back = migrateState(decodeState(encodeState(s)) as never);
    expect(back.user.sponsor?.deals[0].target).toEqual(d.target);
  });
});

describe("sponsor form clause", () => {
  it("big brands write one in; small ones do not", () => {
    const s = newCareer({ seed: "fc-0" });
    const p = userPlayer(s);
    p.reputation = 95;
    p.intlReputation = 80;
    p.form = 7.8;
    const offers = new Map<string, boolean>();
    for (let i = 0; i < 400 && offers.size < 6; i++) {
      s.turnIndex++;
      sponsorWeekly(s);
      for (const o of sponsorState(s).offers) offers.set(o.brandId, !!o.formClause);
      sponsorState(s).offers = [];
      sponsorState(s).cooldown = {};
      sponsorState(s).lastOfferIndex = -99;
    }
    expect([...offers.values()].some(Boolean)).toBe(true);
    for (const [id, clause] of offers) expect(clause).toBe(["kickara", "zestro", "crestbank", "voltara", "strivon", "halden", "nordhawk", "aventra"].includes(id));
  });

  it("warns after a run of poor form and walks after a longer one", () => {
    const s = newCareer({ seed: "fc-1" });
    const d = deal(s, { formClause: true });
    userPlayer(s).form = SP.poorForm - 0.5;
    for (let i = 0; i < SP.warnWeeks; i++) week(s, 12 + i);
    expect(s.news.some((n) => n.title.includes("worried about your form"))).toBe(true);
    expect(sponsorState(s).deals).toContain(d);
    for (let i = SP.warnWeeks; i < SP.dropWeeks; i++) week(s, 12 + i);
    expect(sponsorState(s).deals).not.toContain(d);
    expect(s.news.some((n) => n.title.includes("ends your deal"))).toBe(true);
  });

  it("injury, the bench and pre-season pause the count, recovery resets it, and deals without a clause are safe", () => {
    const s = newCareer({ seed: "fc-2" });
    const clause = deal(s, { formClause: true });
    const plain = deal(s);
    const p = userPlayer(s);
    p.form = SP.poorForm - 0.5;
    week(s, 2);
    expect(clause.poorWeeks ?? 0).toBe(0);
    for (let i = 0; i < SP.dropWeeks - 1; i++) week(s, 12 + i);
    p.form = SP.recoveredForm + 0.1;
    week(s, 30);
    expect(clause.poorWeeks).toBe(0);
    p.form = SP.poorForm - 0.5;
    for (let i = 0; i < SP.dropWeeks + 2; i++) week(s, 31 + i, false); // on the bench: his old form does not count
    expect(clause.poorWeeks).toBe(0);
    p.injury = { type: "Knock", turnsLeft: 20, severity: 1 } as never;
    for (let i = 0; i < SP.dropWeeks + 2; i++) week(s, 31 + i);
    expect(sponsorState(s).deals).toEqual(expect.arrayContaining([clause, plain]));
  });
});
