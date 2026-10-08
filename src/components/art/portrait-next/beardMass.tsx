/**
 * Beards with a body: the boxed beard, the long beard and the chin beard. Each is built from this face's own
 * anchors (sideburn, cheekbone, mouth corner, jaw outline, chin) and shaped differently, not scaled from one
 * template: the boxed beard hugs the jaw and is trimmed square under the chin, the long beard leaves the jaw as a
 * full mass and hangs below the chin in a rounded end, the chin beard grows only from the chin and lower lip.
 *
 * Drawn by value in the beard's own colour (see `beardTones`): a soft fade where growth starts on the cheek, a mass
 * that turns to shadow underneath and on the far side, hair strokes in the direction of growth, short flyaway
 * strands along the cheek line, and ink only where the hair stands off the face (in a deep tone of its own colour).
 */
import type { Head } from "../portrait/anatomy";
import { CX, add, along, clamp, hash01, lerp, scale, sub, unit, type Pt } from "../portrait/geometry";
import type { Anchors } from "./anchors";
import { P, burnY, inside, mouthGap, outline, smin, smooth01 } from "./beardGeometry";
import type { Detail } from "./face";
import type { NextSpec } from "./head";
import { lodNow, noise1, pieces, resample, ring, roughen, stroke, strokeLine } from "./ink";
import { mixHex, type BeardTones, type SkinTones } from "./palette";

export type MassKind = "boxed" | "long" | "chin" | "goatee" | "ring";

/** The lowest the long beard hangs (canvas y): just above where the front of the collar meets the neck. */
export const BEARD_LIMIT_Y = 300;

export interface Mass {
  pts: Pt[];
  /** The part of the outline that is not the cheek line (jaw and chin side), kept crisp when the cheek line fades. */
  edge: Pt[];
  hole?: Pt[];
  /** Where growth starts on the face, left -> right (the edge that fades into skin). Empty when it is the lip line. */
  upper: Pt[];
  /** The edge that stands off the face, left -> right. */
  lower: Pt[];
  /** Direction hair grows at a point. */
  flow: (p: Pt) => Pt;
}

/** Outline points pushed off the face (away from the middle of the head) by a thickness that depends on height. */
function pushed(f: NextSpec, pts: Pt[], th: (y: number) => number, seed: number, s: number): Pt[] {
  const c = P(CX, f.eyeY);
  return pts.map((p) => {
    const k = th(p[1]) + 0.7 * noise1(seed + s * 5, p[1] * 0.09);
    return add(p, scale(unit(sub(p, c)), k));
  });
}

/**
 * The cheek line: from each sideburn, down and in under the cheekbone, round the mouth corner and under the nose.
 * Control points come from the cheek and mouth anchors; the line is then roughened a little, like a hair edge.
 */
function cheekCurve(f: NextSpec, head: Head, a: Anchors, o: { y0: number; low: number; burnW: number; seed: number }): Pt[] {
  const side = (s: 1 | -1): Pt[] => {
    const cheek = s > 0 ? a.cheekR : a.cheekL;
    const corner = s > 0 ? a.mouthR : a.mouthL;
    const wob = (i: number) => 1.1 * noise1(o.seed + s * 13, i * 1.7);
    const yK = Math.max(cheek[1] + 16, f.noseY - 4) + o.low * 9;
    const yM = lerp(o.y0, yK, 0.42);
    const xK = head.half(yK, s) - 17 - o.low * 6 + wob(3);
    const xC = Math.abs(corner[0] - CX) + 11;
    const yC = corner[1] - 9 + o.low * 2 + wob(5);
    return [
      // The sideburn leaves the hair as a narrow wedge that widens as it comes down the jaw line.
      P(CX + s * (head.half(o.y0 - 4, s) - 1), o.y0 - 4),
      P(CX + s * (head.half(o.y0 + 5, s) - o.burnW * 0.55), o.y0 + 5),
      P(CX + s * (head.half(yM, s) - o.burnW - 4 + wob(1)), yM + wob(2)),
      P(CX + s * xK, yK + wob(4)),
      // Between the cheekbone and the mouth corner the line bows instead of running straight.
      P(CX + s * (lerp(xK, xC, 0.5) + 3.5), lerp(yK, yC, 0.5) - 2.5),
      P(CX + s * xC, yC),
      P(CX + s * f.nose.w * 1.15, f.noseY + 6.5),
    ];
  };
  const line = along([...side(-1), P(CX, f.noseY + 5.5), ...side(1).reverse()], lodNow() === 0 ? 2 : 4);
  return lodNow() === 0 ? line : roughen(line, lodNow() === 2 ? 1.1 : 0.6, o.seed + 3, 0.8);
}

