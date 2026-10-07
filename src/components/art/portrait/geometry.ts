import { CONTOUR_T, FACE_SHAPES, geoValue } from "@/engine/appearance/options";
import type { Appearance } from "@/engine/types";

/** Portrait canvas. Everything is drawn in this coordinate system and scaled by the SVG viewBox. */
export const W = 200;
export const H = 240;
export const CX = 100;
export const CROWN = 56;
export const CHIN_BASE = 178;

export type Pt = readonly [number, number];

// ------------------------------------------------------------------ colour

const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = (c: readonly number[]) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;

export function mix(a: string, b: string, t: number): string {
  const x = hex(a);
  const y = hex(b);
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}
export const darken = (c: string, t: number) => mix(c, "#150f0a", t);
export const lighten = (c: string, t: number) => mix(c, "#ffffff", t);

// ------------------------------------------------------------------ face contour

export interface Contour {
  /** Crown and chin y after scaling. */
  top: number;
  chin: number;
  /** Half-width of the face at y (linear between samples). */
  half: (y: number) => number;
  /** Right-hand outline points from the crown to the chin. */
  right: Pt[];
  tension: number;
  cleft: boolean;
}

const cache = new Map<string, Contour>();

export function contourFor(a: Pick<Appearance, "face" | "headW" | "headH">): Contour {
  const key = `${a.face}.${a.headW}.${a.headH}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const shape = FACE_SHAPES[a.face] ?? FACE_SHAPES[0];
  const wScale = geoValue("headWidth", a.headW);
  const hScale = geoValue("headHeight", a.headH) * shape.h;
  const top = CROWN;
  const chin = CROWN + (CHIN_BASE - CROWN) * hScale;
  const right: Pt[] = CONTOUR_T.map((t, i) => [CX + shape.half[i] * wScale * 1.1, top + (chin - top) * t] as Pt);
  const ys = right.map((p) => p[1]);
  const xs = right.map((p) => p[0] - CX);
  const half = (y: number) => {
    if (y <= ys[0]) return 0;
    if (y >= ys[ys.length - 1]) return xs[xs.length - 1];
    let i = 1;
    while (ys[i] < y) i++;
    const t = (y - ys[i - 1]) / (ys[i] - ys[i - 1]);
    return xs[i - 1] + (xs[i] - xs[i - 1]) * t;
  };
  const c = { top, chin, half, right, tension: shape.tension ?? 0.5, cleft: !!shape.cleft };
  if (cache.size > 400) cache.clear();
  cache.set(key, c);
  return c;
}

// ------------------------------------------------------------------ path helpers

const f = (n: number) => Math.round(n * 10) / 10;

/** Smooth closed or open path through points (Catmull-Rom converted to cubic Béziers). */
export function smooth(pts: readonly Pt[], closed = false, tension = 0.5): string {
  const n = pts.length;
  if (n < 2) return "";
  const p = (i: number): Pt => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = p(i - 1);
    const p1 = p(i);
    const p2 = p(i + 1);
    const p3 = p(i + 2);
    const k = tension / 3;
    d += `C${f(p1[0] + (p2[0] - p0[0]) * k * 2)} ${f(p1[1] + (p2[1] - p0[1]) * k * 2)} ${f(p2[0] - (p3[0] - p1[0]) * k * 2)} ${f(p2[1] - (p3[1] - p1[1]) * k * 2)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return closed ? `${d}Z` : d;
}

export const line = (pts: readonly Pt[], closed = false): string => `M${pts.map((p) => `${f(p[0])} ${f(p[1])}`).join("L")}${closed ? "Z" : ""}`;
export const mirror = (pts: readonly Pt[]): Pt[] => pts.map((p) => [2 * CX - p[0], p[1]] as Pt);

/** The full head outline (crown, right side, chin, left side). */
export function headPoints(c: Contour): Pt[] {
  const r = c.right;
  const left = mirror(r).reverse();
  // The crown is a single point shared by both sides; the chin gets a flat base from the last samples.
  return [...r.slice(0, -1), r[r.length - 1], ...left.slice(1)];
}

export function facePath(c: Contour): string {
  const r = c.right;
  const l = mirror(r);
  const pts: Pt[] = [...r, ...l.reverse().slice(0)];
  // Crown (first of r) and its mirror collapse to the same point: drop the duplicate.
  const dedup = pts.filter((p, i) => !(i === pts.length - 1 && Math.abs(p[0] - pts[0][0]) < 0.01 && Math.abs(p[1] - pts[0][1]) < 0.01));
  return smooth(dedup, true, c.tension);
}

/** Sample a cubic Bézier into points (used to scallop and spike hair edges). */
export function bezier(p0: Pt, p1: Pt, p2: Pt, p3: Pt, steps: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
}
