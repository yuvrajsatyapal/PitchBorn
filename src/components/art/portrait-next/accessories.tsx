/**
 * Accessories and facial marks, every one placed from this face's anchors: glasses from the eyes, the bridge of the
 * nose and the sides of the head; a headband from the forehead and the hair it wraps; scars and marks from the cheek,
 * brow, chin, mouth and nose. Nothing uses a fixed position from a default face, and nothing is scaled as a whole.
 */
import { MARKS, SCARS } from "@/engine/appearance/options";
import type { FaceSpec, Head } from "../portrait/anatomy";
import { CX, clamp, lerp, type Pt } from "../portrait/geometry";
import type { Anchors } from "./anchors";
import type { Detail } from "./face";
import { pathOf, ring, stroke } from "./ink";
import { INK, mixHex, type SkinTones } from "./palette";

const P = (x: number, y: number): Pt => [x, y];

/**
 * A headband across the top of the forehead. It follows the forehead's curve (an arc: the front of the head is
 * nearer than the sides) and wraps whatever is there at that height, the head or the hair's outer edge.
 */
export function HeadbandNext({ head, a, color, d, extent, y = a.foreheadTop[1] - 2, h = 9 }: { head: Head; a: Anchors; color: string; d: Detail; extent?: (y: number, s: 1 | -1) => number; y?: number; h?: number }) {
  const y0 = y;
  // The band wraps the head over close hair; big hair stands out beyond it at the sides, so there it ends a little
  // past the head and turns away (its ends darken) instead of crossing the whole volume.
  const half = (y: number, s: 1 | -1) => head.half(y, s) + clamp((extent?.(y, s) ?? 0) - 0.5 - head.half(y, s), 1.2, 7);
  // The band dips towards the sides as it wraps round the forehead (more on a wide head than a narrow one).
  const dip = 4 + a.width * 0.02;
  const edge = (dy: number, k: number) =>
    Array.from({ length: 13 }, (_, i) => {
      const u = i / 6 - 1;
      const y = y0 + dy + dip * u * u - (dy > 0 ? 0.6 * u * u : 0);
      return P(CX + u * half(y, u < 0 ? -1 : 1) * k, y);
    });
  const top = edge(0, 1);
  const bottom = edge(h, 1);
  const band = [...top, ...bottom.slice().reverse()];
  const shade = mixHex(color, "#000000", 0.22);
  const right = [...top.slice(7), ...bottom.slice(7).reverse()];
  const ends = [0, 12].map((i) => ring([top[i], top[i + (i ? -1 : 1)], bottom[i + (i ? -1 : 1)], bottom[i]]));
  const w = d === 0 ? 1.9 : 1.3;
  return (
    <g>
      <path d={pathOf(band)} fill={color} />
      <path d={pathOf(right)} fill={shade} opacity={0.6} />
      <path d={ends.join("")} fill={shade} opacity={0.8} />
      {d > 0 && <path d={stroke(top.slice(1, 6).map((p) => P(p[0], p[1] + 1.6)), { w: 1.2, start: 0.2, end: 0.2, seed: 5 })} fill="#fff" opacity={0.35} />}
      <path d={pathOf(top, false)} fill="none" stroke={INK} strokeWidth={w} strokeLinecap="round" />
      <path d={pathOf(bottom, false)} fill="none" stroke={INK} strokeWidth={w * 0.85} strokeLinecap="round" opacity={0.85} />
    </g>
  );
}

/**
 * Glasses: each lens is sized from its eye (not a scaled stamp), the bridge sits over the nose, and the arms run
 * back towards the tops of the ears, ending at the side of the head where they pass behind it.
 */
