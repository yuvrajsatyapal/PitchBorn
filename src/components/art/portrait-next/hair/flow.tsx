/**
 * Straight and wavy hair that falls: long flowing cuts, curtains, and the long back of a mullet. Each side is one
 * mass from the parting, over the dome and down past the face, so the hair wraps the skull instead of hanging as a
 * flat panel. Clumps, shadow and light follow flow lines laid between the face-framing edge and the outer
 * silhouette, so their direction changes from crown to temple to side on its own.
 */
import type { FaceSpec } from "../../portrait/anatomy";
import { CX, along, lerp, type Pt } from "../../portrait/geometry";
import { noise1, resample, ring, strokeLine } from "../ink";
import { INK, hairTones, mixHex } from "../palette";
import {
  ClipDefs,
  P,
  castBand,
  castBelow,
  fallHalf,
  hairStroke,
  hairline,
  hanging,
  last,
  lobe,
  bumped,
  resampleN,
  rnd,
  shell,
  silhouetteInk,
  type Bump,
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
  /** Outward flare as the hair falls, and a gentle S-wave (0 straight). */
  flare: number;
  wave: number;
  /** Ends: how many and how long. */
  tips: number;
  tipLen: readonly [number, number];
  back: BackDesign | null;
}

export interface BackDesign {
  /** Top of the visible back mass (y) and its end. */
  from: (f: FaceSpec) => number;
  end: (f: FaceSpec) => number;
  /** Extra width beyond the head as it falls. */
  spread: number;
  tips: number;
  /** How far towards the shadow tone the back mass sits (0 base .. 1 shade). */
  tone?: number;
}

const N = 36;

/**
 * Hair behind the head and neck: visible beside the neck and over the shoulders. Darker (it is behind and in
 * shadow), a few flow lines, its ends broken into tapered tips.
 */
export function backMass(i: HairInput, b: BackDesign, side: number): HairArt["back"] {
  const { f, head, color, d, seed } = i;
  const T = hairTones(color);
  const y0 = b.from(f);
  const y1 = b.end(f);
  const edge = (s: 1 | -1): Pt[] => {
    const pts: Pt[] = [];
    for (let y = y0; y <= y1; y += 5) {
      const t = (y - y0) / Math.max(1, y1 - y0);
      pts.push(P(CX + s * (fallHalf(head, s, y0, y) + side + b.spread * t * t + noise1(seed + (s > 0 ? 1 : 2), t * 4) * 1.2), y));
    }
    return pts;
  };
  const R = edge(1);
  const L = edge(-1);
  const bottom = hanging(
    resample([last(R), P(CX, y1 + 4), last(L)], 1.5),
    Array.from({ length: b.tips }, (_, k) => ({ u: (k + 0.5) / b.tips + rnd(seed, k + 20, -0.04, 0.04), w: 0.6 / b.tips, a: rnd(seed, k + 30, 4, 11), lean: rnd(seed, k + 40, -2, 2) })),
  );
  const top = P(CX, y0 - 14);
  const region = [top, ...R, ...bottom.slice(1), ...L.slice().reverse().slice(1)];
  const flows: string[] = [];
  if (d > 0) {
    for (const s of [-1, 1] as const) {
      for (let j = 0; j < 2; j++) {
        const x = CX + s * (fallHalf(head, s, y0, y0 + 20) + side * (0.3 + j * 0.35));
        flows.push(hairStroke([P(x, y0 + 4), P(x + s * (2 + j * 2), lerp(y0, y1, 0.5)), P(x + s * (3 + j * 3 + b.spread * 0.4), y1 - 4)], { from: 0.1, to: 0.9, w: 1.1, seed: seed + j, start: 0.3, end: 0.05 }));
      }
    }
  }
  return (
    <g>
      <path d={ring(region)} fill={mixHex(T.base, T.shade, b.tone ?? 0.55)} />
      {flows.length > 0 && <path d={flows.join("")} fill={T.deep} opacity={0.7} />}
      <path d={silhouetteInk([...R.slice().reverse(), top, ...L], d, seed + 9, [[0, 1]], 1.5)} fill={INK} />
      {d > 0 && <path d={strokeLine(bottom, { w: 0.8, start: 0.4, end: 0.4, seed: seed + 3 })} fill={T.line} opacity={0.7} />}
    </g>
  );
}

