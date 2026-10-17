/** Hair swept back from the forehead: a few broad sections that tile the whole top and run, front to back, to its edge. */
import { CX, along, clamp, lerp, type Pt } from "../../portrait/geometry";
import { noise1, ring } from "../ink";
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
  last,
  lobe,
  rnd,
  shell,
  silhouetteInk,
  taperedLock,
  type Bump,
  type HairArt,
  type HairInput,
} from "./core";

export interface SlickDesign {
  /** Volume over the crown (low) and the extra lift of the front section above it. */
  top: number;
  lift: number;
  /** Thickness at the sides, left and right (they differ), and the number of sections. */
  side: readonly [number, number];
  sections: number;
  /** How far below the hairline corners the swept mass reaches at the sides (default 11; long cuts reach the ear). */
  reach?: number;
  /** A short fade below the mass (default true); long cuts that reach the ear have none. */
  fade?: boolean;
}

/**
 * The mass is its silhouette: a low crown, a broad lift off centre at the front that eases down on one side, and thin
 * sides that taper into the fade. It is tiled by 4-5 wide sections. Each starts on the hairline, runs up in one long
 * smooth curve and ends on the outline of the mass: the middle sections reach the crown, the outer ones bow round the
 * dome and come down the sides, so the side hair is the end of the same flow. Sections are told apart by value, a step
 * darker from left to right, with a soft shadow where one lies on the next. A single thin highlight follows the curve of
 * the left sections. There are no strands, loops or curls.
 */
