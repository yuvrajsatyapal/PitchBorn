/**
 * International identity, kept apart on purpose:
 *
 *   birth country     where the player was born (profile only; never edited by the game)
 *   nationality       the citizenship the career began with
 *   altNationality    a second nation the player is eligible for (birthplace or family)
 *   intl.allegiance   the nation the player has CHOSEN to represent; absent means `nationality`
 *   intl.tiedTo       cap-tied: a competitive senior international has been played, so the choice is binding
 *
 * Simplified model (documented abstraction): a player may switch once, only before being cap-tied and with at most
 * three friendly caps. A competitive senior cap for a nation makes it binding for the rest of the career.
 */
import type { CountryCode, GameState, Player } from "../types";

/** Friendly caps a player can collect and still switch (FIFA allows up to three). */
export const MAX_CAPS_TO_SWITCH = 3;

/** The national team the player belongs to. Never changes without a decision (or a binding cap). */
export function intlTeam(p: Pick<Player, "nationality" | "intl">): CountryCode {
  return p.intl.tiedTo ?? p.intl.allegiance ?? p.nationality;
}

/** Every nation the player could represent, current allegiance first. */
export function eligibleTeams(p: Pick<Player, "nationality" | "altNationality" | "intl">): CountryCode[] {
  const out: CountryCode[] = [intlTeam(p)];
  for (const c of [p.nationality, p.altNationality]) if (c && !out.includes(c)) out.push(c);
  return out;
}

export type Commitment = "open" | "provisional" | "binding";

/** open: no caps yet · provisional: friendlies only, still free to switch once · binding: cap-tied. */
export function commitment(p: Pick<Player, "intl">): Commitment {
  if (p.intl.tiedTo) return "binding";
  return p.intl.caps > 0 ? "provisional" : "open";
}

export function canSwitchAllegiance(p: Pick<Player, "intl" | "retired">): { ok: boolean; reason?: string } {
  if (p.retired || p.intl.retired) return { ok: false, reason: "Retired from international football." };
  if (p.intl.tiedTo) return { ok: false, reason: "Cap-tied: a competitive senior international has been played." };
  if ((p.intl.switches ?? 0) >= 1) return { ok: false, reason: "The allegiance has already been switched once." };
  if (p.intl.caps > MAX_CAPS_TO_SWITCH) return { ok: false, reason: `More than ${MAX_CAPS_TO_SWITCH} caps for the current nation.` };
  return { ok: true };
}

/** The nation shown beside the player: where their allegiance lies, which is what the flag is for. */
export const sportingNation = (p: Pick<Player, "nationality" | "intl">): CountryCode => intlTeam(p);

export const userIntlTeam = (state: GameState): CountryCode => intlTeam(state.players[state.user.playerId]);

/**
 * Make a stored player's international fields consistent without destroying history. Contradictions are resolved
 * towards what actually happened: a binding tie is kept if the nation is one the player could play for.
 */
export function sanitizeIntl(p: Player): void {
  const intl = p.intl;
  if (!intl) return;
  const eligible = new Set([p.nationality, p.altNationality].filter(Boolean) as string[]);
  if (intl.tiedTo && !eligible.has(intl.tiedTo) && !p.virtual) {
    // A tie to a nation the player has no claim to cannot be real; fall back to the citizenship.
    intl.tiedTo = intl.caps > 0 ? p.nationality : undefined;
  }
  if (intl.tiedTo && intl.allegiance !== intl.tiedTo) intl.allegiance = intl.tiedTo;
  if (intl.allegiance && !eligible.has(intl.allegiance) && !p.virtual) delete intl.allegiance;
  if (intl.allegiance === p.nationality && !intl.switches) delete intl.allegiance;
  if (intl.switches !== undefined && (!Number.isFinite(intl.switches) || intl.switches < 0)) delete intl.switches;
  if (intl.compCaps !== undefined && (!Number.isFinite(intl.compCaps) || intl.compCaps < 0)) delete intl.compCaps;
  if (intl.compCaps !== undefined && intl.compCaps > intl.caps) intl.compCaps = intl.caps;
}
