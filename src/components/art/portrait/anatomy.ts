import { CX, add, quad, sampleSegs, scale, segsPath, sub, unit, reverseSegs, type Pt, type Seg } from "./geometry";

/**
 * The face as an illustrator would construct it: skull, temples, cheekbones, a jaw with corners and a chin,
 * then features placed on fixed lines. Every value is an absolute canvas unit (half-widths from the centre line),
 * so every part, hairstyle and beard reads the same landmarks.
 */
export interface EyeSpec {
  /** Half-width and upper-lid height of the opening. */
  w: number;
  h: number;
  /** Lower-lid drop. */
  lo: number;
  /** Outer-corner height (negative lifts it). */
  tilt: number;
  /** Distance of each eye centre from the centre line. */
  gap: number;
  iris: number;
  /** Upper-lid ink weight. */
  lash: number;
  /** Distance from the lid to the crease above it. */
  crease: number;
  /** Heavy fold over the lid. */
  hood: number;
  /** How dark the eye socket is (deep-set eyes). */
  deep: number;
  /** Under-eye fullness. */
  bag: number;
}

export interface BrowSpec {
  /** Thickness at the head (inner end), the arch and the tail. */
  head: number;
  mid: number;
  tail: number;
  /** Rise of the arch above the straight line from head to tail. */
  arch: number;
  /** Where the arch peaks (0 head, 1 tail). */
  peak: number;
  len: number;
  /** How far the tail sits above the head (positive is a stern, tail-up brow). */
  lift: number;
  /** Inner end distance from the centre line. */
  gap: number;
  /** Height of the brow head above the eye line. */
  low: number;
  ragged: number;
}

export interface NoseSpec {
  /** Half-width across the wings. */
  w: number;
  /** Half-width of the bridge. */
  bridge: number;
  /** Half-width of the tip. */
  tip: number;
  /** How far the tip hangs below the wings. */
  drop: number;
  nostril: number;
  /** Upturn: shows more nostril. */
  up: number;
  /** Bump on the bridge. */
  hump: number;
  /** Sideways bend of the tip. */
  crook: number;
  /** Wing flare. */
  flare: number;
}

export interface MouthSpec {
  w: number;
  /** Upper and lower lip height. */
  up: number;
  lo: number;
  /** Corner lift: negative turns the mouth down. */
  corner: number;
  /** Half-width of the cupid's bow peaks. */
  bow: number;
  /** Lips parted (dark gap) and a strip of teeth. */
  part: number;
  teeth: number;
  /** One corner raised. */
  smirk: number;
}

export interface EarSpec {
  w: number;
  top: number;
  bot: number;
}

/** Designed, fixed differences between the two halves of the face. Never random per render. */
export interface Asym {
  eye: number;
  brow: number;
  mouth: number;
  ear: number;
  jaw: number;
}

export interface FaceSpec {
  top: number;
  skullW: number;
  templeW: number;
  cheekW: number;
  /** Cheekbone height below the eye line. */
  cheekDy: number;
  jawW: number;
  jawY: number;
  /** Rounding of the jaw corner (small is a hard corner). */
  jawR: number;
  chinW: number;
  /** Height of the chin's front. */
  chinH: number;
  /** 0 round chin, 1 square chin. */
  chinSq: number;
  chinY: number;
  cleft: number;
  browY: number;
  eyeY: number;
  noseY: number;
  mouthY: number;
  eye: EyeSpec;
  brow: BrowSpec;
  nose: NoseSpec;
  mouth: MouthSpec;
  ear: EarSpec;
  neckW: number;
  adam: number;
  asym: Asym;
}

/** One carefully drawn face: a serious, strong-jawed man in his mid twenties. Every generated face varies from this. */
export const REFERENCE_FACE: FaceSpec = {
  top: 50,
  skullW: 73,
  templeW: 69,
  cheekW: 75,
  cheekDy: 15,
  jawW: 66,
  jawY: 249,
  jawR: 8,
  chinW: 27,
  chinH: 7,
  chinSq: 0.62,
  chinY: 281,
  cleft: 0,
  browY: 143,
  eyeY: 161,
  noseY: 212,
  mouthY: 239,
  eye: { w: 16, h: 7.2, lo: 4.2, tilt: -0.8, gap: 34, iris: 7, lash: 3.2, crease: 6.5, hood: 0, deep: 0.5, bag: 0 },
  brow: { head: 9, mid: 8, tail: 3.2, arch: 3.2, peak: 0.52, len: 37, lift: 3.2, gap: 12, low: 16.5, ragged: 0 },
  nose: { w: 17, bridge: 5.5, tip: 9.5, drop: 1.6, nostril: 1, up: 0, hump: 0.6, crook: 0, flare: 1.2 },
  mouth: { w: 25, up: 5, lo: 6.8, corner: -0.8, bow: 6, part: 0, teeth: 0, smirk: 0 },
  ear: { w: 17, top: 146, bot: 215 },
  neckW: 50,
  adam: 0.6,
  asym: { eye: 0.07, brow: 1.6, mouth: 0.9, ear: 2.2, jaw: 1.6 },
};

export interface Side {
  S: Pt;
  T: Pt;
  K: Pt;
  J: Pt;
  Q: Pt;
  B: Pt;
}

