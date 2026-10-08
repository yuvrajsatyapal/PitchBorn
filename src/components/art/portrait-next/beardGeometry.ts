import type { Head } from "../portrait/anatomy";
import { CX, clamp, type Pt } from "../portrait/geometry";
import type { NextSpec } from "./head";

export const P = (x: number, y: number): Pt => [x, y];

export const smooth01 = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

/** Where facial hair starts: the bottom of the hair's sideburn (the same point every hairline uses). */
export const burnY = (f: NextSpec) => f.ear.top + (f.ear.bot - f.ear.top) * 0.4;

/** The head outline on one side between two heights. */
export const outline = (head: Head, s: 1 | -1, y0: number, y1: number) => (s > 0 ? head.rightPts : head.leftPts).filter((p) => p[1] >= y0 && p[1] <= y1);

/** The lips, with only a hair's width of skin round them. */
export function mouthGap(f: NextSpec): Pt[] {
  const m = f.mouth;
  const cy = f.mouthY + (m.lo - m.up) / 2;
  const rx = m.w + 0.8;
  const ry = (m.up + m.lo) / 2 + 0.7;
  return Array.from({ length: 16 }, (_, i) => {
    const t = (i / 16) * Math.PI * 2;
    return P(CX + Math.cos(t) * rx, cy + Math.sin(t) * ry);
  });
}

export function inside(shape: readonly Pt[], p: Pt): boolean {
  let c = false;
  for (let i = 0, j = shape.length - 1; i < shape.length; j = i++) {
    const A = shape[i];
    const B = shape[j];
    if (A[1] > p[1] !== B[1] > p[1] && p[0] < ((B[0] - A[0]) * (p[1] - A[1])) / (B[1] - A[1]) + A[0]) c = !c;
  }
  return c;
}

/** Smooth minimum: `a` and `b` blend over `k` instead of meeting at a corner. */
export const smin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
