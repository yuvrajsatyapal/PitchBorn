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
  offset,
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
  /** One lock lying across its neighbours: from and to (0 left .. 1 right), width, length. */
  cross?: { from: number; to: number; w: number; len: number };
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

  // Locks hang from the edge; their roots sit inside the mass so the two read as one. Their ends curve on or hook
  // back up instead of stopping in a point.
  const lockFrom = (p: Pt, len: number, lean: number, bendX: number, k: number, rootDy = -8) => {
    const root = P(p[0] - lean * 0.3, p[1] + rootDy);
    const tip = P(p[0] + lean, p[1] + len);
    const mid = P(lerp(root[0], tip[0], 0.5) + bendX, lerp(root[1], tip[1], 0.55));
    // Most tips carry on curving the way the lock leans; some turn back a little. Never a loop.
    const hook = (hash01(seed, k + 90) < 0.65 ? 1 : -0.5) * rnd(seed, k + 91, 0.8, 2.2) * Math.sign(lean || -1);
    return [root, mid, tip, P(tip[0] + hook, tip[1] - Math.abs(hook) * 0.25)] as Pt[];
  };
  const locks = o.locks.map((l, k) => {
    const p = at(clamp(l.u + v(k + 20, 0.02), 0.03, 0.97));
    return { path: lockFrom(p, l.len * (1 + v(k + 30, 0.15)), l.lean + v(k + 40, 1.2), l.bend ?? 0, k), w: l.w * (1 + v(k + 50, 0.12)), k, u: l.u, round: hash01(seed, k + 92) < 0.5 };
  });
  const lockD = locks.map((l) => taperedLock(l.path, { w: l.w, root: 1, peak: 0.3, tip: 0.32, round: l.round, seed: seed + l.k, wobble: 0.06 }));
  // One lock lies across its neighbours.
  const cross = o.cross
    ? (() => {
        const a = at(o.cross.from + v(95, 0.03));
        const b = at(o.cross.to + v(96, 0.03));
        const path = lockFrom(P(b[0], b[1]), o.cross.len, 0, 0, 97, 0).map((p, k2) => (k2 === 0 ? P(a[0], a[1] - 4) : p));
        return { path, w: o.cross.w };
      })()
    : null;

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
  return {
    onSkin: (
      <g>
        {sideFill(1)}
        {sideFill(-1)}
        {/* The fringe and its locks drop a shadow on the forehead, offset down and right. */}
        <g fill={skin.shade}>
          <path d={castBelow(base, 1.5, 3.6, f.top)} opacity={0.85} />
          {/* The locks' own shadows are softer and closer: they must not read as a second set of locks. */}
          <path d={[...locks.map((l) => taperedLock(offset(l.path, 1, 2.4), { w: l.w, root: 1, peak: 0.3, tip: 0.32, round: l.round, seed: seed + l.k })), cross ? taperedLock(offset(cross.path, 1, 2.4), { w: cross.w, root: 0.6, peak: 0.35, tip: 0.3, round: true, seed }) : ""].join("")} opacity={0.4} />
        </g>
      </g>
    ),
    front: (
      <g>
        <ClipDefs id={clip} shapes={[regionD, ...lockD]} />
        <ClipDefs id={`${clip}m`} shapes={[regionD]} />
        {/* No outlines inside the hair: the mass and its locks are one fill, told apart by value. */}
        {/* Separate fills: merged into one path, opposite windings would cut holes where they overlap. */}
        <path d={regionD} fill={T.base} />
        <path d={lockD.join("")} fill={T.base} />
        <g clipPath={`url(#${clip})`}>
          {d > 0 && <path d={litMass} fill={mixHex(T.base, T.light, 0.25)} />}
          <path d={shadeR} fill={T.shade} />
          <path d={under} fill={T.shade} opacity={0.75} />
          {d > 0 && <path d={lockShade.join("")} fill={T.shade} opacity={0.6} />}
          {seps.length > 0 && <path d={seps.join("")} fill={T.deep} />}
        </g>
        {/* Light sits on the top mass where the hair turns down, not on the hanging locks. */}
        <g clipPath={`url(#${clip}m)`}>
          {lights.length > 0 && <path d={lights.join("")} fill={T.light} opacity={0.8} />}
          {dim.length > 0 && <path d={dim.join("")} fill={mixHex(T.base, T.light, 0.45)} opacity={0.55} />}
        </g>
        {/* The outer silhouette is the only heavy line; it breaks once where the light is strongest. */}
        <path d={silhouetteInk(outer, d, seed + 5, [[0, 0.3], [0.36, 1]])} fill={INK} />
        {cross && (
          <g>
            {d > 0 && <path d={taperedLock(offset(cross.path, 1.2, 1.4), { w: cross.w, root: 0.6, peak: 0.35, tip: 0.3, round: true, seed })} fill={T.deep} opacity={0.45} />}
            <path d={taperedLock(cross.path, { w: cross.w, root: 0.6, peak: 0.35, tip: 0.3, round: true, seed })} fill={T.base} />
            {d > 0 && <path d={taperedLock(offset(cross.path, cross.w * 0.2, 0), { w: cross.w * 0.5, root: 0.6, peak: 0.35, tip: 0.3, round: true, seed })} fill={T.shade} opacity={0.6} />}
            {d > 0 && <path d={hairStroke(offset(cross.path, -cross.w * 0.15, -0.5), { from: 0.1, to: 0.45, w: 1.8, seed })} fill={T.light} opacity={0.7} />}
          </g>
        )}
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
  const outline = [...lower, ...upper.slice(1)];
  // A fuzzy edge where density thins, and a soft halo of sparser hair around it.
  const patch = roughen(outline, 0.8, seed, 1.1);
  const halo = roughen(outline.map((p) => P(CX + (p[0] - CX) * 1.06, p[1] + (p[1] < hl.y - 2 ? -1.8 : 0.6))), 1, seed + 1, 1.3);
  const patchD = ring(patch);
  const clip = `${uid}cr`;
  // Growth direction: short marks running forward from the crown, a few dark, a few light.
  const marks: string[] = [];
  const lights: string[] = [];
  if (d > 0) {
    const n = d === 2 ? 12 : 6;
    for (let k = 0; k < n; k++) {
      const u = (k + rnd(seed, k + 40, 0.1, 0.9)) / n;
      const x = lerp(L[0] + 4, R[0] - 4, u);
      const top = lerp(peak + 6, hl.y - 8, Math.abs(u - 0.5) * 1.6);
      const y = lerp(top, hl.y - 2, rnd(seed, k + 50, 0.2, 0.8));
      const len = rnd(seed, k + 60, 2.5, 4.5);
      const lean = (x - CX) * 0.05;
      (k % 3 === 0 && x < CX + 6 ? lights : marks).push(hairStroke([P(x - lean, y - len), P(x, y), P(x + lean * 0.6, y + len * 0.6)], { from: 0, to: 1, w: 0.9, seed: seed + k, start: 0.3, end: 0.1 }));
    }
  }
  return {
    onSkin: shaved.onSkin,
    front: (
      <g>
        <ClipDefs id={clip} shapes={[patchD]} />
        {d > 0 && <path d={ring(halo)} fill={T.base} opacity={0.35} />}
        <path d={patchD} fill={T.base} opacity={0.9} />
        <g clipPath={`url(#${clip})`}>
          <path d={ring([P(CX + 4, peak - 4), P(CX + w + 4, hl.y - 16), P(CX + w + 4, hl.y + 8), P(CX + 10, hl.y + 8)])} fill={T.shade} opacity={0.7} />
          {d > 0 && <path d={organicMass([P(CX - w * 0.7, hl.y - 4), P(CX - w * 0.4, hl.y - 13), P(CX - 6, peak + 3), P(CX - w * 0.3, hl.y - 6)], { seed, rough: 0.8 })} fill={mixHex(T.base, T.light, 0.3)} />}
          {/* Denser just behind the hairline. */}
          <path d={strokeLine(lower.map((p) => P(p[0], p[1] - 1.5)), { w: 2.6, start: 0.3, end: 0.3, seed: seed + 2 })} fill={T.deep} opacity={0.4} />
          {marks.length > 0 && <path d={marks.join("")} fill={T.deep} opacity={0.45} />}
          {lights.length > 0 && <path d={lights.join("")} fill={T.light} opacity={0.5} />}
        </g>
      </g>
    ),
  };
}
