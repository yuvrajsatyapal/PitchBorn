import type { TraitDef } from "../types";
import { ATTACK, ATTACK_FULLBACK } from "./attack";
import { DEFENCE } from "./defence";
import { FLAWS } from "./flaws";
import { KEEPER } from "./keeper";
import { MIDFIELD_TRAITS } from "./midfield";
import { CAPTAIN, MIND } from "./mind";
import { PERSONALITY } from "./personality";

/** Everything added on top of the original catalogue, in display order. */
export const EXTENSIONS: TraitDef[] = [...ATTACK, ...ATTACK_FULLBACK, ...MIDFIELD_TRAITS, ...DEFENCE, ...KEEPER, ...MIND, ...CAPTAIN, ...PERSONALITY, ...FLAWS];
