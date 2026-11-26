import { describe, expect, it } from "vitest";
import { academyPlayers, boardProgress, boardWeekly, ensureBoard, promoteAcademyPlayer, settleBoard, wageBill, wageCap } from "../src/engine/career/board";
import { acceptCoachOffer, startCoaching } from "../src/engine/career/coaching";
import { bidForPlayer, managing, scoutTargets } from "../src/engine/career/coachMarket";
import { BALANCE } from "../src/engine/balance";
import { advanceTurn, retireUser } from "../src/engine/season/advance";
import type { GameState } from "../src/engine/types";
import { newCareer } from "./helpers";

function managerCareer(seed: string): GameState {
  const s = newCareer({ seed });
  advanceTurn(s);
  retireUser(s);
  startCoaching(s);
  const c = s.user.coach!;
  const target = Object.values(s.clubs).find((x) => x.id !== c.clubId)!;
  c.offers.push({ id: "co-m", clubId: target.id, role: "manager", expiresIndex: s.turnIndex + 4, note: "" });
  acceptCoachOffer(s, "co-m");
  return s;
}

describe("managed club board", () => {
  it("sets four objectives and a wage cap no lower than the inherited bill", () => {
    const s = managerCareer("b-1");
    ensureBoard(s);
    const club = managing(s)!;
    const prog = boardProgress(s);
    expect(prog.map((p) => p.objective.id)).toEqual(["league", "cup", "youth", "wages"]);
    expect(wageCap(s, club)).toBeGreaterThanOrEqual(wageBill(s, club.id));
  });

  it("refuses a signing that breaks the wage cap", () => {
    const s = managerCareer("b-2");
    ensureBoard(s);
    const club = managing(s)!;
    s.turn = BALANCE.calendar.summerWindow[0];
    club.balance = 900_000_000;
    s.user.coach!.board!.wageCap = wageBill(s, club.id);
    const t = scoutTargets(s, "ST")[0];
    const res = bidForPlayer(s, t.player.id);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/wage cap|budget|full|asking|wants/);
  });

  it("intake day brings prospects, promotion moves one into first-team plans, and a missed season can sack", () => {
    const s = managerCareer("b-3");
    const club = managing(s)!;
    while (club.squad.length > BALANCE.squad.max - 2) club.squad.pop();
    s.turn = 36;
    const before = club.squad.length;
    boardWeekly(s);
    expect(club.squad.length).toBe(before + 2);
    const kid = academyPlayers(s).find((p) => p.contract?.youth)!;
    expect(promoteAcademyPlayer(s, kid.id).ok).toBe(true);
    expect(kid.contract?.role).toBe("rotation");
    const c = s.user.coach!;
    c.board!.objectives[0].target = 0; // impossible league target
    c.confidence = 20;
    s.turn = BALANCE.calendar.endOfSeasonTurn;
    expect(settleBoard(s)).toBe(true);
    expect(settleBoard(s)).toBe(false);
  });
});
