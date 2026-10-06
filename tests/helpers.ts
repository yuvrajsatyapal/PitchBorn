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
    look: { skin: 1, hair: 2, hairColor: 1, facial: 0, eyes: 1 },
    clubId: "eng-ipswich-town",
    path: "late",
    seed: "unit-seed",
    countries: ["ENG"],
    ...overrides,
  });
}
