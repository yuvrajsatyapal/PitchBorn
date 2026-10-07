/**
 * Hair, built the way an illustrator builds it: a hairline, then one silhouette, then a few large masses (light and
 * shadow), then medium clumps (separations and lit edges that follow the growth), then only a few single strands.
 * No repeated arcs, no sawtooth edges, no helmet: tips and lobes vary in size and spacing and the silhouette is
 * designed per cut. Each hair type has its own technique.
 */
import type { ReactNode } from "react";
import type { Head } from "../portrait/anatomy";
import { CX, add, along, clamp, hash01, lerp, scale, sub, unit, type Pt } from "../portrait/geometry";
import type { Detail } from "./face";
import type { NextSpec } from "./head";
import { blob, noise1, pieces, resample, ring, roughen, strokeLine } from "./ink";
import { INK, hairTones, mixHex, type SkinTones } from "./palette";

const P = (x: number, y: number): Pt => [x, y];

// ------------------------------------------------------------------ hairline

export type HairlineKind = "straight" | "rounded" | "widow" | "mature" | "receding" | "deep" | "irregular";
export const HAIRLINES: readonly HairlineKind[] = ["straight", "rounded", "widow", "mature", "receding", "deep", "irregular"];

export interface Hairline {
  /** Across the forehead, left temple corner -> right temple corner. */
  front: Pt[];
  /** Down each temple, corner -> bottom of the sideburn. */
  templeR: Pt[];
  templeL: Pt[];
  /** Height of the hairline at the centre of the forehead. */
  y: number;
}

const RECESSION: Partial<Record<HairlineKind, number>> = { mature: 0.3, receding: 0.6, deep: 1 };

/**
 * Where hair meets skin. Temples recede up and in (an M) as `recede` (age) and the kind's own recession grow; the
 * centre moves back much less. Seeded so the two sides are never quite the same.
 */
export function hairline(f: NextSpec, head: Head, kind: HairlineKind, recede: number, seed: number, lift = 0): Hairline {
  const tW = f.templeW;
  const rec = clamp(recede + (RECESSION[kind] ?? 0), 0, 1.3);
  const cy = f.top + (f.browY - f.top) * 0.3 + lift + rec * 5 + (kind === "deep" ? 6 : 0);
  const h = (i: number) => hash01(seed, i);
  const side = (s: 1 | -1) => {
    const a = s > 0 ? 1 + (h(1) - 0.5) * 0.25 : 1;
    const midDy = kind === "rounded" ? 4 : kind === "straight" ? 0.8 : 2;
    const cornerDy = (kind === "rounded" ? 10 : kind === "straight" ? 3.5 : 6) - rec * 21 * a;
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
  const centre: Pt[] =
    kind === "widow" ? [P(CX - 7, cy + 0.5), P(CX, cy + 6.5), P(CX + 7, cy + 0.5)] : [P(CX + (h(2) - 0.5) * 3, cy + (kind === "rounded" ? -0.5 : 0))];
  let front = along([l.corner, l.mid, ...centre, r.mid, r.corner], 6, 0.5);
  if (kind === "irregular") front = front.map((p, i) => P(p[0], p[1] + noise1(seed, i * 0.45) * 2.6));
  const templeR = along([r.corner, P(lerp(r.corner[0], r.templeTop[0], 0.6), lerp(r.corner[1], r.templeTop[1], 0.45)), r.templeTop, r.burn], 5, 0.5);
  const templeL = along([l.corner, P(lerp(l.corner[0], l.templeTop[0], 0.6), lerp(l.corner[1], l.templeTop[1], 0.45)), l.templeTop, l.burn], 5, 0.5);
  return { front, templeR, templeL, y: cy };
}

// ------------------------------------------------------------------ shapes

/** A tuft or lobe added to an edge: position along it (0-1), half-width (fraction), height, sideways lean. */
export interface Bump {
  u: number;
  w: number;
  a: number;
  lean?: number;
}

/** Tuft profile: a sharp tip with concave sides. Lobe profile: a rounded bump. */
const tuft = (x: number) => Math.pow(Math.max(0, 1 - Math.abs(x)), 1.7);
const lobe = (x: number) => (Math.abs(x) >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * x));

