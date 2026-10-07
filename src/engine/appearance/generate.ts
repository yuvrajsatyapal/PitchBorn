import { Rng } from "../rng";
import type { Appearance, LegacyAppearance } from "../types";
import { ACCESSORIES, APPEARANCE_KEYS, COUNTS, HAIR_COLORS, HAIR_STYLES } from "./options";

export type RandomScope = "all" | "face" | "hair";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export interface LookBias {
  /** Optional regional lean over the 10 skin tones. It only nudges odds; every tone stays possible everywhere. */
  skin?: readonly number[];
}

/** Spread a coarse distribution (any length) over the 10 tones. */
function spread(w: readonly number[]): number[] {
  return Array.from({ length: COUNTS.skin }, (_, i) => {
    const x = (i / (COUNTS.skin - 1)) * (w.length - 1);
    const lo = Math.floor(x);
    const hi = Math.min(w.length - 1, lo + 1);
    return w[lo] * (1 - (x - lo)) + w[hi] * (x - lo);
  });
}

function skinWeights(bias?: LookBias): number[] {
  const regional = bias?.skin ? spread(bias.skin) : null;
  const sum = regional ? regional.reduce((a, b) => a + b, 0) || 1 : 1;
  return Array.from({ length: COUNTS.skin }, (_, i) => 0.62 / COUNTS.skin + (regional ? (0.38 * regional[i]) / sum : 0.38 / COUNTS.skin));
}

// Relative odds. Footballers skew towards tidy cuts; the odd flamboyant style is rarer.
const HAIR_ODDS: Record<string, number> = {
  "Shaved": 0.5, "Buzz cut": 1.3, "Crew cut": 1.4, "Low fade": 2, "Mid fade": 2, "High fade": 1.4, "Taper": 1.4, "Textured crop": 1.6, "Curly crop": 1.3,
  "Short afro": 1.1, "Medium afro": 0.7, "Big afro": 0.35, "Waves": 1, "Twists": 0.8, "Cornrows": 0.7, "Braids": 0.4, "Short braids": 0.5, "Dreadlocks": 0.4,
  "Short dreads": 0.6, "Medium curls": 1, "Long curls": 0.45, "Short straight": 1.6, "Medium straight": 1, "Long straight": 0.3, "Curtains": 0.8, "Side part": 1.3,
  "Slick back": 1, "Messy": 0.9, "Quiff": 0.9, "Mullet": 0.3, "Receding": 0.25, "Thinning": 0.1, "Sides only": 0.05, "Man bun": 0.3, "Ponytail": 0.25,
  "Caesar": 0.8, "Spiky": 0.6, "Undercut": 0.9, "Bowl cut": 0.12,
};

/** Everyday styles keep their original indices; iconic styles are appended after them. */
const CORE_HAIR = HAIR_STYLES.filter((h) => !h.iconic);
const ICONIC_HAIR = HAIR_STYLES.map((h, i) => [h, i] as const).filter(([h]) => h.iconic);
/** Iconic styles together: about one player in seventy. */
export const ICONIC_CHANCE = 0.014;
/** Styles whose tips can take a second colour, and how often generated players have frosted tips with them. */
const TIP_ODDS: Record<string, number> = { "Frosted Faux Hawk": 0.75, "Textured crop": 0.04, "Spiky": 0.08, "Quiff": 0.03, "Short dreads": 0.05, "Dreadlocks": 0.04, "Twists": 0.06 };
/** Generated Lion Afros are often golden all through (the hair colour itself, never just the ends). */
const GOLDEN = HAIR_COLORS.indexOf("#d6a645");
const LION_GOLDEN_ODDS = 0.6;
export const supportsHairTips = (hair: number) => (HAIR_STYLES[hair]?.name ?? "") in TIP_ODDS;
/** Accessories the generator hands out (later ones are chosen in the editor). */
const GENERATED_ACCESSORIES = ACCESSORIES.indexOf("Ear stud");

const FACIAL_ODDS = [4.2, 3, 1.8, 0.9, 0.7, 1.1, 0.9, 0.5, 1.9, 1.2, 0.9, 0.2, 0.5, 0.6, 0.15, 0.5];

const MOUTH_ODDS = [3, 0.9, 0.8, 0.45, 2, 2, 0.3, 1.6, 2.2, 0.3];

