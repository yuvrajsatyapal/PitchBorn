/**
 * Tone-aware palettes. Shadows and highlights are derived in HSL per tone instead of mixing every colour with the
 * same black or white, so dark skin keeps warmth and plane separation and light skin doesn't turn grey.
 */
type HSL = [number, number, number];

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function hexToHsl(hex: string): HSL {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, s, l];
}

export function hslToHex([h, s, l]: HSL): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)].map((v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, "0")).join("")}`;
}

/** Shift a colour in HSL: hue in degrees, saturation and lightness as deltas. */
export function shift(hex: string, dh: number, ds: number, dl: number): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex([(h + dh + 360) % 360, clamp01(s + ds), clamp01(l + dl)]);
}

/** Straight RGB mix of two colours. */
export function mixHex(a: string, b: string, t: number): string {
  const c = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  return `#${[1, 3, 5].map((i) => Math.round(c(a, i) + (c(b, i) - c(a, i)) * t).toString(16).padStart(2, "0")).join("")}`;
}

export interface SkinTones {
  base: string;
  /** Main cel shadow and the deeper accent inside it. */
  shade: string;
  deep: string;
  light: string;
  blush: string;
  lipUp: string;
  lipLo: string;
  lipHi: string;
  /** Feature ink: warm, darker than the deepest shadow, softer than the outline. */
  line: string;
  /** Eye whites take a little of the skin so they never glow. */
  white: string;
}

export const INK = "#23160f";

/** A colour in the same family: hue shifted, saturation and lightness scaled. */
const tone = (hex: string, dh: number, sMul: number, lMul: number, lAdd = 0): string => {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex([(h + dh + 360) % 360, clamp01(s * sMul), clamp01(l * lMul + lAdd)]);
};

export function skinTones(base: string): SkinTones {
  const [, , l] = hexToHsl(base);
  const dark = clamp01((0.62 - l) / 0.45);
  // Shadows are mixed towards a darker, slightly redder, less saturated version of the skin (never towards black
  // or orange), so chroma stays put while value drops. Dark skin gets a proportionally deeper shadow and a warm,
  // slightly golden light so the planes still separate.
  const down = tone(base, -10, 0.78, 0.34);
  const up = tone(base, 8, 0.75 - 0.15 * dark, 1, 0.3 + 0.08 * dark);
  return {
    base,
    shade: mixHex(base, down, 0.27 + 0.08 * dark),
    deep: mixHex(base, down, 0.5 + 0.12 * dark),
    light: mixHex(base, up, 0.32 + 0.08 * dark),
    blush: mixHex(base, tone(base, -16, 1.1, 0.78), 0.55),
    lipUp: mixHex(base, tone(base, -16, 0.95, 0.5), 0.55 + 0.1 * dark),
    lipLo: mixHex(base, tone(base, -14, 1, 0.74), 0.55 + 0.1 * dark),
    lipHi: mixHex(base, up, 0.45),
    line: tone(base, -12, 0.75, 0.3 - 0.08 * dark),
    white: mixHex("#ece6da", base, 0.12 + 0.12 * dark),
  };
}

export interface HairTones {
  base: string;
  shade: string;
  deep: string;
  light: string;
  line: string;
}

/**
 * How much dark hair and dark skin need separating (0 none .. 1 black hair on the deepest skin). Used to lift the
 * hair's own highlight a little; the skin is never lightened.
 */
export function darkPair(hair: string, skin: string): number {
  const lh = hexToHsl(hair)[2];
  const ls = hexToHsl(skin)[2];
  return Math.max(0, Math.min(1, (0.36 - ls) / 0.12)) * Math.max(0, Math.min(1, (0.21 - lh) / 0.1));
}

/**
 * Tones for hair of one base colour. Against dark skin (`against`), dark hair keeps its base and shadow but its
 * highlight is lifted and cooled a touch, so the hair separates from the face by value and temperature, not by an
 * outline.
 */
