import type { Head } from "../portrait/anatomy";
import { CX, along, lerp, type Pt } from "../portrait/geometry";
import type { Detail } from "./face";
import type { NextSpec } from "./head";
import { blob, ring, stroke, strokeLine } from "./ink";
import { INK, type SkinTones } from "./palette";

const P = (x: number, y: number): Pt => [x, y];

/** Height where the shirt meets the neck at the sides. */
export const SHIRT_Y = 297;

/**
 * The neck's two sides, top -> down into the shirt. The fill and the ink are built from the same lines, so skin
 * never shows outside the contour. The sides carry on well below the collar (into the V of a V-neck); everything
 * below the neckline is clipped away.
 */
export function neckSides(f: NextSpec): { left: Pt[]; right: Pt[]; top: number } {
  const nw = f.neckW;
  const top = f.jawY - 30;
  const side = (s: 1 | -1) =>
    along([P(CX + s * (nw - 0.5), top + 10), P(CX + s * (nw + 1), lerp(top + 10, SHIRT_Y, 0.6)), P(CX + s * (nw + 4.5), SHIRT_Y + 3), P(CX + s * (nw + 7), SHIRT_Y + 24), P(CX + s * (nw + 9), 352)], 6);
  return { left: side(-1), right: side(1), top };
}

/** Half-width of a side line at height y. */
export function halfAt(pts: Pt[], y: number): number {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (b[1] >= y) {
      const t = b[1] === a[1] ? 0 : (y - a[1]) / (b[1] - a[1]);
      return Math.abs(lerp(a[0], b[0], Math.max(0, t)) - CX);
    }
  }
  return Math.abs(pts[pts.length - 1][0] - CX);
}

/**
 * The shirt's opening, as a ring seen from the front: the back of the collar rises behind the neck, the front of the
 * collar dips in front of it. `frontIn` is the edge the neck disappears behind; every visible bit of neck lies above
 * it and inside `open`. All lines run left -> right.
 */
export interface Neckline {
  y: number;
  /** Half-width of the neck where it enters the shirt, and of the opening around it. */
  neck: number;
  open: number;
  /** Inner (against the neck) and outer edges of the front of the collar. */
  frontIn: Pt[];
  frontOut: Pt[];
  /** Lower (the opening) and top edges of the back of the collar. */
  backIn: Pt[];
  backOut: Pt[];
  /** Where the ring meets the shoulders. */
  Lo: Pt;
  Ro: Pt;
}

export interface CollarCut {
  /** Depth of the front of the opening below the side points. */
  dip: number;
  /** Height of the front band and of the back band. */
  h: number;
  back: number;
  v?: boolean;
}

export function neckline(f: NextSpec, cut: CollarCut): Neckline {
  const { right, left } = neckSides(f);
  const y = SHIRT_Y - 3;
  const neck = Math.max(halfAt(right, y), halfAt(left, y));
  // The opening always clears the neck, so the clip only ever trims the neck's bottom, never its sides.
  const open = neck + 4;
  const Li = P(CX - open, y);
  const Ri = P(CX + open, y);
  const Lo = P(CX - open - 5.5, y + 1.5);
  const Ro = P(CX + open + 5.5, y + 1.5);
  const { h, back } = cut;
  // A V is cut relative to the neck it frames, so it reads as a V on any build.
  const dip = cut.v ? Math.max(cut.dip, open * 0.75) : cut.dip;
  const half = (a: Pt[], b: Pt[]) => [...along(a, 5), ...along(b, 5).slice(1)];
  const frontIn = cut.v
    ? half([Li, P(CX - open * 0.55, y + dip * 0.4), P(CX - open * 0.2, y + dip * 0.78), P(CX, y + dip)], [P(CX, y + dip), P(CX + open * 0.2, y + dip * 0.78), P(CX + open * 0.55, y + dip * 0.4), Ri])
    : along([Li, P(CX - open * 0.6, y + dip * 0.75), P(CX, y + dip), P(CX + open * 0.6, y + dip * 0.75), Ri], 5);
  const frontOut = cut.v
    ? half([Lo, P(CX - open * 0.55 - 3, y + dip * 0.4 + h), P(CX - open * 0.2 - 2, y + dip * 0.78 + h), P(CX, y + dip + h * 1.3)], [P(CX, y + dip + h * 1.3), P(CX + open * 0.2 + 2, y + dip * 0.78 + h), P(CX + open * 0.55 + 3, y + dip * 0.4 + h), Ro])
    : along([Lo, P(CX - open * 0.62 - 2, y + dip * 0.75 + h), P(CX, y + dip + h), P(CX + open * 0.62 + 2, y + dip * 0.75 + h), Ro], 5);
  const backIn = along([Li, P(CX - open * 0.6, y - 4.5), P(CX, y - 5.5), P(CX + open * 0.6, y - 4.5), Ri], 5);
  const backOut = along([Lo, P(CX - open - 2.5, y - back * 0.7), P(CX - open * 0.6, y - 5.5 - back), P(CX, y - 6 - back), P(CX + open * 0.6, y - 5.5 - back), P(CX + open + 2.5, y - back * 0.7), Ro], 5);
  return { y, neck, open, frontIn, frontOut, backIn, backOut, Lo, Ro };
}

