/** Goalkeeper specialisms. Deliberately not save-percentage buffs: each changes where danger comes from or what is conceded. */
import type { TraitDef } from "../types";
import { GK, def, u, x } from "./helpers";

export const KEEPER: TraitDef[] = [
  def("reflex_keeper", "Reflex Keeper", "playstyle", GK, "Quick to react to the close-range effort: scrambles, deflections and tap-ins against the side are less likely to go in.", ["reflexes", "diving", "positioning"], 2, {
    req: [{ attr: "reflexes", min: 70 }], conflicts: [u("sweeper_keeper")], role: "reflex keeper",
    signals: { saves: 0.25, save1v1: 0.5, cleanSheet: 0.3 }, trained: ["goalkeeping"],
    match: { againstXgOpen: 0.95, againstXgHeader: 0.97, save: 0.99 },
  }),
  def("cross_claimer", "Cross Claimer", "playstyle", GK, "Comes and takes the cross: high balls are caught or punched clear rather than falling to the attacker.", ["handling", "command", "strength"], 2, {
    req: [{ attr: "handling", min: 64 }], conflicts: [x("weak_on_crosses")], role: "cross-claiming keeper",
    signals: { claim: 1.3, cleanSheet: 0.3 }, trained: ["goalkeeping"],
    match: { claim: 0.94, againstXgHeader: 0.96 },
  }),
  def("safe_hands", "Safe Hands", "playstyle", GK, "Holds on to what he saves: rebounds and spills are rarer, long shots and low drives are smothered.", ["handling", "composure", "positioning"], 2, {
    req: [{ attr: "handling", min: 68 }], conflicts: [x("error_prone")], role: "safe pair of hands",
    signals: { saves: 0.2, cleanSheet: 0.4, full90: 0.1 }, trained: ["goalkeeping"],
    match: { save: 0.985, againstXgOpen: 0.97, againstXgLong: 0.95 },
  }),
];