export function hairTones(base: string, against?: string): HairTones {
  const [h, s, l] = hexToHsl(base);
  const veryDark = l < 0.14;
  const b = against ? darkPair(base, against) : 0;
  return {
    base,
    shade: hslToHex([h, Math.min(1, s + 0.05), Math.max(0.03, l * 0.68)]),
    deep: hslToHex([h, Math.min(1, s + 0.08), Math.max(0.02, l * 0.42)]),
    // Black hair catches a cool sheen; brown and fair hair a warm one.
    light: veryDark
      ? hslToHex([(h + 190) % 360, 0.12 + 0.05 * b, 0.3 + 0.09 * b])
      : hslToHex([b > 0 ? (h + 200) % 360 : h + 4, Math.max(0, s - 0.06 - 0.1 * b), Math.min(0.92, l + (1 - l) * (0.3 + 0.08 * b))]),
    line: hslToHex([h, Math.min(1, s + 0.1), Math.max(0.02, l * 0.3)]),
  };
}

// ------------------------------------------------------------------ facial hair

/** Relative luminance (WCAG) of a #rrggbb colour. */
export function luma(hex: string): number {
  const c = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * c(1) + 0.7152 * c(3) + 0.0722 * c(5);
}

/** Contrast ratio between two colours (1 identical .. 21 black on white). */
export function contrast(a: string, b: string): number {
  const la = luma(a);
  const lb = luma(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export interface BeardTones extends HairTones {
  /** The tone of the edge where the beard stands off the face: a darker (or, on dark skin, cooler and lighter) tone
   * of the beard's own hue, never black. */
  edge: string;
  /** How hard this hair-and-skin pair is to tell apart (0 easy .. 1 hair nearly the colour of the skin). */
  need: number;
}

/** Contrast the beard body is moved to when the hair is close to the skin's value. */
export const BEARD_TARGET = 1.55;

/**
 * Tones for facial hair of one colour on one skin. The beard's hue and saturation always come from the selected
 * facial-hair colour. Skin only decides the strategy: when hair and skin are close in value, the body of the beard
 * moves a little further from the skin along the hair's own colour (darker when the hair is darker, lighter when it
 * is lighter), its shadow deepens, and the edge gets its own tone; the skin is never touched.
 */
export function beardTones(color: string, skin: string): BeardTones {
  const hair = hairTones(color, skin);
  const r0 = contrast(color, skin);
  const need = clamp01((BEARD_TARGET - r0) / (BEARD_TARGET - 1));
  const [h, s, l] = hexToHsl(color);
  const lSkin = luma(skin);
  // Away from the skin; very light hair on light skin can only go darker.
  const up = luma(color) > lSkin && l < 0.78;
  let base = color;
  if (need > 0) {
    // Step the body away from the skin until the pair separates or the step runs out.
    let dl = 0;
    for (let k = 0; k < 8 && contrast(base, skin) < BEARD_TARGET; k++) {
      dl += 0.025;
      base = hslToHex([h, clamp01(s + (up ? 0 : 0.03)), clamp01(l + (up ? dl : -dl))]);
    }
  }
  const [bh, bs, bl] = hexToHsl(base);
  const shade = hslToHex([bh, Math.min(1, bs + 0.05), Math.max(0.03, bl * (0.68 - 0.1 * need))]);
  const deep = hslToHex([bh, Math.min(1, bs + 0.08), Math.max(0.02, bl * (0.42 - 0.06 * need))]);
  const dark = contrast(color, skin) < 1.55 && luma(color) < lSkin;
  // On dark skin the edge of dark hair is a cool lift, on light skin a deeper tone of the hair itself.
  const edge = dark && luma(skin) < 0.12 ? mixHex(hair.light, base, 0.45) : mixHex(hslToHex([bh, Math.min(1, bs + 0.1), Math.max(0.03, bl * 0.4)]), base, 0.25);
  return { ...hair, base, shade, deep, edge, need };
}
