/**
 * The head, drawn from observed structure rather than a formula: the same landmarks as before (crown, temple,
 * cheekbone, jaw corner, chin), plus cheek hollows or fullness, temple dips, and left/right sides that are not
 * mirror images. Everything else (features, hair, beards) reads these outlines.
 */
import type { FaceSpec, Head, Side } from "../portrait/anatomy";
import { CX, add, quad, reverseSegs, sampleSegs, scale, segsPath, sub, unit, type Pt, type Seg } from "../portrait/geometry";

export interface NextSpec extends FaceSpec {
  /** Inward curve below the cheekbone (lean faces) or outward fullness (negative, round faces). */
  hollow: number;
  /** Narrowing at the temples. */
  templeDip: number;
  /** Head tilt in degrees (a portrait is never perfectly level). */
  tilt: number;
  /** Per-side difference in cheek width, so the two halves are not mirrored. */
  cheekAsym: number;
}

function sideSegs(f: NextSpec, sign: 1 | -1): { segs: Seg[]; side: Side } {
  const right = sign > 0;
  const j = right ? f.asym.jaw : -f.asym.jaw * 0.4;
  const ck = right ? f.cheekAsym : -f.cheekAsym * 0.5;
  const X = (dx: number) => CX + sign * dx;
  const crown: Pt = [CX + (right ? 0.6 : -0.6), f.top];
  const skullY = f.top + (f.browY - f.top) * 0.4;
  const templeY = f.browY - 16;
  const S: Pt = [X(f.skullW + (right ? 0.8 : 0)), skullY];
  const T: Pt = [X(f.templeW - f.templeDip * 1.2), templeY];
  const K: Pt = [X(f.cheekW + j * 0.3 + ck), f.eyeY + f.cheekDy + (right ? 0.8 : 0)];
  const J: Pt = [X(f.jawW + j), f.jawY + j * 0.7];
  const Q: Pt = [X(f.chinW), f.chinY - f.chinH];
  const B: Pt = [CX, f.chinY];

  const segs: Seg[] = [];
  segs.push([crown, [X(f.skullW * 0.56), f.top], [X(f.skullW), skullY - (skullY - f.top) * 0.56], S]);
  // Skull side into the temple, dipping in a little on lean heads.
  segs.push([S, [X(f.skullW - f.templeDip), skullY + (templeY - skullY) * 0.45], [X(f.templeW - f.templeDip * 2.2), templeY - (templeY - skullY) * 0.3], T]);
  segs.push([T, [X(f.templeW + (f.cheekW - f.templeW) * 0.5 - f.templeDip), templeY + (K[1] - templeY) * 0.42], [K[0], K[1] - (K[1] - templeY) * 0.36], K]);

  // Cheek: below the cheekbone the side falls in (hollow) or bows out (full) on its way to the jaw corner.
  const kc: Pt = [K[0], K[1] + (J[1] - K[1]) * 0.45];
  const d1 = unit(sub(J, kc));
  const J1 = sub(J, scale(d1, f.jawR));
  const d2 = unit(sub(Q, J));
  const J2 = add(J, scale(d2, f.jawR));
  const h = f.hollow * 5.5;
  segs.push([K, [K[0] - sign * h * 0.4, K[1] + (J[1] - K[1]) * 0.34], add(sub(J1, scale(d1, (J1[1] - K[1]) * 0.32)), [-sign * h, 0]), J1]);
  segs.push(quad(J1, J, J2));

  const rq = 3 + (1 - f.chinSq) * 9;
  const chinFoot: Pt = [X(f.chinW * (0.25 + 0.55 * f.chinSq)), f.chinY];
  const d3 = unit(sub(chinFoot, Q));
  const Q1 = sub(Q, scale(d2, rq));
  const Q2 = add(Q, scale(d3, Math.min(rq, f.chinH * 0.6)));
  const out: Pt = [sign * d2[1], -sign * d2[0]];
  const bulge = right ? 1.8 : 1.1;
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

const cache = new Map<string, Head>();

export function buildHeadNext(f: NextSpec): Head {
  const key = [f.top, f.skullW, f.templeW, f.cheekW, f.cheekDy, f.jawW, f.jawY, f.jawR, f.chinW, f.chinH, f.chinSq, f.chinY, f.browY, f.eyeY, f.asym.jaw, f.hollow, f.templeDip, f.cheekAsym].join(",");
  const hit = cache.get(key);
  if (hit) return hit;
  const r = sideSegs(f, 1);
  const l = sideSegs(f, -1);
  const path = `${segsPath(r.segs)}L${CX} ${f.chinY}${segsPath(reverseSegs(l.segs), false)}Z`;
  const rightPts = monotone(sampleSegs(r.segs, 12));
  const leftPts = monotone(sampleSegs(l.segs, 12));
  const hr = halfFn(rightPts);
  const hl = halfFn(leftPts);
  const head: Head = { path, half: (y, side = 1) => (side > 0 ? hr(y) : hl(y)), right: r.side, left: l.side, rightPts, leftPts };
  if (cache.size > 300) cache.clear();
  cache.set(key, head);
  return head;
}
