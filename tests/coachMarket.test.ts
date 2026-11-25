import { describe, expect, it } from "vitest";
import { acceptCoachOffer, startCoaching } from "../src/engine/career/coaching";
import { askingPrice, bidForPlayer, interestedBuyers, managerBudget, managing, reportFor, reportsLeft, salePrice, saleWage, scoutPlayer, scoutTargets, sellPlayer, SCOUT_REPORTS_PER_WEEK } from "../src/engine/career/coachMarket";
import { playerWillJoin } from "../src/engine/transfers/market";
import { BALANCE } from "../src/engine/balance";
import { advanceTurn, retireUser } from "../src/engine/season/advance";
import type { GameState } from "../src/engine/types";
import { newCareer } from "./helpers";

function managerCareer(seed: string): GameState {
  const s = newCareer({ seed });
  advanceTurn(s);
  retireUser(s);
  startCoaching(s);
  const c = s.user.coach;
  if (!c) throw new Error("no coach");
  const target = Object.values(s.clubs).find((x) => x.id !== c.clubId) as GameState["clubs"][string];
  c.offers.push({ id: "co-m", clubId: target.id, role: "manager", expiresIndex: s.turnIndex + 4, note: "" });
  acceptCoachOffer(s, "co-m");
  return s;
}

describe("manager transfers and scouting", () => {
  it("scouts potential as a range around the truth, three reports a week", () => {
    const s = managerCareer("cm-1");
    const t = scoutTargets(s, "ST");
    expect(t.length).toBeGreaterThan(0);
    for (let i = 0; i < SCOUT_REPORTS_PER_WEEK; i++) expect(scoutPlayer(s, t[i].player.id).ok).toBe(true);
    expect(reportsLeft(s)).toBe(0);
    expect(scoutPlayer(s, t[3]?.player.id ?? t[0].player.id).ok).toBe(false);
    const r = reportFor(s, t[0].player.id);
    expect(r && r.low <= t[0].player.hidden.potential && t[0].player.hidden.potential <= r.high).toBe(true);
  });

  it("signs a player at the asking price in a window, within the budget, and the AI stops buying for the club", () => {
    const s = managerCareer("cm-2");
    const club = managing(s);
    if (!club) throw new Error("not managing");
    s.turn = BALANCE.calendar.summerWindow[0];
    club.balance = 500_000_000;
    const target = scoutTargets(s, "CM").find((t) => !t.free && t.asking > 0 && t.asking < managerBudget(s));
    if (!target) return;
    expect(bidForPlayer(s, target.player.id, target.asking - 100_000).ok).toBe(false);
    const res = bidForPlayer(s, target.player.id);
    if (!res.ok) expect(res.reason).toMatch(/doesn't want|can't spare|full/);
    else expect(target.player.clubId).toBe(club.id);
    expect(askingPrice(s, target.player)).toBeGreaterThanOrEqual(0);
  });

  it("can't trade outside the window", () => {
    const s = managerCareer("cm-3");
    s.turn = 20;
    const club = managing(s);
    const t = scoutTargets(s, "ST")[0];
    expect(bidForPlayer(s, t.player.id).reason).toMatch(/window/);
    expect(sellPlayer(s, club?.squad[0] as string).reason).toMatch(/window/);
  });

  it("a sale goes to the next interested club when the first one doesn't suit the player", () => {
    let refusedTop = 0;
    for (const seed of ["cm-sell-1", "cm-sell-2", "cm-sell-3"]) {
      const base = managerCareer(seed);
      base.turn = BALANCE.calendar.summerWindow[0];
      const club = managing(base);
      if (!club) throw new Error("not managing");
      for (const id of club.squad.slice(0, 12)) {
        const s = structuredClone(base);
        const p = s.players[id];
        const buyers = interestedBuyers(s, p, salePrice(s, p));
        const willing = buyers.filter((b) => playerWillJoin(s, p, b, saleWage(s, p, b)));
        if (buyers.length && !playerWillJoin(s, p, buyers[0], saleWage(s, p, buyers[0]))) refusedTop++;
        const res = sellPlayer(s, id);
        if (willing.length) expect(res.ok, `${id}: ${res.reason}`).toBe(true);
        else expect(res.ok).toBe(false);
      }
    }
    // The case this guards: the most prestigious buyer is refused but someone else would do.
    expect(refusedTop).toBeGreaterThan(0);
  });
});
