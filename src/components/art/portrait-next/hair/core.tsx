/**
 * Shared hair building blocks. Every hairstyle is drawn in the same order of importance: silhouette, hairline,
 * two to six large masses, medium clumps, shadow and light masses, and only then a few strands. These helpers draw
 * those pieces; each technique decides their shape, so styles never collapse into one generic look.
 */
import type { ReactNode } from "react";
import type { FaceSpec, Head } from "../../portrait/anatomy";
import { CX, add, along, clamp, dist, hash01, lerp, sampleSegs, scale, splineSegs, sub, unit, type Pt } from "../../portrait/geometry";
import type { Detail } from "../face";
import { noise1, pieces, resample, ring, roughen, strokeLine } from "../ink";
import type { SkinTones } from "../palette";

export const P = (x: number, y: number): Pt => [x, y];
export const last = <T,>(a: readonly T[]): T => a[a.length - 1];
export const smooth = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};
/** Deterministic value in [lo, hi) for a player seed and a slot. */
export const rnd = (seed: number, i: number, lo: number, hi: number) => lo + (hi - lo) * hash01(seed, i);

// ------------------------------------------------------------------ input / output

export interface HairInput {
  f: FaceSpec;
  head: Head;
  color: string;
  skin: SkinTones;
  uid: string;
  d: Detail;
  /** 0-1 age recession of the hairline. */
  recede: number;
  /** Player seed: small, fixed variations (lock curvature, fringe offset, temple recession). */
  seed: number;
  /** Secondary (frosted tip) colour, if chosen, and the headband colour. */
  tip: string | null;
  band: string;
}

/**
 * Layers a technique returns, in drawing order: behind the head and shirt; on the skin (inside the head clip); the
 * main hair over the face ("mid", under a headband); locks in front of a headband ("front"); and the style's own
 * headband between the two when it has one. `extent` is the hair's outer half-width at a height (for a headband or
 * anything else that wraps the hair); `ears` says how the style treats the ears.
 */
export interface HairArt {
  back?: ReactNode;
  onSkin?: ReactNode;
  mid?: ReactNode;
  front?: ReactNode;
  band?: ReactNode;
  extent?: (y: number, s: 1 | -1) => number;
  ears?: "visible" | "partial" | "covered";
}

/** Half-width of an outer silhouette (left -> over the top -> right) at height y, per side. */
export function extentOf(outer: readonly Pt[]): (y: number, s: 1 | -1) => number {
  const top = outer.reduce((k, p, i) => (p[1] < outer[k][1] ? i : k), 0);
  const sides = { [-1]: outer.slice(0, top + 1).reverse(), [1]: outer.slice(top) } as Record<number, Pt[]>;
  return (y, s) => {
    const pts = sides[s];
    let best = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) best = Math.max(best, Math.abs(lerp(a[0], b[0], (y - a[1]) / (b[1] - a[1])) - CX));
    }
    return best;
  };
}

/** Height of the top of the skull at x (the upper outline), so crests and patches follow its curve. */
export function skullTop(head: Head, x: number): number {
  const s = x >= CX ? 1 : -1;
  const pts = s > 0 ? head.rightPts : head.leftPts;
  const dx = Math.abs(x - CX);
  for (let i = 1; i < pts.length; i++) {
    const a = Math.abs(pts[i - 1][0] - CX);
    const b = Math.abs(pts[i][0] - CX);
    if (b >= dx) return lerp(pts[i - 1][1], pts[i][1], b === a ? 0 : (dx - a) / (b - a));
  }
  return pts[pts.length - 1][1];
}

// ------------------------------------------------------------------ hairline

export type HairlineKind = "straight" | "rounded" | "widow" | "mature" | "receding" | "deep" | "irregular";
export const HAIRLINES: readonly HairlineKind[] = ["straight", "rounded", "widow", "mature", "receding", "deep", "irregular"];

export interface Hairline {
  /** Across the forehead, left temple corner -> right temple corner. */
  front: Pt[];
  /** Down each temple, corner -> bottom of the sideburn. */
  templeR: Pt[];
  templeL: Pt[];
  /** Height at the centre of the forehead. */
  y: number;
}