const downFlow = (f: NextSpec, hang: number) => (p: Pt): Pt => {
  // Over the lip the hair grows out from the middle; elsewhere it runs down and in towards the chin, more steeply
  // the further it hangs.
  if (p[1] < f.mouthY - 1) return unit(P(Math.sign(p[0] - CX || 1), 0.55));
  const k = p[1] > f.chinY ? 0.05 + hang * 0.02 : 0.016;
  return unit(P((CX - p[0]) * k, 1));
};

/** Boxed: close to the jaw, a short and even depth, trimmed square under the chin. */
function boxedMass(f: NextSpec, head: Head, a: Anchors, seed: number): Mass {
  const y0 = burnY(f) + 2;
  const th = (y: number) => lerp(1.3, 4.2, smooth01((y - y0) / (f.jawY - y0))) + 0.9 * smooth01((y - f.jawY) / Math.max(1, f.chinY - f.jawY));
  const flatY = f.chinY + 4.4;
  const squared = (pts: Pt[]) => pts.map((p) => P(p[0], smin(p[1], flatY, 7)));
  const right = squared(pushed(f, outline(head, 1, y0, f.chinY + 1), th, seed, 1));
  const left = squared(pushed(f, outline(head, -1, y0, f.chinY + 1), th, seed, -1));
  const lower = [...left, ...right.slice().reverse()];
  const upper = cheekCurve(f, head, a, { y0, low: 0.9, burnW: 8, seed });
  return { pts: [...right, ...left.slice().reverse(), ...upper], edge: [...right, ...left.slice().reverse()], hole: mouthGap(f), upper, lower, flow: downFlow(f, 0) };
}

/**
 * Long: the jaw carries the same full cheek coverage, but below the chin the beard hangs as its own mass, wider than
 * the chin and ending in a soft rounded point, never a strip. The end stays above the front of the collar.
 */
function longMass(f: NextSpec, head: Head, a: Anchors, seed: number): Mass {
  const y0 = burnY(f) + 2;
  const hang = clamp(Math.min(f.chinY + 40, BEARD_LIMIT_Y) - f.chinY, 11, 40);
  const yJ = lerp(f.jawY, f.chinY, 0.4);
  const th = (y: number) => lerp(1.4, 5, smooth01((y - y0) / (yJ - y0)));
  const W = f.chinW + 13;
  const n = (i: number) => 1.3 * noise1(seed + 40, i * 1.3);
  const jaw = (s: 1 | -1) => pushed(f, outline(head, s, y0, yJ), th, seed, s);
  const body = (s: 1 | -1): Pt[] => {
    const k = s > 0 ? 1.03 : 0.97;
    return [
      P(CX + s * (head.half(yJ, s) + 5), yJ),
      P(CX + s * Math.max(W * k, head.half(f.chinY - 3, s) + 7), f.chinY - 3),
      P(CX + s * (W * 0.97 * k + n(s)), f.chinY + hang * 0.36),
      P(CX + s * (W * 0.68 * k + n(s + 2)), f.chinY + hang * 0.72),
      P(CX + s * W * 0.3 * k, f.chinY + hang * 0.94),
    ];
  };
  const tip = P(CX + 2.2 * Math.sign(noise1(seed, 9) || 1), f.chinY + hang);
  const rightJ = jaw(1);
  const leftJ = jaw(-1);
  const lowerPts = along([body(1)[0], ...body(1).slice(1), tip, ...body(-1).slice(1).reverse(), body(-1)[0]], lodNow() === 0 ? 3 : 5);
  const lower = lodNow() === 0 ? lowerPts : roughen(lowerPts, 0.9, seed + 6, 0.9);
  const upper = cheekCurve(f, head, a, { y0, low: 0, burnW: 8, seed });
  const edge = [...rightJ, ...lower, ...leftJ.slice().reverse()];
  return { pts: [...edge, ...upper], edge, hole: mouthGap(f), upper, lower: [...leftJ, ...lower.slice().reverse(), ...rightJ.slice().reverse()], flow: downFlow(f, 1) };
}

/**
 * Chin: hair on the chin only. It starts under the lower lip, hugs the chin as far round as the chin is wide, and
 * hangs a few units below the outline in an uneven edge. Cheeks and jaw stay clean.
 */
