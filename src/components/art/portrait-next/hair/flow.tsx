/**
 * Hair that falls: long flowing cuts, curtains, the feathered top and long back of a mullet. Each side is a flow
 * field from the parting, over the dome and down past the face. The hair on it is a few large directional locks:
 * their tops merge into one mass over the crown, lower down they split, sway on their own S-curves and end at
 * different lengths in tapered, flicked tips. Locks are told apart by value (each turns into shadow on its far side,
 * and casts a contact shadow on the lock behind), not by outlines. The two sides never mirror: one falls closer to
 * the face, the other pushes out; lengths, waves and lock counts differ.
 */
import type { ReactNode } from "react";
import type { FaceSpec } from "../../portrait/anatomy";
import { CX, along, hash01, lerp, type Pt } from "../../portrait/geometry";
import { noise1, resample, ring } from "../ink";
import { INK, hairTones, mixHex } from "../palette";
import {
  P,
  castBelow,
  fallHalf,
  hairStroke,
  hairline,
  lockOutline,
  offset,
  resampleN,
  rnd,
  shell,
  silhouetteInk,
  smooth,
  type HairArt,
  type HairInput,
  type HairlineKind,
} from "./core";

export interface FlowDesign {
  kind: HairlineKind;
  /** Parting offset from the centre line. */
  part: number;
  top: number;
  side: number;
  /** Where the hair beside the face ends (y), from the face landmarks. */
  end: (f: FaceSpec) => number;
  /** How far the hair comes over the face edge, and how low the arch over the forehead reaches (0 high, 1 brow). */
  cover: number;
  arch: number;
  /** Outward flare as the hair falls, and the size of the S-wave. */
  flare: number;
  wave: number;
  /** Large locks per side (one side may carry one more) and the range their ends reach (fraction of the field). */
  locks: number;
  reach: readonly [number, number];
  /** Locks from the parting falling onto the forehead, and a separate lock in front of the shoulder. */
  strands: number;
  loose: boolean;
  /** How far lock ends flick outwards. */
  flick: number;
  back: BackDesign | null;
}

export interface BackDesign {
  /** Top of the visible back hair (y) and where it ends. */
  from: (f: FaceSpec) => number;
  end: (f: FaceSpec) => number;
  /** How far it spreads beyond the head as it falls, and how many broad masses per side. */
  spread: number;
  masses: number;
}

const N = 40;

/**
 * Hair behind the head and neck, seen beside the neck and on the shoulders: a few broad directional masses per side
 * flowing down and out, with a darker mass between them so no background shows through.
 */
export function backHair(i: HairInput, b: BackDesign, side: number): ReactNode {
  const { f, head, color, d, seed } = i;
  const T = hairTones(color, i.skin.base);
  const y0 = b.from(f);
  const y1 = b.end(f);
  let slot = 0;
  const r = (lo: number, hi: number) => rnd(seed + 41, slot++, lo, hi);
  const masses: { pts: Pt[]; w: number; s: 1 | -1; k: number }[] = [];
  for (const s of [-1, 1] as const) {
    const n = b.masses + (hash01(seed, s > 0 ? 7 : 8) < 0.35 ? 1 : 0);
    for (let j = 0; j < n; j++) {
      const top = lerp(y0, y0 + 14, j / Math.max(1, n)) + r(-3, 3);
      const x0 = CX + s * (head.half(top, s) - 4 - j * 2);
      const out = fallHalf(head, s, y0, y1) + side + b.spread * (0.45 + 0.55 * (j + 1) / n) + r(-3, 4);
      const tipY = y1 + r(-10, 6) - j * 3;
      const pts = [P(x0, top), P(CX + s * (out - b.spread * 0.4), lerp(top, tipY, 0.4)), P(CX + s * (out + r(-2, 3)), lerp(top, tipY, 0.78)), P(CX + s * (out + r(2, 7)), tipY)];
      masses.push({ pts, w: r(14, 20), s, k: masses.length });
    }
  }
  const outline = (m: (typeof masses)[number], dx = 0) => lockOutline(offset(m.pts, dx, 0), { w: dx ? m.w * 0.5 : m.w, root: 1, peak: 0.25, tip: 0.18, wobble: 0.05, swell: 0.12, seed: seed + m.k });
  const fillBetween = ring([P(CX - fallHalf(head, -1, y0, y0) + 2, y0), P(CX + fallHalf(head, 1, y0, y0) - 2, y0), P(CX + fallHalf(head, 1, y0, y1) + side * 0.5, y1 - 14), P(CX - fallHalf(head, -1, y0, y1) - side * 0.5, y1 - 14)]);
  const tone = mixHex(T.base, T.shade, 0.3);
  return (
    <g>
      <path d={fillBetween} fill={mixHex(T.shade, T.deep, 0.4)} />
      {masses.map((m) => (
        <g key={m.k}>
          {d === 2 && <path d={ring(offset(outline(m), m.s * 1.6, 1.2))} fill={T.deep} opacity={0.4} />}
          <path d={ring(outline(m))} fill={tone} />
          {d > 0 && <path d={ring(outline(m, m.s * m.w * 0.22))} fill={T.shade} opacity={0.6} />}
          {d > 0 && m.s < 0 && <path d={hairStroke(offset(m.pts, -m.w * 0.15, 0), { from: 0.12, to: 0.5, w: m.w * 0.2, seed: seed + m.k })} fill={T.light} opacity={0.4} />}
        </g>
      ))}
    </g>
  );
}

