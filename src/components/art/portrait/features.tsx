import { ACCESSORIES, EYE_COLORS, INK } from "@/engine/appearance/options";
import type { AgeLook } from "@/engine/appearance/age";
import { CX, darken, lighten, mix, smooth, type Contour, type Pt } from "./geometry";

export const EYE_Y = 108;
export const BROW_Y = 94;
export const NOSE_BASE = 138;
export const MOUTH_Y = 153;

export interface Skin {
  base: string;
  shade: string;
  deep: string;
  light: string;
  lip: string;
  lipLow: string;
}

export function skinPalette(base: string): Skin {
  return {
    base,
    shade: mix(darken(base, 0.18), "#7a2f1a", 0.12),
    deep: mix(darken(base, 0.4), "#4a1a10", 0.15),
    light: lighten(base, 0.2),
    lip: mix(base, "#9c3a30", 0.4),
    lipLow: mix(base, "#b24c40", 0.3),
  };
}

const sw = (n: number) => ({ strokeWidth: n, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

// ------------------------------------------------------------------ eyes

interface EyeSpec { w: number; h: number; hl: number; tilt: number; ir: number; hood?: number; deep?: boolean }
const EYES: EyeSpec[] = [
  { w: 12, h: 6, hl: 4.6, tilt: -1, ir: 4.3 },
  { w: 10.5, h: 7.6, hl: 6, tilt: 0, ir: 4.9 },
  { w: 13, h: 7, hl: 5.6, tilt: 0, ir: 4.9 },
  { w: 12, h: 4.2, hl: 3.6, tilt: 0, ir: 3.6 },
  { w: 12, h: 5, hl: 4.6, tilt: 0, ir: 4.2, hood: 1 },
  { w: 12, h: 5.6, hl: 4, tilt: -3, ir: 4.1 },
  { w: 12, h: 5.6, hl: 4.6, tilt: 2.6, ir: 4.2 },
  { w: 11, h: 5, hl: 4, tilt: -0.5, ir: 4, deep: true },
];

export function Eyes({ shape, color, spacing, skin, age }: { shape: number; color: number; spacing: number; skin: Skin; age: AgeLook }) {
  const raw = EYES[shape] ?? EYES[0];
  const K = 1.22;
  const e = { ...raw, w: raw.w * K, h: raw.h * K, hl: raw.hl * K, ir: raw.ir * K };
  const cx = 29 * spacing; // distance of eye centre from the face axis
  const xi = CX + cx - e.w;
  const xo = CX + cx + e.w;
  const y = EYE_Y;
  const upper = `M${xi} ${y}C${xi + e.w * 0.5} ${y - e.h * 1.28} ${xo - e.w * 0.55} ${y - e.h * 1.15 + e.tilt} ${xo} ${y + e.tilt}`;
  const lower = `C${xo - e.w * 0.5} ${y + e.hl * 1.15 + e.tilt} ${xi + e.w * 0.5} ${y + e.hl * 1.25} ${xi} ${y}Z`;
  const ix = xi + e.w * 1.05;
  const iy = y - (e.h - e.hl) * 0.15 + e.tilt * 0.35;
  const iris = EYE_COLORS[color] ?? EYE_COLORS[0];
  const one = (
    <g>
      {e.deep && <path d={`M${xi - 3} ${y - 3}Q${CX + cx} ${y - e.h * 2.3} ${xo + 3} ${y + e.tilt - 2}Q${CX + cx} ${y - 1} ${xi - 3} ${y - 3}Z`} fill={skin.shade} opacity={0.55} />}
      <path d={upper + lower} fill="#f4efe6" stroke={INK} {...sw(1.4)} />
      <circle cx={ix} cy={iy} r={e.ir} fill={iris} />
      <circle cx={ix} cy={iy} r={e.ir * 0.52} fill={INK} />
      <circle cx={ix - e.ir * 0.35} cy={iy - e.ir * 0.4} r={e.ir * 0.22} fill="#fff" opacity={0.9} />
      {/* The upper lid sits over the iris and carries the heavier ink line. */}
      <path d={upper} fill="none" stroke={INK} {...sw(2.7)} />
      {e.hood ? <path d={`M${xi + 1} ${y - e.h * 1.5}Q${CX + cx} ${y - e.h * 2.2} ${xo + 1} ${y - e.h * 1.1 + e.tilt}`} fill="none" stroke={skin.deep} opacity={0.75} {...sw(1.6)} /> : null}
      {age.lines > 0.35 && <path d={`M${xo + 1} ${y + e.tilt + 2}l4 1.5M${xo} ${y + e.tilt + 4.5}l4 3`} stroke={skin.deep} opacity={0.4 * age.lines} {...sw(1)} fill="none" />}
    </g>
  );
  return (
    <g>
      {one}
      <g transform={`translate(${CX * 2} 0) scale(-1 1)`}>{one}</g>
    </g>
  );
}

// ------------------------------------------------------------------ eyebrows

interface BrowSpec { thick: number; arch: number; peak: number; len: number; slant: number; ragged?: boolean }
const BROWS: BrowSpec[] = [
  { thick: 4.2, arch: 1.6, peak: 0.5, len: 29, slant: 0 },
  { thick: 3.8, arch: 5.2, peak: 0.55, len: 29, slant: 0 },
  { thick: 2.2, arch: 5.4, peak: 0.55, len: 30, slant: 0 },
  { thick: 4.1, arch: 3.6, peak: 0.66, len: 29, slant: 0.5 },
  { thick: 6.6, arch: 2.2, peak: 0.5, len: 28, slant: 0, ragged: true },
  { thick: 2.4, arch: 0.8, peak: 0.5, len: 29, slant: 0 },
  { thick: 4.4, arch: 4.2, peak: 0.45, len: 26, slant: 0 },
  { thick: 5.2, arch: 3, peak: 0.6, len: 30, slant: 3.2 },
];

export function Brows({ style, color, spacing, angle, skin }: { style: number; color: string; spacing: number; angle: number; skin: Skin }) {
  void skin;
  const b = BROWS[style] ?? BROWS[0];
  const xi = CX + 29 * spacing - 16;
  const yi = BROW_Y + b.slant;
  const xo = xi + b.len * 1.16;
  const yo = BROW_Y + 1.5;
  const xp = xi + b.len * 1.16 * b.peak;
  const yp = BROW_Y - b.arch;
  const t = b.thick * 1.12;
  const top: Pt[] = [[xi, yi - t * 0.55], [xp, yp - t * 0.55], [xo, yo - t * 0.2]];
  const bottom: Pt[] = [[xo, yo + t * 0.1], [xp, yp + t * 0.5], [xi, yi + t * 0.5]];
  const d = `${smooth(top)}L${bottom[0][0]} ${bottom[0][1]}${smooth(bottom).replace("M", "L")}Z`;
  const one = (
    <g transform={`rotate(${angle} ${xi} ${yi})`}>
      <path d={d} fill={color} stroke={color} {...sw(0.8)} />
      {b.ragged && <path d={`M${xi + 2} ${yi - t * 0.6}l1.5 -2.4M${xi + 9} ${yp - t * 0.6}l1 -2.5M${xi + 17} ${yp - t * 0.5}l1.5 -2.2`} stroke={color} {...sw(1.2)} />}
    </g>
  );
  return (
    <g>
      {one}
      <g transform={`translate(${CX * 2} 0) scale(-1 1)`}>{one}</g>
    </g>
  );
}

// ------------------------------------------------------------------ nose

interface NoseSpec { len: number; w: number; tip: number; flare: number; hump?: number; nostrils?: boolean }
const NOSES: NoseSpec[] = [
  { len: 22, w: 8, tip: 1.6, flare: 1 },
  { len: 17, w: 7, tip: 3, flare: 1 },
  { len: 20, w: 10.5, tip: 2, flare: 3 },
  { len: 23, w: 6, tip: 1, flare: 0 },
  { len: 25, w: 7.5, tip: 1, flare: 1, hump: 2.2 },
  { len: 20, w: 11, tip: 2, flare: 4 },
  { len: 19, w: 7.5, tip: 3.6, flare: 1.5, nostrils: true },
  { len: 28, w: 8, tip: 1.6, flare: 1 },
  { len: 21, w: 9, tip: 2.4, flare: 2 },
  { len: 18, w: 10, tip: 2, flare: 3 },
];

export function Nose({ style, scale, skin }: { style: number; scale: number; skin: Skin }) {
  const n = NOSES[style] ?? NOSES[0];
  const len = n.len * scale * 1.12;
  const w = n.w * scale * 1.15;
  const nb = NOSE_BASE; // bottom of the nose
  const top = nb - len;
  const hump = n.hump ?? 0;
  return (
    <g>
      {/* shaded side of the nose */}
      <path d={`M${CX + 1.5} ${top + 4}C${CX + 3 + hump} ${top + len * 0.45} ${CX + w - 1} ${nb - 8} ${CX + w + n.flare * 0.4} ${nb - 3}L${CX + w * 0.5} ${nb}L${CX + 1} ${nb - 1}Z`} fill={skin.shade} opacity={0.55} />
      {/* bridge */}
      <path d={`M${CX - 3} ${top + 2}C${CX - 3.5 - hump} ${top + len * 0.5} ${CX - w + 1.5} ${nb - 9} ${CX - w - n.flare * 0.4} ${nb - 4}`} fill="none" stroke={INK} opacity={0.55} {...sw(1.4)} />
      {/* wings and nostrils */}
      <path d={`M${CX - w - n.flare * 0.5} ${nb - 6}C${CX - w - n.flare - 1} ${nb - 1} ${CX - w + 1} ${nb + 1.6} ${CX - w * 0.45} ${nb + 0.8}`} fill="none" stroke={INK} {...sw(1.8)} />
      <path d={`M${CX + w + n.flare * 0.5} ${nb - 6}C${CX + w + n.flare + 1} ${nb - 1} ${CX + w - 1} ${nb + 1.6} ${CX + w * 0.45} ${nb + 0.8}`} fill="none" stroke={INK} {...sw(1.8)} />
      <path d={`M${CX - w * 0.45} ${nb + 0.8}Q${CX} ${nb + n.tip} ${CX + w * 0.45} ${nb + 0.8}`} fill="none" stroke={INK} {...sw(1.4)} />
      {n.nostrils ? <path d={`M${CX - w * 0.55} ${nb - 0.4}l1.4 -1.6M${CX + w * 0.55} ${nb - 0.4}l-1.4 -1.6`} stroke={INK} {...sw(1.6)} /> : null}
      <path d={`M${CX - w * 0.7} ${nb + 3.2}Q${CX} ${nb + 5.4} ${CX + w * 0.7} ${nb + 3.2}`} fill="none" stroke={skin.deep} opacity={0.4} {...sw(1.2)} />
    </g>
  );
}

// ------------------------------------------------------------------ mouth

interface MouthSpec { w: number; c: number; up: number; low: number; smirk?: number; teeth?: number; open?: number }
const MOUTHS: MouthSpec[] = [
  { w: 11, c: 0, up: 2.2, low: 3.4 },
  { w: 12, c: 1.8, up: 2.2, low: 3.4 },
  { w: 11, c: 1, up: 2.2, low: 3.2, smirk: 2.6 },
  { w: 14, c: 3.2, up: 2, low: 4.4, teeth: 4 },
  { w: 11, c: 0, up: 1.1, low: 1.9 },
  { w: 11.5, c: 0.3, up: 3.8, low: 5 },
  { w: 16, c: 4.2, up: 2, low: 5, teeth: 4.6 },
  { w: 8, c: 0.2, up: 2, low: 2.9 },
  { w: 12, c: -1.4, up: 2, low: 3 },
  { w: 11, c: 0.5, up: 2.4, low: 4, open: 5.4, teeth: 3 },
];

export function Mouth({ style, skin }: { style: number; skin: Skin }) {
  const raw = MOUTHS[style] ?? MOUTHS[0];
  const m = { ...raw, w: raw.w * 1.18, up: raw.up * 1.15, low: raw.low * 1.15 };
  const y = MOUTH_Y;
  const xl = CX - m.w;
  const xr = CX + m.w;
  const yl = y - m.c + (m.smirk ?? 0) * 0.4;
  const yr = y - m.c - (m.smirk ?? 0);
  const mid = y + 0.8 + Math.max(0, m.c) * 0.4;
  const lineD = `M${xl} ${yl}C${CX - m.w * 0.45} ${mid + 0.6} ${CX + m.w * 0.45} ${mid + 0.6} ${xr} ${yr}`;
  const open = m.open ?? (m.teeth ? m.teeth * 0.9 : 0);
  return (
    <g>
      {/* lower lip, then the opening, then the upper lip, so the lips always overlap the teeth */}
      <path d={`M${xl + 2} ${yl + 1}C${CX - m.w * 0.4} ${mid + open + m.low * 1.4} ${CX + m.w * 0.4} ${mid + open + m.low * 1.4} ${xr - 2} ${yr + 1}Z`} fill={skin.lipLow} opacity={0.85} />
      {open > 0 && (
        <g>
          <path d={`M${xl} ${yl}C${CX - m.w * 0.45} ${mid + 0.4} ${CX + m.w * 0.45} ${mid + 0.4} ${xr} ${yr}C${CX + m.w * 0.5} ${mid + open * 1.5 + 1} ${CX - m.w * 0.5} ${mid + open * 1.5 + 1} ${xl} ${yl}Z`} fill="#3a1612" />
          <path d={`M${xl + 1.5} ${yl + 0.4}C${CX - m.w * 0.45} ${mid + 0.6} ${CX + m.w * 0.45} ${mid + 0.6} ${xr - 1.5} ${yr + 0.4}L${xr - 3} ${yr + (m.teeth ?? 3) * 0.9}C${CX + m.w * 0.4} ${mid + (m.teeth ?? 3) + 0.6} ${CX - m.w * 0.4} ${mid + (m.teeth ?? 3) + 0.6} ${xl + 3} ${yl + (m.teeth ?? 3) * 0.9}Z`} fill="#f7f2ea" />
        </g>
      )}
      <path d={`M${xl} ${yl}C${CX - m.w * 0.5} ${mid - m.up * 1.6} ${CX - 2} ${mid - m.up * 1.3} ${CX} ${mid - m.up * 0.7}C${CX + 2} ${mid - m.up * 1.3} ${CX + m.w * 0.5} ${mid - m.up * 1.6} ${xr} ${yr}C${CX + m.w * 0.45} ${mid + 0.6} ${CX - m.w * 0.45} ${mid + 0.6} ${xl} ${yl}Z`} fill={skin.lip} />
      <path d={lineD} fill="none" stroke={INK} {...sw(1.9)} />
      {m.c >= 1.5 && <path d={`M${xl - 1.4} ${yl - 1}q-1.4 1.6 -0.2 3.2M${xr + 1.4} ${yr - 1}q1.4 1.6 0.2 3.2`} fill="none" stroke={skin.deep} opacity={0.55} {...sw(1.2)} />}
      <path d={`M${CX - m.w * 0.4} ${mid + m.low + open + 3.4}Q${CX} ${mid + m.low + open + 5} ${CX + m.w * 0.4} ${mid + m.low + open + 3.4}`} fill="none" stroke={skin.deep} opacity={0.35} {...sw(1.1)} />
    </g>
  );
}

// ------------------------------------------------------------------ ears, neck, kit

const EAR_SIZE = [
  { w: 10, h: 20 },
  { w: 12.5, h: 24 },
  { w: 15.5, h: 28 },
];

export function Ears({ style, scale, contour, skin }: { style: number; scale: number; contour: Contour; skin: Skin }) {
  const s = EAR_SIZE[style] ?? EAR_SIZE[1];
  const w = s.w * scale;
  const h = s.h * scale;
  const yT = 104;
  const x0 = CX + contour.half(yT + h / 2) - 3;
  const ear = (
    <g>
      <path d={`M${x0} ${yT}C${x0 + w * 0.9} ${yT - 3} ${x0 + w * 1.15} ${yT + h * 0.55} ${x0 + w * 0.35} ${yT + h * 0.95}C${x0 + w * 0.1} ${yT + h * 1.05} ${x0 - 2} ${yT + h * 0.95} ${x0 - 3} ${yT + h * 0.88}Z`} fill={skin.base} stroke={INK} {...sw(2.2)} />
      <path d={`M${x0 + 2.5} ${yT + h * 0.2}C${x0 + w * 0.75} ${yT + h * 0.1} ${x0 + w * 0.85} ${yT + h * 0.5} ${x0 + w * 0.25} ${yT + h * 0.75}`} fill="none" stroke={skin.deep} opacity={0.7} {...sw(1.4)} />
    </g>
  );
  return (
    <g>
      {ear}
      <g transform={`translate(${CX * 2} 0) scale(-1 1)`}>{ear}</g>
    </g>
  );
}

export function Neck({ contour, skin, width }: { contour: Contour; skin: Skin; width: number }) {
  const nw = Math.max(21, Math.min(30, contour.half(contour.chin - 22) * 0.6 + 12)) * width;
  const y0 = contour.chin - 34;
  return (
    <g>
      <path d={`M${CX - nw} ${y0}L${CX - nw - 1} 206Q${CX} 222 ${CX + nw + 1} 206L${CX + nw} ${y0}Z`} fill={skin.base} stroke={INK} {...sw(2.4)} />
      <path d={`M${CX - nw + 1} ${y0 + 12}L${CX + nw - 1} ${y0 + 12}L${CX + nw - 1} ${contour.chin + 8}Q${CX} ${contour.chin + 36} ${CX - nw + 1} ${contour.chin + 8}Z`} fill={skin.shade} opacity={0.9} />
      <path d={`M${CX - nw * 0.55} 199Q${CX - 3} 208 ${CX - 4} 216M${CX + nw * 0.55} 199Q${CX + 3} 208 ${CX + 4} 216`} fill="none" stroke={skin.deep} opacity={0.35} {...sw(1.3)} />
    </g>
  );
}

export function Shirt({ kit }: { kit: string }) {
  return (
    <g>
      <path d="M-4 244V218C-4 206 20 199 66 192L134 192C180 199 204 206 204 218V244Z" fill={kit} stroke={INK} {...sw(2.6)} />
      <path d="M14 244V214M186 244V214" stroke={darken(kit, 0.18)} opacity={0.55} {...sw(5)} />
    </g>
  );
}

export function Collar({ trim }: { trim: string }) {
  return (
    <g>
      <path d="M62 190L78 187L100 218L86 217L66 200Z" fill={trim} stroke={INK} {...sw(2.2)} />
      <path d="M138 190L122 187L100 218L114 217L134 200Z" fill={trim} stroke={INK} {...sw(2.2)} />
    </g>
  );
}

export function Accessory({ style, contour, hair }: { style: number; contour: Contour; hair: string }) {
  void hair;
  const name = ACCESSORIES[style];
  if (name === "Headband") {
    const y = 74;
    const x = CX + contour.half(y) + 4;
    return <path d={`M${CX - x + CX} ${y}Q${CX} ${y - 8} ${x} ${y}L${x} ${y + 8}Q${CX} ${y} ${CX * 2 - x} ${y + 8}Z`} fill="#f3efe4" stroke={INK} {...sw(2)} />;
  }
  if (name === "Ear stud") {
    const x = CX + contour.half(128) + 2;
    return <circle cx={x} cy={127} r={1.9} fill="#e8d28a" stroke={INK} strokeWidth={0.9} />;
  }
  return null;
}
