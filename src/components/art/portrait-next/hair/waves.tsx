/**
 * Medium wavy hair worn loose (Playmaker Waves). The wave lives in the shape of the hair, not in texture marks: a
 * fuller crown with two broad swells either side of an off-centre parting, a few large side locks that curve out and
 * return in on their way to the ears, and a fringe of several locks of different length and sweep that grow from
 * the crown, cross the hairline and fall over the forehead. Locks are told apart by value, never by outlines; only
 * the outer silhouette is inked. Both sides differ (volume, lock lengths, wave phase) from the player seed.
 */
import { CX, hash01, lerp, type Pt } from "../../portrait/geometry";
import { backHair, type BackDesign } from "./flow";
import { noise1, ring } from "../ink";
import { INK, hairTones, mixHex } from "../palette";
import {
  P,
  bend,
  bumped,
  fallHalf,
  hairStroke,
  hairline,
  lobe,
  lockOutline,
  offset,
  rnd,
  shell,
  silhouetteInk,
  smooth,
  type HairArt,
  type HairInput,
} from "./core";

export interface WavesDesign {
  /** Parting offset from the centre line, and the volume on top. */
  part: number;
  top: number;
  /** Hair thickness beside the head at the first rows, and how far the sides reach down the ear (0 top .. 1 lobe). */
  side: number;
  reach: readonly [number, number];
  /** Size of the outward-then-inward wave in the side locks. */
  wave: number;
  /** Side locks per side and fringe locks (total). */
  locks: number;
  fringe: number;
  back: BackDesign;
}

interface Edge {
  pts: Pt[];
  tip: Pt;
}

