/** Short hair: shaved scalps, the forward textured crop (also the top of a mullet) and the shaved crescent. */
import { CX, along, clamp, hash01, lerp, type Pt } from "../../portrait/geometry";
import { noise1, resample, ring, roughen, strokeLine } from "../ink";
import { INK, hairTones, mixHex } from "../palette";
import {
  ClipDefs,
  P,
  bumped,
  castBelow,
  fadeRegion,
  hairStroke,
  hairline,
  last,
  lobe,
  organicMass,
  rnd,
  scalpRegion,
  shell,
  sideRegion,
  silhouetteInk,
  taperedLock,
  tuft,
  type Bump,
  type HairArt,
  type HairInput,
  type HairlineKind,
} from "./core";

/** Hair shaved to the scalp: tone only, densest on top, softer at the hairline. The head shape stays the star. */
export function shavedHair(i: HairInput, kind: HairlineKind = "straight", density = 0.32): HairArt {
  const { f, head, color, skin, uid, d, recede, seed } = i;
  const hl = hairline(f, head, kind, recede, seed);
  const tone = mixHex(color, skin.deep, 0.25);
  return { onSkin: fadeRegion(`${uid}sv`, ring(scalpRegion(hl, f)), tone, d, { y0: f.top, y1: hl.y + 6, o0: density * 1.1, o1: density * 0.75 }) };
}

export interface CropDesign {
  kind: HairlineKind;
  top: number;
  side: number;
  sides: "taper" | "fade";
  /** How far the fringe sits below the hairline. */
  drop: number;
  /** Fringe locks: position across the forehead (0 left .. 1 right), width, length, sideways lean, bend. */
  locks: readonly { u: number; w: number; len: number; lean: number; bend?: number }[];
  /** Places where the fringe edge lifts and shows a little forehead. */
  lifts?: readonly { u: number; w: number; a: number }[];
  /** Broad volume changes on top, then a few tufts breaking the silhouette. */
  volume?: readonly Bump[];
  tufts: readonly Bump[];
}

/**
 * Short hair worn forward. The top is one mass shaped by the skull; the fringe is a gently curving edge with a few
 * locks of different size, length and lean hanging from it (one large, some small), and gaps where the edge lifts.
 * Separations run back towards the crown; light sits in short groups on the upper left where the hair turns down.
 */