export interface Head {
  /** Closed outline of skull and face. */
  path: string;
  /** Half-width of the head at y on the right (1) or left (-1) side. */
  half: (y: number, side?: 1 | -1) => number;
  right: Side;
  left: Side;
  /** Outline points crown -> chin for each side. */
  rightPts: Pt[];
  leftPts: Pt[];
}

/** One side of the head from the crown to the chin. Corners are rounded quadratics so jaws have real angles. */
function sideSegs(f: FaceSpec, sign: 1 | -1): { segs: Seg[]; side: Side } {
  const j = sign > 0 ? f.asym.jaw : -f.asym.jaw * 0.4;
  const X = (dx: number) => CX + sign * dx;
  const crown: Pt = [CX, f.top];
  const skullY = f.top + (f.browY - f.top) * 0.4;
  const templeY = f.browY - 16;
  const S: Pt = [X(f.skullW), skullY];
  const T: Pt = [X(f.templeW), templeY];
  const K: Pt = [X(f.cheekW + j * 0.3), f.eyeY + f.cheekDy];
  const J: Pt = [X(f.jawW + j), f.jawY + j * 0.7];
  const Q: Pt = [X(f.chinW), f.chinY - f.chinH];
  const B: Pt = [CX, f.chinY];

  const segs: Seg[] = [];
  segs.push([crown, [X(f.skullW * 0.56), f.top], [X(f.skullW), skullY - (skullY - f.top) * 0.56], S]);
  segs.push([S, [X(f.skullW), skullY + (templeY - skullY) * 0.45], [X(f.templeW + (f.skullW - f.templeW) * 0.3), templeY - (templeY - skullY) * 0.3], T]);
  segs.push([T, [X(f.templeW + (f.cheekW - f.templeW) * 0.4), templeY + (K[1] - templeY) * 0.4], [K[0], K[1] - (K[1] - templeY) * 0.38], K]);

  // Cheek down to the jaw corner, then a hard (but rounded) turn into the jawline.
  const kc: Pt = [K[0], K[1] + (J[1] - K[1]) * 0.45];
  const d1 = unit(sub(J, kc));
  const J1 = sub(J, scale(d1, f.jawR));
  const d2 = unit(sub(Q, J));
  const J2 = add(J, scale(d2, f.jawR));
  segs.push([K, [K[0], K[1] + (J[1] - K[1]) * 0.32], sub(J1, scale(d1, (J1[1] - K[1]) * 0.3)), J1]);
  segs.push(quad(J1, J, J2));

  // Jawline (very slightly convex) into the chin corner.
  const rq = 3 + (1 - f.chinSq) * 9;
  const chinFoot: Pt = [X(f.chinW * (0.25 + 0.55 * f.chinSq)), f.chinY];
  const d3 = unit(sub(chinFoot, Q));
  const Q1 = sub(Q, scale(d2, rq));
  const Q2 = add(Q, scale(d3, Math.min(rq, f.chinH * 0.6)));
  const out: Pt = [sign * d2[1], -sign * d2[0]];
  const bulge = 1.4;
  segs.push([J2, add(add(J2, scale(sub(Q1, J2), 1 / 3)), scale(out, -bulge)), add(add(J2, scale(sub(Q1, J2), 2 / 3)), scale(out, -bulge)), Q1]);
  segs.push(quad(Q1, Q, Q2));
  segs.push([Q2, add(Q2, scale(d3, Math.max(2, (B[1] - Q2[1]) * 0.6))), [X(f.chinW * (0.3 + 0.55 * f.chinSq)), f.chinY], B]);
  return { segs, side: { S, T, K, J, Q, B } };
}

function halfFn(pts: Pt[]): (y: number) => number {
  return (y: number) => {
    if (y <= pts[0][1]) return 0;
    const last = pts[pts.length - 1];
    if (y >= last[1]) return Math.abs(last[0] - CX);
    let i = 1;
    while (i < pts.length - 1 && pts[i][1] < y) i++;
    const a = pts[i - 1];
    const b = pts[i];
    const t = b[1] === a[1] ? 0 : (y - a[1]) / (b[1] - a[1]);
    return Math.abs(a[0] + (b[0] - a[0]) * t - CX);
  };
}

/** y must increase along the outline for the half-width lookup; small overshoots in the corner curves are flattened. */
function monotone(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  let y = -Infinity;
  for (const p of pts) {
    if (p[1] > y) {
      out.push(p);
      y = p[1];
    }
  }
  return out;
}

const headCache = new Map<string, Head>();

export function buildHead(f: FaceSpec): Head {
  const key = [f.top, f.skullW, f.templeW, f.cheekW, f.cheekDy, f.jawW, f.jawY, f.jawR, f.chinW, f.chinH, f.chinSq, f.chinY, f.browY, f.eyeY, f.asym.jaw].join(",");
  const hit = headCache.get(key);
  if (hit) return hit;
  const r = sideSegs(f, 1);
  const l = sideSegs(f, -1);
  const path = `${segsPath(r.segs)}${segsPath(reverseSegs(l.segs), false)}Z`;
  const rightPts = monotone(sampleSegs(r.segs, 12));
  const leftPts = monotone(sampleSegs(l.segs, 12));
  const hr = halfFn(rightPts);
  const hl = halfFn(leftPts);
  const head: Head = { path, half: (y, side = 1) => (side > 0 ? hr(y) : hl(y)), right: r.side, left: l.side, rightPts, leftPts };
  if (headCache.size > 300) headCache.clear();
  headCache.set(key, head);
  return head;
}