export function GlassesNext({ f, head, a, d }: { f: FaceSpec; head: Head; a: Anchors; d: Detail }) {
  const rx = a.eyeW + 4.2;
  const ry = clamp(f.eye.h * 0.9 + 4.2, 7.5, 10.5);
  const lens = (c: Pt): string => {
    const [x, y] = [c[0], c[1] - 0.6];
    const rt = ry * 0.55;
    const rb = ry * 0.85;
    return `M${x - rx + rt} ${y - ry}L${x + rx - rt} ${y - ry}Q${x + rx} ${y - ry} ${x + rx} ${y - ry + rt}L${x + rx} ${y + ry - rb}Q${x + rx} ${y + ry} ${x + rx - rb} ${y + ry}L${x - rx + rb} ${y + ry}Q${x - rx} ${y + ry} ${x - rx} ${y + ry - rb}L${x - rx} ${y - ry + rt}Q${x - rx} ${y - ry} ${x - rx + rt} ${y - ry}Z`;
  };
  const L = a.eyeL;
  const R = a.eyeR;
  const by = lerp(L[1], R[1], 0.5) - ry * 0.35;
  const bridge = `M${L[0] + rx} ${by}Q${CX} ${by - 4} ${R[0] - rx} ${by}`;
  const arm = (s: 1 | -1, c: Pt) => {
    const ear = s > 0 ? a.earR : a.earL;
    const y1 = ear.top[1] + 9;
    return `M${c[0] + s * rx} ${c[1] - ry * 0.45}L${CX + s * (head.half(y1, s) + 0.5)} ${y1}`;
  };
  const w = d === 0 ? 2.2 : d === 1 ? 1.6 : 1.35;
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const fix = (s: string) => s.replace(/-?\d+\.\d+/g, (n) => String(r1(Number(n))));
  return (
    <g>
      <path d={fix(lens(L) + lens(R))} fill="#dbe9ee" fillOpacity={0.14} stroke={INK} strokeWidth={w} strokeLinejoin="round" />
      <path d={fix(bridge + arm(-1, L) + arm(1, R))} fill="none" stroke={INK} strokeWidth={w} strokeLinecap="round" />
      {d > 0 && (
        <path
          d={[L, R].map((c) => stroke([P(c[0] - rx * 0.55, c[1] - ry * 0.45), P(c[0] - rx * 0.2, c[1] - ry * 0.7)], { w: 1.2, start: 0.3, end: 0.3, seed: 7, steps: 2 })).join("")}
          fill="#fff"
          opacity={0.55}
        />
      )}
    </g>
  );
}

/** Freckles, scars and marks, each tied to its region of this face. */
export function MarksNext({ f, a, t, d, freckles, scar, mark }: { f: FaceSpec; a: Anchors; t: SkinTones; d: Detail; freckles: boolean; scar: number; mark: number }) {
  const els: React.ReactNode[] = [];
  if (freckles && d > 0) {
    // Over the bridge of the nose and the tops of both cheeks, spread by the eyes' spacing.
    const spots: [number, number][] = [[-0.95, 0.35], [-0.8, 0.55], [-1.05, 0.62], [-0.6, 0.42], [-0.85, 0.8], [-0.3, 0.25], [-0.38, 0.52], [0.3, 0.25], [0.38, 0.52], [0.95, 0.35], [0.8, 0.55], [1.05, 0.62], [0.6, 0.42], [0.85, 0.8], [0, 0.12], [-0.12, 0.33], [0.12, 0.33]];
    const span = (a.eyeR[0] - a.eyeL[0]) / 2;
    spots.forEach(([u, v], i) => els.push(<circle key={`fr${i}`} cx={CX + u * span} cy={lerp(a.eyeL[1] + 6, a.noseBase[1], v)} r={0.9 + (i % 3) * 0.3} fill={t.deep} opacity={0.5} />));
  }
  const w = d === 0 ? 3.4 : 2.6;
  const scarAt = (from: Pt, to: Pt, key: string) => {
    els.push(<path key={`${key}a`} d={`M${from[0]} ${from[1]}L${to[0]} ${to[1]}`} stroke={t.light} strokeWidth={w} strokeLinecap="round" />);
    if (d > 0) els.push(<path key={`${key}b`} d={stroke([from, to], { w: 1, start: 0.3, end: 0.3, seed: 3, steps: 2 })} fill={t.deep} opacity={0.6} />);
  };
  const s = SCARS[scar];
  if (s === "Cheek scar") scarAt(P(a.cheekR[0] - 4, a.cheekR[1] - 6), P(a.cheekR[0] + 5, a.cheekR[1] + 7), "sc");
  if (s === "Eyebrow scar") scarAt(P(a.browR[0] + 3, a.browR[1] - 7), P(a.browR[0] + 6, a.browR[1] + 5), "sc");
  if (s === "Chin scar") scarAt(P(CX - f.chinW * 0.55, f.chinY - 15), P(CX - f.chinW * 0.15, f.chinY - 9), "sc");
  const m = MARKS[mark];
  if (m === "Beauty mark left") els.push(<circle key="mk" cx={a.mouthL[0] - 3} cy={a.mouthL[1] - 9} r={d === 0 ? 2.4 : 1.8} fill={INK} opacity={0.75} />);
  if (m === "Beauty mark right") els.push(<circle key="mk" cx={a.noseBase[0] + f.nose.w + 11} cy={a.noseBase[1] - 5} r={d === 0 ? 2.4 : 1.8} fill={INK} opacity={0.75} />);
  return <g>{els}</g>;
}
