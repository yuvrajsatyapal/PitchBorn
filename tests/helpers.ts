import { generateAppearance } from "../src/engine/appearance/generate";
import { createWorld, type NewCareerInput } from "../src/engine/world/create";
import type { GameState } from "../src/engine/types";

export function newCareer(overrides: Partial<NewCareerInput> = {}): GameState {
  return createWorld({
    saveName: "Test",
    firstName: "Alex",
    lastName: "Tester",
    nationality: "ENG",
    birthCountry: "ENG",
    position: "ST",
    foot: "R",
    height: 181,
    look: generateAppearance("sim-look"),
    clubId: "eng-ipswich-town",
    path: "late",
    seed: "unit-seed",
    countries: ["ENG"],
    ...overrides,
  });
}

/** Makes the user good enough to start, so a short simulation produces real matches to measure. */
export function strongUser(s: GameState): void {
  const p = s.players[s.user.playerId];
  for (const k of Object.keys(p.attrs)) (p.attrs as Record<string, number>)[k] = 86;
  p.form = 7.5;
  if (p.contract) p.contract.role = "star";
}
