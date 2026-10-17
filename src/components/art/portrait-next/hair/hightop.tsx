/** A structured high top: one tall, flat-topped block of hair over closely faded sides, with optional shaved lines. */
import { CX, along, lerp, type Pt } from "../../portrait/geometry";
import { noise1, resample, ring, strokeLine } from "../ink";
import { INK, hairTones, mixHex } from "../palette";
import { ClipDefs, P, bumped, castBelow, extentOf, fadeRegion, hairline, lobe, organicMass, rnd, shell, silhouetteInk, type Bump, type HairArt, type HairInput } from "./core";

export interface HighTopDesign {
  /** Height of the flat top above the skull. */
  height: number;
  /** How far the block stands out from the head at the fade line. */
  flare: number;
  /** Compact texture clumps along the top edge: count and size. */
  clumps: { count: number; size: readonly [number, number] };
}

/** The shaved line patterns a player can carry (chosen by the seed); the first is plain. */
const PATTERNS = ["none", "line", "step", "double"] as const;

/**
 * The block is a rounded box: near-vertical walls rising from the fade line, softly rounded top corners, a flat top
 * that is never quite level (it tilts a little and has a few compact clumps). It sits clearly above the sides, which
 * are a close fade: tone on the skin thinning down to the ear. The boundary between the block and the fade is a
 * clean line. On the sides, at full size only, a thin shaved line (or a step, or two lines) cuts through the fade.
 */