export function flowHair(i: HairInput, o: FlowDesign): HairArt {
  const { f, head, color, skin, uid, d, recede, seed } = i;
  const T = hairTones(color);
  const hl = hairline(f, head, o.kind, recede, seed);
  const end = o.end(f);
  const partX = CX + o.part + rnd(seed, 1, -2, 2);
  const yW = f.eyeY - 8;
  const sh = shell(f, head, yW, o.side, o.top, o.side + 0.6);
  const ip = Math.max(1, sh.findIndex((p) => p[0] >= partX));
  const crownPart = sh[ip];
  const wave = (s: 1 | -1, t: number) => o.wave * Math.sin(t * Math.PI * 2.2 + (s > 0 ? 0.6 : 0)) * Math.min(1, t * 2.5);

  /** One side: outer silhouette, face-framing edge, ends, and the flow field between them. */
  const build = (s: 1 | -1) => {
    const over = s > 0 ? sh.slice(ip) : sh.slice(0, ip + 1).reverse();
    const fall: Pt[] = [];
    for (let y = yW + 5; y <= end; y += 5) {
      const t = (y - yW) / Math.max(1, end - yW);
      fall.push(P(CX + s * (fallHalf(head, s, yW, y) + o.side + (y - yW) * o.flare + wave(s, t)), y));
    }
    // A few broad clumps break the falling outer edge.
    const outer = bumped(
      resample([...over, ...fall], 2),
      Array.from({ length: 4 }, (_, k) => ({ u: 0.45 + k * 0.14 + rnd(seed, k + (s > 0 ? 170 : 180), -0.03, 0.03), w: 0.05, a: rnd(seed, k + (s > 0 ? 190 : 200), 1, 3) })),
      lobe,
      s > 0 ? 1 : -1,
    );
    const px = partX + s * 0.8;
    const templeY = lerp(hl.y + 8, f.browY - 6, o.arch);
    const innerCtl: Pt[] = [
      P(px, hl.y - 1),
      P(lerp(px, CX + s * f.templeW * 0.6, 0.45), hl.y + 2 + o.arch * 10),
      P(CX + s * f.templeW * 0.64, templeY),
      P(CX + s * (head.half(f.eyeY, s) - o.cover), f.eyeY + 2),
      P(CX + s * (head.half(f.mouthY, s) - o.cover * 0.6 + 1), f.mouthY),
      P(CX + s * (head.half(f.jawY, s) + 3), f.jawY + 6),
      P(CX + s * (f.neckW + 14), lerp(f.jawY, 330, 0.5)),
    ].filter((p, k) => k < 3 || p[1] < end - 6);
    // Long hair ends over the shoulder beside the neck; shorter hair ends against the face.
    const innerEnd = end > f.chinY ? P(CX + s * (f.neckW + 18), end - 4) : P(CX + s * (head.half(end - 4, s) + 1 - o.cover * 0.3), end - 4);
    const inner = along([...innerCtl, innerEnd], 6, 0.5).map((p, k, a) => {
      const t = k / (a.length - 1);
      return t > 0.4 ? P(p[0] + wave(s, t), p[1]) : p;
    });
    // Ends: from the outer end back to the inner end, broken into a few tapered tips.
    const tips: Bump[] = Array.from({ length: o.tips }, (_, k) => ({
      u: (k + 0.5) / o.tips + rnd(seed, k + 60 + (s > 0 ? 9 : 0), -0.06, 0.06),
      w: 0.7 / o.tips,
      a: rnd(seed, k + 70 + (s > 0 ? 9 : 0), o.tipLen[0], o.tipLen[1]),
      lean: s * rnd(seed, k + 80, 0, 3),
    }));
    const bottom = hanging(resample([last(outer), P(lerp(last(outer)[0], last(inner)[0], 0.5), end + 2), last(inner)], 1.5), tips);
    const region = [crownPart, ...outer.slice(1), ...bottom.slice(1), ...inner.slice().reverse()];
    const O = resampleN(outer, N);
    const I = resampleN(inner, N);
    const flow = (v: number, u0: number, u1: number, jit = 0): Pt[] => {
      const out: Pt[] = [];
      for (let k = Math.round(u0 * (N - 1)); k <= Math.round(u1 * (N - 1)); k++) {
        const vv = v + jit * noise1(seed + Math.round(v * 100), k * 0.3);
        out.push(P(lerp(I[k][0], O[k][0], vv), lerp(I[k][1], O[k][1], vv)));
      }
      return out;
    };
    const band = (v0: number, v1: number, u0: number, u1: number) => ring([...flow(v0, u0, u1, 0.03), ...flow(v1, u0, u1, 0.03).reverse()]);
    return { outer, inner, bottom, region, flow, band };
  };
  const R = build(1);
  const L = build(-1);
  const lit = (s: 1 | -1) => s < 0;

  const sideArt = (b: ReturnType<typeof build>, s: 1 | -1) => {
    const id = `${uid}fl${s > 0 ? "r" : "l"}`;
    const seps: string[] = [];
    const lights: string[] = [];
    if (d > 0) {
      [0.2, 0.46, 0.72].forEach((v0, k) => {
        const v = v0 + rnd(seed, k + (s > 0 ? 110 : 120), -0.05, 0.05);
        const u0 = rnd(seed, k + 130, 0.04, 0.18);
        const u1 = rnd(seed, k + 140, 0.6, 0.97);
        seps.push(hairStroke(b.flow(v, u0, u1, 0.02), { from: 0, to: 1, w: d === 2 ? 1.1 : 1.4, seed: seed + k, start: 0.7, end: 0.05, peak: 0.2 }));
      });
      // Light: a broken sheen where the hair turns over the dome, and (lit side) one long light down the fall.
      [0.28, 0.4, 0.56].forEach((v, k) => {
        const u0 = 0.05 + rnd(seed, k + 150, 0, 0.06);
        lights.push(hairStroke(b.flow(v, u0, u0 + rnd(seed, k + 160, 0.12, 0.22)), { from: 0, to: 1, w: (d === 2 ? 3.4 : 3.6) * (k === 1 ? 1.25 : 0.8), seed: seed + k + 3 }));
      });
      if (d === 2 && lit(s)) lights.push(hairStroke(b.flow(0.55, 0.42, 0.72, 0.02), { from: 0, to: 1, w: 1.8, seed: seed + 9 }));
    }
    const shade = lit(s) ? [b.band(0, 0.2, 0.08, 1), b.band(0, 1, 0.88, 1)] : [b.band(0.32, 1, 0, 1), b.band(0, 0.12, 0.05, 1)];
    return (
      <g key={s}>
        <ClipDefs id={id} shapes={[ring(b.region)]} />
        <path d={ring(b.region)} fill={T.base} />
        <g clipPath={`url(#${id})`}>
          <path d={shade.join("")} fill={T.shade} />
          {seps.length > 0 && <path d={seps.join("")} fill={T.deep} opacity={0.8} />}
          {lights.length > 0 && <path d={lights.join("")} fill={lit(s) ? T.light : mixHex(T.base, T.light, 0.45)} opacity={lit(s) ? 0.8 : 0.5} />}
        </g>
        {d > 0 && <path d={strokeLine(b.inner, { w: 0.9, start: 0.3, end: 0.5, seed: seed + (s > 0 ? 21 : 23), wobble: 0.2 })} fill={T.line} opacity={0.85} />}
        {d > 0 && <path d={strokeLine(b.bottom, { w: 0.8, start: 0.5, end: 0.5, seed: seed + 25 })} fill={T.line} opacity={0.7} />}
      </g>
    );
  };
  const silhouette = [...L.outer.slice().reverse(), ...R.outer.slice(1)];
  // The arch over the forehead and the hair on the lit side drop soft shadows on the face.
  const arch = [...L.inner.slice(0, Math.round(L.inner.length * 0.35)).reverse(), ...R.inner.slice(0, Math.round(R.inner.length * 0.35))];
  return {
    back: o.back ? backMass(i, o.back, o.side - 1) : undefined,
    onSkin: (
      <g fill={skin.shade}>
        <path d={castBelow(arch, 1.2, 3, f.top)} opacity={0.8} />
        <path d={castBand(L.inner, 2.6, 1.4)} opacity={0.7} />
        {/* The parting shows a little scalp, a touch darker than the forehead. */}
        <path d={ring([P(partX - 1.4, hl.y), P(partX + 1.4, hl.y), P(crownPart[0], crownPart[1] + 3)])} opacity={0.6} />
      </g>
    ),
    front: (
      <g>
        {sideArt(L, -1)}
        {sideArt(R, 1)}
        <path d={silhouetteInk(silhouette, d, seed + 5, [[0, 0.35], [0.4, 1]], 2)} fill={INK} />
        {d > 0 && <path d={strokeLine([P(partX, hl.y + 0.5), P(crownPart[0], crownPart[1] + 2)], { w: 1, start: 0.6, end: 0.2, seed })} fill={T.deep} />}
      </g>
    ),
  };
}