interface Lock {
  a: number;
  b: number;
  end: number;
  sway: number;
  phase: number;
  k: number;
}

export function flowHair(i: HairInput, o: FlowDesign): HairArt {
  const { f, head, color, skin, d, recede, seed } = i;
  const T = hairTones(color, i.skin.base);
  const hl = hairline(f, head, o.kind, recede, seed);
  let slot = 0;
  const r = (lo: number, hi: number) => rnd(seed + 17, slot++, lo, hi);
  const partX = CX + o.part + r(-3, 3);
  const yW = f.eyeY - 8;
  // One side falls closer to the face, the other pushes out.
  const close: 1 | -1 = hash01(seed, 9) < 0.5 ? -1 : 1;
  const sideTop = r(0, 1.5);
  const sh = shell(f, head, yW, o.side + (close < 0 ? 0 : sideTop), o.top, o.side + (close > 0 ? 0 : sideTop));
  const ip = Math.max(1, sh.findIndex((p) => p[0] >= partX));
  const crownPart = sh[ip];

  /** One side's flow field: outer silhouette and face-framing edge, both resampled from the parting to the ends. */
  const field = (s: 1 | -1) => {
    const near = s === close;
    const cover = o.cover * (near ? 1.35 : 0.7);
    const flare = o.flare * (near ? 0.7 : 1.4);
    const end = o.end(f) + r(-6, 6) + (near ? 0 : r(2, 8));
    const ext = Math.max(10, (end - yW) * 0.12);
    const amp = o.wave * r(0.7, 1.3);
    const ph = r(0, 6.28);
    const wave = (t: number) => amp * Math.sin(t * Math.PI * 2 + ph) * smooth((t - 0.25) / 0.3);
    const over = s > 0 ? sh.slice(ip) : sh.slice(0, ip + 1).reverse();
    const fall: Pt[] = [];
    for (let y = yW + 5; y <= end + ext; y += 5) {
      const t = (y - yW) / Math.max(1, end + ext - yW);
      fall.push(P(CX + s * (fallHalf(head, s, yW, y) + o.side + (y - yW) * flare + wave(t)), y));
    }
    const px = partX + s * 0.8;
    const templeY = lerp(hl.y + 8, f.browY - 6, o.arch);
    const ctl: Pt[] = [
      P(px, hl.y - 1),
      P(lerp(px, CX + s * f.templeW * 0.6, 0.45), hl.y + 2 + o.arch * 10),
      P(CX + s * f.templeW * 0.64, templeY),
      P(CX + s * (head.half(f.eyeY, s) - cover), f.eyeY + 2),
      P(CX + s * (head.half(f.mouthY, s) - cover * 0.6 + 1), f.mouthY),
      P(CX + s * (head.half(f.jawY, s) + 3), f.jawY + 6),
      P(CX + s * (f.neckW + 14), lerp(f.jawY, 330, 0.5)),
    ].filter((p, k) => k < 3 || p[1] < end - 6);
    // Long hair ends over the shoulder beside the neck; shorter hair ends against the face.
    const innerEnd = end > f.chinY ? P(CX + s * (f.neckW + 18), end) : P(CX + s * (head.half(end, s) + 1 - cover * 0.3), end);
    const innerLine = along([...ctl, innerEnd, P(innerEnd[0] + s * ext * flare * 2, end + ext)], 6, 0.5).map((p, k, a) => {
      const t = k / (a.length - 1);
      return P(p[0] + wave(t) * 0.8, p[1]);
    });
    const O = resampleN(resample([...over, ...fall], 2), N);
    const I = resampleN(innerLine, N);
    return { O, I, end };
  };

  const at = (F: { O: Pt[]; I: Pt[] }, k: number, v: number): Pt => P(lerp(F.I[k][0], F.O[k][0], v), lerp(F.I[k][1], F.O[k][1], v));
  /** A lock between two flow lines (v from the face edge 0 to the silhouette 1), tapering to a flicked tip. */
  const lockPts = (F: { O: Pt[]; I: Pt[] }, l: Lock, s: 1 | -1, u0 = 0): Pt[] => {
    const k0 = Math.round(u0 * (N - 1));
    const k1 = Math.max(k0 + 3, Math.round(l.end * (N - 1)));
    const c = (l.a + l.b) / 2 + o.flick;
    const L: Pt[] = [];
    const R: Pt[] = [];
    for (let k = k0; k <= k1; k++) {
      const u = k / (N - 1);
      const t = smooth((u - (l.end - 0.22)) / 0.22);
      const sw = l.sway * Math.sin(u * Math.PI * 1.7 + l.phase) * smooth((u - 0.3) / 0.3);
      const a = at(F, k, lerp(l.a, c, t) + noise1(seed + l.k, u * 4) * 0.02);
      const b = at(F, k, lerp(l.b, c, t) + noise1(seed + l.k + 9, u * 4) * 0.02);
      L.push(P(a[0] + s * sw, a[1]));
      R.push(P(b[0] + s * sw, b[1]));
    }
    return [...L, ...R.reverse()];
  };

  const sideArt = (s: 1 | -1) => {
    const F = field(s);
    const n = o.locks + (s === close ? 0 : hash01(seed, 11) < 0.5 ? 1 : 0);
    const locks: Lock[] = Array.from({ length: n }, (_, k) => ({
      a: k / n - 0.05 + r(-0.03, 0.03),
      b: (k + 1) / n + 0.05 + r(-0.03, 0.03),
      end: r(o.reach[0], o.reach[1]),
      sway: r(-3, 3),
      phase: r(0, 6.28),
      k: k + (s > 0 ? 20 : 0),
    }));
    const lit = s < 0;
    // Outer locks first; the ones nearer the face lie on top of them.
    const order = locks.slice().reverse();
    const tone = (l: Lock) => mixHex(T.base, hash01(seed, l.k + 3) < 0.5 ? T.shade : T.light, hash01(seed, l.k + 4) * 0.14);
    // Each lock turns into shadow on the side away from the light.
    const shadeBand = (l: Lock): Lock => (lit ? { ...l, b: lerp(l.a, l.b, 0.42) } : { ...l, a: lerp(l.a, l.b, 0.55) });
    const extras: { l: Lock; u0: number }[] = [];
    if (o.loose && s === close) extras.push({ l: { a: -0.28, b: -0.13, end: r(0.92, 1), sway: r(-2, 2), phase: r(0, 6), k: 40 + (s > 0 ? 1 : 0) }, u0: 0.42 });
    for (let j = 0; j < o.strands; j++) {
      if ((j % 2 === 0 ? -close : close) !== s && o.strands > 1) continue;
      extras.push({ l: { a: -0.2 - j * 0.04, b: 0.06, end: r(0.16, 0.26), sway: 0, phase: 0, k: 50 + j }, u0: 0 });
    }
    const flowLine = (v: number, u0: number, u1: number) => {
      const out: Pt[] = [];
      for (let k = Math.round(u0 * (N - 1)); k <= Math.round(u1 * (N - 1)); k++) out.push(at(F, k, v));
      return out;
    };
    const lights: string[] = [];
    if (d > 0) {
      // Sheen where the hair turns over the dome: a broken group across a few locks, then one long light down the fall.
      locks.forEach((l, k) => {
        if (!lit && k % 2) return;
        const v = lerp(l.a, l.b, 0.5) + r(-0.05, 0.05);
        const u0 = r(0.05, 0.1);
        lights.push(hairStroke(flowLine(v, u0, u0 + r(0.1, 0.18)), { from: 0, to: 1, w: (d === 2 ? 3.2 : 3.6) * (k % 2 ? 0.75 : 1.15), seed: seed + l.k }));
      });
      if (lit) {
        const l = locks[Math.floor(n / 2)];
        lights.push(hairStroke(flowLine(lerp(l.a, l.b, 0.55), 0.38, Math.min(l.end - 0.12, 0.7)), { from: 0, to: 1, w: 2.4, seed: seed + 3 }));
      }
    }
    const lockShapes = order.map((l) => lockPts(F, l, s));
    return {
      F,
      locks,
      extras,
      art: (
        <g key={s}>
          {order.map((l, j) => (
            <g key={l.k}>
              {/* Contact shadow on the lock behind, offset across the flow so the layering shows over the dome too. */}
              {d === 2 && j > 0 && <path d={ring(lockPts(F, { ...l, a: l.a + 0.05, b: l.b + 0.05 }, s))} fill={T.deep} opacity={0.4} />}
              <path d={ring(lockShapes[j])} fill={tone(l)} />
              {d > 0 && <path d={ring(lockPts(F, shadeBand(l), s))} fill={T.shade} opacity={lit ? 0.55 : 0.75} />}
            </g>
          ))}
          {lights.length > 0 && <path d={lights.join("")} fill={lit ? T.light : mixHex(T.base, T.light, 0.45)} opacity={lit ? 0.75 : 0.5} />}
          {extras.map(({ l, u0 }) => (
            <g key={l.k}>
              {d === 2 && <path d={ring(offset(lockPts(F, l, s, u0), 1.6, 1.6))} fill={T.deep} opacity={0.4} />}
              <path d={ring(lockPts(F, l, s, u0))} fill={tone(l)} />
              {d > 0 && <path d={ring(lockPts(F, shadeBand(l), s, u0))} fill={T.shade} opacity={0.6} />}
            </g>
          ))}
        </g>
      ),
    };
  };
  const L = sideArt(-1);
  const R = sideArt(1);
  // Ink only on the outer silhouette, down to where the locks start to separate.
  const cutL = Math.round(Math.min(...L.locks.map((l) => l.end - 0.22)) * (N - 1));
  const cutR = Math.round(Math.min(...R.locks.map((l) => l.end - 0.22)) * (N - 1));
  const silhouette = [...L.F.O.slice(0, cutL).reverse(), ...R.F.O.slice(1, cutR)];
  // The arch over the forehead and the hair on the lit side drop soft shadows on the face.
  const arch = [...L.F.I.slice(0, 14).reverse(), ...R.F.I.slice(1, 14)];
  return {
    back: o.back ? backHair(i, o.back, o.side - 1) : undefined,
    onSkin: (
      <g fill={skin.shade}>
        <path d={castBelow(arch, 1.2, 3, f.top)} opacity={0.8} />
        <path d={ring([...L.F.I.slice(8, 30), ...offset(L.F.I.slice(8, 30), 2.6, 1.4).reverse()])} opacity={0.65} />
        {/* The parting shows a little scalp, a touch darker than the forehead. */}
        <path d={ring([P(partX - 1.4, hl.y), P(partX + 1.4, hl.y), P(crownPart[0], crownPart[1] + 3)])} opacity={0.6} />
      </g>
    ),
    mid: (
      <g>
        {L.art}
        {R.art}
        <path d={silhouetteInk(silhouette, d, seed + 5, [[0, 0.4], [0.45, 1]], 2)} fill={INK} />
        {d > 0 && <path d={hairStroke([P(partX, hl.y + 0.5), P(lerp(partX, crownPart[0], 0.5), lerp(hl.y, crownPart[1], 0.5)), P(crownPart[0], crownPart[1] + 2)], { from: 0, to: 1, w: 1.1, seed, start: 0.6, end: 0.2 })} fill={T.deep} opacity={0.8} />}
      </g>
    ),
  };
}
