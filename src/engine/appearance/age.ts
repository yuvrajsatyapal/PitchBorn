import type { Appearance } from "../types";

/** How age shows on an unchanging face. Identity parts are never touched. */
export interface AgeLook {
  /** 0-1 amount of grey in the hair. */
  grey: number;
  /** 0-1 grey in facial hair (shows earlier). */
  facialGrey: number;
  /** 0-1 amount of expression/age lines. */
  lines: number;
  /** 0-1 hairline retreat (genetic). */
  recede: number;
  /** 0-1 youthful softness; thins out facial hair. */
  youth: number;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function ageLook(a: Appearance, age: number): AgeLook {
  const gene = a.aging / 100; // low: early greying and thinning, high: late
  const greyStart = 33 + gene * 11;
  const recedeProne = a.aging < 55 ? 1 - a.aging / 55 : 0;
  return {
    grey: clamp01((age - greyStart) / 15) * 0.92,
    facialGrey: clamp01((age - (greyStart - 5)) / 11) * 0.95,
    lines: clamp01((age - 26) / 18),
    recede: clamp01((age - (30 + gene * 8)) / 13) * recedeProne,
    youth: clamp01((22 - age) / 6),
  };
}