/**
 * Displace an evenly sampled edge by a few designed bumps along its outward normal (`sign` flips the side). Bumps
 * that overlap take the larger, so neighbours never merge into a wave.
 */
function bumped(pts: Pt[], bumps: readonly Bump[], profile: (x: number) => number, sign = 1): Pt[] {
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
 * Tips hanging from an edge (a fringe): displacement straight down with a lean. Overlapping clumps combine as a
 * soft maximum, so each tip stays sharp but the notch between two clumps is rounded and never back at the base.
 */
function hanging(pts: Pt[], tips: readonly Bump[], profile: (x: number) => number = tuft): Pt[] {
  const n = pts.length - 1;
  const k = 3;
  return pts.map((p, i) => {
    const u = i / n;
    let sum = 0;
    let lean = 0;
    let wsum = 0;
    for (const b of tips) {
      const v = b.a * profile((u - b.u) / b.w);
      if (v <= 0) continue;
      sum += v ** k;
      lean += (b.lean ?? 0) * v;
      wsum += b.a;
    }
    return sum ? P(p[0] + lean / Math.max(1, wsum) * 1.6, p[1] + sum ** (1 / k)) : p;
  });
}

/**
 * The hair's outer shell: the skull outline from `yS` on the left, over the crown, down to `yS` on the right,
 * pushed out by the hair's thickness (side thickness at yS, `top` at the crown).
 */
function shell(f: NextSpec, head: Head, yS: number, side: number, top: number, sideR = side): Pt[] {
  const L = head.leftPts.filter((p) => p[1] <= yS).reverse();
  const R = head.rightPts.filter((p) => p[1] <= yS);
  const dome = [...L, ...R.slice(1)];
  const c = P(CX, f.top + f.skullW * 0.95);
  const pushed = dome.map((p) => {
    const t = clamp((yS - p[1]) / Math.max(1, yS - f.top), 0, 1);
    const s0 = p[0] > CX ? sideR : side;
    const th = s0 + (top - s0) * Math.pow(t, 1.25);
    return add(p, scale(unit(sub(p, c)), th));
  });
  return resample(pushed, 2.2);
}

// ------------------------------------------------------------------ context

export interface HairInput {
  f: NextSpec;
  head: Head;
  color: string;
  skin: SkinTones;
  uid: string;
  d: Detail;
  recede: number;
  seed: number;
}

/** What a technique returns: layers drawn on the skin (inside the head clip), and the hair itself. */
export interface HairArt {
  onSkin?: ReactNode;
  back?: ReactNode;
  front?: ReactNode;
}

/** A soft-edged tone over the scalp or the sides: hair seen through as colour, never as dots. */
function scalpTone(id: string, region: string, color: string, opacity: number, d: Detail, gradient?: { y0: number; y1: number; o0: number; o1: number }) {
  const blur = d > 0 ? `url(#${id}b)` : undefined;
  return (
    <g>
      <defs>
        {d > 0 && (
          <filter id={`${id}b`} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation={d === 2 ? 1.6 : 1.2} />
          </filter>
        )}
        {gradient && (
          <linearGradient id={`${id}g`} gradientUnits="userSpaceOnUse" x1="0" y1={gradient.y0} x2="0" y2={gradient.y1}>
            <stop offset="0" stopColor={color} stopOpacity={gradient.o0} />
            <stop offset="1" stopColor={color} stopOpacity={gradient.o1} />
          </linearGradient>
        )}
      </defs>
      <path d={region} fill={gradient ? `url(#${id}g)` : color} opacity={gradient ? 1 : opacity} filter={blur} />
    </g>
  );
}

/** Polygon of the scalp above the hairline (front + temples), extended well past the head (it is clipped). */
function scalpRegion(hl: Hairline, f: NextSpec): Pt[] {
  const R = hl.templeR;
  const L = hl.templeL;
  return [...L.slice().reverse(), ...hl.front, ...R, P(CX + 160, R[R.length - 1][1]), P(CX + 160, f.top - 60), P(CX - 160, f.top - 60), P(CX - 160, L[L.length - 1][1])];
}

/** Side region between a temple line and the head edge (for tapered and faded sides). */
function sideRegion(temple: Pt[], s: 1 | -1, y0: number): Pt[] {
  const t = temple.filter((p) => p[1] >= y0);
  const yB = t[t.length - 1][1];
  return [...t, P(CX + s * 160, yB + 2), P(CX + s * 160, y0 - 4)];
}

// ------------------------------------------------------------------ techniques

/** Hair shaved to the scalp: tone only, densest on top, softer at the hairline; the head shape stays the star. */
export function shavedHair(i: HairInput, kind: HairlineKind = "straight", density = 0.32): HairArt {
  const { f, head, color, skin, uid, d, recede, seed } = i;
  const hl = hairline(f, head, kind, recede, seed);
  const tone = mixHex(color, skin.deep, 0.25);
  return {
    onSkin: (
      <g>
        {scalpTone(`${uid}sv`, ring(scalpRegion(hl, f)), tone, density, d, { y0: f.top, y1: hl.y + 6, o0: density * 1.1, o1: density * 0.75 })}
        {/* A slightly deeper band where hair is densest, just behind the hairline. */}
        {d > 0 && scalpTone(`${uid}sv2`, ring([...hl.front.map((p) => P(p[0], p[1] - 3)), ...hl.front.slice().reverse().map((p) => P(p[0], p[1] - 14))]), tone, density * 0.35, d)}
      </g>
    ),
  };
}

interface CropOpts {
  kind: HairlineKind;
  /** Volume on top and at the sides of the mass. */
  top: number;
  side: number;
  /** How the sides are cut: tone that fades out ("fade") or stays ("taper"). */
  sides: "taper" | "fade";
  /** Fringe tips: position across the forehead (0 left .. 1 right), half-width, length, lean. */
  tips: readonly Bump[];
  /** Tufts on the silhouette (position 0 left .. 1 right along the shell). */
  tufts: readonly Bump[];
  /** Fringe drop below the hairline (base of the tips). */
  drop: number;
}

/**
 * Short straight or wavy hair worn forward (textured crop, caesar-like cuts): a short-sided shell, a top mass that
 * breaks into a handful of forward clumps over the forehead, separations running back to the crown and lit
 * clump edges on the upper left.
 */
export function cropHair(i: HairInput, o: CropOpts): HairArt {
  const { f, head, color, skin, uid, d, recede, seed } = i;
  const T = hairTones(color);
  const hl = hairline(f, head, o.kind, recede, seed);
  const h = (k: number) => hash01(seed + 17, k);
  const cornerR = hl.front[hl.front.length - 1];
  const cornerL = hl.front[0];
  // The solid mass stops just below the temple corners; below that the short sides are tone on the skin.
  const yS = Math.max(cornerR[1], cornerL[1]) + 11;
  const outer = bumped(bumped(shell(f, head, yS, o.side, o.top, o.side + 0.5), [{ u: 0.42, w: 0.3, a: 2.5 }], lobe), o.tufts, tuft);
  // Front edge: right temple corner -> left, sitting a little below the hairline, with the clumps hanging off it.
  const base = [cornerR, ...hl.front.filter((_, k) => k % 5 === 3).reverse().map((p, k) => P(p[0], p[1] + o.drop + noise1(seed, k) * 1.2)), cornerL];
  const fringe = hanging(resample(along(base, 6, 0.5), 1.5), o.tips.map((t) => ({ ...t, u: 1 - t.u })));
  const sideFront = (s: 1 | -1, end: Pt, corner: Pt) => along([end, P(lerp(end[0], corner[0], 0.45) - s * 1, lerp(end[1], corner[1], 0.6)), corner], 4, 0.5);
  const sR = sideFront(1, outer[outer.length - 1], cornerR);
  const sL = sideFront(-1, outer[0], cornerL);
  const region = [...outer, ...sR.slice(1), ...fringe.slice(1), ...sL.slice().reverse().slice(1)];
  const clip = `${uid}hc`;

  // Growth: every clump runs from a fringe tip back towards the crown, fanning out.
  const crown = P(CX + 6, f.top - o.top * 0.5);
  const at = (u: number) => fringe[Math.round(clamp(1 - u, 0, 1) * (fringe.length - 1))];
  const flow = (from: Pt, k: number, reach = 1): Pt[] => {
    const spread = (from[0] - CX) * 0.45;
    const end = P(crown[0] + spread * 0.7 + (h(k + 9) - 0.5) * 6, crown[1] + 6);
    return [from, P(lerp(from[0], end[0], 0.45) + (h(k) - 0.5) * 3 - 1.5, lerp(from[1], end[1], 0.5)), P(lerp(from[0], end[0], reach), lerp(from[1], end[1], reach))];
  };
  const seps: string[] = [];
  const lights: string[] = [];
  const softLights: string[] = [];
  // Separations: from the notch between two clumps, back into the mass, fading out at different lengths.
  for (let k = 0; k < o.tips.length - 1; k++) {
    const a = o.tips[k];
    const b = o.tips[k + 1];
    const p = at((a.u + a.w * 0.5 + (b.u - b.w * 0.5)) / 2);
    const len = 0.35 + h(k + 30) * 0.45;
    if (d === 0 && k % 2) continue;
    for (const part of pieces(flow(P(p[0], p[1] - 1.5), k + 50), [[0, len]], 7)) seps.push(strokeLine(part, { w: d === 0 ? 2.2 : d === 1 ? 1.8 : 1.4, start: 0.9, end: 0.05, peak: 0.12, seed: seed + k }));
  }
  // Lit clumps (left of centre): a main light and a smaller companion, mid-way along the clump.
  o.tips.forEach((t, k) => {
    const tip = at(t.u);
    const lit = tip[0] < CX + 10;
    if (d === 0) return;
    const path = flow(P(tip[0] + 2, tip[1] - 4), k);
    const a0 = 0.18 + h(k + 40) * 0.12;
    const a1 = a0 + 0.22 + h(k + 41) * 0.18;
    const main = pieces(path, [[a0, a1]], 7);
    const side = pieces(path.map((p) => P(p[0] - 2.6, p[1] + 1)), [[a0 + 0.06, a0 + 0.06 + (a1 - a0) * 0.55]], 7);
    for (const part of main) (lit ? lights : softLights).push(strokeLine(part, { w: d === 2 ? 2.4 : 2.8, start: 0.2, end: 0.15, peak: 0.4, seed: seed + 90 + k }));
    if (lit && d === 2) for (const part of side) lights.push(strokeLine(part, { w: 1.3, start: 0.2, end: 0.15, peak: 0.4, seed: seed + 95 + k }));
  });
  // Shadow masses: the right third (its edge follows a clump, so it reads as hair turning away, not a panel),
  // and the band where the clumps curl down off the forehead.
  const edgeTip = at(0.76);
  const edge = along(flow(P(edgeTip[0], edgeTip[1] + 2), 77, 1.25), 6).map((p, k) => P(p[0] + noise1(seed + 4, k * 0.6) * 1.8, p[1]));
  const shadeR = ring([...edge, P(CX + 130, crown[1] - 30), P(CX + 130, yS + 20), P(edge[0][0], yS + 20)]);
  const under = ring([...fringe, ...fringe.slice().reverse().map((p, k) => P(p[0] + 0.5, p[1] - 4.5 - 2.5 * Math.sin(k * 0.37 + seed) ** 2))]);
  const litMass = blob(roughen([P(CX - f.templeW * 0.72, hl.y - 1), P(CX - f.templeW * 0.6, f.top - 1), P(CX - 18, f.top - o.top * 0.75), P(CX + 6, f.top - o.top * 0.45), P(CX - 8, f.top + 12), P(CX - 32, hl.y - 6)], 1.6, seed + 3), 0.5);

  // Sides below the mass: tone on the skin, tapering (or fading out) down to the sideburn.
  const sideTone = mixHex(color, skin.deep, 0.2);
  const yTop = yS - 8;
  const yBot = hl.templeR[hl.templeR.length - 1][1];
  const sideFill = (s: 1 | -1) =>
    scalpTone(`${uid}sd${s > 0 ? "r" : "l"}`, ring(sideRegion(s > 0 ? hl.templeR : hl.templeL, s, yTop)), sideTone, 0.6, d, {
      y0: yTop,
      y1: yBot,
      o0: o.sides === "fade" ? 0.5 : 0.55,
      o1: o.sides === "fade" ? 0.04 : 0.28,
    });
  // The fringe's shadow on the forehead, offset down and right (light from the upper left).
  const cast = ring([...fringe.map((p) => P(p[0] + 1.5, p[1] + 3.6)), P(CX - 160, f.top - 60), P(CX + 160, f.top - 60)]);
  const k = d === 0 ? 1.4 : 1;
  return {
    onSkin: (
      <g>
        {sideFill(1)}
        {sideFill(-1)}
        <path d={cast} fill={skin.shade} opacity={0.85} />
      </g>
    ),
    front: (
      <g>
        <defs>
          <path id={`${clip}d`} d={ring(region)} />
          <clipPath id={clip}>
            <use href={`#${clip}d`} />
          </clipPath>
        </defs>
        <use href={`#${clip}d`} fill={T.base} />
        <g clipPath={`url(#${clip})`}>
          {d > 0 && <path d={litMass} fill={mixHex(T.base, T.light, 0.25)} />}
          <path d={shadeR} fill={T.shade} />
          <path d={under} fill={T.shade} opacity={0.85} />
          {seps.length > 0 && <path d={seps.join("")} fill={T.deep} />}
          {lights.length > 0 && <path d={lights.join("")} fill={T.light} opacity={0.8} />}
          {softLights.length > 0 && <path d={softLights.join("")} fill={mixHex(T.base, T.light, 0.45)} opacity={0.6} />}
        </g>
        {/* Ink: the silhouette (heavier on the shadow side); the fringe and temple edges in a lighter, broken line. */}
        <path d={strokeLine(outer, { w: 2.1 * k, start: 0.6, end: 0.7, peak: 0.75, seed: seed + 5, wobble: 0.15 })} fill={INK} />
        {d > 0 && <path d={strokeLine(sR, { w: 1.1, start: 0.9, end: 0.2, seed: seed + 6 })} fill={T.line} />}
        {d > 0 && <path d={strokeLine(sL, { w: 0.9, start: 0.9, end: 0.2, seed: seed + 7 })} fill={T.line} />}
        {pieces(fringe, [[0, 0.4], [0.47, 1]], 1).map((p, n) => (
          <path key={n} d={strokeLine(p, { w: 1.1 * k, start: 0.4, end: 0.4, peak: 0.5, seed: seed + 8 + n, wobble: 0.25 })} fill={T.line} />
        ))}
      </g>
    ),
  };
}

// ------------------------------------------------------------------ the proof-of-concept cuts

const TEXTURED_CROP: CropOpts = {
  kind: "straight",
  top: 12,
  side: 1,
  sides: "taper",
  drop: 5,
  tips: [
    { u: 0.06, w: 0.1, a: 7, lean: -3 },
    { u: 0.2, w: 0.13, a: 15, lean: -6 },
    { u: 0.36, w: 0.14, a: 22, lean: -8 },
    { u: 0.51, w: 0.11, a: 13, lean: -5 },
    { u: 0.66, w: 0.15, a: 19, lean: -7 },
    { u: 0.84, w: 0.11, a: 10, lean: -3 },
  ],
  tufts: [
    { u: 0.16, w: 0.05, a: 3, lean: -2 },
    { u: 0.27, w: 0.07, a: 6, lean: -3 },
    { u: 0.4, w: 0.05, a: 4, lean: -1.5 },
    { u: 0.5, w: 0.08, a: 7.5, lean: 2 },
    { u: 0.62, w: 0.05, a: 3.5, lean: 2 },
    { u: 0.73, w: 0.07, a: 5.5, lean: 3 },
    { u: 0.86, w: 0.05, a: 3, lean: 2 },
  ],
};

/** New-technique hair for the styles in the proof of concept; null means "use the current renderer". */
export function drawHair(id: string, i: HairInput): HairArt | null {
  switch (id) {
    case "shaved":
      return shavedHair(i, "straight", 0.32);
    case "textured-crop":
      return cropHair(i, TEXTURED_CROP);
    default:
      return null;
  }
}

/** Legacy option index -> proof-of-concept design id. */
export const POC_IDS: Partial<Record<number, string>> = { 0: "shaved", 7: "textured-crop" };
