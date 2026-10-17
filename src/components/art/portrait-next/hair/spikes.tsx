/** Short athletic hair with broad spiked masses spread across the whole top (no single crest), over close sides. */
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
  last,
  rnd,
  shell,
  silhouetteInk,
  type Bump,
  type HairArt,
  type HairInput,
} from "./core";

export interface SpikeDesign {
  /** Number of spikes (a range if the seed may pick). */
  count: readonly [number, number];
  /** Height of every spike over the crown, and the thickness of the crown mass under the spikes. */
  height: number;
  crown: number;
  /** Where along the outline (0 left temple .. 1 right temple) the row begins and ends. */
  span: readonly [number, number];
  /** Half-width of a spike as a multiple of the spacing: above 1 neighbours overlap and share a valley. */
  overlap: number;
  /** Short angular spikes over the forehead: how many, and their height. */
  fringe: { count: number; height: number };
}

/** Broad spike: a firm tip with only slightly concave flanks, so a spike reads as a mass, not a thorn. */
const broad = (x: number) => Math.pow(Math.max(0, 1 - Math.abs(x)), 1.3);

/**
 * One crown mass shaped by the skull, with 4-7 broad spikes standing out of it. Spikes differ in height, width, tilt
 * and spacing, overlap where they meet, and grow out of the crown (the outline between them stays on the mass, it
 * never drops back to the scalp). The front edge is short and angular: a few small forward spikes over the hairline.
 * The sides are a close cap in tone. Light runs up the axis of each spike; the right of each spike turns into shade.
 */
