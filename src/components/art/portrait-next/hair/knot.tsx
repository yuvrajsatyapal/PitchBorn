/** Long hair combed tight off the face and gathered into one compact knot on the crown. No tail, nothing hanging behind. */
import type { ReactNode } from "react";
import { CX, along, clamp, lerp, type Pt } from "../../portrait/geometry";
import { anchorsFor } from "../anchors";
import { ring } from "../ink";
import { INK, hairTones } from "../palette";
import { P, hairStroke, rnd, silhouetteInk, type HairArt, type HairInput } from "./core";
import { slickHair, type SlickDesign } from "./slick";

export interface KnotDesign {
  /** Radius of the knot, as a fraction of the skull's half-width. */
  size: number;
  /** How far the knot sits above the skull, as a fraction of its own radius (the base is tucked this far in). */
  lift: number;
  /** Sideways offset from the centre line, as a fraction of the knot's radius (seeded side). */
  shift: number;
  /** Turns of hair wound round the knot. */
  coils: number;
}

/** The knot: a compact rounded mass wound in arcs round its centre, held at the base by a thin tie. */
function knot(i: HairInput, o: KnotDesign): ReactNode {
  const { f, head, color, d, seed, band } = i;
  const T = hairTones(color, i.skin.base);
  const a = anchorsFor(f, head);
  const r = clamp(a.width * 0.5 * o.size, 12, 22) * rnd(seed, 3, 0.94, 1.06);
  const s = seed % 2 === 0 ? 1 : -1;
  const cx = CX + s * o.shift * r;
  const cy = f.top - r * o.lift;
  // A slightly squashed round: wider than tall, with a flattened base where it sits on the head.
  const pts: Pt[] = Array.from({ length: 28 }, (_, k) => {
    const th = (k / 28) * Math.PI * 2;
    const wob = 1 + 0.035 * Math.sin(th * 3 + seed) + 0.025 * Math.sin(th * 5 + seed * 2);
    return P(cx + Math.cos(th) * r * 1.08 * wob, cy + Math.sin(th) * r * 0.92 * wob);
  });
  const body = ring(along([...pts, pts[0]], 3, 0.5));

  // The hair winds round the centre: arcs of light on the upper left, turning into shade on the right.
  const arc = (rad: number, from: number, to: number): Pt[] => Array.from({ length: 9 }, (_, k) => {
    const th = lerp(from, to, k / 8);
    return P(cx + Math.cos(th) * r * 1.08 * rad, cy + Math.sin(th) * r * 0.92 * rad);
  });
  const strands: string[] = [];
  const lights: string[] = [];
  if (d > 0) {
    for (let k = 0; k < o.coils; k++) {
      const rad = lerp(0.82, 0.3, k / Math.max(1, o.coils - 1));
      const from = rnd(seed, 10 + k, 2.2, 2.9) + k * 0.7;
      strands.push(hairStroke(arc(rad, from, from + rnd(seed, 20 + k, 2.8, 3.8)), { from: 0, to: 1, w: d === 2 ? 1.3 : 1.7, seed: seed + k, start: 0.4, end: 0.3, peak: 0.5 }));
      lights.push(hairStroke(arc(rad + 0.1, from - 0.1, from + 1.9), { from: 0.05, to: 0.95, w: d === 2 ? 2.6 : 3.2, seed: seed + 40 + k, start: 0.3, end: 0.2, peak: 0.5 }));
    }
  }
  const tie = ring(along([P(cx - r * 0.74, cy + r * 0.78), P(cx, cy + r * 0.92), P(cx + r * 0.74, cy + r * 0.78), P(cx + r * 0.72, cy + r * 0.98), P(cx, cy + r * 1.1), P(cx - r * 0.72, cy + r * 0.98), P(cx - r * 0.74, cy + r * 0.78)], 3));
  const tieTones = hairTones(band);
  return (
      <g>
        <path d={body} fill={T.base} />
        {lights.length > 0 && <path d={lights.join("")} fill={T.light} opacity={0.5} />}
        {strands.length > 0 && <path d={strands.join("")} fill={T.deep} opacity={0.55} />}
        <path d={silhouetteInk(pts.concat([pts[0]]), d, seed + 9, [[0, 1]], 1.8)} fill={INK} />
        <path d={tie} fill={tieTones.base} />
      </g>
  );
}

/**
 * Long hair pulled back and up: the head is covered by tightly combed sections (Slickback Flow's, flatter and closer, no
 * lift at the front), the ears and forehead clear, and all the length is gathered at the crown into a single
 * compact knot, wound round itself and tied at its base. The knot is behind the head, so the skull hides its lower part
 * and only the rounded top and tie show. There is no tail and no hair behind the neck.
 */
export function knotHair(i: HairInput, o: SlickDesign, k: KnotDesign): HairArt {
  const a = anchorsFor(i.f, i.head);
  const wide = clamp((a.width - 120) / 40, 0, 1);
  const fit: SlickDesign = { ...o, top: lerp(o.top * 0.9, o.top * 1.2, wide), side: [lerp(o.side[0], o.side[0] + 0.8, wide), lerp(o.side[1], o.side[1] + 0.8, wide)] };
  return { ...slickHair(i, fit), back: knot(i, k) };
}
