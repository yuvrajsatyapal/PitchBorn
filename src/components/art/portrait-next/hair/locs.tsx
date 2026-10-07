/**
 * Locs (dreads). A short scalp cap they grow from, then about a dozen major locks, each a narrow organic mass:
 * thickness that swells and pinches, a flattened section, small bends, its own root direction, length and end.
 * Some start far back and appear from behind the head; side counts and lengths differ left to right; two locks fall
 * over the forehead, not from evenly spaced points. Locks are separated by value (a contact shadow where one lies on
 * another), never by outlines.
 */
import type { ReactNode } from "react";
import { CX, along, hash01, lerp, sub, unit, type Pt } from "../../portrait/geometry";
import { resample, ring, roughen, strokeLine } from "../ink";
import { INK, hairTones, mixHex } from "../palette";
import {
  ClipDefs,
  P,
  bend,
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
  type HairlineKind,
} from "./core";

export interface LocsDesign {
  kind: HairlineKind;
  /** Where the longest locks end (y). */
  end: number;
  /** Locks over the forehead, framing the face (per side, one side gets one more) and behind (per side). */
  fringe: number;
  side: number;
  back: number;
  /** Lock width range. */
  w: readonly [number, number];
  /** Volume of the scalp cap the locks grow from (default: close to the head). */
  cap?: { top: number; side: number };
  /** How far the locks beside the face push out, and how many hang in front of the shoulders. */
  spread?: number;
  forward?: number;
  /** Locks rising from the crown and arching out over the cap before they fall (big volume). */
  rise?: number;
}

interface Lock {
  pts: Pt[];
  w: number;
  k: number;
  tone: number;
  tip: number;
  round: boolean;
  flat?: { u: number; k: number };
  lit: boolean;
  /** Thick locks only: how the end finishes (blunt, tapered, or splitting into two short ends), and the length of
   * the knotted sections it is made of. */
  end?: "blunt" | "taper" | "split";
  knot?: { period: number; phase: number };
}