const RECESSION: Partial<Record<HairlineKind, number>> = { mature: 0.3, receding: 0.6, deep: 1 };

/**
 * Where hair meets skin. The temples recede up and in (an M) as age and the kind's own recession grow; the centre
 * moves back much less. The two temples are never identical: each side gets its own small, fixed offset.
 */
export function hairline(f: FaceSpec, head: Head, kind: HairlineKind, recede: number, seed: number, lift = 0): Hairline {
  const tW = f.templeW;
  const rec = clamp(recede + (RECESSION[kind] ?? 0), 0, 1.3);
  const cy = f.top + (f.browY - f.top) * 0.3 + lift + rec * 5 + (kind === "deep" ? 6 : 0);
  const side = (s: 1 | -1) => {
    const a = 1 + (hash01(seed, s > 0 ? 1 : 3) - 0.5) * 0.3;
    const dy = (hash01(seed, s > 0 ? 2 : 4) - 0.5) * 2.4;
    const midDy = kind === "rounded" ? 4 : kind === "straight" ? 0.8 : 2;
    const cornerDy = (kind === "rounded" ? 10 : kind === "straight" ? 3.5 : 6) - rec * 21 * a + dy;
    const mid = P(CX + s * tW * (0.3 - rec * 0.05), cy + midDy - rec * 3);
    const corner = P(CX + s * (tW * 0.63 - rec * 9 * a), cy + cornerDy);
    const yT = Math.max(corner[1] + 16, f.browY - 24 - rec * 4);
    const templeTop = P(CX + s * (head.half(yT, s) - 9.5), yT);
    const yB = f.ear.top + (f.ear.bot - f.ear.top) * 0.4;
    const burn = P(CX + s * (head.half(yB, s) - 6.5), yB);
    return { mid, corner, templeTop, burn };
  };
  const r = side(1);
  const l = side(-1);
  const centre: Pt[] = kind === "widow" ? [P(CX - 7, cy + 0.5), P(CX, cy + 6.5), P(CX + 7, cy + 0.5)] : [P(CX + (hash01(seed, 5) - 0.5) * 3, cy + (kind === "rounded" ? -0.5 : 0))];
  let front = along([l.corner, l.mid, ...centre, r.mid, r.corner], 6, 0.5);
  if (kind === "irregular") front = front.map((p, i) => P(p[0], p[1] + noise1(seed, i * 0.45) * 2.6));
  const temple = (t: typeof r) => along([t.corner, P(lerp(t.corner[0], t.templeTop[0], 0.6), lerp(t.corner[1], t.templeTop[1], 0.45)), t.templeTop, t.burn], 5, 0.5);
  return { front, templeR: temple(r), templeL: temple(l), y: cy };
}

// ------------------------------------------------------------------ edges and masses

/** A bump added to an edge: position along it (0-1), half-width (fraction of its length), height, sideways lean. */
export interface Bump {
  u: number;
  w: number;
  a: number;
  lean?: number;
}

/** Tuft profile: a sharp tip with concave sides. Lobe profile: a rounded bump. */
export const tuft = (x: number) => Math.pow(Math.max(0, 1 - Math.abs(x)), 1.7);
export const lobe = (x: number) => (Math.abs(x) >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * x));

/** Push an edge out along its normal (`sign` flips the side) by a few designed bumps; overlaps take the larger. */
export function bumped(pts: Pt[], bumps: readonly Bump[], profile: (x: number) => number, sign = 1): Pt[] {
  const n = pts.length - 1;
  return pts.map((p, i) => {
    const u = i / n;
    let best = 0;
    let lean = 0;
    for (const b of bumps) {
      const v = b.a * profile((u - b.u) / b.w);
      if (Math.abs(v) > Math.abs(best)) {
        best = v;
        lean = (b.lean ?? 0) * profile((u - b.u) / b.w);
      }
    }
    if (!best && !lean) return p;
    const a = pts[Math.max(0, i - 1)];
    const c = pts[Math.min(n, i + 1)];
    const t = unit(sub(c, a));
    const nrm: Pt = [t[1] * sign, -t[0] * sign];
    return add(add(p, scale(nrm, best)), scale(t, lean));
  });
}

