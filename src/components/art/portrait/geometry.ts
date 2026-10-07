/**
 * INTERIM vector renderer. This folder draws portraits procedurally with SVG geometry and is kept only so the game
 * has portraits until the hand-illustrated asset set (components/art/illustrated, docs/PORTRAIT_ART.md) is
 * delivered. Do not extend it: new art goes into illustrated assets.
 *
 * Shared drawing helpers for the portrait. All parts are drawn in one 300 x 350 canvas.
 */
import { hash01, luminance, mix } from "../shared";

export const W = 300;
export const H = 350;
export const CX = 150;

export type Pt = readonly [number, number];
export type Seg = readonly [Pt, Pt, Pt, Pt];

/** Warm near-black ink, and the three line weights: silhouette, structure, detail. */
export const INK = "#2a1b14";
export const OUT = 3;
export const MID = 1.8;
export const FINE = 1.15;

// ------------------------------------------------------------------ colour

export { hash01, luminance, mix };
export const darken = (c: string, t: number) => mix(c, "#150f0a", t);
export const lighten = (c: string, t: number) => mix(c, "#ffffff", t);

// ------------------------------------------------------------------ numbers and points

export const r1 = (n: number) => Math.round(n * 10) / 10;
/** Trim path data to one decimal place: plenty at any display size, and portraits stay light in long lists. */
export const q = (d: string) => d.replace(/(\d\.\d)\d+/g, "$1");
export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
export const scale = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];
export const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const unit = (a: Pt): Pt => {
  const l = Math.hypot(a[0], a[1]) || 1;
  return [a[0] / l, a[1] / l];
};
export const mirrorX = (p: Pt): Pt => [2 * CX - p[0], p[1]];

// ------------------------------------------------------------------ curves

export function cubicAt(s: Seg, t: number): Pt {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [a * s[0][0] + b * s[1][0] + c * s[2][0] + d * s[3][0], a * s[0][1] + b * s[1][1] + c * s[2][1] + d * s[3][1]];
}

/** A quadratic corner (p0 -> control -> p1) as a cubic segment. */
export const quad = (p0: Pt, c: Pt, p1: Pt): Seg => [p0, add(p0, scale(sub(c, p0), 2 / 3)), add(p1, scale(sub(c, p1), 2 / 3)), p1];

export function sampleSegs(segs: readonly Seg[], steps = 10): Pt[] {
  const out: Pt[] = [];
  segs.forEach((s, i) => {
    for (let k = i === 0 ? 0 : 1; k <= steps; k++) out.push(cubicAt(s, k / steps));
  });
  return out;
}

export const segsPath = (segs: readonly Seg[], move = true): string =>
  (move ? `M${r1(segs[0][0][0])} ${r1(segs[0][0][1])}` : "") + segs.map((s) => `C${r1(s[1][0])} ${r1(s[1][1])} ${r1(s[2][0])} ${r1(s[2][1])} ${r1(s[3][0])} ${r1(s[3][1])}`).join("");

export const reverseSegs = (segs: readonly Seg[]): Seg[] => segs.slice().reverse().map((s) => [s[3], s[2], s[1], s[0]] as Seg);
export const mirrorSegs = (segs: readonly Seg[]): Seg[] => segs.map((s) => s.map(mirrorX) as unknown as Seg);

/** Catmull-Rom spline through points, as cubic segments. */
export function splineSegs(pts: readonly Pt[], closed = false, tension = 0.5): Seg[] {
  const n = pts.length;
  const p = (i: number): Pt => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const segs: Seg[] = [];
  const k = tension / 3;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = p(i - 1);
    const p1 = p(i);
    const p2 = p(i + 1);
    const p3 = p(i + 2);
    segs.push([p1, [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k], [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k], p2]);
  }
  return segs;
}

export const spline = (pts: readonly Pt[], closed = false, tension = 0.5) => segsPath(splineSegs(pts, closed, tension)) + (closed ? "Z" : "");
export const poly = (pts: readonly Pt[], closed = false) => `M${pts.map((p) => `${r1(p[0])} ${r1(p[1])}`).join("L")}${closed ? "Z" : ""}`;
export const polyCont = (pts: readonly Pt[]) => pts.map((p) => `L${r1(p[0])} ${r1(p[1])}`).join("");

/** Points along a smooth curve through `pts`. */
export const along = (pts: readonly Pt[], steps = 6, tension = 0.5) => sampleSegs(splineSegs(pts, false, tension), steps);

/**
 * A filled stroke whose width varies along its length, so ink lines swell and taper like a brush or pen line.
 * `w(u)` gives the full width at u in [0, 1].
 */
export function ribbon(pts: readonly Pt[], w: (u: number) => number): string {
  const n = pts.length;
  if (n < 2) return "";
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const t = unit(sub(b, a));
    const nrm: Pt = [-t[1], t[0]];
    const hw = w(i / (n - 1)) / 2;
    left.push(add(pts[i], scale(nrm, hw)));
    right.push(add(pts[i], scale(nrm, -hw)));
  }
  return `${poly(left)}${polyCont(right.reverse())}Z`;
}

/** Tapered brush mark: thin at both ends, widest at `peak`. */
export const taper = (max: number, min = 0.2, peak = 0.5) => (u: number) => min + (max - min) * Math.sin(Math.PI * Math.min(1, u <= peak ? (u / peak) * 0.5 : 0.5 + ((u - peak) / (1 - peak)) * 0.5));

export const sw = (n: number) => ({ strokeWidth: n, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" });

/** Even-odd point-in-polygon test. */
export function inside(shape: readonly Pt[], p: Pt): boolean {
  let c = false;
  for (let i = 0, j = shape.length - 1; i < shape.length; j = i++) {
    const a = shape[i];
    const b = shape[j];
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