export function spikesHair(i: HairInput, o: SpikeDesign): HairArt {
  const { f, head, color, skin, uid, d, recede, seed } = i;
  const T = hairTones(color, skin.base);
  const hl = hairline(f, head, "straight", recede, seed);
  let slot = 0;
  const r = (lo: number, hi: number) => rnd(seed + 53, slot++, lo, hi);
  const yS = f.ear.top - 3;
  const yM = Math.max(hl.front[0][1], last(hl.front)[1]) + 5;

  const base = shell(f, head, yM, 1.6, o.crown, 1.6);
  const n = Math.round(r(o.count[0], o.count[1] + 0.99));
  const spikes: (Bump & { k: number; lean: number })[] = [];
  // Evenly spaced and equal: the only differences between spikes are a few percent of height and width, so the row
  // reads as one deliberate cut. Each stands out along the skull's normal, so the row fans out with the dome.
  const span = o.span[1] - o.span[0];
  for (let k = 0; k < n; k++) {
    const u = o.span[0] + (span * (k + 0.5)) / n;
    spikes.push({ u, a: o.height * (1 + r(-0.04, 0.04)), w: (span / n) * o.overlap * (1 + r(-0.03, 0.03)), lean: 0, k });
  }
  const outer = bumped(base, spikes, broad);

  // Front edge: the hairline, short and angular, a few small spikes pushed forward over the forehead.
  const front = resample(hl.front.slice().reverse().filter((_, k) => k % 2 === 0 || k === hl.front.length - 1), 1.4);
  const tips: Bump[] = Array.from({ length: o.fringe.count }, (_, k) => ({
    u: lerp(0.2, 0.8, (k + 0.5) / o.fringe.count),
    w: 0.62 / o.fringe.count / 1.6,
    a: o.fringe.height * (1 + r(-0.05, 0.05)),
    lean: 0,
  }));
  const hung = hanging(front, tips);

  const cornerR = hung[0];
  const cornerL = last(hung);
  const sideEnd = (s: 1 | -1, from: Pt, to: Pt) => along([from, P(lerp(from[0], to[0], 0.5) + s * 0.4, lerp(from[1], to[1], 0.5)), to], 3, 0.5).slice(1);
  const mass = [...outer, ...sideEnd(1, last(outer), cornerR), ...hung.slice(1), ...sideEnd(-1, cornerL, outer[0]).slice(0, -1)];
  const massD = ring(mass);
  const clip = `${uid}sp`;

  // Close sides: a cap just off the skull, in tone, thinning down the temple to the top of the ear.
  const capOuter = shell(f, head, yS, 1.4, 2.4);
  const temple = (t: Pt[]) => t.filter((p) => p[1] <= yS);
  const tR = temple(hl.templeR);
  const tL = temple(hl.templeL);
  const cap = [...capOuter, ...tR.slice().reverse(), ...hl.front.slice().reverse().slice(1), ...tL.slice(1)];
  const sideTone = mixHex(color, skin.deep, 0.18);

  // Light up the axis of each spike (left of centre), shade on its right, a dark valley between neighbours.
  const tipAt = (u: number) => outer[clamp(Math.round(u * (outer.length - 1)), 0, outer.length - 1)];
  const lights: string[] = [];
  const shades: string[] = [];
  const valleys: string[] = [];
  const sorted = spikes.slice().sort((a, b) => a.u - b.u);
  sorted.forEach((s, k) => {
    // The spike's tip is the highest point of the outline within its width.
    const lo = Math.round(clamp(s.u - s.w * 0.7, 0, 1) * (outer.length - 1));
    const hi = Math.round(clamp(s.u + s.w * 0.7, 0, 1) * (outer.length - 1));
    const tip = outer.slice(lo, hi + 1).reduce((m, p) => (p[1] < m[1] ? p : m), outer[lo]);
    const root = P(tip[0] - s.lean * 1.4, tip[1] + s.a * 1.15 + 3);
    const axis = [root, P(lerp(root[0], tip[0], 0.55) + noise1(seed + k, 0.4) * 1.5, lerp(root[1], tip[1], 0.55)), P(tip[0] - 0.5, tip[1] + 1.5)];
    const wd = clamp(s.w * 150, 3.4, 6.5);
    if (d > 0 && tip[0] < CX + f.skullW * 0.4) lights.push(hairStroke(axis.map((p) => P(p[0] - wd * 0.25, p[1])), { from: 0.12, to: 0.88, w: d === 2 ? wd * 0.5 : wd * 0.6, seed: seed + k, start: 0.4, end: 0.15, peak: 0.5 }));
    shades.push(strokeLine(axis.map((p) => P(p[0] + wd * 0.38, p[1] + 1)), { w: wd * 0.85, start: 0.5, end: 0.2, peak: 0.45, seed: seed + k + 9 }));
    const next = sorted[k + 1];
    if (next && d > 0) {
      const v = tipAt((s.u + next.u) / 2);
      valleys.push(hairStroke([P(v[0], v[1] + 1), P(v[0] + s.lean * 0.2, v[1] + 7), P(v[0] + s.lean * 0.4, v[1] + 13)], { from: 0, to: 1, w: d === 2 ? 1.6 : 2, seed: seed + k + 30, start: 0.9, end: 0.05, peak: 0.15 }));
    }
  });
  // The far (right) side of the whole mass turns away from the light.
  const split = along([P(CX + f.skullW * 0.28, f.top - o.crown - o.height), P(CX + f.skullW * 0.2, lerp(f.top, hl.y, 0.5)), P(CX + f.skullW * 0.26, hl.y + 6)], 4).map((p, k) => P(p[0] + noise1(seed + 6, k * 0.6) * 3.4, p[1]));
  const shadeR = ring([...split, P(CX + 150, hl.y + 6), P(CX + 150, f.top - 60)]);
  // The hair's lower edge drops a band of shade just inside it, where the forehead meets it.
  const under = ring([...hung, ...hung.slice().reverse().map((p, k) => P(p[0], p[1] - 4 - 1.6 * Math.sin(k * 0.4 + seed) ** 2))]);

  return {
    onSkin: <path d={castBelow(hung, 1.2, 2.8, f.top)} fill={skin.shade} opacity={0.55} />,
    mid: (
      <g>
        {fadeRegion(`${uid}spc`, ring(cap), sideTone, d === 2 ? 1 : d, { y0: yM - 10, y1: yS, o0: 0.9, o1: 0.28 })}
        <ClipDefs id={clip} shapes={[massD]} />
        <path d={massD} fill={T.base} />
        <g clipPath={`url(#${clip})`}>
          <path d={shadeR} fill={T.shade} opacity={0.6} />
          <path d={shades.join("")} fill={T.shade} opacity={0.75} />
          <path d={under} fill={T.shade} opacity={0.7} />
          {valleys.length > 0 && <path d={valleys.join("")} fill={T.deep} opacity={0.7} />}
          {lights.length > 0 && <path d={lights.join("")} fill={T.light} opacity={0.75} />}
        </g>
        <path d={silhouetteInk(outer, d, seed + 5, [[0, 0.3], [0.36, 1]], 1.9)} fill={INK} />
      </g>
    ),
    extent: extentOf(outer),
    ears: "visible",
  };
}
