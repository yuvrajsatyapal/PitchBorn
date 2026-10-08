/**
 * Dutch Dreads: a big crown mass and about fourteen thick locks growing out of it. Built in the order the hair
 * grows: crown mass -> root clumps -> overlapping locks -> flowing midsections -> tapered ends.
 *
 * Every lock has its root inside the crown mass (or behind the head, for the rear locks) and is drawn so that the
 * crown covers its root: it leaves the mass at a root clump, never starts on the skin. Most locks sit under the
 * crown; a few are drawn over it, fading in from inside the mass. Locks differ in width, length, curvature, flat
 * sections and ends; surface marks are irregular twists, not evenly spaced bands. Locks are separated by value (a
 * contact shadow where one lies on another), never by an outline.
 */
import type { ReactNode } from "react";
import { CX, along, hash01, lerp, sub, unit, type Pt } from "../../portrait/geometry";
import { resample, ring, roughen, strokeLine } from "../ink";
import { INK, hairTones, mixHex } from "../palette";
import {
  ClipDefs,
  P,
  bend,
  coilyCluster,
  extentOf,
  hairStroke,
  hairline,
  last,
  lobedEdge,
  lockOutline,
  offset,
  rnd,
  shell,
  silhouetteInk,
  type HairArt,
  type HairInput,
  type Hairline,
} from "./core";

/** Number of locks and their size; everything else comes from the face. */
const DESIGN = { end: 318, fringe: 2, side: 3, back: 2, w: [18, 25] as const, cap: { top: 24, side: 14 }, spread: 36, forward: 1 };

export interface DutchLock {
  k: number;
  /** Control points, root first. The root is inside the crown mass (or behind the head). */
  pts: Pt[];
  w: number;
  tone: number;
  tip: number;
  flat?: { u: number; k: number };
  end: "blunt" | "taper" | "split";
  /** On the side the light comes from. */
  lit: boolean;
  /** Where the lock sits: behind the head, under the crown mass, or over it (fading in from inside it). */
  layer: "back" | "under" | "over";
}

export interface DutchPlan {
  hl: Hairline;
  capY: number;
  /** The dome the locks grow from (left side end over the top to the right side end) and the whole crown mass. */
  outer: Pt[];
  cap: Pt[];
  locks: DutchLock[];
}

