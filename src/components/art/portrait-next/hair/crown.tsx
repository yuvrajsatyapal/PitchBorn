/** Short, tightly curled hair: a compact crown built from overlapping curl clusters over a stepped taper. */
import { CX, along, clamp, lerp, type Pt } from "../../portrait/geometry";
import { anchorsFor } from "../anchors";
import { resample, ring } from "../ink";
import { INK, hairTones, mixHex } from "../palette";
import {
  P,
  ShapeDefs,
  bumped,
  castBelow,
  coilyCluster,
  extentOf,
  fadeRegion,
  hairline,
  last,
  lobe,
  lobedEdge,
  rnd,
  shell,
  sideRegion,
  silhouetteInk,
  type HairArt,
  type HairInput,
} from "./core";

export interface CrownDesign {
  /** Height of the crown above the skull. */
  top: number;
  /** Thickness at the weight line over the temples. */
  side: number;
  /** Curl clusters (full size) on the rim, the middle and the centre of the crown. */
  clusters: readonly [number, number, number];
  /** Cluster radius range. */
  size: readonly [number, number];
}

/**
 * The crown is one compact mass whose outline is itself made of curl clusters (rounded lobes of different size, one
 * side a little fuller). Inside, clusters of different size overlap in three rings that follow the dome; each casts a
 * small shade on the one below it, and the lit ones on the upper left catch light. The crown ends at a clear weight
 * line over the temples; below it a shorter band tapers down in value to the top of the ear, so the step reads as
 * crown -> shorter sides -> temples -> hairline. The hairline is natural: small lobes, no hanging curls.
 */
