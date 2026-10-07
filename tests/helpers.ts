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
