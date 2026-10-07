/**
 * Curly and coily hair (afros, curly tops). The silhouette does most of the work: an afro is a rounded mass that curves
 * in under the sides; a curly top follows the skull. Inside: the whole mass in shadow tone, a large lit body on the
 * upper left with a clumpy edge, a few broken arcs of light clusters that follow the roundness, scattered darker
 * groups, and at close-up size only, a handful of curl indications.
 */
import type { FaceSpec } from "../../portrait/anatomy";
import { CX, add, along, clamp, hash01, lerp, scale, sub, unit, type Pt } from "../../portrait/geometry";
import { resample, ring, roughen, strokeLine } from "../ink";
import { INK, hairTones, mixHex } from "../palette";
import {
  P,
  ShapeDefs,
  castBelow,
  coilyCluster,
  curlMark,
  extentOf,
  fadeRegion,
  hairline,
  hanging,
  last,
  lobe,
  lobedEdge,
  rnd,
  scatter,
  shell,
  sideRegion,
  silhouetteInk,
  taperedLock,
  type Bump,
  type HairArt,
  type HairInput,
  type HairlineKind,
} from "./core";

export interface CoilyDesign {
  kind: HairlineKind;
  /** "round": an afro, a rounded mass around the head; "cap": a curly top that follows the skull. */
  shape: "round" | "cap";
  top: number;
  side: number;
  /** Full sides down the temples (afro) or a faded side below a curly top. */
  sides: "full" | "fade";
  /** Silhouette lobes: spacing and height ranges, and how often a larger lobe appears. */
  edge: { spacing: readonly [number, number]; amp: readonly [number, number]; big?: number };
  /** Edge over the forehead: small lobes, plus (curly tops) a few curl groups hanging lower. */
  fringe: { spacing: readonly [number, number]; amp: readonly [number, number]; drop?: number; tips?: readonly Bump[] };
  /** Texture clusters: radius range, lumpiness, squash; and how many arcs of light. */
  cluster: { r: readonly [number, number]; lobes: number; squash: number };
  groups: number;
  /** Curl indications at close-up size. */
  curls: number;
  curlR: readonly [number, number];
  /**
   * A mane: the volume continues down around the whole head. The part above `low` is in front (covering the ears and
   * framing the face); the rest of the cloud, down to `bottom`, is behind the head and neck.
   */
  mane?: { low: (f: FaceSpec) => number; bottom: (f: FaceSpec) => number };
}

/** A rounded mass from `yS` on the left, over the top, down to `yS` on the right (a squarish ellipse). */
function roundMass(f: HairInput["f"], head: HairInput["head"], top: number, side: number, yS: number, seed: number): Pt[] {
  const yTop = f.top - top;
  // Widest a little above the ears, so the mass meets the head just outside them instead of curling in.
  const cy = lerp(yTop, yS, 0.64);
  const ry = cy - yTop;
  const rx = Math.max(head.half(f.browY - 18, 1), head.half(f.browY - 18, -1)) + side;
  const te = Math.asin(clamp((yS - cy) / ry, -1, 1));
  const n = 2.5;
  const pw = (v: number) => Math.sign(v) * Math.abs(v) ** (2 / n);
  // One side a little fuller than the other.
  const kL = 1 + rnd(seed, 21, -0.04, 0.04);
  const kR = 1 + rnd(seed, 22, -0.04, 0.04);
  const pts: Pt[] = [];
  for (let k = 0; k <= 60; k++) {
    const th = Math.PI - te + (k / 60) * (Math.PI + 2 * te);
    const c = Math.cos(th);
    pts.push(P(CX + rx * (c < 0 ? kL : kR) * pw(c), cy + ry * pw(Math.sin(th))));
  }
  return resample(pts, 2.2);
}

/**
 * The whole cloud of a mane as one loop: from the bottom centre round the left, over the top, down the right and back
 * to the bottom. Widest around the ears; one side a little fuller.
 */
function cloudLoop(f: FaceSpec, head: HairInput["head"], top: number, side: number, yBot: number, seed: number): Pt[] {
  const yTop = f.top - top;
  const cy = lerp(yTop, yBot, 0.52);
  const rx = Math.max(head.half(f.browY - 18, 1), head.half(f.browY - 18, -1)) + side;
  const n = 2.4;
  const pw = (v: number) => Math.sign(v) * Math.abs(v) ** (2 / n);
  const kL = 1 + rnd(seed, 21, -0.04, 0.04);
  const kR = 1 + rnd(seed, 22, -0.04, 0.04);
  const pts: Pt[] = [];
  for (let k = 0; k <= 80; k++) {
    const th = Math.PI / 2 + (k / 80) * Math.PI * 2;
    const c = Math.cos(th);
    const sn = Math.sin(th);
    pts.push(P(CX + rx * (c < 0 ? kL : kR) * pw(c), cy + (sn < 0 ? cy - yTop : yBot - cy) * pw(sn)));
  }
  return resample(pts, 2.2);
}

