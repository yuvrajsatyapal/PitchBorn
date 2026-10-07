/**
 * Hand-drawn line helpers. Every line is a filled brush stroke whose width swells and tapers along its length,
 * with a little deterministic unevenness, and can stop, break or fade instead of closing every shape.
 */
import { add, along, hash01, scale, sub, unit, type Pt } from "../portrait/geometry";

// ------------------------------------------------------------------ size-aware output

/**
 * Path output depends on the size the portrait is drawn at: points that can't move a pixel are dropped and
 * coordinates are written only as precisely as they can show. Set for one synchronous render with `withDetail`.
 */
let tol = 0.12;
let dec = 1;
const TOL = [0.8, 0.35, 0.12] as const;

export function withDetail<T>(d: 0 | 1 | 2, fn: () => T): T {
  const prev = [tol, dec];
  tol = TOL[d];
  dec = d === 0 ? 0 : 1;
  try {
    return fn();
  } finally {
    [tol, dec] = prev;
  }
}

/** Douglas-Peucker: keep only the points that move the line by more than `t`. */
export function simplify(pts: readonly Pt[], t = tol): readonly Pt[] {
  const n = pts.length;
  if (n < 4 || t <= 0) return pts;
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  const t2 = t * t;
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = pts[a];
    const dx = pts[b][0] - ax;
    const dy = pts[b][1] - ay;
    const len2 = dx * dx + dy * dy || 1e-9;
    let max = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const u = Math.max(0, Math.min(1, ((pts[i][0] - ax) * dx + (pts[i][1] - ay) * dy) / len2));
      const ex = ax + u * dx - pts[i][0];
      const ey = ay + u * dy - pts[i][1];
      const d2 = ex * ex + ey * ey;
      if (d2 > max) {
        max = d2;
        idx = i;
      }
    }
    if (max > t2 && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

const num = (v: number) => (dec ? Math.round(v * 10) / 10 : Math.round(v));

/** A polyline or polygon as path data, simplified and rounded for the current size. */
export function pathOf(pts: readonly Pt[], closed = true): string {
  const s = simplify(pts);
  let out = "";
  let px = NaN;
  let py = NaN;
  for (const p of s) {
    const x = num(p[0]);
    const y = num(p[1]);
    if (x === px && y === py) continue;
    out += `${out ? "L" : "M"}${x} ${y}`;
    px = x;
    py = y;
  }
  return out && closed ? `${out}Z` : out;
}

/** Outline of a band whose width varies along a line (a brush stroke). */
function ribbonPts(line: readonly Pt[], w: (u: number) => number): Pt[] {
  const n = line.length;
  if (n < 2) return [];
  const L: Pt[] = [];
  const R: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = unit(sub(line[Math.min(n - 1, i + 1)], line[Math.max(0, i - 1)]));
    const nr: Pt = [-t[1], t[0]];
    const hw = w(i / (n - 1)) / 2;
    L.push(add(line[i], scale(nr, hw)));
    R.push(add(line[i], scale(nr, -hw)));
  }
  return [...L, ...R.reverse()];
}

/** Smooth deterministic 1D noise in [-1, 1]. */
export function noise1(seed: number, x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash01(seed, i) * 2 - 1;
  const b = hash01(seed, i + 1) * 2 - 1;
  const t = f * f * (3 - 2 * f);
  return a + (b - a) * t;
}

export interface StrokeOpts {
  /** Width at the thickest point. */
  w: number;
  /** Width at each end as a fraction of w. */
  start?: number;
  end?: number;
  /** Where along the stroke it is thickest (0-1). */
  peak?: number;
  /** Unevenness of the width (0-1). */
  wobble?: number;
  seed?: number;
  /** Curve resolution. */
  steps?: number;
}

const profile = (u: number, o: StrokeOpts) => {
  const start = o.start ?? 0.2;
  const end = o.end ?? 0.15;
  const peak = o.peak ?? 0.45;
  if (u <= peak) {
    const t = u / peak;
    return start + (1 - start) * Math.sin((t * Math.PI) / 2);
  }
  const t = (u - peak) / (1 - peak);
  return end + (1 - end) * Math.cos((t * Math.PI) / 2);
};

/** A tapered pen stroke along a smooth curve through `pts`. */
export function stroke(pts: readonly Pt[], o: StrokeOpts): string {
  const line = along(pts, o.steps ?? 6);
  const seed = o.seed ?? 1;
  const wob = o.wobble ?? 0.18;
  return pathOf(ribbonPts(line, (u) => Math.max(0.05, o.w * profile(u, o) * (1 + wob * noise1(seed, u * 5)))));
}

/** Sample a smooth curve and keep only the parts between the given [from, to] fractions (for broken lines). */
export function pieces(pts: readonly Pt[], keep: readonly (readonly [number, number])[], steps = 8): Pt[][] {
  const line = along(pts, steps);
  const n = line.length - 1;
  return keep.map(([a, b]) => line.slice(Math.round(a * n), Math.round(b * n) + 1)).filter((p) => p.length > 1);
}

/** Stroke a sampled polyline directly (already dense). */
export function strokeLine(line: readonly Pt[], o: StrokeOpts): string {
  const seed = o.seed ?? 1;
  const wob = o.wobble ?? 0.18;
  return pathOf(ribbonPts(line, (u) => Math.max(0.05, o.w * profile(u, o) * (1 + wob * noise1(seed, u * 5)))));
}

/** Push each point of a closed or open outline in or out along its normal by smooth noise: painted, not ruled. */
export function roughen(pts: readonly Pt[], amp: number, seed: number, freq = 0.35): Pt[] {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const t = unit([b[0] - a[0], b[1] - a[1]]);
    const k = amp * noise1(seed, i * freq);
    return [p[0] - t[1] * k, p[1] + t[0] * k] as Pt;
  });
}

/** A closed smooth shape through points. */
export function blob(pts: readonly Pt[], tension = 0.5): string {
  const line = along([...pts, pts[0], pts[1]], 6, tension);
  const n = line.length;
  // drop the duplicated tail so the closing segment isn't drawn twice
  const cut = line.slice(0, Math.max(3, n - 6));
  return pathOf(cut);
}

/** Evenly spaced points along a polyline (spacing `step`), so displacements don't bunch up where the input is dense. */
export function resample(pts: readonly Pt[], step: number): Pt[] {
  const out: Pt[] = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let s = step - carry;
    while (s <= len) {
      const t = s / len;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      s += step;
    }
    carry = len - (s - step);
  }
  const last = pts[pts.length - 1];
  const end = out[out.length - 1];
  if (Math.hypot(last[0] - end[0], last[1] - end[1]) > step * 0.35) out.push(last);
  return out;
}

/** Closed path through points (no smoothing). */
export const ring = (pts: readonly Pt[]) => pathOf(pts);
