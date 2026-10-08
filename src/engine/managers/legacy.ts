import { clubName } from "../data/world";
import type { GameState, LegacyResult } from "../types";
import { userPlayer } from "../world/helpers";
import { influentialManager } from "./history";

/** The manager who shaped the career, when the evidence supports one; absent for careers without a defining manager. */
export function influentialManagerLegacy(state: GameState): LegacyResult["influentialManager"] | undefined {
  const w = influentialManager(state);
  if (!w) return undefined;
  const p = userPlayer(state);
  const h = w.honours;
  const won: string[] = [];
  if (h.league) won.push(`${h.league} league title${h.league > 1 ? "s" : ""}`);
  if (h.continental) won.push(`${h.continental} continental trophy${h.continental > 1 ? "s" : ""}`);
  if (h.cup) won.push(`${h.cup} cup${h.cup > 1 ? "s" : ""}`);
  if (h.promotions) won.push(`${h.promotions} promotion${h.promotions > 1 ? "s" : ""}`);
  const lines = [`Played together: ${w.seasons} season${w.seasons === 1 ? "" : "s"} at ${w.clubs.map((c) => clubName(c, true)).join(" and ")}`, `${w.apps} appearances together`];
  if (won.length) lines.push(`Major achievements: ${won.join(" · ")}`);
  lines.push(`Relationship: ${w.label}`);
  if (w.breakthrough) lines.push("The manager who gave the first-team breakthrough.");
  if (w.captain) lines.push(`The manager who made ${p.firstName} captain.`);
  if (w.reunited) lines.push("The pair reunited years later.");
  if (w.importance >= 70) lines.push("One of the defining relationships of the career.");
  return { managerId: w.managerId, name: w.name, lines };
}
