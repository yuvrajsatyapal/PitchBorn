/** Long hair combed straight back: the swept top, continued behind the ears in flowing masses that follow the jaw and neck. */
import type { ReactNode } from "react";
import { CX, clamp, lerp, type Pt } from "../../portrait/geometry";
import { anchorsFor } from "../anchors";
import { noise1, ring } from "../ink";
import { hairTones, mixHex } from "../palette";
import { SHIRT_Y, halfAt, neckSides } from "../neck";
import { P, hairStroke, offset, rnd, smooth, type HairArt, type HairInput } from "./core";
import { slickHair, type SlickDesign } from "./slick";

export interface RearDesign {
  /** Per mass, outermost first: how far its tip ends below the shirt line, how far it stands off the widest point of the head,
   *  how far it ends off the neck, and its width. */
  ends: readonly number[];
  pad: readonly number[];
  spread: readonly number[];
  width: readonly number[];
}

const STEP = 4;

/**
 * Every contour is measured from this head: it starts just outside the skull at the top of the ear, follows the head
 * edge, then (once the head narrows into the jaw) the neck, standing off by a pad that swells and eases. So a wide head
 * gives wide hair, a narrow one hair close to the neck, and no gap opens beside the jaw: the space between the outer
 * contour and the neck is filled by the same hair, one mass behind another.
 */
export interface RearMass {
  s: 1 | -1;
  k: number;
  /** Outer contour, top of the ear -> tip, and the matching inner contour. */
  edge: Pt[];
  inner: Pt[];
  mid: Pt[];
}

export function rearMasses(i: HairInput, o: RearDesign): RearMass[] {
  const { f, head, seed } = i;
  const neck = neckSides(f);
  const y0 = f.ear.top - 10;
  // Room between head and neck at the ear: narrow heads get hair closer to the neck, wide ones more of it.
  const room = clamp((head.half(f.ear.top + 14, 1) - halfAt(neck.right, f.ear.top + 14)) / 24, 0.55, 1.25);
  const masses: RearMass[] = [];
  for (const s of [-1, 1] as const) {
    o.ends.forEach((endOff, k) => {
      const yEnd = SHIRT_Y + endOff + rnd(seed + 300 + k, s > 0 ? 1 : 2, -6, 6);
      const n = Math.max(4, Math.round((yEnd - y0) / STEP));
      const nh = (y: number) => halfAt(s > 0 ? neck.right : neck.left, y);
      // Hair falls from the widest point of the head (not along the narrowing jaw) and eases in towards the neck as it
      // goes down: it starts at the skull's width plus the pad, ends a few units off the neck, and never cuts inside
      // the head or the neck.
      const widest = Math.max(...[0, 1, 2, 3, 4].map((q) => head.half(lerp(y0, f.jawY - 18, q / 4), s)));
      const e0 = widest + 0.8 + o.pad[k] * room;
      const e1 = nh(yEnd) + o.spread[k];
      const belly = rnd(seed + 330 + k, s > 0 ? 1 : 2, 1.5, 4.5);
      const floor = (y: number) => Math.max(head.half(y, s) + 0.8, nh(y) + 3);
      const raw = Array.from({ length: n + 1 }, (_, j) => {
        const y = lerp(y0, yEnd, j / n);
        const t = j / n;
        const edge0 = head.half(y, s) + 0.8;
        const target = lerp(e0, e1, Math.pow(smooth(t), 1.15)) + belly * Math.sin(Math.PI * Math.min(1, t * 1.15)) + noise1(seed + 320 + k * 7 + s, j * 0.18) * 1.8;
        // It leaves the skull exactly where the top mass ends and only then stands off, so the two read as one flow.
        const flow = edge0 + (target - edge0) * smooth(t / 0.4);
        return Math.max(flow, edge0, nh(y) + 3);
      });
      // Two light smoothing passes keep the contour a curve, not a staircase of the head and neck lines.
      let e = raw;
      for (let pass = 0; pass < 2; pass++) e = e.map((v, j) => (j === 0 || j === n ? v : Math.max(floor(lerp(y0, yEnd, j / n)), (e[j - 1] + 2 * v + e[j + 1]) / 4)));
      const wmax = o.width[k] * room;
      const edge = e.map((v, j) => P(CX + s * v, lerp(y0, yEnd, j / n)));
      const inner = e.map((v, j) => {
        const t = j / n;
        const w = wmax * Math.pow(1 - t, 0.75) * (0.55 + 0.45 * smooth(t / 0.25)) + 1;
        return P(CX + s * (v - w), lerp(y0, yEnd, j / n));
      });
      const mid = edge.map((p, j) => P((p[0] + inner[j][0]) / 2, p[1]));
      masses.push({ s, k, edge, inner, mid });
    });
  }
  return masses;
}

function rear(i: HairInput, o: RearDesign): ReactNode {
  const { color, d, seed } = i;
  const T = hairTones(color, i.skin.base);
  const masses = rearMasses(i, o);
  const shape = (m: RearMass) => ring([...m.edge, ...m.inner.slice().reverse()]);
  // Hair behind the neck between the two sides, down to the shirt: one deep tone, so no background shows through.
  const outerOf = (s: 1 | -1) => masses.find((m) => m.s === s && m.k === 0)?.edge ?? [];
  const L = outerOf(-1);
  const R = outerOf(1);
  const hull = ring([...L, P(CX - 8, SHIRT_Y + 30), P(CX + 8, SHIRT_Y + 30), ...R.slice().reverse()]);
  const tone = (k: number) => mixHex(T.base, T.shade, [0.48, 0.32, 0.18][k] ?? 0.2);
  return (
    <g>
      <path d={hull} fill={mixHex(T.shade, T.deep, 0.45)} />
      {masses.map((m) => (
        <g key={`${m.s}${m.k}`}>
          {d === 2 && <path d={ring(offset([...m.edge, ...m.inner.slice().reverse()], m.s * 1.4, 1.2))} fill={T.deep} opacity={0.35} />}
          <path d={shape(m)} fill={tone(m.k)} />
          {d > 0 && m.s < 0 && m.k < 2 && <path d={hairStroke(m.mid, { from: 0.15, to: 0.72, w: 2.4, seed: seed + m.k + 50, start: 0.5, end: 0.4, peak: 0.45 })} fill={T.light} opacity={0.38} />}
        </g>
      ))}
    </g>
  );
}

/**
 * Long, straight hair combed back off the forehead: the swept top of Slickback Flow, flatter, its crown and side
 * volume following this head's width (a narrow skull stays narrow and low, a broad or square one carries more, a
 * round one a little less), reaching down to the top of the ear, and continuing behind the ear in three flowing masses
 * per side that end on the shoulders. No tie, no parting, nothing in front of the ears.
 */
export function nordicHair(i: HairInput, o: SlickDesign, r: RearDesign): HairArt {
  const { f, head } = i;
  const a = anchorsFor(f, head);
  const k = clamp((a.width - 120) / 40, 0, 1);
  const round = 1 - 0.25 * Math.max(0, -((f as { hollow?: number }).hollow ?? 0));
  const fit: SlickDesign = {
    ...o,
    top: lerp(o.top * 0.8, o.top * 1.35, k) * round,
    lift: lerp(o.lift * 0.75, o.lift * 1.4, k) * round,
    side: [lerp(o.side[0], o.side[0] + 1.2, k), lerp(o.side[1], o.side[1] + 1.4, k)],
  };
  return { ...slickHair(i, fit), back: rear(i, r) };
}
