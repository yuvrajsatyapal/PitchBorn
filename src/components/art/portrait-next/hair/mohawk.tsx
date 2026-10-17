/** A tall, narrow central crest standing out of closely cropped sides. */
import { CX, along, clamp, lerp, type Pt } from "../../portrait/geometry";
import { noise1, resample, ring, strokeLine } from "../ink";
import { INK, hairTones, mixHex } from "../palette";
import {
  ClipDefs,
  P,
  bumped,
  castBelow,
  extentOf,
  fadeRegion,
  hairStroke,
  hairline,
  hanging,
  lobe,
  rnd,
  shell,
  silhouetteInk,
  smooth,
  type Bump,
  type HairArt,
  type HairInput,
} from "./core";

export interface MohawkDesign {
  /** Half-width of the crest as a fraction of the temple half-width, and how much it narrows towards the top. */
  width: number;
  taper: number;
  /** Height of the crest above the top of the skull (portrait units). */
  height: number;
  /** Largest sideways lean of the top, and the largest sideways shift of the whole crest. */
  lean: number;
  shift: number;
  /** Small clumps breaking each edge: count and size. */
  clumps: { count: number; size: readonly [number, number] };
  /** Short tips hanging over the forehead. */
  fringe: number;
}

/**
 * The crest is one connected mass: two nearly parallel sides rising from the hairline, a rounded top, and a lower
 * edge hung with a few short tips over the forehead. Its edges are broken by a handful of small clumps (never
 * spikes), and the whole crest leans a little and sits a little off the centre line, both fixed by the player's
 * seed. The sides are a close crop in tone, thinning to nothing at the ear, so the crest always stands much taller
 * than anything beside it. Light runs up the left of the crest; its right half turns into shade.
 */