export function highTopHair(i: HairInput, o: HighTopDesign): HairArt {
  const { f, head, color, skin, uid, d, recede, seed } = i;
  const T = hairTones(color, skin.base);
  const hl = hairline(f, head, "straight", recede, seed);
  let slot = 0;
  const r = (lo: number, hi: number) => rnd(seed + 131, slot++, lo, hi);
  const yS = f.ear.top - 3;
  const cornerR = hl.front[hl.front.length - 1];
  const cornerL = hl.front[0];
  const yFade = Math.max(cornerR[1], cornerL[1]) + 5;
  const yTop = f.top - o.height * (1 + r(-0.05, 0.05));
  const wL = head.half(yFade, -1) + o.flare;
  const wR = head.half(yFade, 1) + o.flare;
  // The top is never quite level.
  const tl = r(-1.4, 1.4);
  const tr = r(-1.4, 1.4);
  const ctrl: Pt[] = [
    P(CX - wL, yFade),
    P(CX - wL - 0.3, lerp(yFade, yTop, 0.5)),
    P(CX - wL - 0.2, yTop + 15),
    P(CX - wL + 4.5, yTop + 4 + tl),
    P(CX - wL * 0.55, yTop + tl * 0.7),
    P(CX - wL * 0.15, yTop + tl * 0.3 + tr * 0.3),
    P(CX + wR * 0.15, yTop + tr * 0.3 + tl * 0.3),
    P(CX + wR * 0.55, yTop + tr * 0.7),
    P(CX + wR - 4.5, yTop + 4 + tr),
    P(CX + wR + 0.2, yTop + 15),
    P(CX + wR + 0.3, lerp(yFade, yTop, 0.5)),
    P(CX + wR, yFade),
  ];
  const curve = resample(along(ctrl, 6, 0.5), 1.4);
  // Compact clumps along the top edge only: small, rounded, none at the corners.
  const bumps: Bump[] = Array.from({ length: o.clumps.count }, (_, k) => ({ u: lerp(0.3, 0.7, (k + r(0.25, 0.75)) / o.clumps.count), w: r(0.03, 0.05), a: r(o.clumps.size[0], o.clumps.size[1]) }));
  const outer = bumped(curve, bumps, lobe);

  // The block's lower edge: the fade line at both walls, the hairline across the forehead.
  const front = hl.front.slice().reverse().map((p, k, a) => (k === 0 || k === a.length - 1 ? p : P(p[0], p[1] - 1 + noise1(seed + 2, k * 0.5) * 0.9)));
  const toFront = (from: Pt, to: Pt) => along([from, P(lerp(from[0], to[0], 0.5), lerp(from[1], to[1], 0.5) + 3), to], 3, 0.5).slice(1);
  const region = [...outer, ...toFront(outer[outer.length - 1], front[0]), ...front.slice(1), ...toFront(front[front.length - 1], outer[0]).slice(0, -1)];
  const regionD = ring(region);
  const clip = `${uid}hk`;

  // The faded sides: tone on the skin from the fade line down to the top of the ear.
  const capOuter = shell(f, head, yS, 1.1, 1.6);
  const temple = (t: Pt[]) => t.filter((p) => p[1] <= yS);
  const cap = [...capOuter, ...temple(hl.templeR).slice().reverse(), ...hl.front.slice().reverse().slice(1), ...temple(hl.templeL).slice(1)];
  const sideTone = mixHex(color, skin.deep, 0.2);

  // Shaved lines on the sides (full size only): parallel to the temple line, never crossing the ear or the block.
  const pattern = PATTERNS[Math.floor(r(0, PATTERNS.length))];
  const lines: string[] = [];
  if (d === 2 && pattern !== "none") {
    for (const s of [1, -1] as const) {
      const t = temple(s > 0 ? hl.templeR : hl.templeL).filter((p) => p[1] > yFade + 3);
      if (t.length < 4) continue;
      const out = (k: number) => t.map((p) => P(p[0] + s * k, p[1]));
      const path = (k: number, from: number, to: number) => strokeLine(out(k).slice(Math.floor(from * t.length), Math.ceil(to * t.length)), { w: 1.7, start: 0.3, end: 0.3, seed: seed + k });
      lines.push(path(3.2, 0.1, 0.92));
      if (pattern === "double") lines.push(path(6.2, 0.18, 0.8));
      if (pattern === "step") {
        const y = t[Math.floor(t.length * 0.45)];
        lines.push(strokeLine([P(y[0] + s * 3.2, y[1]), P(y[0] + s * 7, y[1] + 0.6)], { w: 1.7, start: 0.3, end: 0.3, seed: seed + 5 }));
      }
    }
  }

  // Light on the top edge (upper left), a compact shaded clump or two, shade on the right wall.
  const topEdge = outer.filter((p) => p[1] < yTop + 9);
  const lit = topEdge.filter((p) => p[0] < CX + 4);
  const lightD = d > 0 && lit.length > 3 ? strokeLine(lit.map((p) => P(p[0], p[1] + 3.2)), { w: 4, start: 0.6, end: 0.6, peak: 0.5, seed: seed + 3 }) : "";
  const wallR = ring([P(CX + wR * 0.5, yTop - 8), P(CX + wR + 20, yTop - 8), P(CX + wR + 20, yFade + 8), P(CX + wR * 0.6 + noise1(seed, 1) * 2, yFade + 8), P(CX + wR * 0.5 + noise1(seed, 2) * 3, lerp(yFade, yTop, 0.5))]);
  const patches: string[] = [];
  const lightPatches: string[] = [];
  if (d > 0) {
    for (let k = 0; k < (d === 2 ? 5 : 2); k++) {
      const x = CX + r(-wL * 0.7, wR * 0.7);
      const y = r(yTop + 8, yFade - 6);
      const rad = r(6, 10);
      const blob = organicMass([P(x - rad, y), P(x, y - rad * 0.6), P(x + rad, y + 1), P(x + rad * 0.2, y + rad * 0.6)], { seed: seed + k, rough: 0.6 });
      (x < CX ? lightPatches : patches).push(blob);
    }
  }
  const under = ring([...front, ...front.slice().reverse().map((p, k) => P(p[0], p[1] - 4 - 1.5 * Math.sin(k * 0.4 + seed) ** 2))]);
  const boundary = strokeLine(along([P(CX - wL, yFade), P(CX - wL + (cornerL[0] - (CX - wL)) * 0.5, yFade + 1.5), cornerL], 4, 0.5), { w: 1.2, start: 0.2, end: 0.8, seed: seed + 8 });

  return {
    onSkin: <path d={castBelow(front, 1.2, 2.8, f.top)} fill={skin.shade} opacity={0.5} />,
    mid: (
      <g>
        {fadeRegion(`${uid}hkc`, ring(cap), sideTone, d === 2 ? 1 : d, { y0: yFade - 8, y1: yS, o0: 0.78, o1: 0.08 })}
        {lines.length > 0 && <path d={lines.join("")} fill={skin.base} opacity={0.95} />}
        <ClipDefs id={clip} shapes={[regionD]} />
        <path d={regionD} fill={T.base} />
        <g clipPath={`url(#${clip})`}>
          <path d={wallR} fill={T.shade} opacity={0.7} />
          {patches.length > 0 && <path d={patches.join("")} fill={T.shade} opacity={0.3} />}
          {lightPatches.length > 0 && <path d={lightPatches.join("")} fill={mixHex(T.base, T.light, 0.4)} opacity={0.3} />}
          <path d={under} fill={T.shade} opacity={0.7} />
          {lightD && <path d={lightD} fill={T.light} opacity={0.7} />}
        </g>
        <path d={silhouetteInk(outer, d, seed + 5, [[0, 0.18], [0.24, 1]], 1.9)} fill={INK} />
        {d > 0 && <path d={boundary} fill={INK} opacity={0.3} />}
      </g>
    ),
    extent: extentOf(outer),
    ears: "visible",
  };
}