/**
 * Rounded lobes of varied size and spacing along an edge, for curly and coily silhouettes. Spacing, height and the
 * odd larger lobe come from the seed, so the edge never reads as a regular scallop.
 */
export function lobedEdge(pts: Pt[], o: { seed: number; spacing: readonly [number, number]; amp: readonly [number, number]; big?: number; sign?: number; step?: number }): Pt[] {
  const step = o.step ?? 1.4;
  const res = resample(pts, step);
  const len = Math.max(1, (res.length - 1) * step);
  const bumps: Bump[] = [];
  let s = rnd(o.seed, 0, 0.2, 0.7) * o.spacing[0];
  for (let k = 1; s < len; k++) {
    const sp = rnd(o.seed, k, o.spacing[0], o.spacing[1]);
    let a = rnd(o.seed, k + 100, o.amp[0], o.amp[1]);
    if (o.big && hash01(o.seed, k + 200) < o.big) a *= 1.6;
    bumps.push({ u: s / len, w: (sp * 0.62) / len, a });
    s += sp;
  }
  return bumped(res, bumps, lobe, o.sign ?? 1);
}

/** Tips hanging from an edge (fringe, hair ends): straight down with a lean; neighbours blend as a soft maximum. */
export function hanging(pts: Pt[], tips: readonly Bump[], profile: (x: number) => number = tuft): Pt[] {
  const n = pts.length - 1;
  return pts.map((p, i) => {
    const u = i / n;
    let sum = 0;
    let lean = 0;
    let wsum = 0;
    for (const b of tips) {
      const v = b.a * profile((u - b.u) / b.w);
      if (v <= 0) continue;
      sum += v ** 3;
      lean += (b.lean ?? 0) * v;
      wsum += b.a;
    }
    return sum ? P(p[0] + (lean / Math.max(1, wsum)) * 1.6, p[1] + sum ** (1 / 3)) : p;
  });
}

/**
 * The skull outline from `yS` on the left, over the crown, down to `yS` on the right, pushed out by the hair's
 * thickness: `side` at yS growing to `top` at the crown. Hair volume always follows the head underneath.
 */
export function shell(f: FaceSpec, head: Head, yS: number, side: number, top: number, sideR = side): Pt[] {
  const L = head.leftPts.filter((p) => p[1] <= yS).reverse();
  const R = head.rightPts.filter((p) => p[1] <= yS);
  const dome = [...L, ...R.slice(1)];
  const c = P(CX, f.top + f.skullW * 0.95);
  const pushed = dome.map((p) => {
    const t = clamp((yS - p[1]) / Math.max(1, yS - f.top), 0, 1);
    const s0 = p[0] > CX ? sideR : side;
    return add(p, scale(unit(sub(p, c)), s0 + (top - s0) * Math.pow(t, 1.25)));
  });
  return resample(pushed, 2.2);
}

/** Widest half-width of the head between y0 and y (hair falls straight from the widest point, it doesn't follow the jaw in). */
export function fallHalf(head: Head, s: 1 | -1, y0: number, y: number): number {
  let m = 0;
  for (let t = y0; t <= y; t += 4) m = Math.max(m, head.half(Math.min(t, y), s));
  return Math.max(m, head.half(y, s));
}

/** `n` points evenly spaced by arc length. */
export function resampleN(pts: readonly Pt[], n: number): Pt[] {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + dist(pts[i - 1], pts[i]));
  const total = last(acc) || 1;
  const out: Pt[] = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const s = (k / (n - 1)) * total;
    while (j < pts.length - 1 && acc[j] < s) j++;
    const t = clamp((s - acc[j - 1]) / (acc[j] - acc[j - 1] || 1), 0, 1);
    out.push(P(lerp(pts[j - 1][0], pts[j][0], t), lerp(pts[j - 1][1], pts[j][1], t)));
  }
  return out;
}

/** Closed smooth loop through control points. */
export const loop = (pts: readonly Pt[], steps = 6, tension = 0.5): Pt[] => sampleSegs(splineSegs(pts, true, tension), steps);