export function cropHair(i: HairInput, o: CropDesign): HairArt {
  const { f, head, color, skin, uid, d, recede, seed } = i;
  const T = hairTones(color);
  const hl = hairline(f, head, o.kind, recede, seed);
  const v = (k: number, span: number) => (hash01(seed + 29, k) - 0.5) * 2 * span;
  const cornerL = hl.front[0];
  const cornerR = last(hl.front);
  const yS = Math.max(cornerR[1], cornerL[1]) + 11;
  let outer = shell(f, head, yS, o.side, o.top, o.side + 0.5);
  outer = bumped(outer, o.volume ?? [{ u: 0.42, w: 0.3, a: 2.5 }], lobe);
  outer = bumped(
    outer,
    o.tufts.map((t, k) => ({ ...t, u: t.u + v(k, 0.012), a: t.a * (1 + v(k + 10, 0.25)) })),
    tuft,
  );

  // Fringe edge: right corner -> left, below the hairline, lifting in places to show forehead.
  const n = hl.front.length - 1;
  const lifted = hl.front.map((p, k) => {
    const u = k / n;
    let lift = 0;
    for (const l of o.lifts ?? []) lift = Math.max(lift, l.a * lobe((u - l.u) / l.w));
    return k === 0 || k === n ? p : P(p[0], p[1] + o.drop - lift + noise1(seed, k * 0.4) * 0.8);
  });
  const base = resample(along(lifted.filter((_, k) => k % 3 === 0 || k === n), 6, 0.5), 1.5).reverse();
  const at = (u: number) => base[clamp(Math.round((1 - u) * (base.length - 1)), 0, base.length - 1)];

  // Locks hang from the edge; their roots sit inside the mass so the two read as one.
  const locks = o.locks.map((l, k) => {
    const p = at(clamp(l.u + v(k + 20, 0.02), 0.03, 0.97));
    const len = l.len * (1 + v(k + 30, 0.15));
    const lean = l.lean + v(k + 40, 1.2);
    const root = P(p[0] - lean * 0.3, p[1] - 8);
    const tip = P(p[0] + lean, p[1] + len);
    const mid = P(lerp(root[0], tip[0], 0.5) + (l.bend ?? 0), lerp(root[1], tip[1], 0.55));
    return { path: [root, mid, tip] as Pt[], w: l.w * (1 + v(k + 50, 0.12)), k, u: l.u };
  });
  const lockD = locks.map((l) => taperedLock(l.path, { w: l.w, root: 1, peak: 0.3, tip: 0.24, seed: seed + l.k, wobble: 0.06 }));

  const sideFront = (s: 1 | -1, end: Pt, corner: Pt) => along([end, P(lerp(end[0], corner[0], 0.45) - s, lerp(end[1], corner[1], 0.6)), corner], 4, 0.5);
  const sR = sideFront(1, last(outer), cornerR);
  const sL = sideFront(-1, outer[0], cornerL);
  const region = [...outer, ...sR.slice(1), ...base.slice(1), ...sL.slice().reverse().slice(1)];
  const regionD = ring(region);
  const clip = `${uid}hc`;

  // Flow: from the fringe back towards the crown, fanning out.
  const crown = P(CX + 6 + v(60, 4), f.top - o.top * 0.5);
  const flow = (from: Pt, k: number, reach = 1): Pt[] => {
    const spread = (from[0] - CX) * 0.45;
    const end = P(crown[0] + spread * 0.7 + v(k + 9, 3), crown[1] + 6);
    return [from, P(lerp(from[0], end[0], 0.45) + v(k, 1.5) - 1.5, lerp(from[1], end[1], 0.5)), P(lerp(from[0], end[0], reach), lerp(from[1], end[1], reach))];
  };
  // Separations: only between some locks, running back into the mass and fading at different lengths.
  const sorted = locks.slice().sort((a, b) => a.u - b.u);
  const seps: string[] = [];
  for (let k = 0; k < sorted.length - 1; k++) {
    if (hash01(seed, k + 70) < 0.35 || (d === 0 && k % 2)) continue;
    const p = at((sorted[k].u + sorted[k + 1].u) / 2);
    seps.push(hairStroke(flow(P(p[0], p[1] - 2), k + 50), { from: 0, to: 0.35 + hash01(seed, k + 30) * 0.4, w: d === 0 ? 2.2 : d === 1 ? 1.6 : 1.3, seed: seed + k, start: 0.9, end: 0.05, peak: 0.12 }));
  }
  // Light: short groups on the upper left, following the flow where the hair bends down towards the face.
  const lights: string[] = [];
  const dim: string[] = [];
  if (d > 0) {
    [0.16, 0.33, 0.5, 0.72].forEach((u0, g) => {
      const p = at(u0 + v(g + 80, 0.03));
      const path = flow(P(p[0], p[1] - 3), g + 90);
      const lit = p[0] < CX + 12;
      const a0 = 0.18 + hash01(seed, g + 40) * 0.1;
      const a1 = a0 + 0.2 + hash01(seed, g + 41) * 0.15;
      (lit ? lights : dim).push(hairStroke(path, { from: a0, to: a1, w: d === 2 ? 2.4 : 2.8, seed: seed + g }));
      if (lit && d === 2) {
        lights.push(hairStroke(path.map((q) => P(q[0] - 2.8, q[1] + 1)), { from: a0 + 0.05, to: a0 + (a1 - a0) * 0.6, w: 1.4, seed: seed + g + 5 }));
        if (g % 2 === 0) lights.push(hairStroke(path.map((q) => P(q[0] + 2.4, q[1])), { from: a0 + 0.08, to: a0 + (a1 - a0) * 0.45, w: 1.1, seed: seed + g + 7 }));
      }
    });
  }
  // Shadow masses: the right of the head (its edge follows a clump, so it reads as hair turning away), and the band
  // where the hair curls down off the forehead. Each lock darkens on its shadow side.
  const edgeP = at(0.74);
  const edge = along(flow(P(edgeP[0], edgeP[1] + 2), 77, 1.25), 6).map((p, k) => P(p[0] + noise1(seed + 4, k * 0.6) * 1.8, p[1]));
  const shadeR = ring([...edge, P(CX + 130, crown[1] - 30), P(CX + 130, yS + 20), P(edge[0][0], yS + 20)]);
  const under = ring([...base, ...base.slice().reverse().map((p, k) => P(p[0] + 0.5, p[1] - 4 - 2.2 * Math.sin(k * 0.37 + seed) ** 2))]);
  const lockShade = locks.map((l) => taperedLock(l.path.map((p) => P(p[0] + l.w * 0.22, p[1])), { w: l.w * 0.5, root: 1, peak: 0.3, tip: 0.1, seed: seed + l.k }));
  const litMass = organicMass([P(CX - f.templeW * 0.72, hl.y - 1), P(CX - f.templeW * 0.6, f.top - 1), P(CX - 18, f.top - o.top * 0.75), P(CX + 6, f.top - o.top * 0.45), P(CX - 8, f.top + 12), P(CX - 32, hl.y - 6)], { seed: seed + 3, rough: 1.6 });

  // Sides below the mass: tone on the skin, tapering (or fading out) down to the sideburn.
  const sideTone = mixHex(color, skin.deep, 0.2);
  const yTop = yS - 8;
  const yBot = last(hl.templeR)[1];
  const sideFill = (s: 1 | -1) =>
    fadeRegion(`${uid}sd${s > 0 ? "r" : "l"}`, ring(sideRegion(s > 0 ? hl.templeR : hl.templeL, s, yTop)), sideTone, d, {
      y0: yTop,
      y1: yBot,
      o0: o.sides === "fade" ? 0.5 : 0.55,
      o1: o.sides === "fade" ? 0.04 : 0.28,
    });
  const k = d === 0 ? 1.4 : 1;
  return {
    onSkin: (
      <g>
        {sideFill(1)}
        {sideFill(-1)}
        {/* The fringe and its locks drop a shadow on the forehead, offset down and right. */}
        <g fill={skin.shade} opacity={0.85}>
          <path d={castBelow(base, 1.5, 3.6, f.top)} />
          {locks.map((l) => (
            <path key={l.k} d={taperedLock(l.path.map((p) => P(p[0] + 1.5, p[1] + 3.6)), { w: l.w, root: 1, peak: 0.3, tip: 0.24, seed: seed + l.k })} />
          ))}
        </g>
      </g>
    ),
    front: (
      <g>
        <ClipDefs id={clip} shapes={[regionD, ...lockD]} />
        {/* Thin edge under the fringe and around the locks; the mass covers it where the locks join. */}
        {d > 0 && <path d={strokeLine(base, { w: 1, start: 0.4, end: 0.4, peak: 0.5, seed: seed + 8, wobble: 0.25 })} fill={T.line} />}
        <g fill={T.base} stroke={d > 0 ? T.line : undefined} strokeWidth={0.8} strokeLinejoin="round">
          {lockD.map((dd, n2) => (
            <path key={n2} d={dd} />
          ))}
        </g>
        <path d={regionD} fill={T.base} />
        <g clipPath={`url(#${clip})`}>
          {d > 0 && <path d={litMass} fill={mixHex(T.base, T.light, 0.25)} />}
          <path d={shadeR} fill={T.shade} />
          <path d={under} fill={T.shade} opacity={0.75} />
          {d > 0 && <path d={lockShade.join("")} fill={T.shade} opacity={0.6} />}
          {seps.length > 0 && <path d={seps.join("")} fill={T.deep} />}
          {lights.length > 0 && <path d={lights.join("")} fill={T.light} opacity={0.8} />}
          {dim.length > 0 && <path d={dim.join("")} fill={mixHex(T.base, T.light, 0.45)} opacity={0.55} />}
        </g>
        {/* The outer silhouette is the only heavy line; it breaks once where the light is strongest. */}
        <path d={silhouetteInk(outer, d, seed + 5, [[0, 0.3], [0.36, 1]])} fill={INK} />
        {d > 0 && <path d={strokeLine(sR, { w: 1.1 * k, start: 0.9, end: 0.2, seed: seed + 6 })} fill={T.line} />}
        {d > 0 && <path d={strokeLine(sL, { w: 0.9 * k, start: 0.9, end: 0.2, seed: seed + 7 })} fill={T.line} />}
      </g>
    ),
  };
}