export function coilyHair(i: HairInput, o: CoilyDesign): HairArt {
  const { f, head, color, skin, uid, d, recede, seed } = i;
  const T = hairTones(color, i.skin.base);
  const hl = hairline(f, head, o.kind, recede, seed);
  const cornerL = hl.front[0];
  const cornerR = last(hl.front);
  const full = o.sides === "full";
  const mane = o.mane;
  // A full afro ends at the top of the ears; a mane well below them; a curly top just below the temple corners.
  const yS = mane ? mane.low(f) : full ? f.ear.top + 4 : Math.max(cornerR[1], cornerL[1]) + 10;
  let cloud: Pt[] | null = null;
  let outer: Pt[];
  let cut = [0, 0];
  if (mane) {
    // Large lobes need less resolution than small ones.
    cloud = lobedEdge(cloudLoop(f, head, o.top, o.side, mane.bottom(f), seed), { seed, ...o.edge, step: d === 0 ? 3 : 2 });
    const iL = cloud.findIndex((p) => p[1] <= yS);
    let iR = cloud.length - 1;
    while (iR > iL && cloud[iR][1] > yS) iR--;
    cut = [iL, iR];
    outer = cloud.slice(iL, iR + 1);
  } else {
    const raw = o.shape === "round" ? roundMass(f, head, o.top, o.side, yS, seed) : shell(f, head, yS, o.side, o.top, o.side + rnd(seed, 23, -0.5, 1.5));
    outer = lobedEdge(raw, { seed, ...o.edge });
  }

  // Where the hair meets the face: full sides curve in under the mass to the sideburns and run up the temples;
  // a faded cut turns in above them.
  const sideFront = (s: 1 | -1, end: Pt, corner: Pt, temple: Pt[]): Pt[] => {
    // A mane covers the ears: it turns in under itself to the cheek and hugs the face outline up to the temple.
    if (mane) {
      const edge = P(CX + s * (head.half(yS, s) - 1.5), yS + 2);
      const under = along([end, P(lerp(end[0], edge[0], 0.45), yS + 7), edge], 4);
      const hug = (s > 0 ? head.rightPts : head.leftPts)
        .filter((p) => p[1] > corner[1] + 16 && p[1] < yS - 2)
        .map((p) => P(CX + s * (Math.abs(p[0] - CX) - 3), p[1]))
        .reverse();
      return [...under, ...hug, P(CX + s * (head.half(corner[1] + 10, s) - 7), corner[1] + 10), corner];
    }
    // A faded cut: curls hang a little over the weight line instead of stopping on a ruled edge.
    if (!full) return lobedEdge(along([end, P(lerp(end[0], corner[0], 0.45) - s, lerp(end[1], corner[1], 0.6)), corner], 4, 0.5), { seed: seed + (s > 0 ? 31 : 37), spacing: [6, 10], amp: [0.8, 2.2], sign: s > 0 ? -1 : 1 });
    // The mass curves in under itself to the head just above the ear; only a thin sideburn continues below.
    const yE = f.ear.top + 2;
    const edge = P(CX + s * (head.half(yE, s) + 0.5), yE);
    const under = along([end, P(lerp(end[0], edge[0], 0.5), Math.max(end[1], yE) + 3), edge], 4, 0.5);
    // Down the temple the hair hugs the face outline instead of cutting into the face.
    const hug = temple.filter((p) => p[1] < yE - 3).map((p) => (p[1] > hl.y + 26 ? P(CX + s * Math.max(Math.abs(p[0] - CX), head.half(p[1], s) - 3.5), p[1]) : p));
    return [...under, ...hug.reverse()];
  };
  const sR = sideFront(1, last(outer), cornerR, hl.templeR);
  const sL = sideFront(-1, outer[0], cornerL, hl.templeL);
  const frontBase = resample(hl.front.slice().reverse().map((p, k, a) => (k === 0 || k === a.length - 1 ? p : P(p[0], p[1] + (o.fringe.drop ?? 0)))), 1.5);
  const hung = o.fringe.tips ? hanging(frontBase, o.fringe.tips.map((t) => ({ ...t, u: 1 - t.u })), lobe) : frontBase;
  const front = lobedEdge(hung, { seed: seed + 5, spacing: o.fringe.spacing, amp: o.fringe.amp });
  const region = [...outer, ...sR.slice(1), ...front.slice(1), ...sL.slice().reverse().slice(1)];
  const regionD = ring(region);
  const faceEdge = [...sR, ...front.slice(1), ...sL.slice().reverse().slice(1)];
  const clip = `${uid}hc`;

  // Frame of the mass, for placing light: its centre and half-sizes.
  const xs = outer.map((p) => p[0]);
  const ys = outer.map((p) => p[1]);
  const top = Math.min(...ys);
  const bottom = o.shape === "round" || mane ? yS : hl.y + 4;
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (top + bottom) / 2;
  const rx = (Math.max(...xs) - Math.min(...xs)) / 2;
  const ry = (bottom - top) / 2;

  // Large masses: the lit body is the hair shape pulled towards the upper left, with a clumpy edge.
  const c0 = P(cx - 4, cy);
  const body = region.filter((_, k) => k % 5 === 0).map((p) => P(c0[0] + (p[0] - c0[0]) * 0.8 - rx * 0.07, c0[1] + (p[1] - c0[1]) * 0.8 - ry * 0.12));
  const litBody = ring(roughen(along([...body, body[0]], 4), 2.6, seed + 11, 0.55));
  // The light side of the volume: a broad, lumpy shape on the upper left that the light clusters sit on.
  const litArc: Pt[] = [];
  for (let k = 0; k <= 6; k++) litArc.push(P(cx + Math.cos(lerp(3.3, 4.85, k / 6)) * rx * 0.86, cy + Math.sin(lerp(3.3, 4.85, k / 6)) * ry * 0.86));
  for (let k = 6; k >= 0; k--) litArc.push(P(cx + Math.cos(lerp(3.45, 4.7, k / 6)) * rx * 0.36 - rx * 0.05, cy + Math.sin(lerp(3.45, 4.7, k / 6)) * ry * 0.4));
  const litMass = ring(roughen(along([...litArc, litArc[0]], 4), 2.2, seed + 12, 0.6));
  const fc = P(CX, f.eyeY);
  const underside = ring([...faceEdge, ...faceEdge.slice().reverse().map((p) => add(p, scale(unit(sub(p, fc)), 6)))]);

  // Light: a few large groups, each the light on a cluster of coils (one lumpy mass, a smaller satellite, a bright
  // core at close-up size), following the roundness on the upper left. Darker groups sit on the turn into shadow.
  const lightC: string[] = [];
  const bright: string[] = [];
  const shadeC: string[] = [];
  if (d > 0) {
    const groups = d === 2 ? o.groups : Math.max(1, o.groups - 1);
    for (let g = 0; g < groups; g++) {
      const th = lerp(3.6, 4.7, (g + 0.5) / groups) + rnd(seed, g + 300, -0.15, 0.15);
      const rr = rnd(seed, g + 310, 0.5, 0.7);
      const p = P(cx + Math.cos(th) * rx * rr, cy + Math.sin(th) * ry * rr);
      const tan = P(-Math.sin(th), Math.cos(th));
      const R = rnd(seed, g + 330, o.cluster.r[0], o.cluster.r[1]) * 1.9;
      const shape = { seed: seed + g * 10, lobes: 5, squash: 0.6, rot: th + Math.PI / 2 };
      lightC.push(coilyCluster(p, R, shape));
      const side = hash01(seed, g + 340) > 0.5 ? 1 : -1;
      lightC.push(coilyCluster(add(p, scale(tan, side * R * 1.15)), R * 0.5, { ...shape, seed: shape.seed + 3, lobes: 4, squash: 0.8 }));
      if (d === 2) bright.push(coilyCluster(P(p[0] - R * 0.15, p[1] - R * 0.25), R * 0.42, { ...shape, seed: shape.seed + 7 }));
    }
    const darks = d === 2 ? 4 : 2;
    for (let k = 0; k < darks; k++) {
      const th = rnd(seed, k + 400, -0.9, 1.2) + (k % 2 ? 0 : Math.PI * 1.75);
      const rr = rnd(seed, k + 410, 0.35, 0.75);
      shadeC.push(coilyCluster(P(cx + Math.cos(th) * rx * rr, cy + Math.sin(th) * ry * rr), rnd(seed, k + 420, o.cluster.r[0], o.cluster.r[1]) * 1.3, { seed: seed + k + 430, lobes: 4, squash: 0.7, rot: th }));
    }
  }
  // Sparse curl indications at close-up size only.
  const curlsLit: string[] = [];
  const curlsDark: string[] = [];
  if (d === 2) {
    const cand = scatter(region, 9, seed + 17);
    for (let k = 0, n = 0; k < cand.length && n < o.curls; k++) {
      if (hash01(seed, k + 800) > 0.3) continue;
      const p = cand[k];
      const litSide = p[0] < cx - rx * 0.1 && p[1] < cy;
      (litSide ? curlsLit : curlsDark).push(curlMark(p, rnd(seed, k + 900, o.curlR[0], o.curlR[1]), { seed: seed + k, rot: hash01(seed, k + 950) * 6.28, w: 0.75 }));
      n++;
    }
  }

  // Sideburns: thin tapered pieces below the mass, on the skin.
  const burns = full && !mane
    ? ([1, -1] as const).map((s) => {
        const yE = f.ear.top;
        const b = last(s > 0 ? hl.templeR : hl.templeL);
        return taperedLock([P(CX + s * (head.half(yE - 4, s) - 2.5), yE - 4), P(CX + s * (head.half(b[1] - 6, s) - 2.5), lerp(yE, b[1] - 4, 0.5)), P(CX + s * (head.half(b[1] - 4, s) - 2), b[1] - 4)], { w: 4, root: 1, peak: 0.2, tip: 0.3, seed: seed + (s > 0 ? 1 : 2) });
      })
    : [];
  const fade = full
    ? null
    : ([1, -1] as const).map((s) => (
        <g key={s}>
          {fadeRegion(`${uid}cf${s > 0 ? "r" : "l"}`, ring(sideRegion(s > 0 ? hl.templeR : hl.templeL, s, yS - 10)), mixHex(color, skin.deep, 0.2), d, {
            y0: yS - 10,
            y1: last(hl.templeR)[1],
            o0: 0.85,
            mid: [0.35, 0.42],
            o1: 0.02,
          })}
        </g>
      ));
  // The rest of a mane: behind the head and neck, darker, its own light low on the lit side.
  const back = cloud
    ? (() => {
        const ys = cloud.map((p) => p[1]);
        const yB = Math.max(...ys);
        const cId = `${uid}hm`;
        const loopD = ring(cloud);
        const lows: string[] = [];
        if (d > 0)
          for (let k = 0; k < (d === 2 ? 3 : 2); k++) {
            const s = k === 2 ? 1 : -1;
            lows.push(coilyCluster(P(CX + s * rx * rnd(seed, k + 600, 0.62, 0.8), lerp(yS, yB, rnd(seed, k + 610, 0.2, 0.5))), rnd(seed, k + 620, o.cluster.r[0], o.cluster.r[1]) * 1.6, { seed: seed + k + 630, lobes: 5, squash: 0.7 }));
          }
        return (
          <g>
            <ShapeDefs id={cId} d={loopD} />
            {/* Close in value to the front mass, so the cloud reads as one mass of the same hair colour. */}
            <use href={`#${cId}s`} fill={mixHex(T.shade, T.deep, 0.2)} />
            <g clipPath={`url(#${cId})`}>
              {lows.length > 0 && <path d={lows.join("")} fill={mixHex(T.base, T.shade, 0.25)} opacity={0.9} />}
            </g>
            <path d={silhouetteInk(cloud.slice(0, cut[0] + 2), d, seed + 7, [[0.12, 1]], 1.9)} fill={INK} />
            <path d={silhouetteInk(cloud.slice(cut[1] - 1), d, seed + 8, [[0, 0.88]], 1.9)} fill={INK} />
          </g>
        );
      })()
    : undefined;
  return {
    back,
    extent: extentOf(outer),
    ears: mane ? "covered" : full ? "partial" : "visible",
    onSkin: (
      <g>
        {fade}
        {burns.length > 0 && <path d={burns.join("")} fill={mixHex(color, skin.deep, 0.2)} opacity={0.6} />}
        {/* The mass shades the upper forehead and, on full sides, the temples. */}
        <path d={castBelow(faceEdge, 1.4, 3, f.top)} fill={skin.shade} opacity={0.75} />
      </g>
    ),
    mid: (
      <g>
        <ShapeDefs id={clip} d={regionD} />
        <use href={`#${clip}s`} fill={mixHex(T.shade, T.deep, 0.3)} />
        <g clipPath={`url(#${clip})`}>
          <path d={litBody} fill={T.base} />
          {d > 0 && <path d={litMass} fill={mixHex(T.base, T.light, 0.22)} />}
          <path d={underside} fill={T.deep} opacity={0.55} />
          {shadeC.length > 0 && <path d={shadeC.join("")} fill={T.shade} opacity={0.9} />}
          {lightC.length > 0 && <path d={lightC.join("")} fill={mixHex(T.base, T.light, 0.55)} opacity={0.9} />}
          {bright.length > 0 && <path d={bright.join("")} fill={T.light} opacity={0.75} />}
          {curlsDark.length > 0 && <path d={curlsDark.join("")} fill={T.deep} opacity={0.55} />}
          {curlsLit.length > 0 && <path d={curlsLit.join("")} fill={T.light} opacity={0.6} />}
        </g>
        <path d={silhouetteInk(outer, d, seed + 5, [[0, 0.22], [0.28, 1]], 1.9)} fill={INK} />
        {d === 2 && full && <path d={strokeLine(front, { w: 0.8, start: 0.5, end: 0.5, seed: seed + 6, wobble: 0.3 })} fill={T.line} opacity={0.6} />}
      </g>
    ),
  };
}