/** A large hair mass: a closed smooth shape with a little deterministic irregularity on its edge. */
export function organicMass(pts: readonly Pt[], o: { seed: number; rough?: number; freq?: number; tension?: number }): string {
  const l = loop(pts, 6, o.tension ?? 0.5);
  return ring(o.rough ? roughen(l, o.rough, o.seed, o.freq ?? 0.3) : l);
}

export interface LockOpts {
  /** Full width at the widest point. */
  w: number;
  /** Width at the root and at the tip, as fractions of w, and where it is widest. */
  root?: number;
  tip?: number;
  peak?: number;
  /** A rounded end (locs, curl ends) instead of a point. */
  round?: boolean;
  /** Small, smooth unevenness of the width. */
  wobble?: number;
  /** Slow swelling and pinching along the length (0 even .. ~0.3 lumpy). */
  swell?: number;
  /** A flattened, wider section: where (0-1) and how much wider. */
  flat?: { u: number; k: number };
  seed: number;
  steps?: number;
}

/** Outline of a tapered lock or clump following a curve (root -> tip). */
export function lockOutline(path: readonly Pt[], o: LockOpts): Pt[] {
  const line = along(path, o.steps ?? 6);
  const n = line.length;
  const root = o.root ?? 0.9;
  const tip = o.tip ?? 0.3;
  const peak = o.peak ?? 0.25;
  const wob = o.wobble ?? 0.08;
  const L: Pt[] = [];
  const R: Pt[] = [];
  let hwEnd = 0;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const t = unit(sub(line[Math.min(n - 1, i + 1)], line[Math.max(0, i - 1)]));
    const nr: Pt = [-t[1], t[0]];
    const k = u < peak ? lerp(root, 1, smooth(u / peak)) : lerp(1, tip, smooth((u - peak) / (1 - peak)));
    const flat = o.flat ? 1 + o.flat.k * lobe((u - o.flat.u) / 0.2) : 1;
    const hw = (o.w / 2) * k * flat * (1 + wob * noise1(o.seed, u * 7) + (o.swell ?? 0) * noise1(o.seed + 3, u * 2.6));
    L.push(add(line[i], scale(nr, hw)));
    R.push(add(line[i], scale(nr, -hw)));
    hwEnd = hw;
  }
  const cap: Pt[] = [];
  if (o.round && n > 1) {
    const e = line[n - 1];
    const t = unit(sub(line[n - 1], line[n - 2]));
    const nr: Pt = [-t[1], t[0]];
    for (let k = 1; k < 6; k++) {
      const th = (Math.PI * k) / 6;
      cap.push(add(e, add(scale(nr, hwEnd * Math.cos(th)), scale(t, hwEnd * Math.sin(th) * 0.9))));
    }
  }
  return [...L, ...cap, ...R.reverse()];
}

export const taperedLock = (path: readonly Pt[], o: LockOpts) => ring(lockOutline(path, o));

/** Bend a control polyline: each interior point is pushed sideways a little (a lock is never a clean curve). */
export function bend(pts: readonly Pt[], seed: number, amp: number): Pt[] {
  return pts.map((p, i) => {
    if (i === 0 || i === pts.length - 1) return p;
    const t = unit(sub(pts[i + 1], pts[i - 1]));
    const k = (hash01(seed, i + 61) - 0.5) * 2 * amp;
    return P(p[0] - t[1] * k, p[1] + t[0] * k);
  });
}

/**
 * A ringlet (a curly lock seen from the front): its centre line swings from side to side, more towards the end, and
 * its width swells where a coil faces out and pinches between coils. Returns the outline and, for shading, where each
 * coil turns under (a point on the lock and the direction across it).
 */
