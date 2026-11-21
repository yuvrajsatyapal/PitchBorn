import { describe, expect, it } from "vitest";
import { BALANCE } from "../src/engine/balance";
import { cancelLoanRequest, loanAdvice, loanDestinations, requestLoan } from "../src/engine/career/loanAdvice";
import { generateUserOffers } from "../src/engine/career/offers";
import { overallFor } from "../src/engine/players/attributes";
import { clubLevel } from "../src/engine/players/economy";
import { Rng } from "../src/engine/rng";
import type { GameState } from "../src/engine/types";
import { userPlayer } from "../src/engine/world/helpers";
import { newCareer } from "./helpers";

/** A 17-year-old prospect at an elite club. */
function academyProspect(seed: string): GameState {
  const s = newCareer({ seed, clubId: "eng-man-city", path: "academy" });
  const p = userPlayer(s);
  if (p.contract) p.contract.role = "prospect";
  return s;
}

describe("loan advice", () => {
  it("suggests a loan for a prospect at a club far above his level", () => {
    const s = academyProspect("loan-1");
    const p = userPlayer(s);
    const gap = clubLevel(s.clubs[p.clubId as string].reputation) - overallFor(p.attrs, p.position);
    expect(gap).toBeGreaterThanOrEqual(5);
    const a = loanAdvice(s);
    expect(a).not.toBeNull();
    expect(a?.level).toBe("suggest");
    expect(a?.destinations.length).toBeGreaterThan(0);
    for (const d of a?.destinations ?? []) {
      expect(d.clubId).not.toBe(p.clubId);
      expect(s.clubs[d.clubId].reputation).toBeLessThan(s.clubs[p.clubId as string].reputation);
    }
  });

  it("urges a loan when the player has barely played this season", () => {
    const s = academyProspect("loan-2");
    s.turn = BALANCE.calendar.seasonStart + 12;
    const p = userPlayer(s);
    // Give the club results so there were minutes to play.
    const club = p.clubId as string;
    let n = 0;
    for (const c of Object.values(s.competitions)) {
      for (const f of c.fixtures) {
        if (n < 10 && (f.home === club || f.away === club) && c.kind === "league") {
          f.result = { hg: 1, ag: 0, goals: [] };
          n++;
        }
      }
    }
    const a = loanAdvice(s);
    expect(a?.level).toBe("urge");
    expect(a?.possible).toBe(n * 90);
    expect(a?.share).toBe(0);
  });

  it("gives no advice to older players, players already on loan, or the retired", () => {
    const s = academyProspect("loan-3");
    const p = userPlayer(s);
    p.birthYear = s.season - 25;
    expect(loanAdvice(s)).toBeNull();
    p.birthYear = s.season - 18;
    p.loan = { fromClubId: "eng-man-city", untilSeason: s.season };
    expect(loanAdvice(s)).toBeNull();
    delete p.loan;
    s.user.retired = true;
    expect(loanAdvice(s)).toBeNull();
  });

  it("sends a loan offer from the club the player asked for", () => {
    const s = academyProspect("loan-4");
    const target = loanDestinations(s, 10).at(-1)?.clubId as string;
    expect(target).toBeTruthy();
    expect(requestLoan(s, target)).toContain("loan");
    expect(s.user.wantsLoan).toBe(true);
    expect(s.user.loanTarget).toBe(target);
    s.turn = BALANCE.calendar.summerWindow[1];
    for (let i = 0; i < 40 && !s.user.offers.some((o) => o.kind === "loan"); i++) generateUserOffers(s, new Rng([i + 1, 2, 3, 4]));
    const loan = s.user.offers.find((o) => o.kind === "loan");
    expect(loan?.fromClubId).toBe(target);
    cancelLoanRequest(s);
    expect(s.user.wantsLoan).toBe(false);
    expect(s.user.loanTarget).toBeUndefined();
  });
});
