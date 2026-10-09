/** Shared building blocks for the trait catalogue: position groups, the `def` constructor and conflict shorthands. */
import type { Position, TraitId } from "../../types";
import type { TraitDef } from "../types";

export const GK = ["GK"] as const;
export const CB = ["CB"] as const;
export const FB = ["RB", "LB"] as const;
export const DM = ["DM"] as const;
export const CM = ["CM"] as const;
export const AM = ["AM"] as const;
export const W = ["RW", "LW"] as const;
export const ST = ["ST"] as const;
export const OUT: readonly Position[] = ["RB", "CB", "LB", "DM", "CM", "AM", "RW", "LW", "ST"];
export const ATTACKERS: readonly Position[] = ["AM", "RW", "LW", "ST"];
export const MIDFIELD: readonly Position[] = ["DM", "CM", "AM"];

type Base = Omit<TraitDef, "id" | "name" | "blurb" | "category" | "positions" | "core" | "rarity">;

export const def = (
  id: TraitId, name: string, category: TraitDef["category"], positions: TraitDef["positions"], blurb: string,
  core: TraitDef["core"], rarity: number, rest: Base = {},
): TraitDef => ({ id, name, blurb, category, positions, core, rarity, ...rest });

/** A conflict that makes coexistence unlikely but not impossible. */
export const u = (a: TraitId) => ({ id: a, kind: "unlikely" as const });
/** A conflict that rules coexistence out. */
export const x = (a: TraitId) => ({ id: a, kind: "exclusive" as const });