export function ringlet(path: readonly Pt[], o: { w: number; turns: number; amp: number; seed: number; tip?: number }): { outline: Pt[]; turns: { p: Pt; n: Pt; hw: number }[] } {
  const line = resampleN(along(path, 6), 44);
  const n = line.length;
  const ph = hash01(o.seed, 7) * 6.28;
  const tip = o.tip ?? 0.45;
  const L: Pt[] = [];
  const R: Pt[] = [];
  const turns: { p: Pt; n: Pt; hw: number }[] = [];
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const t = unit(sub(line[Math.min(n - 1, i + 1)], line[Math.max(0, i - 1)]));
    const nr: Pt = [-t[1], t[0]];
    const a = u * o.turns * Math.PI * 2 + ph;
    const c = add(line[i], scale(nr, o.amp * Math.sin(a) * (0.35 + 0.65 * u)));
    const hw = (o.w / 2) * lerp(1, tip, u) * (0.82 + 0.22 * Math.cos(a)) * (u < 0.08 ? 0.75 + 3 * u : 1);
    L.push(add(c, scale(nr, hw)));
    R.push(add(c, scale(nr, -hw)));
    const k = Math.floor((a - Math.PI) / (Math.PI * 2));
    if (i > 2 && k !== prev && u < 0.95) turns.push({ p: c, n: nr, hw });
    prev = k;
  }
  // A rounded end.
  const t = unit(sub(line[n - 1], line[n - 2]));
  const nr: Pt = [-t[1], t[0]];
  const end = scale(add(L[n - 1], R[n - 1]), 0.5);
  const hwEnd = dist(L[n - 1], R[n - 1]) / 2;
  const cap: Pt[] = [];
  for (let k = 1; k < 5; k++) {
    const th = (Math.PI * k) / 5;
    cap.push(add(end, add(scale(nr, hwEnd * Math.cos(th)), scale(t, hwEnd * Math.sin(th)))));
  }
  return { outline: [...L, ...cap, ...R.reverse()], turns };
}

/** The same outline moved: a contact shadow under an overlapping lock, or a cast shadow on the skin. */
export const offset = (pts: readonly Pt[], dx: number, dy: number): Pt[] => pts.map((p) => P(p[0] + dx, p[1] + dy));

/** A directional highlight (or separation) along part of a flow line. */
export function hairStroke(path: readonly Pt[], o: { from: number; to: number; w: number; seed: number; start?: number; end?: number; peak?: number }): string {
  return pieces(path, [[o.from, o.to]], 7)
    .map((p) => strokeLine(p, { w: o.w, start: o.start ?? 0.15, end: o.end ?? 0.1, peak: o.peak ?? 0.4, seed: o.seed, wobble: 0.12 }))
    .join("");
}

/** An irregular clump of curls: a lumpy rounded shape, never a ring or a C. */
export function coilyCluster(c: Pt, r: number, o: { seed: number; lobes?: number; squash?: number; rot?: number }): string {
  const K = 14;
  const lobes = o.lobes ?? 4;
  const sq = o.squash ?? 0.85;
  const rot = o.rot ?? 0;
  const ph = hash01(o.seed, 1) * 6.28;
  const pts = Array.from({ length: K }, (_, k) => {
    const th = (k / K) * Math.PI * 2;
    const rr = r * (1 + 0.2 * Math.sin(lobes * th + ph) + 0.12 * noise1(o.seed, k * 0.8));
    const x = Math.cos(th) * rr;
    const y = Math.sin(th) * rr * sq;
    return P(c[0] + x * Math.cos(rot) - y * Math.sin(rot), c[1] + x * Math.sin(rot) + y * Math.cos(rot));
  });
  return ring(loop(pts, 3));
}

/** A single curl indication: a short tightening arc. Used sparingly, never as a fill pattern. */
export function curlMark(c: Pt, r: number, o: { seed: number; rot: number; w?: number }): string {
  const pts = Array.from({ length: 7 }, (_, k) => {
    const a = o.rot + (k / 6) * 4.2;
    const rr = r * (1 - (0.3 * k) / 6);
    return P(c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr * 0.9);
  });
  return strokeLine(along(pts, 2), { w: o.w ?? 0.8, start: 0.35, end: 0.1, peak: 0.35, seed: o.seed });
}

/** Region between an edge and the same edge shifted (light from the upper left): a cast shadow on the skin. */
export function castBand(edge: readonly Pt[], dx: number, dy: number): string {
  return ring([...edge, ...edge.map((p) => P(p[0] + dx, p[1] + dy)).reverse()]);
}

/** Everything below an edge shifted down: the shadow a fringe drops on the forehead (clipped to the head). */
export function castBelow(edge: readonly Pt[], dx: number, dy: number, top: number): string {
  const s = edge.map((p) => P(p[0] + dx, p[1] + dy));
  const rtl = s[0][0] > last(s)[0];
  return ring([...s, P(rtl ? CX - 170 : CX + 170, top - 70), P(rtl ? CX + 170 : CX - 170, top - 70)]);
}