export function mohawkHair(i: HairInput, o: MohawkDesign): HairArt {
  const { f, head, color, skin, uid, d, recede, seed } = i;
  const T = hairTones(color, skin.base);
  const hl = hairline(f, head, "straight", recede, seed);
  let slot = 0;
  const r = (lo: number, hi: number) => rnd(seed + 97, slot++, lo, hi);
  const yS = f.ear.top - 3;

  const shift = r(-o.shift, o.shift);
  const lean = r(-o.lean, o.lean);
  const c = CX + shift;
  const hw = clamp(f.templeW * o.width, 18, 29);
  const yTop = f.top - o.height * (1 + r(-0.06, 0.06));
  const yHl = (x: number) => {
    const p = hl.front.reduce((m, q) => (Math.abs(q[0] - x) < Math.abs(m[0] - x) ? q : m), hl.front[0]);
    return p[1];
  };
  // Half-width at height y: widest at the hairline, narrowing smoothly towards the top.
  const half = (y: number) => hw * (1 - o.taper * smooth((yHl(c) - y) / (yHl(c) - yTop)));
  const sway = (y: number) => lean * Math.pow(clamp((yHl(c) - y) / (yHl(c) - yTop), 0, 1), 1.6);

  // Left edge from the hairline up, rounded top, right edge back down.
  const rows = 8;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let k = 0; k <= rows; k++) {
    const y = lerp(yHl(c - hw), yTop + 7, k / rows);
    left.push(P(c - half(y) + sway(y), y));
    right.push(P(c + half(y) + sway(y), lerp(yHl(c + hw), yTop + 7, k / rows)));
  }
  // A crisp peak: the sides run straight into a narrow, slightly asymmetric point instead of a rounded top.
  const peak = P(c + sway(yTop), yTop);
  const crown = [P(c - half(yTop + 9) * 0.5 + sway(yTop + 9), yTop + 9), peak, P(c + half(yTop + 9) * 0.5 + sway(yTop + 9), yTop + 9)];
  const curve = resample(along([...left, ...crown, ...right.slice().reverse()], 6, 0.3), 1.2);
  // A few small clumps along the edges, all pushing outwards, none near the base.
  const bumps: Bump[] = Array.from({ length: o.clumps.count }, (_, k) => ({
    u: lerp(0.1, 0.9, (k + r(0.2, 0.8)) / o.clumps.count),
    w: r(0.04, 0.07),
    a: r(o.clumps.size[0], o.clumps.size[1]),
  }));
  const outer = bumped(curve, bumps.filter((b) => Math.abs(b.u - 0.5) > 0.14), lobe);

  // Lower edge: the hairline between the two sides of the crest, hung with a few short tips.
  const front = resample(hl.front.filter((p) => Math.abs(p[0] - c) < hw).slice().reverse(), 1.4);
  const tips: Bump[] = Array.from({ length: o.fringe }, (_, k) => ({ u: lerp(0.16, 0.84, (k + r(0.25, 0.75)) / o.fringe), w: r(0.07, 0.11), a: r(3, 6.5), lean: r(-1.5, 1.5) }));
  const hung = hanging(front, tips);
  const base = [...outer, ...hung];
  const crestD = ring(base);
  const clip = `${uid}mh`;

  // Close sides: a fade that is clearly shorter than the crest, strongest by the crest, gone at the ear.
  const capOuter = shell(f, head, yS, 1.2, 1.8);
  const temple = (t: Pt[]) => t.filter((p) => p[1] <= yS);
  const cap = [...capOuter, ...temple(hl.templeR).slice().reverse(), ...hl.front.slice().reverse().slice(1), ...temple(hl.templeL).slice(1)];
  const sideTone = mixHex(color, skin.deep, 0.22);

  // Light up the left of the crest, a pair of separations between clumps, shade on the right half.
  const axis = (dx: number): Pt[] => {
    const y0 = yHl(c) - 4;
    const y1 = yTop + 8;
    const ym = (y0 + y1) / 2;
    return [P(c + dx + sway(y0), y0), P(c + dx + sway(ym) + noise1(seed, dx) * 1.2, ym), P(c + dx + sway(y1), y1)];
  };
  const lights: string[] = [];
  const seps: string[] = [];
  if (d > 0) {
    lights.push(hairStroke(axis(-hw * 0.42), { from: 0.12, to: 0.88, w: d === 2 ? 3 : 3.6, seed: seed + 1, start: 0.4, end: 0.2, peak: 0.5 }));
    if (d === 2) lights.push(hairStroke(axis(-hw * 0.72), { from: 0.28, to: 0.7, w: 1.6, seed: seed + 2, start: 0.4, end: 0.3 }));
    seps.push(hairStroke(axis(hw * 0.12), { from: 0.22, to: 0.86, w: 1.5, seed: seed + 3, start: 0.1, end: 0.6, peak: 0.5 }));
    if (d === 2) seps.push(hairStroke(axis(-hw * 0.2), { from: 0.42, to: 0.82, w: 1.2, seed: seed + 4, start: 0.2, end: 0.6 }));
  }
  const split = [P(c + hw * 0.18 + sway(yHl(c)), yHl(c) + 6), P(c + hw * 0.1 + sway((yHl(c) + yTop) / 2), lerp(yHl(c), yTop, 0.5)), P(c + hw * 0.2 + sway(yTop), yTop - 4)].map((p, k) => P(p[0] + noise1(seed + 6, k) * 1.5, p[1]));
  const shadeR = ring([...along(split, 5, 0.5), P(c + hw * 3, yTop - 6), P(c + hw * 3, yHl(c) + 6)]);
  const under = ring([...hung, ...hung.slice().reverse().map((p, k) => P(p[0], p[1] - 4 - 1.6 * Math.sin(k * 0.4 + seed) ** 2))]);

  return {
    onSkin: <path d={castBelow(hung, 1.2, 2.8, f.top)} fill={skin.shade} opacity={0.5} />,
    mid: (
      <g>
        {fadeRegion(`${uid}mhc`, ring(cap), sideTone, d === 2 ? 1 : d, { y0: yHl(c) - 14, y1: yS, o0: 0.5, o1: 0.1 })}
        <ClipDefs id={clip} shapes={[crestD]} />
        <path d={crestD} fill={T.base} />
        <g clipPath={`url(#${clip})`}>
          <path d={shadeR} fill={T.shade} opacity={0.75} />
          <path d={under} fill={T.shade} opacity={0.7} />
          {seps.length > 0 && <path d={seps.join("")} fill={T.deep} opacity={0.7} />}
          {lights.length > 0 && <path d={lights.join("")} fill={T.light} opacity={0.75} />}
        </g>
        <path d={silhouetteInk(outer, d, seed + 5, [[0, 0.2], [0.26, 1]], 1.9)} fill={INK} />
        {/* Where the crest meets the faded side it needs a light edge line too, low down only. */}
        {d > 0 && <path d={strokeLine(left.slice(0, 4), { w: 1.2, start: 0.2, end: 0.8, seed: seed + 7 })} fill={INK} opacity={0.35} />}
      </g>
    ),
    extent: extentOf(capOuter),
    ears: "visible",
  };
}
