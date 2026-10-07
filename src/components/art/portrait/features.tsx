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
  const lum = (parseInt(base.slice(1, 3), 16) * 0.3 + parseInt(base.slice(3, 5), 16) * 0.59 + parseInt(base.slice(5, 7), 16) * 0.11) / 255;
  return {
    base,
    shade: mix(darken(base, 0.2 + 0.06 * lum), "#7a2f1a", 0.14),
    deep: mix(darken(base, 0.42), "#4a1a10", 0.18),
    // darker skin needs a stronger, warmer highlight to read at all
    light: mix(lighten(base, 0.16 + 0.2 * (1 - lum)), "#ffd9b0", 0.12),
    lip: mix(base, "#9c3a30", 0.4),
    lipLow: mix(base, "#b24c40", 0.3),
  };
}

const sw = (n: number) => ({ strokeWidth: n, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

// ------------------------------------------------------------------ eyes

/** w/h: half-width and lid height. lo: how far the lower lid drops. tilt: outer corner height (negative lifts it). lid: iris covered by the upper lid. */
interface EyeSpec { w: number; h: number; lo: number; tilt: number; ir: number; lid: number; hood?: number; deep?: boolean; heavy?: number; bag?: number }
const EYES: EyeSpec[] = [
  { w: 10, h: 4.6, lo: 3.4, tilt: -0.8, ir: 3.5, lid: 0.28 }, // almond
  { w: 8.6, h: 5.4, lo: 4.2, tilt: 0, ir: 3.9, lid: 0.2 }, // round
  { w: 11, h: 5, lo: 3.8, tilt: 0, ir: 3.8, lid: 0.22 }, // wide
  { w: 10, h: 3.2, lo: 2.4, tilt: 0, ir: 3, lid: 0.4, heavy: 1 }, // narrow
  { w: 10, h: 4, lo: 3, tilt: 0, ir: 3.4, lid: 0.45, hood: 1, heavy: 1 }, // hooded
  { w: 10, h: 4.2, lo: 3.1, tilt: -2.6, ir: 3.4, lid: 0.3 }, // upturned
  { w: 10, h: 4.2, lo: 3.4, tilt: 2.4, ir: 3.4, lid: 0.32, bag: 1 }, // downturned
  { w: 9, h: 3.8, lo: 2.8, tilt: -0.4, ir: 3.3, lid: 0.35, deep: true }, // deep-set
];

export function Eyes({ shape, color, spacing, skin, age, uid }: { shape: number; color: number; spacing: number; skin: Skin; age: AgeLook; uid: string }) {
  const raw = EYES[shape] ?? EYES[0];
  const K = 1.14;
  const e = { ...raw, w: raw.w * K, h: raw.h * K, lo: raw.lo * K, ir: raw.ir * K };
  const iris = EYE_COLORS[color] ?? EYE_COLORS[0];
  const cx = 28 * spacing;
  const one = (side: 0 | 1) => {
    // The second eye is a hair smaller and lower: real faces are not mirror images.
    const k = side ? { h: 0.93, dy: 0.7, tilt: 0.5 } : { h: 1, dy: 0, tilt: 0 };
    const h = e.h * k.h;
    const tilt = e.tilt + k.tilt;
    const xi = CX + cx - e.w;
    const xo = CX + cx + e.w;
    const y = EYE_Y + k.dy;
    const yo = y + tilt;
    const upper = `M${xi} ${y}C${xi + e.w * 0.45} ${y - h * 1.5} ${xo - e.w * 0.5} ${yo - h * 1.4} ${xo} ${yo}`;
    const lowerBack = `C${xo - e.w * 0.45} ${yo + e.lo * 1.2} ${xi + e.w * 0.5} ${y + e.lo * 1.25} ${xi} ${y}`;
    const shape = `${upper}${lowerBack}Z`;
    const id = `${uid}e${side}`;
    const ix = xi + e.w * 1.1; // the iris looks slightly inwards towards the nose on the viewer's right eye
    const iy = y - h * 0.35 + tilt * 0.3 + (e.lid > 0.3 ? 0.4 : 0);
    const droop = age.lines > 0.4 || e.bag;
    return (
      <g key={side}>
        <defs>
          <clipPath id={id}>
            <path d={shape} />
          </clipPath>
        </defs>
        {/* socket shadow under the brow ridge */}
        <path d={`M${xi - 3} ${y - 2}Q${CX + cx} ${y - h * (e.deep ? 3.6 : 2.7)} ${xo + 3} ${yo - 1}Q${CX + cx} ${y - h * 0.9} ${xi - 3} ${y - 2}Z`} fill={skin.shade} opacity={e.deep ? 0.6 : 0.34} />
        <path d={shape} fill="#ece6d9" />
        <g clipPath={`url(#${id})`}>
          <circle cx={ix} cy={iy} r={e.ir} fill={iris} />
          <circle cx={ix} cy={iy} r={e.ir} fill="none" stroke={INK} strokeWidth={0.9} opacity={0.7} />
          <circle cx={ix} cy={iy} r={e.ir * 0.46} fill={INK} />
          <circle cx={ix - e.ir * 0.32} cy={iy - e.ir * 0.1} r={e.ir * 0.2} fill="#fff" opacity={0.85} />
          {/* the upper lid casts a soft shadow across the eye and covers the top of the iris */}
          <path d={`${upper}L${xo} ${yo - 8}L${xi} ${y - 8}Z`} fill={skin.base} />
          <path d={`${upper}L${xo} ${yo + h * (0.55 + e.lid)}C${xo - e.w * 0.6} ${yo + h * (0.85 + e.lid)} ${xi + e.w * 0.6} ${y + h * (0.85 + e.lid)} ${xi} ${y + h * 0.5}Z`} fill={INK} opacity={0.18} />
        </g>
        {/* upper lid: heavy ink, flicking out at the outer corner */}
        <path d={upper} fill="none" stroke={INK} {...sw(e.heavy ? 3 : 2.5)} />
        <path d={`M${xo - 1} ${yo - 0.2}l${3.2} ${-0.5 + (tilt > 1 ? 1.4 : 0)}`} stroke={INK} {...sw(1.8)} />
        <path d={`M${xi} ${y}l-1.6 0.6`} stroke={INK} {...sw(1.4)} />
        {/* lower lid indication */}
        <path d={`M${xi + 2} ${y + e.lo * 1.05}Q${CX + cx} ${y + e.lo * 1.4} ${xo - 1} ${yo + e.lo * 0.7}`} fill="none" stroke={skin.deep} opacity={0.7} {...sw(1)} />
        {/* lid crease */}
        <path d={`M${xi + 1} ${y - h * 1.35}Q${CX + cx + 1} ${y - h * (e.hood ? 2.9 : 2.25)} ${xo + 1} ${yo - h * 1.2}`} fill="none" stroke={skin.deep} opacity={e.hood ? 0.8 : 0.5} {...sw(e.hood ? 1.5 : 1.1)} />
        {droop && <path d={`M${xi + 1} ${y + e.lo * 1.9}Q${CX + cx} ${y + e.lo * 2.7} ${xo - 1} ${yo + e.lo * 1.7}`} fill="none" stroke={skin.deep} opacity={0.3 + 0.3 * age.lines} {...sw(1.1)} />}
        {age.lines > 0.35 && <path d={`M${xo + 2} ${yo + 1}l3.6 1.2M${xo + 2} ${yo + 3.2}l3.2 2.4`} stroke={skin.deep} opacity={0.4 * age.lines} {...sw(0.9)} fill="none" />}
      </g>
    );
  };
  return (
    <g>
      <g transform={`translate(${CX * 2} 0) scale(-1 1)`}>{one(1)}</g>
      {one(0)}
    </g>
  );
}

// ------------------------------------------------------------------ eyebrows

interface BrowSpec { thick: number; arch: number; peak: number; len: number; slant: number; ragged?: boolean; low?: number }
const BROWS: BrowSpec[] = [
  { thick: 3.8, arch: 1.4, peak: 0.5, len: 27, slant: 0 },
  { thick: 3.4, arch: 4.6, peak: 0.55, len: 27, slant: 0 },
  { thick: 1.9, arch: 4.8, peak: 0.55, len: 28, slant: 0 },
  { thick: 3.8, arch: 3.2, peak: 0.66, len: 27, slant: 0.5 },
  { thick: 6, arch: 2, peak: 0.5, len: 26, slant: 0, ragged: true },
  { thick: 2.1, arch: 0.7, peak: 0.5, len: 27, slant: 0 },
  { thick: 4, arch: 3.8, peak: 0.45, len: 24, slant: 0 },
  { thick: 4.8, arch: 2.6, peak: 0.6, len: 28, slant: 3.4 },
  { thick: 5.6, arch: 1.2, peak: 0.45, len: 27, slant: 1.4, ragged: true, low: 3 },
  { thick: 3, arch: 3.2, peak: 0.5, len: 33, slant: -0.4 },
];

export function Brows({ style, color, spacing, angle, skin }: { style: number; color: string; spacing: number; angle: number; skin: Skin }) {
  const b = BROWS[style] ?? BROWS[0];
  const one = (side: 0 | 1) => {
    // Subtle asymmetry: the second brow sits a touch lower and flatter.
    const a = side ? angle * 0.55 + 0.9 : angle;
    const dy = (side ? 0.9 : 0) + (b.low ?? 0);
    const xi = CX + 28 * spacing - 15;
    const yi = BROW_Y + b.slant + dy;
    const xo = xi + b.len * 1.1;
    const yo = BROW_Y + 2 + dy;
    const xp = xi + b.len * 1.1 * b.peak;
    const yp = BROW_Y - b.arch + dy;
    const t = b.thick;
    const top: Pt[] = [[xi, yi - t * 0.5], [xp, yp - t * 0.55], [xo, yo - t * 0.15]];
    const bottom: Pt[] = [[xo, yo + t * 0.1], [xp, yp + t * 0.5], [xi, yi + t * 0.55]];
    const d = `${smooth(top)}L${bottom[0][0]} ${bottom[0][1]}${smooth(bottom).replace("M", "L")}Z`;
    // Hair flicks along the brow break up the solid shape.
    const flicks: string[] = [];
    for (let i = 0; i < 6; i++) {
      const u = i / 5;
      const x = xi + (xo - xi) * u;
      const yy = u < b.peak ? yi + (yp - yi) * (u / b.peak) : yp + (yo - yp) * ((u - b.peak) / (1 - b.peak));
      flicks.push(`M${(x - 0.6).toFixed(1)} ${(yy + t * 0.3).toFixed(1)}l${(1.6 + (i % 2)).toFixed(1)} ${(-t * 0.55 - 0.6).toFixed(1)}`);
    }
    return (
      <g key={side} transform={`rotate(${a} ${xi} ${yi})`}>
        <path d={d} fill={color} stroke={color} {...sw(0.8)} />
        <path d={flicks.join("")} stroke={darken(color, 0.3)} opacity={0.7} {...sw(0.8)} fill="none" />
        {b.ragged && <path d={`M${xi + 2} ${yi - t * 0.6}l1.5 -2.4M${xi + 9} ${yp - t * 0.6}l1 -2.5M${xi + 17} ${yp - t * 0.5}l1.5 -2.2`} stroke={color} {...sw(1.2)} />}
      </g>
    );
  };
  void skin;
  return (
    <g>
      {one(0)}
      <g transform={`translate(${CX * 2} 0) scale(-1 1)`}>{one(1)}</g>
    </g>
  );
}

// ------------------------------------------------------------------ nose

/** len: bridge length. w: wing half-width. bw: bridge half-width. tw: tip half-width. crook: bridge sideways bend. */
interface NoseSpec { len: number; w: number; bw: number; tw: number; tip: number; flare: number; hump?: number; crook?: number; up?: number }
const NOSES: NoseSpec[] = [
  { len: 22, w: 8.5, bw: 3.2, tw: 4.4, tip: 1.6, flare: 1 }, // straight
  { len: 16, w: 7.4, bw: 3, tw: 4.8, tip: 2.6, flare: 1, up: 0.6 }, // button
  { len: 20, w: 11, bw: 4.4, tw: 6.2, tip: 2, flare: 3 }, // broad
  { len: 24, w: 6.2, bw: 2.4, tw: 3, tip: 1, flare: 0 }, // narrow
  { len: 25, w: 8, bw: 3, tw: 4, tip: 1.2, flare: 1, hump: 2.6 }, // roman
  { len: 20, w: 11.5, bw: 4, tw: 6, tip: 2, flare: 4 }, // wide base
  { len: 18, w: 7.8, bw: 3, tw: 4.4, tip: 3.4, flare: 1.5, up: 1.6 }, // upturned
  { len: 29, w: 8.2, bw: 3.2, tw: 4.2, tip: 1.8, flare: 1 }, // long
  { len: 21, w: 9.2, bw: 3.6, tw: 5.4, tip: 2.4, flare: 2 }, // soft
  { len: 19, w: 10, bw: 5.2, tw: 5.6, tip: 2, flare: 3 }, // flat bridge
  { len: 24, w: 8.4, bw: 3.2, tw: 4.4, tip: 1.6, flare: 1, crook: 2.6, hump: 1 }, // crooked
  { len: 21, w: 9, bw: 3.2, tw: 7, tip: 2.6, flare: 2.2 }, // broad tip
];

export function Nose({ style, scale, skin }: { style: number; scale: number; skin: Skin }) {
  const n = NOSES[style] ?? NOSES[0];
  const len = n.len * scale;
  const k = scale;
  const w = n.w * k;
  const bw = n.bw * k;
  const tw = n.tw * k;
  const nb = NOSE_BASE;
  const top = nb - len;
  const hump = n.hump ?? 0;
  const cr = n.crook ?? 0;
  const up = n.up ?? 0;
  const wingY = nb - 5;
  // light comes from the upper left: the right-hand plane of the nose is in shade
  const planeR = `M${CX + bw} ${top + 2}C${CX + bw + hump * 0.6 + cr} ${top + len * 0.45} ${CX + tw + 0.5 + cr * 0.4} ${nb - 10} ${CX + w + n.flare * 0.4} ${wingY}C${CX + w + n.flare} ${nb} ${CX + w * 0.7} ${nb + 1.4} ${CX + tw * 0.5} ${nb + 0.6}L${CX + 1} ${nb - 4}Z`;
  return (
    <g>
      <path d={planeR} fill={skin.shade} opacity={0.62} />
      {/* soft light on the bridge and the ball of the tip */}
      <path d={`M${CX - bw * 0.2 + cr * 0.3} ${top + 5}C${CX - bw * 0.2 + cr * 0.3} ${top + len * 0.45} ${CX - 1} ${nb - 12} ${CX - 1} ${nb - 7}`} fill="none" stroke={skin.light} opacity={0.55} {...sw(2.6)} />
      <ellipse cx={CX - 1} cy={nb - 3.2} rx={tw * 0.45} ry={1.8} fill={skin.light} opacity={0.5} />
      {/* bridge contours: a faint left edge, a firmer right edge that carries the shadow */}
      <path d={`M${CX - bw - 0.5} ${top + 3}C${CX - bw - hump * 0.4 + cr * 0.6} ${top + len * 0.5} ${CX - tw - 0.5} ${nb - 10} ${CX - w - n.flare * 0.4} ${wingY}`} fill="none" stroke={INK} opacity={0.45} {...sw(1.2)} />
      <path d={`M${CX + bw} ${top + 2}C${CX + bw + hump * 0.6 + cr} ${top + len * 0.45} ${CX + tw + 0.5 + cr * 0.4} ${nb - 10} ${CX + w + n.flare * 0.4} ${wingY}`} fill="none" stroke={INK} opacity={0.75} {...sw(1.5)} />
      {/* alar wings */}
      <path d={`M${CX - w - n.flare * 0.4} ${wingY}C${CX - w - n.flare - 1.4} ${nb - 1} ${CX - w + 0.5} ${nb + 2} ${CX - tw * 0.55} ${nb + 0.8}`} fill="none" stroke={INK} {...sw(1.9)} />
      <path d={`M${CX + w + n.flare * 0.4} ${wingY}C${CX + w + n.flare + 1.4} ${nb - 1} ${CX + w - 0.5} ${nb + 2} ${CX + tw * 0.55} ${nb + 0.8}`} fill="none" stroke={INK} {...sw(1.9)} />
      {/* nostrils, more open on upturned noses */}
      <path d={`M${CX - tw * 0.95} ${nb + 0.4}q${tw * 0.35} ${-1.8 - up} ${tw * 0.85} 0`} fill={INK} stroke={INK} opacity={0.85} {...sw(1.1)} />
      <path d={`M${CX + tw * 0.95} ${nb + 0.4}q${-tw * 0.35} ${-1.8 - up} ${-tw * 0.85} 0`} fill={INK} stroke={INK} opacity={0.85} {...sw(1.1)} />
      <path d={`M${CX - tw * 0.55} ${nb + 0.8}Q${CX} ${nb + n.tip + 0.6} ${CX + tw * 0.55} ${nb + 0.8}`} fill="none" stroke={INK} opacity={0.7} {...sw(1.2)} />
      {/* shadow under the nose */}
      <path d={`M${CX - w * 0.75} ${nb + 3.2}Q${CX} ${nb + 6} ${CX + w * 0.75} ${nb + 3.2}`} fill="none" stroke={skin.deep} opacity={0.4} {...sw(1.6)} />
    </g>
  );
}

// ------------------------------------------------------------------ mouth

/** c: corner lift (negative turns the mouth down). up/low: lip thickness. open: dark parting. teeth: a thin strip of teeth. */
interface MouthSpec { w: number; c: number; up: number; low: number; smirk?: number; teeth?: number; open?: number; bow?: number }
const MOUTHS: MouthSpec[] = [
  { w: 10.5, c: 0, up: 2.2, low: 3.4, bow: 1 }, // neutral
  { w: 11, c: 1.1, up: 2.2, low: 3.3, bow: 1 }, // slight smile
  { w: 10.5, c: 0.4, up: 2.2, low: 3.2, smirk: 1.9 }, // smirk
  { w: 12, c: 1.9, up: 2, low: 3.6, teeth: 2.6 }, // smile
  { w: 11, c: -0.2, up: 1.1, low: 1.8 }, // thin
  { w: 10.5, c: 0, up: 3.6, low: 5, bow: 1.4 }, // full
  { w: 14, c: 0.3, up: 2.2, low: 3.4 }, // wide
  { w: 8, c: 0.1, up: 2, low: 2.8 }, // small
  { w: 10.5, c: -1.8, up: 2, low: 2.8 }, // stern
  { w: 10.5, c: 0, up: 2.4, low: 3.6, open: 2.4 }, // parted
];

export function Mouth({ style, skin }: { style: number; skin: Skin }) {
  const m = MOUTHS[style] ?? MOUTHS[0];
  const y = MOUTH_Y;
  const xl = CX - m.w;
  const xr = CX + m.w;
  // the corners are never at exactly the same height
  const yl = y - m.c + (m.smirk ?? 0) * 0.4 + 0.3;
  const yr = y - m.c - (m.smirk ?? 0);
  const mid = y + 0.6 + Math.max(0, m.c) * 0.25;
  const open = m.open ?? 0;
  const bow = m.bow ?? 0;
  const lineD = `M${xl} ${yl}C${CX - m.w * 0.45} ${mid + 0.3} ${CX - 1.5} ${mid + 0.5} ${CX} ${mid + 0.3}C${CX + 1.5} ${mid + 0.5} ${CX + m.w * 0.45} ${mid + 0.3} ${xr} ${yr}`;
  const upper = `M${xl} ${yl}C${CX - m.w * 0.5} ${mid - m.up * 1.3} ${CX - 2.4} ${mid - m.up * (1.1 + bow * 0.25)} ${CX} ${mid - m.up * (0.55 + bow * 0.1)}C${CX + 2.4} ${mid - m.up * (1.1 + bow * 0.25)} ${CX + m.w * 0.5} ${mid - m.up * 1.3} ${xr} ${yr}C${CX + m.w * 0.45} ${mid + 0.3} ${CX - m.w * 0.45} ${mid + 0.3} ${xl} ${yl}Z`;
  const lowerY = mid + open + m.low;
  return (
    <g>
      {/* lower lip */}
      <path d={`M${xl + 1.5} ${yl + 0.6}C${CX - m.w * 0.45} ${lowerY * 1.0 + m.low * 0.6} ${CX + m.w * 0.45} ${lowerY + m.low * 0.6} ${xr - 1.5} ${yr + 0.6}Z`} fill={skin.lipLow} opacity={0.9} />
      <path d={`M${CX - m.w * 0.5} ${lowerY + 0.6}Q${CX} ${lowerY + m.low * 0.35 + 0.4} ${CX + m.w * 0.5} ${lowerY + 0.6}`} fill="none" stroke={skin.light} opacity={0.5} {...sw(1.4)} />
      {open > 0 && <path d={`M${xl + 1} ${yl}C${CX - m.w * 0.4} ${mid + 0.2} ${CX + m.w * 0.4} ${mid + 0.2} ${xr - 1} ${yr}C${CX + m.w * 0.4} ${mid + open + 1.2} ${CX - m.w * 0.4} ${mid + open + 1.2} ${xl + 1} ${yl}Z`} fill="#3a1612" />}
      {m.teeth ? <path d={`M${xl + 2.5} ${yl + 0.6}C${CX - m.w * 0.4} ${mid + 0.6} ${CX + m.w * 0.4} ${mid + 0.6} ${xr - 2.5} ${yr + 0.6}C${CX + m.w * 0.4} ${mid + m.teeth * 0.9} ${CX - m.w * 0.4} ${mid + m.teeth * 0.9} ${xl + 2.5} ${yl + 0.6}Z`} fill="#eee8dc" /> : null}
      {/* upper lip (darker, sits in the shadow of the nose) */}
      <path d={upper} fill={skin.lip} />
      <path d={lineD} fill="none" stroke={INK} {...sw(1.8)} />
      {/* corners and the groove under the lower lip */}
      <path d={`M${xl - 0.8} ${yl - 0.6}q-1.2 1 -0.6 2.2M${xr + 0.8} ${yr - 0.6}q1.2 1 0.6 2.2`} fill="none" stroke={skin.deep} opacity={0.55} {...sw(1.1)} />
      <path d={`M${CX - m.w * 0.42} ${lowerY + m.low * 0.55 + 2.4}Q${CX} ${lowerY + m.low * 0.55 + 4.4} ${CX + m.w * 0.42} ${lowerY + m.low * 0.55 + 2.4}`} fill="none" stroke={skin.deep} opacity={0.4} {...sw(1.2)} />
      <path d={`M${CX - 2} ${NOSE_BASE + 6}l0 ${mid - m.up - NOSE_BASE - 7}M${CX + 2} ${NOSE_BASE + 6}l0 ${mid - m.up - NOSE_BASE - 7}`} fill="none" stroke={skin.shade} opacity={0.35} {...sw(1)} />
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