export function wavesHair(i: HairInput, o: WavesDesign): HairArt {
  const { f, head, color, skin, d, recede, seed } = i;
  const T = hairTones(color, skin.base);
  const hl = hairline(f, head, "irregular", recede, seed);
  let slot = 0;
  const r = (lo: number, hi: number) => rnd(seed + 71, slot++, lo, hi);
  // The part sits off centre on a seeded side; more hair falls to the far side of it.
  const ps: 1 | -1 = hash01(seed, 31) < 0.5 ? -1 : 1;
  const fs: 1 | -1 = ps > 0 ? -1 : 1;
  const partX = CX + ps * (o.part + r(-2, 3));
  const yW = f.eyeY - 8;
  const earH = f.ear.bot - f.ear.top;
  const volL = r(0, 3);
  const volR = r(0, 3);
  const sh0 = shell(f, head, yW, o.side + volL, o.top, o.side + volR);
  // Two broad swells in the crown, one each side of the part, different in height and width.
  const ip = Math.max(2, sh0.findIndex((p) => p[0] >= partX));
  const nsh = sh0.length - 1;
  const sh = bumped(
    sh0,
    [
      { u: ip / nsh - r(0.12, 0.2), w: r(0.15, 0.2), a: r(3.5, 5), lean: r(-1, 1) },
      { u: ip / nsh + r(0.12, 0.2), w: r(0.14, 0.2), a: r(2.5, 4), lean: r(-1, 1) },
    ],
    lobe,
  );
  const crownPart = sh[ip];
  const center = P(CX, f.top + f.skullW * 0.95);

  /** The dome point `t` of the way from the part to the side end, pulled `inset` towards the head centre. */
  const domePt = (s: 1 | -1, t: number, inset: number): Pt => {
    const idx = Math.round(s > 0 ? lerp(ip, nsh, t) : lerp(ip, 0, t));
    const p = sh[Math.max(0, Math.min(nsh, idx))];
    const dx = center[0] - p[0];
    const dy = center[1] - p[1];
    const m = Math.hypot(dx, dy) || 1;
    return P(p[0] + (dx / m) * inset, p[1] + (dy / m) * inset);
  };

  interface Lock {
    path: Pt[];
    w: number;
    k: number;
    s: 1 | -1;
    v: number;
  }
  const sideLocks = (s: 1 | -1): Lock[] => {
    const far = s === fs;
    const n = o.locks + (far && hash01(seed, 33) < 0.5 ? 1 : 0);
    const ph = r(0, 6.28);
    const amp = o.wave * (far ? r(1, 1.35) : r(0.65, 0.95));
    const reach = lerp(o.reach[0], o.reach[1], r(0, 1)) * (far ? 1 : 0.92);
    const endBase = f.ear.top + earH * reach;
    const locks: Lock[] = [];
    for (let k = 0; k < n; k++) {
      const v = n === 1 ? 1 : k / (n - 1);
      const w = r(17, 22) * (0.85 + 0.2 * v);
      const out = lerp(-1, o.side + (s > 0 ? volR : volL), v);
      const end = endBase + r(-5, 6) + (1 - v) * r(-2, 5);
      const wv = (t: number) => amp * Math.sin(t * Math.PI * 2.3 - 0.35 + (ph - 3.14) * 0.1 + k * 0.3) * smooth(t / 0.3);
      const ypt = (t: number) => lerp(yW, end, t);
      const xAt = (t: number, y: number) => CX + s * (fallHalf(head, s, yW, y) + out + wv(t) + t * 4 + 5 * v * Math.sin(Math.PI * Math.min(1, t * 1.25)));
      const edge = v === 1 ? 0.5 : 0;
      const ctl: Pt[] = [
        P(partX + s * (2.5 + 5 * v), hl.y - 9 - 5 * (1 - v)),
        domePt(s, 0.45, w * 0.45 * edge + 3 + (1 - v) * 3),
        P(CX + s * (head.half(yW, s) + lerp(w * 0.2, out - w * 0.3, v)), yW),
        P(xAt(0.3, ypt(0.3)), ypt(0.3)),
        P(xAt(0.6, ypt(0.6)), ypt(0.6)),
        P(xAt(0.82, ypt(0.82)), ypt(0.82)),
        P(xAt(1, end) + s * lerp(0.5, 2.5, 1 - v), end),
      ];
      locks.push({ path: bend(ctl, seed + k + (s > 0 ? 20 : 0), 1.4), w, k: k + (s > 0 ? 20 : 0), s, v });
    }
    return locks;
  };
  const outline = (l: Lock, dx = 0, wk = 1) =>
    lockOutline(dx ? offset(l.path, dx, 0) : l.path, { w: l.w * wk, root: 0.85, peak: 0.35, tip: l.k >= 60 ? 0.5 : 0.2, round: l.k >= 60, wobble: 0.06, swell: 0.1, seed: seed + l.k });
  const L = sideLocks(-1);
  const R = sideLocks(1);

  // The fringe: locks grow from the crown near the part and cross the hairline, each its own length, sweep and curve.
  const forehead = f.browY - hl.y;
  const nf = o.fringe;
  const fringe: Lock[] = [];
  for (let k = 0; k < nf; k++) {
    const sd: 1 | -1 = k < nf - 2 ? fs : ps;
    const j = sd === fs ? k : k - (nf - 2);
    const m = sd === fs ? nf - 2 : 2;
    const span = f.templeW * (sd === fs ? 0.62 : 0.42);
    const frac = (j + 0.5 + r(-0.15, 0.25)) / m;
    const xe = partX + sd * span * frac + r(-2, 2);
    const len = forehead * (sd === fs ? lerp(0.78, 0.3, frac) * r(0.85, 1.15) : r(0.3, 0.5)) * (k % 2 ? 0.85 : 1.1);
    const ye = hl.y + 4 + len;
    const root = P(partX + sd * (4 + frac * 14), hl.y - 14 - r(0, 6));
    const mid = P(lerp(partX, xe, 0.5) + sd * r(3, 7), lerp(root[1], ye, 0.45));
    const end = P(xe + sd * r(0, 5), ye);
    fringe.push({ path: bend([root, mid, end], seed + 60 + k, 1.5), w: r(21, 28), k: 60 + k, s: sd, v: Math.max(0, j) });
  }

  // Outer silhouette: the dome, then the outer edge of the back-most lock of each side.
  const outerOf = (l: Lock): Edge => {
    const o2 = outline(l);
    const n2 = o2.length / 2;
    const a = o2.slice(0, n2);
    const b = o2.slice(n2).reverse();
    const mean = (p: Pt[]) => p.reduce((q, c) => q + Math.abs(c[0] - CX), 0) / p.length;
    const pts = (mean(a) > mean(b) ? a : b).filter((p) => p[1] >= sh[s2i(l.s)][1] - 1);
    return { pts, tip: pts[pts.length - 1] };
  };
  const s2i = (s: 1 | -1) => (s > 0 ? nsh : 0);
  const backL = L[L.length - 1];
  const backR = R[R.length - 1];
  const eL = outerOf(backL);
  const eR = outerOf(backR);
  const outer = [...eL.pts.slice().reverse(), ...sh.slice(1, nsh), ...eR.pts];

  const endY = (ls: Lock[]) => Math.min(...ls.map((l) => l.path[l.path.length - 1][1])) - 8;
  const inner = (s: 1 | -1, y1: number): Pt[] => {
    const pts: Pt[] = [];
    const yTop = hl.templeR[hl.templeR.length - 1][1];
    for (let y = y1; y >= yTop; y -= 5) pts.push(P(CX + s * (head.half(y, s) - 2), y));
    return pts;
  };
  const base = ring([
    ...outer,
    ...inner(1, endY(R)),
    ...hl.templeR.slice().reverse(),
    ...hl.front.slice().reverse(),
    ...hl.templeL,
    ...inner(-1, endY(L)).reverse(),
  ]);

  const tone = (l: Lock) => mixHex(T.base, hash01(seed, l.k + 3) < 0.5 ? T.shade : T.light, hash01(seed, l.k + 4) * 0.16);
  const lit = (s: 1 | -1) => s < 0;
  const drawLock = (l: Lock, idx: number, withContact: boolean) => (
    <g key={l.k}>
      {d === 2 && withContact && idx > 0 && <path d={ring(offset(outline(l), l.s * 1.3, 1.6))} fill={T.deep} opacity={0.4} />}
      <path d={ring(outline(l))} fill={tone(l)} />
      {d > 0 && <path d={ring(outline(l, l.s * l.w * (lit(l.s) ? 0.3 : 0.2) * -1, 0.55))} fill={T.shade} opacity={lit(l.s) ? 0.5 : 0.7} />}
    </g>
  );
  const sideArt = (ls: Lock[]) => ls.slice().reverse().map((l, idx) => drawLock(l, idx, true));

  const lights: string[] = [];
  if (d > 0) {
    for (const l of [...L, ...R]) {
      if (!lit(l.s) && l.k % 2) continue;
      lights.push(hairStroke(l.path, { from: 0.14 + noise1(seed + l.k, 3) * 0.04, to: 0.4, w: lit(l.s) ? 3.8 : 2.8, seed: seed + l.k }));
      if (lit(l.s) && l.v < 1) lights.push(hairStroke(l.path, { from: 0.58, to: 0.86, w: 2.4, seed: seed + l.k + 5 }));
    }
    for (const l of fringe) lights.push(hairStroke(l.path, { from: 0.3, to: 0.72, w: 2.6, seed: seed + l.k }));
  }
  const fringeOrder = fringe.slice().sort((a, b) => b.path[2][1] - a.path[2][1]);

  return {
    back: backHair(i, o.back, o.side - 1),
    onSkin: (
      <g fill={skin.shade}>
        {d > 0 && fringe.map((l) => <path key={l.k} d={ring(offset(outline(l), -l.s * 1.2, 2.6))} opacity={0.4} />)}
        {/* The parting shows a little scalp, a touch darker than the forehead. */}
        <path d={ring([P(partX - 1.3, hl.y), P(partX + 1.3, hl.y), P(crownPart[0], crownPart[1] + 3)])} opacity={0.6} />
      </g>
    ),
    mid: (
      <g>
        <path d={base} fill={mixHex(T.base, T.shade, 0.55)} />
        {/* The crown reads as one lit mass: a broad light on the side facing the light, following the dome. */}
        {d > 0 && <path d={hairStroke(sh.slice(2, ip).map((p) => P(p[0] + 4, p[1] + 5.5)), { from: 0.1, to: 0.9, w: 5, seed: seed + 2, start: 0.3, end: 0.15 })} fill={T.light} opacity={0.5} />}
        {sideArt(L)}
        {sideArt(R)}
        {fringeOrder.map((l, idx) => drawLock(l, idx, false))}
        {lights.length > 0 && <path d={lights.join("")} fill={T.light} opacity={0.6} />}
        <path d={silhouetteInk(outer, d, seed + 5, [[0, 1]], 2)} fill={INK} />
        {d > 0 && <path d={hairStroke([P(partX, hl.y + 0.5), P(lerp(partX, crownPart[0], 0.5), lerp(hl.y, crownPart[1], 0.5)), P(crownPart[0], crownPart[1] + 2)], { from: 0, to: 1, w: 1.1, seed, start: 0.6, end: 0.2 })} fill={T.deep} opacity={0.8} />}
      </g>
    ),
    ears: "partial",
  };
}
