/**
 * Locs (dreads). A short scalp cap they grow from, then individual locks: each with its own width, length, bend and
 * rounded end, falling with gravity. Back locks hang behind the head and shoulders; side locks frame the face and
 * overlap each other; a few fall over the forehead. Separation between locks comes from value and a thin dark edge,
 * never a heavy outline.
 */
import type { ReactNode } from "react";
import { CX, along, hash01, lerp, type Pt } from "../../portrait/geometry";
import { ring, strokeLine } from "../ink";
import { INK, hairTones, mixHex } from "../palette";
import {
  ClipDefs,
  P,
  hairStroke,
  hairline,
  last,
  lobedEdge,
  rnd,
  shell,
  silhouetteInk,
  taperedLock,
  type HairArt,
  type HairInput,
  type HairlineKind,
} from "./core";

export interface LocsDesign {
  kind: HairlineKind;
  /** Where the longest locks end (y). */
  end: number;
  /** Locks over the forehead, framing the face (per side) and behind (per side). */
  fringe: number;
  side: number;
  back: number;
  /** Lock width range. */
  w: readonly [number, number];
}

interface Lock {
  path: Pt[];
  w: number;
  k: number;
  tone: number;
  s: 1 | -1;
}

export function locsHair(i: HairInput, o: LocsDesign): HairArt {
  const { f, head, color, skin, uid, d, recede, seed } = i;
  const T = hairTones(color);
  const hl = hairline(f, head, o.kind, recede, seed);
  const r = (k: number, lo: number, hi: number) => rnd(seed, k, lo, hi);
  const cornerL = hl.front[0];
  const cornerR = last(hl.front);
  const capY = Math.max(cornerL[1], cornerR[1]) + 14;
  // The cap is bumpy where the locks start.
  const outer = lobedEdge(shell(f, head, capY, 4, 10, 4.5), { seed: seed + 3, spacing: [8, 13], amp: [0.8, 2.2] });
  const sideFront = (end: Pt, corner: Pt) => along([end, P(lerp(end[0], corner[0], 0.5), lerp(end[1], corner[1], 0.6)), corner], 4, 0.5);
  const sR = sideFront(last(outer), cornerR);
  const sL = sideFront(outer[0], cornerL);
  const cap = [...outer, ...sR.slice(1), ...hl.front.slice().reverse().slice(1), ...sL.slice().reverse().slice(1)];
  const capD = ring(cap);

  const locks = { back: [] as Lock[], side: [] as Lock[], fringe: [] as Lock[] };
  let k = 0;
  const w = () => r(k + 1000, o.w[0], o.w[1]);
  // Behind: roots high on the sides of the skull, falling outside the face and behind the shoulders.
  for (const s of [-1, 1] as const) {
    for (let j = 0; j < o.back; j++, k++) {
      const yR = lerp(f.top + 12, hl.y + 6, j / Math.max(1, o.back - 1));
      const root = P(CX + s * (head.half(yR, s) - 6), yR);
      const out = 13 + j * 4.5 + r(k, 0, 5);
      const tipY = o.end + 8 - j * 5 + r(k + 1, -8, 8);
      // Out of the scalp, arcing over the side of the head, then falling.
      const path = [root, P(CX + s * (head.half(yR, s) + out * 0.75), yR + 10), P(CX + s * (head.half(f.eyeY, s) + out), f.eyeY + 12), P(CX + s * (head.half(f.eyeY, s) + out + r(k + 2, 2, 9)), lerp(f.eyeY, tipY, 0.6)), P(CX + s * (head.half(f.eyeY, s) + out + r(k + 3, 4, 14)), tipY)];
      locks.back.push({ path, w: w(), k, tone: hash01(seed, k + 50), s });
    }
  }
  // Framing the face: roots along the side of the cap, the outer ones first so the inner ones overlap them.
  for (const s of [-1, 1] as const) {
    for (let j = 0; j < o.side; j++, k++) {
      const yR = lerp(hl.y + 2, capY - 2, j / Math.max(1, o.side - 1));
      const root = P(CX + s * (head.half(yR, s) - 3 - j * 2), yR);
      const out = (o.side - 1 - j) * 7 + r(k, 3, 7);
      const tipY = o.end - j * 9 + r(k + 1, -10, 6);
      const ex = CX + s * (head.half(f.eyeY, s) + out);
      const sway = r(k + 2, -9, 11);
      const path = [root, P(root[0] + s * (6 + out * 0.4), root[1] + 9), P(ex, f.eyeY + 4), P(ex + s * sway * 0.5, lerp(f.eyeY, tipY, 0.55)), P(ex + s * (sway + r(k + 3, 0, 6)), tipY)];
      locks.side.push({ path, w: w(), k, tone: hash01(seed, k + 50), s });
    }
  }
  // Over the forehead: a few shorter locks falling forward and parting outwards, stopping above the brows.
  for (let j = 0; j < o.fringe; j++, k++) {
    const u = (o.fringe > 1 ? lerp(0.3, 0.7, j / (o.fringe - 1)) : 0.45) + r(k, -0.04, 0.04);
    const p = hl.front[Math.round(u * (hl.front.length - 1))];
    const s: 1 | -1 = p[0] < CX ? -1 : 1;
    const root = P(p[0] - s, p[1] - 10);
    // Parting outwards as they fall, each a different length.
    const tip = P(p[0] + (p[0] - CX) * 0.55 + s * r(k + 1, 2, 6), f.browY - 6 - r(k + 2, 0, 14));
    const path = [root, P(root[0] + (p[0] - CX) * 0.08, root[1] + 8), P(lerp(root[0], tip[0], 0.55) + s * 2, lerp(root[1], tip[1], 0.6)), tip];
    locks.fringe.push({ path, w: w() * 0.95, k, tone: hash01(seed, k + 50), s });
  }

  const tones = [T.base, mixHex(T.base, T.shade, 0.4), mixHex(T.base, T.light, 0.2)];
  const shape = (l: Lock) => taperedLock(l.path, { w: l.w, root: 0.85, peak: 0.18, tip: 0.6, round: true, wobble: 0.12, seed: seed + l.k });
  const lockArt = (l: Lock, behind = false): ReactNode => {
    const lit = l.path[2][0] < CX + 8;
    const tone = behind ? mixHex(tones[Math.floor(l.tone * 3)], T.shade, 0.45) : tones[Math.floor(l.tone * 3)];
    const shift = (dx: number) => l.path.map((p) => P(p[0] + dx, p[1]));
    // A few soft bumps across the lock at close-up size: the knotted texture of a loc, not a pattern.
    const knots: string[] = [];
    if (d === 2 && !behind) {
      for (const u of [0.3, 0.5, 0.72]) {
        const a = along(l.path, 6);
        const p = a[Math.round(u * (a.length - 1))];
        knots.push(strokeLine([P(p[0] - l.w * 0.32, p[1] - 0.6), P(p[0], p[1] + 0.8), P(p[0] + l.w * 0.32, p[1] - 0.4)], { w: 0.6, start: 0.3, end: 0.3, seed: seed + l.k }));
      }
    }
    return (
      <g key={`${behind ? "b" : "f"}${l.k}`}>
        <path d={shape(l)} fill={tone} stroke={d > 0 ? T.deep : undefined} strokeWidth={0.75} strokeLinejoin="round" />
        {d > 0 && <path d={taperedLock(shift(l.w * 0.22), { w: l.w * 0.45, root: 0.85, peak: 0.18, tip: 0.6, round: true, seed: seed + l.k })} fill={T.shade} opacity={behind ? 0.4 : 0.6} />}
        {d > 0 && lit && !behind && <path d={hairStroke(shift(-l.w * 0.2), { from: 0.06, to: 0.5 + hash01(seed, l.k + 70) * 0.3, w: l.w * 0.22, seed: seed + l.k })} fill={T.light} opacity={0.7} />}
        {knots.length > 0 && <path d={knots.join("")} fill={T.deep} opacity={0.35} />}
      </g>
    );
  };

  // Partings on the cap: short lines from the crown towards the roots.
  const parts: string[] = [];
  if (d > 0) {
    const crown = P(CX + 4, f.top + 4);
    for (let j = 0; j < 5; j++) {
      const t = P(lerp(cornerL[0] + 8, cornerR[0] - 8, (j + 0.5) / 5), hl.y - 6);
      parts.push(hairStroke([P(lerp(crown[0], t[0], 0.35), lerp(crown[1], t[1], 0.35)), P(lerp(crown[0], t[0], 0.7), lerp(crown[1], t[1], 0.7)), t], { from: 0, to: 1, w: 1, seed: seed + j, start: 0.2, end: 0.6 }));
    }
  }
  const clip = `${uid}hc`;
  const shiftL = (l: Lock, dx: number, dy: number) => taperedLock(l.path.map((p) => P(p[0] + dx, p[1] + dy)), { w: l.w, root: 0.85, peak: 0.18, tip: 0.6, round: true, seed: seed + l.k });
  return {
    back: <g>{locks.back.map((l) => lockArt(l, true))}</g>,
    onSkin: (
      <g fill={skin.shade} opacity={0.8}>
        {/* Locks over the forehead and on the lit side drop soft shadows on the skin. */}
        {[...locks.fringe, ...locks.side.filter((l) => l.s < 0)].map((l) => (
          <path key={l.k} d={shiftL(l, 1.8, 3)} />
        ))}
        <path d={ring([...hl.front.map((p) => P(p[0] + 1, p[1] + 2.5)), ...hl.front.slice().reverse()])} />
      </g>
    ),
    front: (
      <g>
        <ClipDefs id={clip} shapes={[capD]} />
        <path d={capD} fill={T.base} />
        <g clipPath={`url(#${clip})`}>
          <path d={ring([P(CX + 18, f.top - 20), P(CX + 30, hl.y), P(CX + 120, hl.y + 20), P(CX + 120, f.top - 30)])} fill={T.shade} />
          {parts.length > 0 && <path d={parts.join("")} fill={T.deep} opacity={0.7} />}
        </g>
        <path d={silhouetteInk(outer, d, seed + 5, [[0, 0.25], [0.31, 1]], 1.8)} fill={INK} />
        {locks.side.map((l) => lockArt(l))}
        {locks.fringe.map((l) => lockArt(l))}
      </g>
    ),
  };
}