function chinMass(f: NextSpec, head: Head, a: Anchors, seed: number, shape: "chin" | "goatee" | "ring" = "chin"): Mass {
  const m = f.mouth;
  const lipBottom = f.mouthY + m.lo;
  // Goatee: a narrower tuft that starts right under the lip. Ring (with a moustache): the hair also climbs the sides
  // of the mouth to just above the lips, round the mouth, with the lips left clear.
  const yTop = shape === "ring" ? f.mouthY - m.up - 1 : lipBottom + (shape === "goatee" ? 2.2 : 3.2);
  // How far the hair reaches round the chin follows how wide this chin is (pointed chins stay narrow).
  const reach = shape === "goatee" ? f.chinW * 0.7 + 6 : f.chinW * 0.95 + 8;
  const th = (y: number) => lerp(0.8, 3.8, smooth01((y - (f.chinY - f.chinH * 2.6)) / (f.chinH * 2.6)));
  const take = (s: 1 | -1) => outline(head, s, yTop + 4, f.chinY + 1).filter((p) => Math.abs(p[0] - CX) <= reach + 0.7 * noise1(seed + s, 3));
  const rightPts = pushed(f, take(1), th, seed, 1);
  const leftPts = pushed(f, take(-1), th, seed, -1);
  const edge0 = [...rightPts, ...leftPts.slice().reverse()];
  // A tuft or two hang below the outline: a low, uneven lower edge rather than a smooth line.
  const edge = roughen(resample(edge0, 2.4), lodNow() === 0 ? 0 : 1.1, seed + 8, 0.7).map((p) => P(p[0], p[1] + 1.5 * Math.max(0, noise1(seed + 11, p[0] * 0.09))));
  const eR = rightPts.length ? rightPts[0] : P(CX + reach, f.chinY - f.chinH * 2);
  const eL = leftPts.length ? leftPts[0] : P(CX - reach, f.chinY - f.chinH * 2);
  // From the chin outline the hair climbs the chin in a soft cup to the lower lip and crosses under it: the upper
  // boundary is the whole cup (sides and top), so it fades in, cheeks and jaw stay clean.
  const tw = shape === "ring" ? m.w + 5 : shape === "goatee" ? Math.min(m.w * 0.42, reach * 0.7) : Math.min(m.w * 0.6, reach * 0.74);
  const side = (s: 1 | -1, e: Pt): Pt[] => [
    e,
    P(CX + s * (reach * 0.99 + 0.8 * noise1(seed + s, 6)), lerp(e[1], yTop, 0.4)),
    P(CX + s * (tw + (reach - tw) * 0.35), lerp(e[1], yTop, 0.78)),
    P(CX + s * (tw * 0.62), yTop + 0.9 + 0.4 * noise1(seed + s, 7)),
  ];
  const cup = along([...side(-1, eL), P(CX + 0.7 * noise1(seed, 4), yTop - 0.8), ...side(1, eR).reverse()], 4);
  const upper = lodNow() === 0 ? cup : roughen(cup, 0.8, seed + 12, 0.9);
  return { pts: [...edge, ...upper.slice(1, -1)], edge, upper, lower: edge, hole: shape === "ring" ? mouthGap(f) : undefined, flow: (p) => unit(P((CX - p[0]) * 0.05, 1)) };
}

export const massFor = (kind: MassKind, f: NextSpec, head: Head, a: Anchors, seed: number): Mass => (kind === "boxed" ? boxedMass(f, head, a, seed) : kind === "long" ? longMass(f, head, a, seed) : chinMass(f, head, a, seed, kind === "chin" ? "chin" : kind));

const bounds = (pts: readonly Pt[]) => {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};