/** Where every lock goes. Pure geometry: the drawing and the tests both read this. */
export function dutchPlan(i: HairInput): DutchPlan {
  const { f, head, recede, seed } = i;
  const o = DESIGN;
  const hl = hairline(f, head, "irregular", recede, seed);
  let slot = 0;
  const r = (lo: number, hi: number) => rnd(seed, 500 + slot++, lo, hi);
  const cornerL = hl.front[0];
  const cornerR = last(hl.front);
  const capY = Math.max(cornerL[1], cornerR[1]) + 14;
  const outer = lobedEdge(shell(f, head, capY, o.cap.side, o.cap.top, o.cap.side + 0.5), { seed: seed + 3, spacing: [12, 20], amp: [1.6, 3.6] });
  const capHalf = extentOf(outer);
  const sideFront = (end: Pt, corner: Pt) => along([end, P(lerp(end[0], corner[0], 0.5), lerp(end[1], corner[1], 0.6)), corner], 4, 0.5);
  const cap = [...outer, ...sideFront(last(outer), cornerR).slice(1), ...hl.front.slice().reverse().slice(1), ...sideFront(outer[0], cornerL).slice().reverse().slice(1)];

  let k = 0;
  const make = (pts: Pt[], layer: DutchLock["layer"], lit: boolean, w?: number): DutchLock => {
    const e = hash01(seed, k + 90);
    const end: DutchLock["end"] = e < 0.5 ? "blunt" : e < 0.82 ? "taper" : "split";
    const lock: DutchLock = {
      k,
      pts: bend(pts, seed + k * 7, 2.4),
      w: (w ?? r(o.w[0], o.w[1])) * r(0.85, 1.14),
      tone: hash01(seed, k + 50),
      tip: end === "taper" ? r(0.28, 0.42) : r(0.62, 0.85),
      flat: hash01(seed, k + 70) < 0.65 ? { u: r(0.25, 0.8), k: r(0.12, 0.34) } : undefined,
      end,
      lit,
      layer,
    };
    k++;
    return lock;
  };

  const extra: 1 | -1 = hash01(seed, 1) < 0.5 ? -1 : 1;
  const locks: DutchLock[] = [];
  for (const s of [-1, 1] as const) {
    // Behind the head: rooted far back, appearing from behind the skull and falling behind the shoulders.
    for (let j = 0; j < o.back; j++) {
      const yR = lerp(f.top + 6, hl.y, (j + r(0, 0.6)) / o.back);
      const root = P(CX + s * head.half(yR, s) * r(0.55, 0.85), yR);
      const out = r(16, 26) + j * 6 + o.spread * 1.2;
      locks.push(make([root, P(CX + s * (head.half(yR, s) + r(6, 12)), yR + r(10, 18)), P(CX + s * (head.half(f.eyeY, s) + out), f.eyeY + r(0, 18)), P(CX + s * (head.half(f.eyeY, s) + out + r(0, 10)), o.end + r(-8, 14))], "back", s < 0));
    }
    // Beside the face: each rooted high inside the crown at its own height and angle, leaving the mass at its lower
    // edge. Higher roots fall further out, so the locks fan from one root area instead of hanging in parallel.
    const n = o.side + (s === extra ? 1 : 0);
    for (let j = 0; j < n; j++) {
      const t = Math.min(1, Math.max(0, (j + r(-0.25, 0.25)) / Math.max(1, n - 1)));
      const yR = lerp(hl.y + 2, capY - 10, t);
      let root = P(CX + s * capHalf(yR, s) * r(0.6, 0.76), yR);
      // The lower edge of the crown slopes up towards the face: a root that would sit outside it moves up into it.
      for (let g = 0; g < 12 && !insideShape(cap, root); g++) root = P(root[0], root[1] - 3);
      const out = (n - 1 - j) * 8 + r(1, 6) + o.spread * (0.5 + 0.5 * ((n - 1 - j) / Math.max(1, n - 1)));
      const p2 = P(CX + s * (head.half(f.eyeY, s) + out), f.eyeY + r(-6, 8));
      const tipY = o.end - (hash01(seed, k + 55) < 0.25 ? r(30, 62) : r(0, 24));
      const tip = P(p2[0] + s * r(-5, 10) + s * o.spread * 0.25, tipY);
      // Higher roots leave the mass flatter and further out, lower ones more steeply: the locks fan.
      const a = lerp(0.3, 1.05, t) + r(-0.12, 0.12);
      const reach = lerp(28, 13, t) + r(-3, 3);
      const p1 = P(root[0] + s * Math.cos(a) * reach, root[1] + Math.sin(a) * reach);
      const lock = make([root, p1, P(lerp(p1[0], p2[0], 0.55), lerp(p1[1], p2[1], 0.5)), p2, P(lerp(p2[0], tip[0], 0.5) + s * r(-4, 4), lerp(p2[1], tipY, 0.5)), tip], "under", s < 0);
      locks.push(lock);
    }
    // In front of a shoulder: from the temple, close past the jaw, onto the chest.
    for (let j = 0; j < o.forward && s === extra; j++) {
      // Rooted high in the crown and carried inside it before it leaves, so it has room to fade in.
      const yR = lerp(f.top, hl.y, 0.5);
      const root = P(CX + s * (capHalf(yR, s) * r(0.5, 0.62)), yR);
      const inner = P(CX + s * (capHalf(capY - 16, s) * 0.9), capY - 16);
      const exit = P(CX + s * (head.half(f.eyeY, s) + 2), f.eyeY - 14);
      const pJ = P(CX + s * (head.half(f.mouthY, s) + r(4, 9)), f.mouthY);
      const tip = P(CX + s * (f.neckW + r(14, 24)), o.end + r(2, 12));
      locks.push(make([root, inner, exit, pJ, P(lerp(pJ[0], tip[0], 0.5), lerp(pJ[1], tip[1], 0.5)), tip], "over", s < 0));
    }
  }
  // Over the forehead: one longer lock sweeping to one side, one shorter pushed the other way. Both leave the
  // crown well above the hairline (their root is inside the mass) and fall forward.
  const sweep: 1 | -1 = hash01(seed, 2) < 0.5 ? -1 : 1;
  for (let j = 0; j < o.fringe; j++) {
    const u = (j === 0 ? 0.4 : 0.66) + r(-0.06, 0.06);
    const p = hl.front[Math.round((sweep < 0 ? u : 1 - u) * (hl.front.length - 1))];
    const dir = j === 0 ? sweep : -sweep;
    const root = P(p[0] - dir * 2, p[1] - 22);
    const tip = j === 0 ? P(p[0] + dir * r(14, 20), f.browY - 20 - r(0, 6)) : P(p[0] + dir * r(8, 13), hl.y + r(16, 22));
    const mid = P(lerp(root[0], tip[0], 0.5) + dir * 2, lerp(root[1], tip[1], 0.62));
    locks.push(make([root, P(root[0] + dir * 2, p[1] - 6), P(lerp(root[0], mid[0], 0.5) + dir * 2, p[1] + 6), mid, tip], j === 1 ? "over" : "under", root[0] < CX + 8, 15));
  }
  return { hl, capY, outer, cap, locks };
}