/**
 * The visible neck: everything above the front of the collar and inside the opening. Its shading is clipped to the
 * neck's own outline, so no skin or skin shadow can reach the shirt or the background.
 */
export function NeckNext({ f, head, t, d, uid, line }: { f: NextSpec; head: Head; t: SkinTones; d: Detail; uid: string; line: Neckline }) {
  const nw = f.neckW;
  const { left, right, top } = neckSides(f);
  const shape = ring([P(left[0][0], top), ...left, ...right.slice().reverse(), P(right[0][0], top)]);
  const visible = ring([P(CX - line.open, top - 10), ...line.frontIn, P(CX + line.open, top - 10)]);
  const R = head.right;
  const L = head.left;
  // The jaw's shadow on the neck follows the jawline: deep under the chin and towards the shadow side.
  const cast = blob(
    [
      P(CX - nw - 4, top),
      P(CX + nw + 4, top),
      P(CX + nw + 4, R.J[1] + 36),
      P(R.J[0] - 22, R.J[1] + 30),
      P(CX + f.chinW + 8, f.chinY + 19),
      P(CX - 4, f.chinY + 22),
      P(CX - f.chinW - 12, f.chinY + 17),
      P(L.J[0] + 20, L.J[1] + 18),
      P(CX - nw - 4, L.J[1] + 20),
    ],
    0.45,
  );
  const sideR = blob([P(CX + nw - 14, top + 30), P(CX + nw + 8, top + 30), P(CX + nw + 10, 330), P(CX + nw - 20, 330), P(CX + nw - 14, 270)], 0.4);
  const tendon = (s: 1 | -1) => [P(CX + s * (nw - 9), f.jawY + 8), P(CX + s * (nw - 17), f.jawY + 38), P(CX + s * 15, 298), P(CX + s * 8, 314)];
  // The contour ends just inside the shirt, under the collar.
  const upTo = (pts: Pt[]) => pts.filter((p) => p[1] <= SHIRT_Y + 6);
  // Midway down the visible neck, never down at the collar.
  const adamY = lerp(f.chinY, line.y, 0.45);
  const ns = `${uid}ns`;
  const nv = `${uid}nv`;
  return (
    <g>
      <defs>
        <clipPath id={nv}>
          <path d={visible} />
        </clipPath>
        <clipPath id={ns}>
          <path d={shape} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${nv})`}>
        <path d={shape} fill={t.base} />
        <g clipPath={`url(#${ns})`}>
          <path d={sideR} fill={t.shade} />
          <path d={cast} fill={t.shade} />
          <path d={blob([P(CX - f.chinW - 6, f.chinY + 2), P(CX + f.chinW + 10, f.chinY + 2), P(R.J[0] - 18, R.J[1] + 12), P(CX + f.chinW + 4, f.chinY + 14), P(CX - 4, f.chinY + 13)], 0.5)} fill={t.deep} opacity={0.45} />
          {d === 2 && (
            <>
              <path d={stroke(tendon(-1), { w: 0.8, start: 0.1, end: 0.05, peak: 0.5, seed: 127 })} fill={t.line} opacity={0.2} />
              <path d={stroke(tendon(1), { w: 0.9, start: 0.1, end: 0.05, peak: 0.5, seed: 131 })} fill={t.line} opacity={0.25} />
            </>
          )}
          {f.adam > 0.2 && d > 0 && <path d={stroke([P(CX - 3, adamY), P(CX + 0.5, adamY + 1.5 + 2 * f.adam), P(CX + 3.5, adamY)], { w: 0.85, seed: 137 })} fill={t.line} opacity={0.28 * f.adam} />}
        </g>
        <path d={strokeLine(upTo(left), { w: 1.3, start: 0.4, end: 0.5, peak: 0.3, seed: 109 })} fill={INK} />
        <path d={strokeLine(upTo(right), { w: 1.8, start: 0.4, end: 0.6, peak: 0.3, seed: 113 })} fill={INK} />
      </g>
    </g>
  );
}