function pickWeighted(rng: Rng, weights: readonly number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng.next() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

function hairColorWeights(skin: number): number[] {
  if (skin >= 7) return [7, 4, 1.2, 0.2, 0, 0, 0, 0, 0.05, 0];
  if (skin >= 4) return [4, 4, 3, 1.8, 0.8, 0.3, 0.1, 0.25, 0.2, 0];
  return [2.4, 2.8, 3.4, 3, 2.4, 2, 1.5, 1, 0.8, 0];
}

function geoValue(rng: Rng): number {
  return Math.round(clamp(rng.normal(50, 19), 0, 100));
}

/** Rolls the parts of a face selected by `scope` into `into`. */
function roll(rng: Rng, into: Appearance, scope: RandomScope, bias?: LookBias): void {
  if (scope === "all" || scope === "face") {
    into.skin = pickWeighted(rng, skinWeights(bias));
    into.face = rng.int(0, COUNTS.face - 1);
    into.eyes = rng.int(0, COUNTS.eyes - 1);
    const lightEyes = into.skin <= 4;
    into.eyeColor = pickWeighted(rng, lightEyes ? [3, 3, 1.6, 1, 1.4, 0.8] : [6, 4, 0.5, 0.05, 0.02, 0.05]);
    into.nose = rng.int(0, COUNTS.nose - 1);
    // Footballers mostly wear neutral, focused expressions; smiles are the exception.
    into.mouth = pickWeighted(rng, MOUTH_ODDS);
    into.brow = rng.int(0, COUNTS.brow - 1);
    into.ear = rng.int(0, COUNTS.ear - 1);
    into.headW = geoValue(rng);
    into.headH = geoValue(rng);
    into.eyeSp = geoValue(rng);
    into.browAng = Math.round(clamp(rng.normal(42, 18), 0, 100));
    into.noseSc = geoValue(rng);
    into.earSc = geoValue(rng);
    into.aging = rng.int(0, 100);
    into.freckles = rng.chance(into.skin <= 3 ? 0.14 : 0.04) ? 1 : 0;
    into.scar = rng.chance(0.05) ? rng.int(1, COUNTS.scar - 1) : 0;
    into.mark = rng.chance(0.06) ? rng.int(1, COUNTS.mark - 1) : 0;
    into.accessory = rng.chance(0.07) ? rng.int(1, GENERATED_ACCESSORIES) : 0;
  }
  if (scope === "all" || scope === "hair") {
    const dark = into.skin / (COUNTS.skin - 1);
    const texture = (t: string) => (t === "coily" ? 0.45 + 1.3 * dark : t === "curly" ? 0.8 + 0.5 * dark : t === "straight" ? 1.35 - 0.8 * dark : 1);
    into.hair = pickWeighted(
      rng,
      CORE_HAIR.map((h) => (HAIR_ODDS[h.name] ?? 1) * texture(h.texture)),
    );
    into.hairColor = pickWeighted(rng, hairColorWeights(into.skin));
    into.browColor = rng.chance(0.18) ? clamp(into.hairColor + rng.int(-1, 1), 0, 8) : into.hairColor;
    into.facial = pickWeighted(rng, FACIAL_ODDS);
    into.facialColor = rng.chance(0.2) ? clamp(into.hairColor + rng.int(-1, 1), 0, 8) : into.hairColor;
  }
  // Everything below was added later and draws only after all the original values, so a seed's original face,
  // hair and colours never change.
  if (scope === "all" || scope === "hair") {
    const dark = into.skin / (COUNTS.skin - 1);
    if (rng.chance(ICONIC_CHANCE)) {
      const texture = (t: string) => (t === "coily" ? 0.45 + 1.3 * dark : t === "curly" ? 0.8 + 0.5 * dark : t === "straight" ? 1.35 - 0.8 * dark : 1);
      into.hair = ICONIC_HAIR[pickWeighted(rng, ICONIC_HAIR.map(([h]) => texture(h.texture)))][1];
      if (HAIR_STYLES[into.hair].name === "Lion Afro" && rng.chance(LION_GOLDEN_ODDS)) into.hairColor = GOLDEN;
    }
    const name = HAIR_STYLES[into.hair]?.name ?? "";
    into.hairTip = rng.chance(TIP_ODDS[name] ?? 0) ? rng.int(1, COUNTS.hairTip - 1) : 0;
  }
  if (scope === "all" || scope === "face") into.band = rng.int(0, COUNTS.band - 1);
}

const blank = (): Appearance => ({ v: 2, ...(Object.fromEntries(APPEARANCE_KEYS.map((k) => [k, 0])) as Record<(typeof APPEARANCE_KEYS)[number], number>) });

/** The same seed always gives the same face. Never uses the world RNG stream. */
export function generateAppearance(seed: string, bias?: LookBias): Appearance {
  const a = blank();
  roll(Rng.fromSeed(`look:${seed}`), a, "all", bias);
  return a;
}

/** Re-roll part of a face (character creator). Identity parts stay put for the "hair" scope. */
export function randomizeAppearance(current: Appearance, scope: RandomScope, rng: Rng): Appearance {
  const a = { ...current };
  roll(rng, a, scope);
  return a;
}

const LEGACY_SKIN = [0, 2, 3, 5, 7, 9];
const LEGACY_HAIR = [21, 2, 36, 0, 22, 28, 24, 1];
const LEGACY_HAIR_COLOR = [0, 2, 3, 5, 6, 7];
const LEGACY_FACIAL = [0, 8, 3, 5];
const LEGACY_EYES = [0, 1, 3];

/** Upgrade an old five-value avatar, keeping what the player chose and filling the rest deterministically. */
export function fromLegacy(old: LegacyAppearance, seed: string): Appearance {
  const a = generateAppearance(seed);
  a.skin = LEGACY_SKIN[old.skin] ?? a.skin;
  a.hair = LEGACY_HAIR[old.hair] ?? a.hair;
  a.hairColor = LEGACY_HAIR_COLOR[old.hairColor] ?? a.hairColor;
  a.browColor = a.hairColor;
  a.facial = LEGACY_FACIAL[old.facial] ?? a.facial;
  a.facialColor = a.hairColor;
  a.eyes = LEGACY_EYES[old.eyes] ?? a.eyes;
  return a;
}

export const isLegacyAppearance = (x: unknown): x is LegacyAppearance => !!x && typeof x === "object" && (x as { v?: number }).v !== 2;

/** Clamp every field into range (hand-edited saves, future option removals). */
export function sanitizeAppearance(a: Appearance): Appearance {
  const out = { ...a, v: 2 as const };
  for (const k of APPEARANCE_KEYS) {
    const max = k in COUNTS ? COUNTS[k as keyof typeof COUNTS] - 1 : 100;
    out[k] = Math.round(clamp(Number.isFinite(out[k]) ? out[k] : 0, 0, max));
  }
  return out;
}

export const appearanceKey = (a: Appearance): string => APPEARANCE_KEYS.map((k) => a[k]).join(".");
