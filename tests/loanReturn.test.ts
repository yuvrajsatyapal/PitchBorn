import { describe, expect, it } from "vitest";
import { rolloverUserContract } from "../src/engine/career/offers";
import { addToSquad, removeFromSquad } from "../src/engine/world/helpers";
import type { GameState } from "../src/engine/types";
import { newCareer } from "./helpers";

/** User on loan at another club, rolled over into the season after the loan ends. */
function onLoan(expiresOffset: number): { s: GameState; parent: string } {
  const s = newCareer();
  const p = s.players[s.user.playerId];
  const parent = p.clubId as string;
  const other = Object.keys(s.clubs).find((id) => id !== parent) as string;
  removeFromSquad(s, p.id);
  addToSquad(s, p.id, other);
  s.season += 1;
  p.loan = { fromClubId: parent, untilSeason: s.season };
  (p.contract as NonNullable<typeof p.contract>).expires = s.season + expiresOffset;
  return { s, parent };
}

describe("loan return", () => {
  it("goes back to the parent club when the contract's final season is the one starting", () => {
    const { s, parent } = onLoan(0);
    rolloverUserContract(s);
    const p = s.players[s.user.playerId];
    expect(p.clubId).toBe(parent);
    expect(p.contract).not.toBeNull();
    expect(s.clubs[parent].squad).toContain(p.id);
  });

  it("becomes a free agent only when the contract ran out during the loan", () => {
    const { s } = onLoan(-1);
    rolloverUserContract(s);
    const p = s.players[s.user.playerId];
    expect(p.clubId).toBeNull();
    expect(p.contract).toBeNull();
  });
});