export function dutchHair(i: HairInput): HairArt {
  const { f, color, skin, uid, d, seed, tip } = i;
  const T = hairTones(color, skin.base);
  const TT = tip ? hairTones(tip) : null;
  const plan = dutchPlan(i);
  const { hl, outer, cap, locks } = plan;
  const capHalf = extentOf(outer);
  const capD = ring(cap);

  const tones = [T.base, mixHex(T.base, T.shade, 0.4), mixHex(T.base, T.light, 0.2)];
  const outline = (l: DutchLock, dx = 0) => {
    const shape = lockOutline(offset(l.pts, dx, 0), { w: dx ? l.w * 0.5 : l.w, root: 0.8, peak: 0.2, tip: l.tip, round: true, wobble: 0.12, swell: 0.42, flat: l.flat, seed: seed + l.k });
    // Thick locks are matte and a little fuzzy at the edge, never a clean tube.
    return dx ? shape : roughen(shape, 0.7, seed + l.k + 300, 0.55);
  };
  const shapes = new Map(locks.map((l) => [l.k, outline(l)]));
  const shapeOf = (l: DutchLock) => shapes.get(l.k) ?? outline(l);

  // A split end: two short nubs leaving the end of the lock at slightly different angles.
  const splitEnds = (l: DutchLock): string => {
    const a = along(l.pts, 6);
    const e = a[a.length - 1];
    const t = unit(sub(e, a[a.length - 3]));
    const nub = (side: number) => {
      const dir = unit(P(t[0] + -t[1] * side * 0.45, t[1] + t[0] * side * 0.45));
      const from = P(e[0] - t[0] * 4 + -t[1] * side * l.w * 0.18, e[1] - t[1] * 4 + t[0] * side * l.w * 0.18);
      return ring(lockOutline([from, P(from[0] + dir[0] * 6, from[1] + dir[1] * 6), P(from[0] + dir[0] * (9 + side * 2), from[1] + dir[1] * (9 + side * 2))], { w: l.w * 0.42, root: 1, peak: 0.2, tip: 0.6, round: true, seed: seed + l.k + 7 }));
    };
    return nub(-1) + nub(1);
  };

  // Where the lock leaves the crown mass: the first point of its path outside it.
  const exitOf = (l: DutchLock): { p: Pt; u: number } | null => {
    const a = along(l.pts, 8);
    for (let n = 1; n < a.length; n++) if (!insideShape(cap, a[n])) return { p: a[n], u: n / (a.length - 1) };
    return null;
  };

  // Surface marks: a few twists across the lock at irregular spacing and angle, never bands at equal intervals.
  const twists = (l: DutchLock, behind: boolean) => {
    const dark: string[] = [];
    const light: string[] = [];
    if (d === 0) return { dark, light };
    const a = resample(along(l.pts, 6), 2);
    const total = a.length;
    let u = 0.16 + hash01(seed, l.k + 200) * 0.08;
    let j = 0;
    while (u < 0.92) {
      const idx = Math.min(total - 2, Math.round(u * (total - 1)));
      u += 0.08 + hash01(seed, l.k * 17 + j + 210) * 0.16;
      j++;
      if (hash01(seed, l.k * 19 + j + 230) < 0.28 || (d === 1 && j % 2)) continue;
      const p = a[idx];
      const t = unit(sub(a[idx + 1], a[Math.max(0, idx - 1)]));
      const [nx, ny] = [-t[1], t[0]];
      const hw = l.w * 0.46 * (1 - u * 0.3);
      const side = hash01(seed, l.k * 23 + j) < 0.5 ? -1 : 1;
      // A twist crosses most of the lock on a slant, starting at one edge and fading before the other.
      const slant = 2 + hash01(seed, l.k * 29 + j) * 3.5;
      const reach = 0.55 + hash01(seed, l.k * 31 + j) * 0.5;
      const from = P(p[0] + nx * hw * side, p[1] + ny * hw * side);
      const to = P(p[0] - nx * hw * side * reach + t[0] * slant, p[1] - ny * hw * side * reach + t[1] * slant);
      dark.push(strokeLine(along([from, P(lerp(from[0], to[0], 0.5) + t[0] * 1.2, lerp(from[1], to[1], 0.5) + t[1] * 1.2), to], 3), { w: 0.7 + hash01(seed, l.k * 37 + j) * 1.3, start: 0.5, end: 0.05, peak: 0.3, seed: seed + l.k + j }));
      if (d === 2 && !behind && l.lit && hash01(seed, l.k * 41 + j) < 0.6) light.push(strokeLine(along([P(from[0] - t[0] * 2.4, from[1] - t[1] * 2.4), P(lerp(from[0], to[0], 0.55) - t[0] * 2.8, lerp(from[1], to[1], 0.55) - t[1] * 2.8)], 2), { w: 0.9, start: 0.3, end: 0.1, seed: seed + l.k + j + 50 }));
    }
    return { dark, light };
  };

  // Dyed ends: the last part of each lock, cut on a slant that differs from lock to lock (the two sides of the outline
  // are cut at different points), so the colour change is ragged, not a straight band.
  const ends = (l: DutchLock, from = 0.72) => {
    const shape = shapeOf(l);
    const n = shape.length;
    const half = (n - 5) / 2;
    const lean = Math.round((hash01(seed, l.k + 400) - 0.5) * 0.3 * half);
    const mL = Math.max(1, Math.round(from * (half - 1)) + lean);
    const mR = Math.max(1, Math.round(from * (half - 1)) - lean);
    return ring([...shape.slice(mL, n - mR)]);
  };

  const lockArt = (l: DutchLock, front: boolean): ReactNode => {
    const behind = l.layer === "back";
    // Toned by depth: behind the head darkest, under the crown a little shaded, over it lightest.
    const tone = behind ? mixHex(tones[Math.floor(l.tone * 3)], T.shade, 0.45) : front ? mixHex(T.base, T.light, l.tone * 0.14) : mixHex(T.base, T.shade, 0.12 + l.tone * 0.16);
    const shape = shapeOf(l);
    const tw = twists(l, behind);
    const body = (
      <>
        {/* Contact shadow on whatever lies behind: separation by value, not by an outline. */}
        {(d === 2 || (front && d === 1)) && <path d={ring(offset(shape, 1.4, 1.5))} fill={T.deep} opacity={0.45} />}
        {l.end === "split" && <path d={splitEnds(l)} fill={tone} />}
        <path d={ring(shape)} fill={tone} />
        <path d={ring(outline(l, l.w * 0.22))} fill={T.shade} opacity={behind ? 0.35 : 0.6} />
        {/* Under the crown the lock goes into shadow where it meets the mass. */}
        {!behind && !front && d > 0 && <path d={hairStroke(l.pts, { from: 0, to: 0.24, w: l.w * 0.95, seed: seed + l.k + 90, start: 0.9, end: 0.3, peak: 0.1 })} fill={T.deep} opacity={0.4} />}
        {l.lit && !behind && <path d={hairStroke(offset(l.pts, -l.w * 0.18, 0), { from: 0.1, to: 0.34 + hash01(seed, l.k + 80) * 0.2, w: l.w * 0.22, seed: seed + l.k })} fill={T.light} opacity={0.55} />}
        {l.lit && !behind && d === 2 && <path d={hairStroke(offset(l.pts, -l.w * 0.12, 0), { from: 0.5 + hash01(seed, l.k + 81) * 0.1, to: 0.7 + hash01(seed, l.k + 82) * 0.14, w: l.w * 0.15, seed: seed + l.k + 1 })} fill={T.light} opacity={0.42} />}
        {tw.dark.length > 0 && <path d={tw.dark.join("")} fill={T.deep} opacity={behind ? 0.3 : 0.45} />}
        {tw.light.length > 0 && <path d={tw.light.join("")} fill={T.light} opacity={0.4} />}
        {TT && <path d={ends(l)} fill={behind ? mixHex(TT.base, TT.shade, 0.6) : TT.base} />}
      </>
    );
    if (!front || d === 0) return <g key={`${l.layer}${l.k}`}>{body}</g>;
    // Over the crown: the lock fades in from inside the mass, so there is no visible start.
    const a = along(l.pts, 8);
    // Fully opaque by the point where it leaves the mass, so nothing fades outside the crown.
    const [r0, r1] = [a[0], a[Math.round((exitOf(l)?.u ?? 0.3) * (a.length - 1))]];
    const id = `${uid}dl${l.k}`;
    return (
      <g key={`${l.layer}${l.k}`}>
        <defs>
          <linearGradient id={`${id}g`} gradientUnits="userSpaceOnUse" x1={r0[0]} y1={r0[1]} x2={r1[0]} y2={r1[1]}>
            <stop offset="0" stopColor="#000" />
            <stop offset="0.45" stopColor="#000" />
            <stop offset="1" stopColor="#fff" />
          </linearGradient>
          <mask id={`${id}m`} maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="350">
            <rect x="0" y="0" width="300" height="350" fill={`url(#${id}g)`} />
          </mask>
        </defs>
        <g mask={`url(#${id}m)`}>{body}</g>
      </g>
    );
  };
  // Small sizes: the same masses as flat fills, merged, without shading.
  const flat = (ls: DutchLock[], fill: string) =>
    ls.length > 0 && (
      <>
        <path d={ls.map((l) => ring(shapeOf(l))).join("")} fill={fill} />
        {TT && <path d={ls.map((l) => ends(l)).join("")} fill={TT.base} />}
      </>
    );

  const back = locks.filter((l) => l.layer === "back");
  const under = locks.filter((l) => l.layer === "under");
  const over = locks.filter((l) => l.layer === "over");

  // Root clumps: where a lock leaves the crown, a lumpy mass of the crown's own hair rides over its root, so the
  // lock comes out of the mass instead of starting at its edge. They are part of the crown (same fill and shading).
  const clumps = d === 0 ? [] : [...under, ...over].flatMap((l) => {
    const e = exitOf(l);
    if (!e) return [];
    const a = along(l.pts, 8);
    const back2 = a[Math.max(0, Math.round(e.u * (a.length - 1)) - 2)];
    return [coilyCluster(P(lerp(back2[0], e.p[0], 0.4), lerp(back2[1], e.p[1], 0.4)), l.w * 0.56, { seed: seed + l.k * 5, lobes: 3, squash: 0.8 })];
  });

  const parts: string[] = [];
  if (d > 0) {
    const crown = P(CX + 4, f.top + 4);
    const cornerL = hl.front[0];
    const cornerR = last(hl.front);
    for (let j = 0; j < 3; j++) {
      const t = P(lerp(cornerL[0] + 10, cornerR[0] - 10, (j + rnd(seed, 90 + j, 0.2, 0.8)) / 3), hl.y - 6);
      parts.push(hairStroke([P(lerp(crown[0], t[0], 0.4), lerp(crown[1], t[1], 0.4)), P(lerp(crown[0], t[0], 0.7), lerp(crown[1], t[1], 0.7)), t], { from: 0, to: 1, w: 1, seed: seed + j, start: 0.2, end: 0.6 }));
    }
  }
  const clip = `${uid}hc`;
  const nearFace = [...locks.filter((l) => l.layer !== "back" && Math.abs(last(l.pts)[0] - CX) < f.cheekW + 14)];
  return {
    // Behind the head the locks are only a darker mass until close-up size.
    back: d < 2 ? flat(back, mixHex(T.base, T.shade, 0.45)) : <g>{back.map((l) => lockArt(l, false))}</g>,
    onSkin: (
      <g fill={skin.shade} opacity={0.75}>
        {/* Locks beside the face drop soft shadows on the skin. */}
        <path d={nearFace.map((l) => ring(offset(shapeOf(l), 1.8, 3))).join("")} />
        <path d={ring([...hl.front.map((p) => P(p[0] + 1, p[1] + 2.5)), ...hl.front.slice().reverse()])} />
      </g>
    ),
    mid: (
      <g>
        {/* Locks under the crown first: its mass then covers every root. */}
        {d === 0 ? flat([...under, ...over], T.base) : under.map((l) => lockArt(l, false))}
        <ClipDefs id={clip} shapes={[capD, ...clumps]} />
        <path d={capD} fill={T.base} />
        {clumps.length > 0 && <path d={clumps.join("")} fill={T.base} />}
        <g clipPath={`url(#${clip})`}>
          <path d={ring([P(CX + 18, f.top - 20), P(CX + 30, hl.y), P(CX + 120, hl.y + 20), P(CX + 120, f.top - 30)])} fill={T.shade} />
          {parts.length > 0 && <path d={parts.join("")} fill={T.deep} opacity={0.6} />}
        </g>
        <path d={silhouetteInk(outer, d, seed + 5, [[0, 0.25], [0.31, 1]], 1.8)} fill={INK} />
      </g>
    ),
    // Over the crown: drawn after any headband, fading in from inside the mass.
    front: d === 0 ? undefined : <g>{over.map((l) => lockArt(l, true))}</g>,
    extent: capHalf,
    ears: "covered",
  };
}

function insideShape(shape: readonly Pt[], p: Pt): boolean {
  let c = false;
  for (let i = 0, j = shape.length - 1; i < shape.length; j = i++) {
    const a = shape[i];
    const b = shape[j];
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