export function locsHair(i: HairInput, o: LocsDesign): HairArt {
  const { f, head, color, skin, uid, d, recede, seed, tip } = i;
  const T = hairTones(color, i.skin.base);
  const TT = tip ? hairTones(tip) : null;
  const hl = hairline(f, head, o.kind, recede, seed);
  let k = 0;
  let slot = 0;
  const r = (lo: number, hi: number) => rnd(seed, 500 + slot++, lo, hi);
  const cornerL = hl.front[0];
  const cornerR = last(hl.front);
  const capY = Math.max(cornerL[1], cornerR[1]) + 14;
  // The cap is bumpy where the locks start.
  const cp = o.cap ?? { top: 10, side: 4 };
  const big = !!o.cap;
  const outer = lobedEdge(shell(f, head, capY, cp.side, cp.top, cp.side + 0.5), { seed: seed + 3, spacing: big ? [12, 20] : [8, 13], amp: big ? [1.6, 3.6] : [0.8, 2.2] });
  const capHalf = extentOf(outer);
  const spread = o.spread ?? 0;
  const rise = o.rise ?? 0;
  const sideFront = (end: Pt, corner: Pt) => along([end, P(lerp(end[0], corner[0], 0.5), lerp(end[1], corner[1], 0.6)), corner], 4, 0.5);
  const sR = sideFront(last(outer), cornerR);
  const sL = sideFront(outer[0], cornerL);
  const cap = [...outer, ...sR.slice(1), ...hl.front.slice().reverse().slice(1), ...sL.slice().reverse().slice(1)];
  const capD = ring(cap);

  const make = (pts: Pt[], lit: boolean): Lock => {
    const lock: Lock = {
      pts: bend(pts, seed + k * 7, big ? 1.6 : 3),
      w: r(o.w[0], o.w[1]),
      k,
      tone: hash01(seed, k + 50),
      tip: r(0.5, 0.8),
      round: hash01(seed, k + 60) < 0.65,
      flat: hash01(seed, k + 70) < 0.6 ? { u: r(0.3, 0.75), k: r(0.12, 0.3) } : undefined,
      lit,
    };
    if (big) {
      // Thick locks: each its own end shape and a wider range of widths.
      const e = hash01(seed, k + 90);
      lock.end = e < 0.55 ? "blunt" : e < 0.85 ? "taper" : "split";
      lock.tip = lock.end === "taper" ? r(0.3, 0.42) : r(0.7, 0.85);
      lock.round = true;
      lock.w *= r(0.85, 1.12);
      lock.knot = { period: lock.w * r(0.75, 1), phase: r(0, 1) };
    }
    k++;
    return lock;
  };
  // One side carries one more lock than the other.
  const extra: 1 | -1 = hash01(seed, 1) < 0.5 ? -1 : 1;
  const back: Lock[] = [];
  const side: Lock[] = [];
  const fringe: Lock[] = [];
  const forward: Lock[] = [];
  for (const s of [-1, 1] as const) {
    // Behind: rooted far back, appearing from behind the head and falling behind the shoulders.
    for (let j = 0; j < o.back; j++) {
      const yR = lerp(f.top + 6, hl.y, (j + r(0, 0.6)) / o.back);
      const root = P(CX + s * head.half(yR, s) * r(0.55, 0.85), yR);
      const out = r(16, 26) + j * 6 + spread * 1.2;
      back.push(make([root, P(CX + s * (head.half(yR, s) + r(6, 12)), yR + r(10, 18)), P(CX + s * (head.half(f.eyeY, s) + out), f.eyeY + r(0, 18)), P(CX + s * (head.half(f.eyeY, s) + out + r(0, 10)), o.end + r(-8, 14))], s < 0));
    }
    // Framing the face: uneven root heights, each leaving the scalp at its own angle.
    const n = o.side + (s === extra ? 1 : 0);
    for (let j = 0; j < n; j++) {
      const out = (n - 1 - j) * 7.5 + r(1, 6) + spread * (0.6 + 0.4 * (n - 1 - j) / Math.max(1, n - 1));
      const p2 = P(CX + s * (head.half(f.eyeY, s) + out), f.eyeY + r(-4, 6));
      const tipY = o.end - r(0, 34);
      const tip = P(p2[0] + s * r(-4, 10) + s * spread * 0.3, tipY);
      if (rise > 0 && j < n - 1) {
        // Big volume: rooted high on the crown, the lock lies over the dome of the cap (just outside it) and then
        // falls wide. Following the dome keeps it a smooth arc, never a bent pipe.
        const yR = lerp(f.top + 14, hl.y, (j + r(0, 0.5)) / n);
        const root = P(CX + s * capHalf(yR, s) * r(0.55, 0.72), yR);
        const lift = 3 + rise * r(2, 5);
        const dome = [0.55, 1].map((t) => {
          const y = lerp(yR, capY - 4, t);
          return P(CX + s * (capHalf(y, s) + lift * t), y);
        });
        const fall = P(lerp(last(dome)[0], p2[0], 0.5) + s * 3, lerp(last(dome)[1], p2[1], 0.5));
        side.push(make([root, ...dome, fall, p2, P(lerp(p2[0], tip[0], 0.5) + s * r(-4, 4), lerp(p2[1], tipY, 0.5)), tip], s < 0));
        continue;
      }
      const yR = lerp(hl.y - 6, Math.max(cornerL[1], cornerR[1]) + 6, Math.min(1, Math.max(0, (j + r(-0.3, 0.3)) / Math.max(1, n - 1))));
      const root = P(CX + s * (head.half(yR, s) - r(2, 6)), yR);
      const a = r(0.35, 1.1);
      const reach = r(8, 14);
      const p1 = P(root[0] + s * Math.cos(a) * reach, root[1] + Math.sin(a) * reach);
      side.push(make([root, p1, p2, P(lerp(p2[0], tip[0], 0.5) + s * r(-4, 4), lerp(p2[1], tipY, 0.5)), tip], s < 0));
    }
    // In front of the shoulders: from the temple, close past the jaw, onto the chest.
    for (let j = 0; j < (o.forward ?? 0) && s === extra; j++) {
      const yR = Math.max(cornerL[1], cornerR[1]) + 10;
      const root = P(CX + s * (head.half(yR, s) - 4), yR);
      const pJ = P(CX + s * (head.half(f.mouthY, s) + r(4, 9)), f.mouthY);
      const tip = P(CX + s * (f.neckW + r(14, 24)), o.end + r(2, 12));
      forward.push(make([root, P(root[0] + s * 6, lerp(yR, f.mouthY, 0.4)), pJ, P(lerp(pJ[0], tip[0], 0.5), lerp(pJ[1], tip[1], 0.5)), tip], s < 0));
    }
  }
  // Over the forehead: one longer lock sweeping to one side, one shorter pushed the other way.
  const sweep: 1 | -1 = hash01(seed, 2) < 0.5 ? -1 : 1;
  for (let j = 0; j < o.fringe; j++) {
    const u = (j === 0 ? 0.42 : 0.66) + r(-0.06, 0.06);
    const p = hl.front[Math.round((sweep < 0 ? u : 1 - u) * (hl.front.length - 1))];
    const dir = j === 0 ? sweep : -sweep;
    const root = P(p[0], p[1] - 12);
    // Thick locks over the forehead sweep well to the side instead of hanging straight down.
    const side2 = big ? 1.15 : 1;
    const tip = j === 0 ? P(root[0] + dir * r(16, 22) * side2, (big ? f.browY - 18 : f.browY) - r(0, 6)) : P(root[0] + dir * r(10, 15) * side2, hl.y + r(24, 32) - (big ? 10 : 0));
    // Thick ones fall forward and a little to the side, curving gently (never across the forehead).
    const mid = big ? P(lerp(root[0], tip[0], 0.45) + dir * 3, lerp(root[1], tip[1], 0.55)) : P(lerp(root[0], tip[0], 0.7), lerp(root[1], tip[1], 0.6));
    const lock = make([root, P(root[0] + dir * 3, root[1] + 10), mid, tip], root[0] < CX + 8);
    if (big) lock.w *= 0.72;
    fringe.push(lock);
  }

  const tones = [T.base, mixHex(T.base, T.shade, 0.4), mixHex(T.base, T.light, 0.2)];
  const outline = (l: Lock, dx = 0) => {
    const shape = lockOutline(offset(l.pts, dx, 0), { w: dx ? l.w * 0.5 : l.w, root: 0.8, peak: 0.2, tip: l.tip, round: l.round, wobble: 0.06, swell: big ? 0.26 : 0.22, flat: l.flat, knots: l.knot && { ...l.knot, depth: d === 0 ? 0 : 0.12 }, seed: seed + l.k });
    // Thick locks are matte and a little fuzzy at the edge, never a clean tube.
    return big && !dx ? roughen(shape, 0.7, seed + l.k + 300, 0.55) : shape;
  };
  // A split end: two short nubs leaving the end of the lock at slightly different angles.
  const splitEnds = (l: Lock): string => {
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
  // Thick locks are made of knotted sections: where one section turns into the next the lock pinches in and a soft
  // band of shadow runs across it, with a little light on the section above on the lit side.
  const sections = (l: Lock, behind: boolean) => {
    const dark: string[] = [];
    const light: string[] = [];
    if (!l.knot || d === 0) return { dark, light };
    const a = resample(along(l.pts, 6), 2);
    let run = 0;
    let next = (1 + l.knot.phase) * l.knot.period;
    const total = a.reduce((m, p, i) => (i ? m + Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) : 0), 0);
    for (let i = 1, j = 0; i < a.length - 1; i++) {
      run += Math.hypot(a[i][0] - a[i - 1][0], a[i][1] - a[i - 1][1]);
      if (run < next) continue;
      next += l.knot.period;
      j++;
      if (run > total - l.w * 0.7 || (d === 1 && j % 2)) continue;
      const p = a[i];
      const t = unit(sub(a[i + 1], a[i - 1]));
      const [nx, ny] = [-t[1], t[0]];
      const hw = l.w * 0.44 * (1 - (run / total) * 0.3);
      const bow = 1.4 + hash01(seed, l.k * 31 + j) * 1.6;
      dark.push(strokeLine(along([P(p[0] + nx * hw, p[1] + ny * hw), P(p[0] + t[0] * bow, p[1] + t[1] * bow), P(p[0] - nx * hw, p[1] - ny * hw)], 3), { w: d === 2 ? 1.6 : 2.2, start: 0.3, end: 0.3, seed: seed + l.k + j }));
      if (d === 2 && !behind && l.lit) light.push(strokeLine(along([P(p[0] + nx * hw * 0.75 - t[0] * 3, p[1] + ny * hw * 0.75 - t[1] * 3), P(p[0] + nx * hw * 0.15 - t[0] * 4.5, p[1] + ny * hw * 0.15 - t[1] * 4.5)], 2), { w: 1.3, start: 0.3, end: 0.3, seed: seed + l.k + j + 50 }));
    }
    return { dark, light };
  };
  // Dyed ends: the last part of each lock's outline (its two sides from that point, round the end).
  const ends = (l: Lock, from = 0.74) => {
    const shape = outline(l);
    const n = shape.length;
    const k = Math.round(from * ((n - (l.round ? 5 : 0)) / 2 - 1));
    return ring([...shape.slice(k, n - k)]);
  };
  const lockArt = (l: Lock, behind: boolean, front = false): ReactNode => {
    // Thick locks are toned by depth: behind the head darkest, beside the face a little shaded, in front lightest.
    const tone = behind
      ? mixHex(tones[Math.floor(l.tone * 3)], T.shade, 0.45)
      : big
        ? front
          ? mixHex(T.base, T.light, l.tone * 0.14)
          : mixHex(T.base, T.shade, 0.12 + l.tone * 0.16)
        : tones[Math.floor(l.tone * 3)];
    const shape = outline(l);
    const sec = sections(l, behind);
    const knots: string[] = [];
    if (d === 2 && !behind) {
      const a = along(l.pts, 6);
      for (const u of [0.35, 0.62]) {
        const p = a[Math.round(u * (a.length - 1))];
        knots.push(strokeLine([P(p[0] - l.w * 0.3, p[1] - 0.6), P(p[0], p[1] + 0.8), P(p[0] + l.w * 0.3, p[1] - 0.4)], { w: 0.6, start: 0.3, end: 0.3, seed: seed + l.k }));
      }
    }
    return (
      <g key={`${behind ? "b" : "f"}${l.k}`}>
        {/* Contact shadow on whatever lies behind: separation by value, not by an outline (close-ups only; locks in
            front of others at medium size too). */}
        {(d === 2 || (front && d === 1)) && <path d={ring(offset(shape, 1.4, 1.5))} fill={T.deep} opacity={0.45} />}
        {l.end === "split" && <path d={splitEnds(l)} fill={tone} />}
        <path d={ring(shape)} fill={tone} />
        <path d={ring(outline(l, l.w * 0.22))} fill={T.shade} opacity={behind ? 0.35 : 0.6} />
        {l.lit && !behind && <path d={hairStroke(offset(l.pts, -l.w * 0.18, 0), { from: 0.08, to: 0.42 + hash01(seed, l.k + 80) * 0.25, w: l.w * 0.24, seed: seed + l.k })} fill={T.light} opacity={0.6} />}
        {l.lit && !behind && d === 2 && <path d={hairStroke(offset(l.pts, -l.w * 0.12, 0), { from: 0.6, to: 0.74, w: l.w * 0.16, seed: seed + l.k + 1 })} fill={T.light} opacity={0.45} />}
        {knots.length > 0 && !big && <path d={knots.join("")} fill={T.deep} opacity={0.3} />}
        {sec.dark.length > 0 && <path d={sec.dark.join("")} fill={T.deep} opacity={behind ? 0.3 : 0.42} />}
        {sec.light.length > 0 && <path d={sec.light.join("")} fill={T.light} opacity={0.45} />}
        {TT && <path d={ends(l)} fill={behind ? mixHex(TT.base, TT.shade, 0.6) : TT.base} />}
      </g>
    );
  };
  // Small sizes: the same masses as flat fills, merged, without shading.
  const flat = (ls: Lock[], fill: string) =>
    ls.length > 0 && (
      <>
        <path d={ls.map((l) => ring(outline(l))).join("")} fill={fill} />
        {TT && <path d={ls.map((l) => ends(l)).join("")} fill={TT.base} />}
      </>
    );

  const parts: string[] = [];
  if (d > 0) {
    const crown = P(CX + 4, f.top + 4);
    for (let j = 0; j < 3; j++) {
      const t = P(lerp(cornerL[0] + 10, cornerR[0] - 10, (j + r(0.2, 0.8)) / 3), hl.y - 6);
      parts.push(hairStroke([P(lerp(crown[0], t[0], 0.4), lerp(crown[1], t[1], 0.4)), P(lerp(crown[0], t[0], 0.7), lerp(crown[1], t[1], 0.7)), t], { from: 0, to: 1, w: 1, seed: seed + j, start: 0.2, end: 0.6 }));
    }
  }
  const clip = `${uid}hc`;
  const nearFace = [...fringe, ...forward, ...side.filter((l) => Math.abs(last(l.pts)[0] - CX) < f.cheekW + 14)];
  return {
    // Behind the head the locks are only a darker mass until close-up size.
    back: d < 2 ? flat(back, mixHex(T.base, T.shade, 0.45)) : <g>{back.map((l) => lockArt(l, true))}</g>,
    onSkin: (
      <g fill={skin.shade} opacity={0.75}>
        {/* Locks over the forehead and beside the face drop soft shadows on the skin. */}
        <path d={nearFace.map((l) => ring(offset(outline(l), 1.8, 3))).join("")} />
        <path d={ring([...hl.front.map((p) => P(p[0] + 1, p[1] + 2.5)), ...hl.front.slice().reverse()])} />
      </g>
    ),
    mid: (
      <g>
        <ClipDefs id={clip} shapes={[capD]} />
        <path d={capD} fill={T.base} />
        <g clipPath={`url(#${clip})`}>
          <path d={ring([P(CX + 18, f.top - 20), P(CX + 30, hl.y), P(CX + 120, hl.y + 20), P(CX + 120, f.top - 30)])} fill={T.shade} />
          {parts.length > 0 && <path d={parts.join("")} fill={T.deep} opacity={0.6} />}
        </g>
        <path d={silhouetteInk(outer, d, seed + 5, [[0, 0.25], [0.31, 1]], 1.8)} fill={INK} />
        {d === 0 ? (
          <>
            {flat(side, T.base)}
            {flat(forward, T.base)}
            {flat(fringe, T.base)}
          </>
        ) : (
          <>
            {side.map((l) => lockArt(l, false))}
            {forward.map((l) => lockArt(l, false, true))}
            {fringe.map((l) => lockArt(l, false, true))}
          </>
        )}
      </g>
    ),
    extent: capHalf,
    ears: "covered",
  };
}