export function crownHair(i: HairInput, o: CrownDesign): HairArt {
  const { f, head, color, skin, uid, d, recede, seed } = i;
  const T = hairTones(color, skin.base);
  const hl = hairline(f, head, "irregular", recede, seed);
  const a = anchorsFor(f, head);
  // Wide skulls carry a broader and slightly taller crown, narrow ones a compact one; the weight line follows the temples.
  const k = clamp((a.width - 120) / 40, 0, 1);
  const top = lerp(o.top * 0.85, o.top * 1.12, k) + rnd(seed, 5, -1, 1.2);
  const cornerL = hl.front[0];
  const cornerR = last(hl.front);
  const yS = f.ear.top - 1;
  const yM = Math.min(Math.max(cornerR[1], cornerL[1]) + 8, yS - 6);

  const sideL = o.side + rnd(seed, 6, -0.3, 0.5);
  const sideR = o.side + rnd(seed, 7, -0.3, 0.5);
  const raw = shell(f, head, yM, sideL, top, sideR);
  // One side of the crown is fuller, and where depends on the player.
  // and the other a little flatter, so the crown leans without gaining volume.
  const u0 = rnd(seed, 8, 0.2, 0.8);
  const fuller = bumped(raw, [{ u: u0, w: 0.2, a: rnd(seed, 9, 1.4, 2.6) }, { u: (u0 + 0.5) % 1, w: 0.22, a: -rnd(seed, 10, 0.8, 1.6) }], lobe);
  const lobed = lobedEdge(fuller, { seed, spacing: [8, 16], amp: [1.4, 3.8], big: 0.3 });
  // The hair ends where the head ends: towards the temples the outline is held to the skull edge (lobes die out), and
  // only over the crown does it stand off.
  const outer = lobed.map((p) => {
    // Only on the flanks: over the dome the outline stands off vertically, and the skull is narrower there.
    if (p[1] < f.top + (yM - f.top) * 0.5) return p;
    const s = p[0] >= CX ? 1 : -1;
    const room = clamp((yM - p[1]) / (0.5 * (yM - f.top)), 0, 1);
    const cap = head.half(p[1], s) + lerp(0.5, top + 1, room * room);
    return Math.abs(p[0] - CX) > cap ? P(CX + s * cap, p[1]) : p;
  });

  // Weight line: the crown turns in to the hairline corner above the temple; below it only the short taper remains.
  const turn = (s: 1 | -1, end: Pt, corner: Pt): Pt[] => lobedEdge(along([end, P(lerp(end[0], corner[0], 0.5) - s, lerp(end[1], corner[1], 0.55)), corner], 4, 0.5), { seed: seed + (s > 0 ? 31 : 37), spacing: [6, 9], amp: [0.6, 1.6], sign: s > 0 ? -1 : 1 });
  const sR = turn(1, last(outer), cornerR);
  const sL = turn(-1, outer[0], cornerL);
  const frontBase = hl.front.slice().reverse();
  const front = lobedEdge(frontBase, { seed: seed + 5, spacing: [9, 14], amp: [0.5, 1.1] });
  const region = [...outer, ...sR.slice(1), ...front.slice(1), ...sL.slice().reverse().slice(1)];
  const regionD = ring(region);
  const faceEdge = [...sR, ...front.slice(1), ...sL.slice().reverse().slice(1)];
  const clip = `${uid}ct`;

  const xs = outer.map((p) => p[0]);
  const ys = outer.map((p) => p[1]);
  const topY = Math.min(...ys);
  const bottom = hl.y + 4;
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (topY + bottom) / 2;
  const rx = (Math.max(...xs) - Math.min(...xs)) / 2;
  const ry = (bottom - topY) / 2;

  // Clusters in three rings along the dome (angle: upper half of the ellipse), rim first so the inner ones overlap them.
  const full = o.clusters;
  const count = (n: number) => (d === 2 ? n : d === 1 ? Math.max(2, Math.round(n * 0.65)) : Math.max(2, Math.round(n * 0.4)));
  const rings: [number, number, number][] = [
    [count(full[0]), 0.78, 3.3],
    [count(full[1]), 0.46, 3.45],
    [count(full[2]), 0.16, 3.7],
  ];
  const shadows: string[] = [];
  const lit: string[] = [];
  const mids: string[] = [];
  const bright: string[] = [];
  let g = 0;
  rings.forEach(([n, rr, th0], ring_) => {
    for (let q = 0; q < n; q++) {
      const th = lerp(th0, 6.12 - (th0 - 3.3) * 0.9, (q + 0.5) / n) + rnd(seed, 100 + g, -0.2, 0.2);
      const rad = clamp(rr + rnd(seed, 130 + g, -0.07, 0.07), 0.08, 0.9);
      const c = P(cx + Math.cos(th) * rx * rad, cy + Math.sin(th) * ry * rad * 0.95);
      const R = lerp(o.size[0], o.size[1], Math.pow(rnd(seed, 160 + g, 0, 1), 1.4)) * (ring_ === 0 ? 1.05 : 1);
      const shape = { seed: seed + g * 7, lobes: 3 + (g % 3), squash: rnd(seed, 190 + g, 0.62, 0.95), rot: th + Math.PI / 2 };
      shadows.push(coilyCluster(P(c[0] + 1.3, c[1] + 1.7), R * 1.02, shape));
      (Math.cos(th) < -0.2 ? lit : mids).push(coilyCluster(c, R, shape));
      if (d === 2 && Math.cos(th) < 0 && Math.sin(th) < -0.4) bright.push(coilyCluster(P(c[0] - R * 0.22, c[1] - R * 0.3), R * 0.4, { ...shape, seed: shape.seed + 3, lobes: 3 }));
      g++;
    }
  });

  const fc = P(CX, f.eyeY);
  const underside = ring([...faceEdge, ...faceEdge.slice().reverse().map((p) => P(p[0] + ((p[0] - fc[0]) / Math.hypot(p[0] - fc[0], p[1] - fc[1])) * 5, p[1] + ((p[1] - fc[1]) / Math.hypot(p[0] - fc[0], p[1] - fc[1])) * 5))]);

  // The taper: a short band below the weight line, dense where it meets the crown and thinning to the ear.
  const taper = ([1, -1] as const).map((s) => (
    <g key={s}>
      {fadeRegion(`${uid}ctf${s > 0 ? "r" : "l"}`, ring(sideRegion(s > 0 ? hl.templeR : hl.templeL, s, yM - 18)), mixHex(color, skin.deep, 0.28), d, {
        y0: yM - 18,
        y1: Math.min(yS, last(hl.templeR)[1]),
        o0: 0.62,
        mid: [0.45, 0.3],
        o1: 0.015,
      })}
    </g>
  ));

  return {
    extent: extentOf(outer),
    ears: "visible",
    onSkin: (
      <g>
        {taper}
        <path d={castBelow(faceEdge, 1.3, 2.6, f.top)} fill={skin.shade} opacity={0.7} />
      </g>
    ),
    mid: (
      <g>
        <ShapeDefs id={clip} d={regionD} />
        <use href={`#${clip}s`} fill={mixHex(T.shade, T.deep, 0.4)} />
        <g clipPath={`url(#${clip})`}>
          <path d={underside} fill={T.deep} opacity={0.5} />
          <path d={shadows.join("")} fill={T.shade} stroke={T.shade} strokeWidth={1.6} strokeLinejoin="round" opacity={0.85} />
          <path d={mids.join("")} fill={T.base} stroke={T.base} strokeWidth={1.8} strokeLinejoin="round" />
          {lit.length > 0 && <path d={lit.join("")} fill={mixHex(T.base, T.light, 0.34)} stroke={mixHex(T.base, T.light, 0.34)} strokeWidth={1.6} strokeLinejoin="round" />}
          {bright.length > 0 && <path d={bright.join("")} fill={T.light} opacity={0.6} />}
        </g>
        <path d={silhouetteInk(resample(outer, 1.6), d, seed + 5, [[0, 0.2], [0.26, 1]], 1.8)} fill={INK} />
      </g>
    ),
  };
}
