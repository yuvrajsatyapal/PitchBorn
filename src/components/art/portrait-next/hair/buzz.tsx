/** Clipper cuts: hair so short it follows the skull exactly. Drawn as a thin mass with a real hairline, not as scalp tone. */
import { CX, along, clamp, hash01, lerp, type Pt } from "../../portrait/geometry";
import { noise1, ring, strokeLine } from "../ink";
import { INK, hairTones, mixHex } from "../palette";
import { ClipDefs, fadeRegion, P, bumped, extentOf, hairline, last, lobe, organicMass, rnd, shell, silhouetteInk, type HairArt, type HairInput, type HairlineKind } from "./core";

export interface BuzzDesign {
  kind: HairlineKind;
  /** Thickness of the hair over the crown and at the sides, in portrait units. */
  top: readonly [number, number];
  side: number;
  /** How solid the colour is: low shows the scalp through the hair. */
  density: number;
}

/**
 * One thin mass: the skull outline pushed out by the length of the hair (a few units on top, almost nothing at the
 * sides), cut off by the hairline across the forehead and down each temple to the sideburn. Light sits on the dome
 * and follows its curve; the far side turns away into shadow; the hairline is a little denser than the crown.
 * At small sizes only the mass, its dome shading and the hairline remain.
 */
export function buzzHair(i: HairInput, o: BuzzDesign): HairArt {
  const { f, head, color, skin, uid, d, recede, seed } = i;
  const T = hairTones(color, skin.base);
  const hl = hairline(f, head, o.kind, recede, seed, -2.5);
  const n = hl.front.length - 1;
  // The forehead line is never a clean curve: small, slow unevenness, and each corner sits a little differently.
  const front = hl.front.map((p, k) => (k === 0 || k === n ? p : P(p[0], p[1] + noise1(seed + 7, k * 0.5) * 1.1)));
  // Clean temples: the sideburn stops at the top of the ear instead of running down beside it.
  const yS = Math.min(Math.max(last(hl.templeR)[1], last(hl.templeL)[1]), f.ear.top + 2);
  const upTo = (t: Pt[]) => t.filter((p) => p[1] <= yS);
  const templeR = upTo(hl.templeR);
  const templeL = upTo(hl.templeL);
  const burnR = last(templeR);
  const burnL = last(templeL);
  const thick = rnd(seed, 1, o.top[0], o.top[1]);
  let outer = shell(f, head, yS, o.side, thick, o.side);
  // The crown is slightly fuller on one side, and where depends on the player.
  outer = bumped(outer, [{ u: 0.34 + hash01(seed, 2) * 0.3, w: 0.28, a: 0.9 }], lobe);

  const end = (s: 1 | -1, tip: Pt, burn: Pt): Pt[] => along([tip, P(lerp(tip[0], burn[0], 0.5) - s * 0.5, lerp(tip[1], burn[1], 0.5) + 0.6), burn], 3, 0.5).slice(1);
  const region = [
    ...outer,
    ...end(1, last(outer), burnR),
    ...templeR.slice().reverse().slice(1),
    ...front.slice().reverse().slice(1),
    ...templeL.slice(1),
    ...end(-1, outer[0], burnL).reverse(),
  ];
  const regionD = ring(region);
  const clip = `${uid}bz`;

  // Dome light on the upper left, following the skull a few units inside the edge; shadow turning away on the right.
  const c = P(CX, f.top + f.skullW * 0.95);
  const inward = (p: Pt, k: number): Pt => {
    const dx = c[0] - p[0];
    const dy = c[1] - p[1];
    const m = Math.hypot(dx, dy) || 1;
    return P(p[0] + (dx / m) * k, p[1] + (dy / m) * k);
  };
  const rim = outer.filter((p) => p[1] < yS - 8);
  const lit = rim.filter((p) => p[0] < CX + 6);
  const turn = rim.filter((p) => p[0] > CX + f.skullW * 0.34);
  const shadeD = ring([...turn, ...turn.slice().reverse().map((p) => inward(p, 17))]);
  const lightD = lit.length > 3 ? strokeLine(lit.map((p) => inward(p, 4.5)), { w: 4.6, start: 0.7, end: 0.7, peak: 0.45, seed: seed + 3 }) : "";
  // The hairline is slightly denser than the crown, and uneven.
  const lineD = strokeLine(front.map((p) => P(p[0], p[1] + 1.4)), { w: 2.6, start: 0.5, end: 0.5, seed: seed + 4, wobble: 0.2 });

  // Very faint changes in density across the dome: wide, soft and few. Never strokes.
  const patches: string[] = [];
  if (d > 0) {
    const k = d === 2 ? 4 : 2;
    for (let g = 0; g < k; g++) {
      const cx = CX + rnd(seed, 10 + g, -f.templeW * 0.55, f.templeW * 0.55);
      const cy = rnd(seed, 20 + g, f.top + 6, hl.y - 4);
      const r = rnd(seed, 30 + g, 8, 15);
      patches.push(organicMass([P(cx - r, cy), P(cx - r * 0.2, cy - r * 0.55), P(cx + r, cy - r * 0.1), P(cx + r * 0.3, cy + r * 0.5)], { seed: seed + g, rough: 0.8 }));
    }
  }

  const density = clamp(o.density + (hash01(seed, 3) - 0.5) * 0.06, 0.7, 1);
  return {
    mid: (
      <g>
        <ClipDefs id={clip} shapes={[regionD]} />
        {/* The skin under it is covered so the head's own outline does not show through a thin mass. */}
        <path d={regionD} fill={skin.base} />
        {/* Densest over the crown, thinning towards the hairline and the sideburns. */}
        {fadeRegion(`${uid}bzf`, regionD, T.base, d, { y0: f.top, y1: yS, o0: density + 0.22, mid: [0.34, density - 0.08], o1: density - 0.3 })}
        <g clipPath={`url(#${clip})`}>
          <path d={shadeD} fill={T.shade} opacity={0.38} />
          {patches.length > 0 && <path d={patches.join("")} fill={mixHex(T.base, T.light, 0.4)} opacity={0.22} />}
          <path d={lineD} fill={T.deep} opacity={0.22} />
          {lightD && <path d={lightD} fill={T.light} opacity={d === 0 ? 0.4 : 0.55} />}
        </g>
        {/* The outer edge is the only line; it fades out before the ear. */}
        <path d={silhouetteInk(outer, d, seed + 5, [[0.02, 0.9]], 1.5)} fill={INK} />
      </g>
    ),
    extent: extentOf(outer),
  };
}