/** Points of a polygon inside which texture may be placed, sampled on a jittered grid. */
export function scatter(poly: readonly Pt[], step: number, seed: number): Pt[] {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const out: Pt[] = [];
  let k = 0;
  for (let y = Math.min(...ys); y < Math.max(...ys); y += step * 0.86) {
    for (let x = Math.min(...xs) + ((Math.round(y / step) % 2) * step) / 2; x < Math.max(...xs); x += step) {
      const p = P(x + (hash01(seed, k) - 0.5) * step * 0.7, y + (hash01(seed, k + 997) - 0.5) * step * 0.7);
      k++;
      if (insidePoly(poly, p)) out.push(p);
    }
  }
  return out;
}

function insidePoly(shape: readonly Pt[], p: Pt): boolean {
  let c = false;
  for (let i = 0, j = shape.length - 1; i < shape.length; j = i++) {
    const a = shape[i];
    const b = shape[j];
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

/** Ink for an outer silhouette: the strongest line in the hair, optionally broken where light hits. */
export function silhouetteInk(pts: readonly Pt[], d: Detail, seed: number, keep: readonly (readonly [number, number])[] = [[0, 1]], w = 2): string {
  return pieces(pts, keep, 1)
    .map((p) => strokeLine(p, { w: w * (d === 0 ? 1.35 : 1), start: 0.55, end: 0.6, peak: 0.7, seed, wobble: 0.15 }))
    .join("");
}

// ------------------------------------------------------------------ tone on the skin

/**
 * Hair seen as colour on the skin (shaved scalps, short and faded sides): a vertical gradient, never dots. A soft
 * edge (blur) only at close-up size, where it shows and where few portraits are on screen.
 */
export function fadeRegion(id: string, region: string, color: string, d: Detail, g: { y0: number; y1: number; o0: number; o1: number; mid?: readonly [number, number] }) {
  return (
    <g>
      <defs>
        {d === 2 && (
          <filter id={`${id}b`} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation={1.4} />
          </filter>
        )}
        <linearGradient id={`${id}g`} gradientUnits="userSpaceOnUse" x1="0" y1={g.y0} x2="0" y2={g.y1}>
          <stop offset="0" stopColor={color} stopOpacity={g.o0} />
          {g.mid && <stop offset={g.mid[0]} stopColor={color} stopOpacity={g.mid[1]} />}
          <stop offset="1" stopColor={color} stopOpacity={g.o1} />
        </linearGradient>
      </defs>
      <path d={region} fill={`url(#${id}g)`} filter={d === 2 ? `url(#${id}b)` : undefined} />
    </g>
  );
}

/** The scalp above the hairline (front and temples), extended past the head (it is clipped to it). */
export function scalpRegion(hl: Hairline, f: FaceSpec): Pt[] {
  const R = hl.templeR;
  const L = hl.templeL;
  return [...L.slice().reverse(), ...hl.front, ...R, P(CX + 160, last(R)[1]), P(CX + 160, f.top - 60), P(CX - 160, f.top - 60), P(CX - 160, last(L)[1])];
}

/** Side region between a temple line and the head edge (for short and faded sides). */
export function sideRegion(temple: Pt[], s: 1 | -1, y0: number): Pt[] {
  const t = temple.filter((p) => p[1] >= y0);
  const yB = last(t)[1];
  return [...t, P(CX + s * 160, yB + 2), P(CX + s * 160, y0 - 4)];
}

/** One shape used both as a clip and as a fill, written once: fill it with `<use href={`#${id}s`} />`. */
export function ShapeDefs({ id, d }: { id: string; d: string }) {
  return (
    <defs>
      <path id={`${id}s`} d={d} />
      <clipPath id={id}>
        <use href={`#${id}s`} />
      </clipPath>
    </defs>
  );
}

/** A clip path made of several shapes (their union). */
export function ClipDefs({ id, shapes }: { id: string; shapes: readonly string[] }) {
  return (
    <defs>
      <clipPath id={id}>
        {shapes.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </clipPath>
    </defs>
  );
}