export function BeardMass({ kind, f, head, a, t, B, youth, d, uid }: { kind: MassKind; f: NextSpec; head: Head; a: Anchors; t: SkinTones; B: BeardTones; youth: number; d: Detail; uid: string }) {
  const seed = ({ boxed: 9, long: 11, chin: 12, goatee: 5, ring: 6 }[kind]) * 31 + Math.round(f.chinY * 3 + f.jawW);
  const mass = massFor(kind, f, head, a, seed);
  const { x0, x1, y0, y1 } = bounds(mass.pts);
  const region = ring(mass.pts) + (mass.hole ? ring(mass.hole) : "");
  const id = `${uid}bm`;
  const height = y1 - y0;
  const thin = 1 - 0.45 * youth;
  const chin = kind === "chin" || kind === "goatee" || kind === "ring";

  // Hair strokes: short, tapered, in the direction of growth. Dark ones fill the shadow side, light ones catch the
  // light on the near cheek and the top of the mass.
  const dark: string[] = [];
  const lit: string[] = [];
  if (d > 0) {
    const n = (d === 2 ? 40 : 14) * (chin ? 0.6 : 1);
    for (let k = 0, tries = 0; k < n && tries < n * 8; tries++) {
      const p = P(lerp(x0, x1, hash01(seed, tries * 2)), lerp(y0, y1, hash01(seed, tries * 2 + 1)));
      if (!inside(mass.pts, p) || (mass.hole && inside(mass.hole, p))) continue;
      k++;
      const dir = mass.flow(p);
      const len = 4 + hash01(seed, tries + 400) * (kind === "long" && p[1] > f.chinY ? 10 : 5);
      const bendv = scale(P(-dir[1], dir[0]), (hash01(seed, tries + 450) - 0.5) * 2.2);
      const line = [sub(p, scale(dir, len * 0.4)), add(add(p, scale(dir, len * 0.15)), bendv), add(p, scale(dir, len * 0.6))];
      const light = p[0] < CX - 4 && p[1] < lerp(y0, y1, 0.75) && hash01(seed, tries + 500) < 0.55;
      (light ? lit : dark).push(stroke(line, { w: d === 2 ? 0.9 : 1.3, start: 0.35, end: 0.1, steps: 3, seed: seed + tries }));
    }
  }

  // The cheek line fades into the skin: a thin zone of sparse growth (skin showing through) and a few short strands
  // that leave the line, never a ruled edge.
  const cheekZone: string[] = [];
  const strands: string[] = [];
  const cheeks = mass.upper.filter((p) => Math.abs(p[0] - CX) > f.nose.w * 1.5);
  if (d > 0 && !chin && cheeks.length > 3) {
    cheekZone.push(ring([...cheeks, ...cheeks.map((p) => P(p[0] + (p[0] > CX ? -2 : 2), p[1] + 8 + 2.5 * noise1(seed + 20, p[0] * 0.1))).reverse()]));
  }
  if (d > 0 && mass.upper.length > 3) {
    const step = d === 2 ? 4.2 : 7.5;
    const line = resample(mass.upper, step);
    line.forEach((p, i) => {
      if (hash01(seed + 60, i) < 0.3) return;
      const up = P(0.4 * noise1(seed + 61, i), -1);
      const out = P(Math.sign(p[0] - CX || 1) * 0.5 * hash01(seed + 62, i), 0);
      const dir = unit(add(chin ? P(0, 0.4) : up, out));
      const len = 2.6 + hash01(seed + 63, i) * 3.6;
      strands.push(stroke([sub(p, scale(dir, -1.8)), add(p, scale(dir, len * 0.5)), add(p, scale(dir, len))], { w: d === 2 ? 1 : 1.4, start: 0.6, end: 0.05, steps: 2, seed: seed + i }));
    });
  }

  // Cast shadow on the neck under the beard (never beyond the neck's width, so none falls on the backdrop).
  const under = mass.lower.filter((p) => p[1] > f.chinY - 5 && Math.abs(p[0] - CX) < a.neckR[0] - CX - 5);
  const shadow = d > 0 && under.length > 2 ? ring([...under, ...under.map((p) => P(p[0], p[1] + 3.2)).reverse()]) : "";

  const ink = d === 0 ? mass.lower.filter((p) => p[1] > f.chinY - 3) : mass.lower.filter((p) => p[1] > f.chinY - 12);
  const edge = ink.length > 3 ? pieces(ink, d === 0 ? [[0, 1]] : [[0, 0.34], [0.38, 0.68], [0.72, 1]], 1).map((p) => strokeLine(p, { w: d === 0 ? 1.9 : 1.2, start: 0.1, end: 0.1, peak: 0.55, seed: seed + 3, wobble: 0.2 })).join("") : "";

  const ym = lerp(y0, y1, 0.16);
  const wash = mixHex(B.base, t.deep, 0.4);
  const centre = P(CX, lerp(y0, y1, 0.62));
  const feather =
    d === 0
      ? []
      : (d === 2 ? [[2.4, 0.3], [5.4, 0.17], [9, 0.08]] : [[3, 0.25], [7, 0.1]]).map(([dist, o]) => ({
          o,
          d: ring([...mass.edge, ...mass.upper.map((p) => add(p, scale(unit(sub(p, centre)), dist + 1.2 * noise1(seed + 70, p[0] * 0.08))))]) + (mass.hole ? ring(mass.hole) : ""),
        }));
  // Thumbnails: the mass and its lit side, nothing else (a few large shapes carry the silhouette and the colour).
  if (d === 0) {
    const litBody = ring(mass.pts.map((p) => P(p[0] - 1.2, p[1] - 3))) + (mass.hole ? ring(mass.hole) : "");
    return (
      <g opacity={thin}>
        <path d={region} fill={B.shade} fillRule="evenodd" />
        <path d={litBody} fill={B.base} fillRule="evenodd" />
        {edge && <path d={edge} fill={B.edge} opacity={0.8} />}
      </g>
    );
  }
  return (
    <g opacity={thin}>
      <defs>
        <clipPath id={id}>
          <path d={region} clipRule="evenodd" />
        </clipPath>
        {d > 0 && (
          <linearGradient id={`${id}g`} gradientUnits="userSpaceOnUse" x1={CX - (x1 - x0) * 0.08} y1="0" x2={x1} y2="0">
            <stop offset="0" stopColor={B.shade} stopOpacity="0" />
            <stop offset="1" stopColor={B.shade} stopOpacity="0.62" />
          </linearGradient>
        )}
        {kind === "long" && d > 0 && (
          <linearGradient id={`${id}v`} gradientUnits="userSpaceOnUse" x1="0" y1={f.chinY - 6} x2="0" y2={y1}>
            <stop offset="0" stopColor={B.shade} stopOpacity="0" />
            <stop offset="1" stopColor={B.shade} stopOpacity="0.55" />
          </linearGradient>
        )}
        {d === 2 && (
          <filter id={`${id}f`} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation={1.6} />
          </filter>
        )}
      </defs>
      {shadow && <path d={shadow} fill={t.deep} opacity={0.4} />}
      {/* Where growth starts on the face: stacked, ever fainter copies of the cheek line, so the hair thins out into
          the skin instead of stopping on a ruled edge. The jaw side stays crisp. */}
      {feather.map((l, i) => (
        <path key={i} d={l.d} fill={wash} fillRule="evenodd" opacity={l.o} />
      ))}
      <path d={region} fill={B.shade} fillRule="evenodd" />
      <g clipPath={`url(#${id})`}>
        {/* The lit body: the region moved up and left, so a band of shadow stays underneath and on the right. */}
        <path d={ring(mass.pts.map((p) => P(p[0] - 1, p[1] - Math.min(3, height * 0.1))))} fill={mixHex(B.base, B.shade, 0.5)} />
        <path d={ring(mass.pts.map((p) => P(p[0] - 1.8, p[1] - Math.min(5.4, height * 0.18))))} fill={B.base} />
        {/* The far side of the face turns away from the light. */}
        <rect x={x0 - 4} y={y0 - 6} width={x1 - x0 + 8} height={y1 - y0 + 12} fill={`url(#${id}g)`} />
        {kind === "long" && d > 0 && <rect x={x0 - 4} y={f.chinY - 6} width={x1 - x0 + 8} height={y1 - f.chinY + 10} fill={`url(#${id}v)`} />}
        {cheekZone.length > 0 && (
          <g filter={d === 2 ? `url(#${id}f)` : undefined}>
            <path d={cheekZone.join("")} fill={t.base} opacity={0.3} />
          </g>
        )}
        {/* Light on the near side: a soft, uneven mass. */}
        {d > 0 && <path d={ring(roughen(along([P(x0 - 6, lerp(y0, y1, 0.08)), P(lerp(x0, CX, 0.55), ym + 2), P(CX - 8, lerp(y0, y1, 0.35)), P(lerp(x0, CX, 0.45), lerp(y0, y1, 0.62)), P(x0 - 4, lerp(y0, y1, 0.72)), P(x0 - 6, lerp(y0, y1, 0.08))], 5), 1.6, seed + 15, 0.5))} fill={mixHex(B.base, B.light, 0.32)} opacity={0.42} />}
        {dark.length > 0 && <path d={dark.join("")} fill={B.deep} opacity={0.5} />}
        {lit.length > 0 && <path d={lit.join("")} fill={B.light} opacity={0.55} />}
        {mass.hole && d > 0 && <path d={strokeLine(mass.hole.slice(1, 8), { w: 1, start: 0.2, end: 0.2, seed })} fill={B.deep} opacity={0.55} />}
      </g>
      {strands.length > 0 && <path d={strands.join("")} fill={B.base} opacity={0.75} />}
      {edge && <path d={edge} fill={B.edge} opacity={0.8} />}
    </g>
  );
}
