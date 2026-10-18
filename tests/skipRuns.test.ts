import { describe, expect, it } from "vitest";
import { newCareer, strongUser } from "./helpers";
import { advanceTurn } from "../src/engine/season/advance";
import { interruptReason, snapshotAttention } from "../src/engine/season/interrupts";
import { BALANCE } from "../src/engine/balance";

describe("fixed-length skips", () => {
  it("run to their date instead of stopping for decisions, offers or injuries", () => {
    const g = newCareer();
    strongUser(g);
    const target = BALANCE.calendar.endOfSeasonTurn - g.turn + 1;
    const before = snapshotAttention(g);
    let stoppedEarly: string | null = null;
    for (let w = 0; w < target - 1 && !stoppedEarly; w++) {
      const r = advanceTurn(g, { byDay: true });
      stoppedEarly = interruptReason(g, before, { newSeason: r.newSeason, stopOnMatch: false, stopForNews: false });
    }
    expect(stoppedEarly).toBeNull();
  }, 60000);
});