export function slickHair(i: HairInput, o: SlickDesign): HairArt {
  const { f, head, color, skin, uid, d, recede, seed } = i;
  const T = hairTones(color, skin.base);
  const hl = hairline(f, head, "rounded", recede, seed, -1);
  let slot = 0;
  const r = (lo: number, hi: number) => rnd(seed + 211, slot++, lo, hi);
  const yS = f.ear.top - 2;
  const cornerR = last(hl.front);
  const cornerL = hl.front[0];
  const yM = Math.min(Math.max(cornerR[1], cornerL[1]) + (o.reach ?? 11), yS);

  // Silhouette: a high front lift off centre, a long lower shoulder on the other side, and a gentle dip behind it.
  const base = shell(f, head, yM, o.side[0], o.top, o.side[1]);
  const at = 0.5 + r(-0.1, 0.1);
  const dir = at > 0.5 ? 1 : -1;
  const rise: Bump[] = [
    { u: at, w: 0.25, a: o.lift },
    { u: at - dir * 0.2, w: 0.15, a: o.lift * 0.42 },
    { u: at + dir * 0.22, w: 0.13, a: -o.lift * 0.14 },
  ];
  const outer = bumped(base, rise, lobe);
  const front = hl.front.slice().reverse();
  const n = front.length - 1;
  // The front edge is not level: it lifts in a soft arch where the front section rises, and falls away at the temples.
  const raised = front.map((p, k) => (k === 0 || k === n ? p : P(p[0], p[1] - 1.2 - 2 * lobe((k / n - (1 - at)) / 0.5) + noise1(seed + 4, k * 0.45) * 0.7)));
  // A running average of the heights removes any pointed dip while keeping the slow, uneven wave.
  const edge = raised.map((p, k) => {
    if (k < 2 || k > n - 2) return p;
    const y = (raised[k - 2][1] + raised[k - 1][1] * 2 + p[1] * 3 + raised[k + 1][1] * 2 + raised[k + 2][1]) / 9;
    return P(p[0], y);
  });
  const end = (s: 1 | -1, from: Pt, to: Pt) => along([from, P(lerp(from[0], to[0], 0.5) - s * 0.3, lerp(from[1], to[1], 0.5) + 0.5), to], 3, 0.5).slice(1);
  const region = [...outer, ...end(1, last(outer), edge[0]), ...edge.slice(1), ...end(-1, edge[n], outer[0]).slice(0, -1)];
  const regionD = ring(region);
  const clip = `${uid}sk`;

  // Sections: root on the hairline, tip on the outline, a long curve between (straight up first, then bowing outwards).
  const m = d === 0 ? 3 : d === 1 ? Math.min(4, o.sections) : o.sections;
  // Left to right, like the outline, so a section starting on the left ends on the left.
  const edgeLR = edge.slice().reverse();
  const outerAt = (u: number): Pt => outer[clamp(Math.round(u * (outer.length - 1)), 0, outer.length - 1)];
  const span = Math.abs(edge[0][0] - last(edge)[0]);
  const secs = Array.from({ length: m }, (_, k) => {
    const us = lerp(0.08, 0.92, (k + 0.5 + r(-0.15, 0.15)) / m);
    const root = edgeLR[clamp(Math.round(us * n), 0, n)];
    // Where it ends on the outline: the far left starts end near the left shoulder, the middle ones at the crown.
    const ue = clamp(0.5 + (us - 0.5) * 0.82 + r(-0.03, 0.03), 0.1, 0.9);
    const t = outerAt(ue);
    const tip = P(lerp(t[0], CX, 0.03), t[1] + 3.5);
    // Combed, not fanned: every section bows the same way (towards the lifted side), outer ones a little more as they
    // go over the dome.
    const bow = dir * 2.5 + (us - 0.5) * 22;
    const path = [root, P(lerp(root[0], tip[0], 0.28) + bow * 0.6, lerp(root[1], tip[1], 0.4)), P(lerp(root[0], tip[0], 0.55) + bow, lerp(root[1], tip[1], 0.92)), tip];
    const w = (span / m) * r(1.7, 2);
    return { us, path, w, k };
  });
  const order = secs.slice().sort((a, b) => Math.abs(b.us - 0.5) - Math.abs(a.us - 0.5));
  const opts = (s: (typeof secs)[number]) => ({ w: s.w, root: 0.9, peak: 0.4, tip: 0.5, wobble: 0.02, seed: seed + s.k, steps: 10 });
  const tone = (us: number, k: number) => mixHex(T.base, T.shade, clamp((us - 0.15) * 0.65 + (k % 2 ? 0.05 : -0.02), 0, 0.46));

  // Light follows the left sections' curve, thin; a soft shadow under each section where it lies on its neighbour.
  const lightOf = (s: (typeof secs)[number]) => {
    // Sampled along the section and bent outwards in the middle, so it curves the way the hair goes back.
    const line = along(s.path, 10, 0.5);
    const bent = line.map((p, k) => P(p[0] - s.w * 0.2 + Math.sign(s.us - 0.5 || -1) * 4.5 * Math.sin((Math.PI * k) / (line.length - 1)), p[1] + 0.5));
    return hairStroke(bent, { from: 0.15, to: 0.85, w: d === 2 ? 2.2 : 2.8, seed: seed + s.k + 30, start: 0.5, end: 0.5, peak: 0.5 });
  };
  const shoulder = outer.filter((p) => p[0] > CX + 8 && p[1] < yM - 6);
  const bounce = shoulder.length > 3 ? hairStroke(along(shoulder.map((p) => P(p[0] - 4, p[1] + 6)), 4, 0.5), { from: 0.05, to: 0.95, w: 5.5, seed: seed + 9, start: 0.6, end: 0.6, peak: 0.5 }) : "";
  const lowEdge = ring([...edge, ...edge.slice().reverse().map((p, k) => P(p[0], p[1] - 3 - 1.2 * Math.sin(k * 0.4 + seed) ** 2))]);

  // The fade below the mass continues its tone, so the sides read as the end of the sweep, not as separate panels.
  const capOuter = shell(f, head, yS, 1, 1.6);
  const temple = (t: Pt[]) => t.filter((p) => p[1] <= yS);
  const cap = [...capOuter, ...temple(hl.templeR).slice().reverse(), ...hl.front.slice().reverse().slice(1), ...temple(hl.templeL).slice(1)];
  const sideTone = mixHex(color, skin.deep, 0.12);

  return {
    onSkin: <path d={castBelow(edge, 1.2, 2.6, f.top)} fill={skin.shade} opacity={0.5} />,
    mid: (
      <g>
        {o.fade !== false && fadeRegion(`${uid}skc`, ring(cap), sideTone, d === 2 ? 1 : d, { y0: yM - 22, y1: yS, o0: 0.9, mid: [0.35, 0.8], o1: 0.06 })}
        <ClipDefs id={clip} shapes={[regionD]} />
        <path d={regionD} fill={mixHex(T.base, T.shade, 0.45)} />
        <g clipPath={`url(#${clip})`}>
          {/* A slightly wider, faint copy of the right-hand sections softens where they lie on the crown (one path). */}
          {d === 2 && <path d={order.filter((s) => s.us > 0.45).map((s) => taperedLock(s.path, { ...opts(s), w: s.w * 1.14 })).join("")} fill={mixHex(T.base, T.shade, 0.3)} opacity={0.4} />}
          {order.map((s) => (
            <g key={s.k}>
              <path d={taperedLock(s.path, opts(s))} fill={tone(s.us, s.k)} />
              {d === 2 && s.us < 0.62 && <path d={lightOf(s)} fill={T.light} opacity={0.38} />}
            </g>
          ))}
          {d > 0 && bounce && <path d={bounce} fill={mixHex(T.base, T.light, 0.5)} opacity={0.3} />}
          {d > 0 && <path d={lowEdge} fill={T.shade} opacity={0.55} />}
        </g>
        {d > 0 && (
          <g clipPath={`url(#${clip})`}>
            <defs>
              <linearGradient id={`${uid}skg`} gradientUnits="userSpaceOnUse" x1={CX - 70} y1="0" x2={CX + 70} y2="0">
                <stop offset="0" stopColor={T.light} stopOpacity="0.16" />
                <stop offset="0.5" stopColor={T.light} stopOpacity="0" />
                <stop offset="1" stopColor={T.deep} stopOpacity="0.38" />
              </linearGradient>
            </defs>
            <path d={regionD} fill={`url(#${uid}skg)`} />
          </g>
        )}
        <path d={silhouetteInk(outer, d, seed + 5, [[0, 1]], 1.9)} fill={INK} />
      </g>
    ),
    extent: extentOf(outer),
    ears: "visible",
  };
}