/**
 * The shaved crescent: a scalp in tone with one half-moon of short, dense hair at the front, flat along the hairline
 * and arched on top. No outline: value alone separates it from the scalp.
 */
export function crescentHair(i: HairInput): HairArt {
  const { f, head, color, uid, d, recede, seed } = i;
  const T = hairTones(color);
  const hl = hairline(f, head, "straight", recede, seed);
  const shaved = shavedHair(i, "straight", 0.36);
  const w = f.templeW * (0.6 + (hash01(seed, 31) - 0.5) * 0.06);
  // Flat along the hairline (a touch below it), arched high over the front of the head: a half-moon.
  const lower = hl.front.filter((p) => Math.abs(p[0] - CX) <= w).map((p) => P(p[0], p[1] + 1.5));
  const L = lower[0];
  const R = last(lower);
  const peak = hl.y - 30 - rnd(seed, 32, 0, 3);
  const upper = along([R, P(CX + w * 0.78, hl.y - 18), P(CX + w * 0.32, peak + 2), P(CX - w * 0.28, peak + 2.5), P(CX - w * 0.74, hl.y - 19), L], 6);
  const patch = roughen([...lower, ...upper.slice(1)], 0.5, seed, 0.6);
  const patchD = ring(patch);
  const clip = `${uid}cr`;
  return {
    onSkin: shaved.onSkin,
    front: (
      <g>
        <ClipDefs id={clip} shapes={[patchD]} />
        <path d={patchD} fill={T.base} opacity={0.94} />
        <g clipPath={`url(#${clip})`}>
          <path d={ring([P(CX + 4, peak - 4), P(CX + w + 4, hl.y - 16), P(CX + w + 4, hl.y + 8), P(CX + 10, hl.y + 8)])} fill={T.shade} opacity={0.8} />
          {d > 0 && <path d={organicMass([P(CX - w * 0.7, hl.y - 4), P(CX - w * 0.4, hl.y - 13), P(CX - 6, peak + 3), P(CX - w * 0.3, hl.y - 6)], { seed, rough: 0.8 })} fill={mixHex(T.base, T.light, 0.35)} />}
          <path d={strokeLine(lower.map((p) => P(p[0], p[1] - 1.2)), { w: 2.4, start: 0.3, end: 0.3, seed: seed + 2 })} fill={T.deep} opacity={0.5} />
        </g>
        {d > 0 && <path d={strokeLine(upper, { w: 0.8, start: 0.2, end: 0.2, seed: seed + 3 })} fill={T.line} opacity={0.55} />}
      </g>
    ),
  };
}
