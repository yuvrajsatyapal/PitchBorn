import type { ReactNode } from "react";
import { HAIR_STYLES, type HairStyle } from "@/engine/appearance/options";
import type { FaceSpec, Head } from "./anatomy";
import type { Skin } from "./face";
import { q, CX, FINE, INK, MID, OUT, add, along, clamp, darken, dist, hash01, inside, lerp, luminance, mix, poly, polyCont, r1, ribbon, scale, sub, sw, taper, unit, type Pt } from "./geometry";

export interface HairCtx {
  style: HairStyle;
  /** Style index: seeds the designed irregularity of tips and clumps so each cut always looks the same. */
  index: number;
  color: string;
  f: FaceSpec;
  head: Head;
  recede: number;
  skin: Skin;
  uid: string;
  /** Small sizes draw fewer clumps and curls; the silhouette and hairline stay the same. */
  lite?: boolean;
}

export const hairStyleOf = (i: number): HairStyle => HAIR_STYLES[i] ?? HAIR_STYLES[0];
export const hairTint = (base: string, grey: number) => (grey > 0 ? mix(base, "#b8b8bb", grey * 0.85) : base);

/** Hair options were authored on the old 200px head; this maps their heights onto the anatomical landmarks. */
export function legacyY(f: FaceSpec): (y: number) => number {
  const src = [56, 94, 108, 138, 153, 178];
  const dst = [f.top, f.browY, f.eyeY, f.noseY, f.mouthY, f.chinY];
  return (y: number) => {
    let i = 1;
    while (i < src.length - 1 && y > src[i]) i++;
    const t = (y - src[i - 1]) / (src[i] - src[i - 1]);
    return dst[i - 1] + (dst[i] - dst[i - 1]) * t;
  };
}

interface Tone {
  base: string;
  dark: string;
  light: string;
}

function tones(color: string): Tone {
  const lum = luminance(color);
  return {
    base: color,
    dark: darken(color, 0.4),
    // Black hair takes a cool sheen; brown and fair hair a warm one.
    light: lum < 0.09 ? mix(color, "#69707e", 0.4) : mix(mix(color, "#c08a5a", 0.32 + 0.1 * (1 - lum)), "#ffffff", 0.05 + 0.15 * lum),
  };
}

// ------------------------------------------------------------------ geometry

interface HairGeom {
  s: HairStyle;
  seed: number;
  /** Outer silhouette, right bottom -> crown -> left bottom. */
  outer: Pt[];
  /** Front edge across the forehead, right corner -> left corner (includes fringe tips). */
  front: Pt[];
  /** Front edge of the side hair, corner -> bottom, per side. */
  sideR: Pt[];
  sideL: Pt[];
  capBottom: number;
  endY: number;
  hlY: number;
  thickTop: number;
  thickSide: number;
  cap: string;
  /** Fade regions (below the solid cap) per side. */
  fades: string[];
  dir: 1 | -1;
  /** The cap as polygons, for placing texture inside it. */
  shape: Pt[][];
}

function resample(pts: Pt[], step: number): Pt[] {
  const out: Pt[] = [pts[0]];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    let a = pts[i - 1];
    const b = pts[i];
    let seg = dist(a, b);
    while (acc + seg >= step) {
      const t = (step - acc) / seg;
      a = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      out.push(a);
      seg = dist(a, b);
      acc = 0;
    }
    acc += seg;
  }
  if (dist(out[out.length - 1], pts[pts.length - 1]) > step * 0.3) out.push(pts[pts.length - 1]);
  return out;
}

const normalAt = (pts: Pt[], i: number): Pt => {
  const a = pts[Math.max(0, i - 1)];
  const b = pts[Math.min(pts.length - 1, i + 1)];
  const t = unit(sub(b, a));
  return [t[1], -t[0]];
};

/** Cut a polyline at height y (first crossing), returning the part before it. */
function until(pts: Pt[], y: number): Pt[] {
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1] && b[1] >= y) {
      const t = (y - a[1]) / (b[1] - a[1]);
      out.push([a[0] + (b[0] - a[0]) * t, y]);
      return out;
    }
    out.push(b);
  }
  return out;
}

export function hairGeometry(ctx: HairCtx): HairGeom {
  const { style: s, f, head, recede, index } = ctx;
  const Y = legacyY(f);
  const seed = 7919 * (index + 3);
  const dir: 1 | -1 = s.part === 0 ? 1 : (s.part as 1 | -1);
  const thickTop = s.top * 1.5;
  const thickSide = 1.5 + s.side * 1.35;
  const fringeRecede = s.fringe === "none" || s.horseshoe ? recede : recede * 0.4;
  const hlY = clamp(Y(s.line) - fringeRecede * 20, f.top + 9, f.browY - 26);
  const endY = Math.max(Y(s.end), f.browY);
  // Faded cuts keep their solid hair on top; the fade starts higher the tighter the cut.
  const capBottom = s.fade > 0 ? Math.min(endY, lerp(f.top, f.browY, [1, 0.7, 0.57, 0.46][s.fade])) : endY;

  // Hairline: across the forehead to the temple corners, then down the temples to the sideburns.
  const cornerY = clamp(Math.min(hlY + 7, Y(s.temple) - 2 - fringeRecede * 14), f.top + 8, f.browY - 20);
  const sideFront = (sign: 1 | -1): Pt[] => {
    const tfY = Math.max(cornerY + 12, Y(s.temple) - fringeRecede * 12);
    const sb = (s.back >= 2 ? 9 : 7) + s.side * 0.15;
    const pts: Pt[] = [
      [CX + sign * f.templeW * 0.6, cornerY],
      [CX + sign * (head.half(tfY, sign) - 11), tfY],
      [CX + sign * (head.half(endY, sign) - sb), endY],
    ];
    return along(pts, 5, 0.4);
  };
  const sideR = sideFront(1);
  const sideL = sideFront(-1);

  // ---- front edge (hairline or fringe), right corner -> left corner
  const cR: Pt = sideR[0];
  const cL: Pt = sideL[0];
  const h = (i: number) => hash01(seed, i);
  let front: Pt[];
  const tips = (base: Pt[], len: (i: number) => number, lean: (i: number) => number, every = 1): Pt[] => {
    // Insert a tip between consecutive points: hair clumps hanging over the forehead.
    const out: Pt[] = [base[0]];
    for (let i = 1; i < base.length; i++) {
      const a = base[i - 1];
      const b = base[i];
      if (i % every === 0) {
        const m: Pt = [(a[0] + b[0]) / 2 + lean(i) * (0.6 + h(i) * 0.6), (a[1] + b[1]) / 2 + len(i)];
        out.push(m);
      }
      out.push(b);
    }
    return out;
  };
  switch (s.fringe) {
    case "straight":
    case "caesar": {
      const fy = clamp(Math.max(hlY + 14, f.browY - 34), hlY, f.browY - 14);
      const base = resample(along([cR, [CX + 30, fy - 1], [CX, fy + 1], [CX - 30, fy - 1], cL], 6), s.fringe === "caesar" ? 7 : 10);
      front = tips(base, (i) => (s.fringe === "caesar" ? 2.6 : 3 + h(i) * 6), () => (s.fringe === "caesar" ? 0 : -1.5));
      break;
    }
    case "side":
    case "sweep": {
      // Swept across from the parting: clumps lean away from the part and hang lower on the far side.
      const low = s.fringe === "sweep" ? 26 : 16;
      const pts: Pt[] = dir > 0 ? [cR, [CX + 28, hlY + low - 4], [CX - 4, hlY + low * 0.55], [CX - 30, hlY + 4], cL] : [cR, [CX + 30, hlY + 4], [CX + 4, hlY + low * 0.55], [CX - 28, hlY + low - 4], cL];
      const base = resample(along(pts, 6), 11);
      front = tips(base, (i) => 4 + h(i) * 7, () => -dir * 6);
      break;
    }
    case "curtain": {
      const fy = Math.min(hlY + 28, f.browY - 10);
      const pts: Pt[] = [[CX + head.half(f.browY - 6) - 4, f.browY - 6], [CX + 36, fy - 6], [CX + 10, hlY + 6], [CX, hlY - 1], [CX - 10, hlY + 6], [CX - 36, fy - 6], [CX - head.half(f.browY - 6) + 4, f.browY - 6]];
      front = resample(along(pts, 6), 9).map((p, i) => [p[0], p[1] + (i % 2 ? 2.5 : 0)] as Pt);
      sideR.splice(0, sideR.length, ...along([[CX + head.half(f.browY - 6) - 4, f.browY - 6], [CX + head.half(endY) - 9, endY]], 4));
      sideL.splice(0, sideL.length, ...along([[CX - head.half(f.browY - 6) + 4, f.browY - 6], [CX - head.half(endY) + 9, endY]], 4));
      break;
    }
    case "messy": {
      const fy = Math.max(hlY + 10, f.browY - 40);
      const base = resample(along([cR, [CX + 26, fy], [CX, fy + 2], [CX - 26, fy], cL], 6), 9);
      front = tips(base, (i) => 3 + h(i) * 11, (i) => (h(i + 40) - 0.5) * 8);
      break;
    }
    case "quiff":
    case "none":
    default: {
      // A natural hairline: a clean line with tiny, irregular notches where the hairs start.
      const base = resample(along([cR, [CX + f.templeW * 0.32, hlY + 2.5], [CX, hlY], [CX - f.templeW * 0.32, hlY + 2.5], cL], 6), 6);
      front = base.map((p, i) => [p[0], p[1] + (i % 2 ? 1.3 + h(i) : -0.3)] as Pt);
      break;
    }
  }

  // ---- outer silhouette: the skull outline pushed out by the hair's thickness, then given an irregular edge
  const centre: Pt = [CX, f.top + f.skullW * 0.95];
  const skullR = head.rightPts.filter((p) => p[1] <= capBottom);
  const long = s.back >= 2 && endY > f.eyeY;
  let maxX = 0;
  const pushed: Pt[] = skullR.map((p) => {
    const t = clamp((capBottom - p[1]) / Math.max(1, capBottom - f.top), 0, 1);
    const d = thickSide + (thickTop - thickSide) * Math.pow(t, 1.6) + (s.texture === "coily" ? s.side * 0.5 * Math.sin(Math.PI * t) : 0);
    const n = unit(sub(p, centre));
    let q = add(p, scale(n, d));
    if (s.flat) q = [q[0], Math.max(q[1], f.top - thickTop * 0.82)];
    if (long) {
      maxX = Math.max(maxX, q[0]);
      q = [Math.max(q[0], maxX - (q[1] - f.eyeY) * 0.08), q[1]];
    }
    return q;
  });
  if (pushed.length && pushed[pushed.length - 1][1] < capBottom) {
    const last = pushed[pushed.length - 1];
    pushed.push([Math.max(last[0], CX + head.half(capBottom) + thickSide), capBottom]);
  }
  const rightHalf = pushed.slice().reverse(); // capBottom -> crown
  const leftHalf = pushed.map((p) => [2 * CX - p[0] - (hash01(seed, 99) - 0.5) * 2, p[1]] as Pt);
  let outer = [...rightHalf, ...leftHalf.slice(1)];
  if (s.edge === "tuft") {
    outer = outer.map((p) => [p[0], p[1] - 16 * Math.exp(-(((p[0] - (CX + 12)) / 30) ** 2)) * (p[1] < f.top + 10 ? 1 : 0)] as Pt);
  }
  if (s.edge === "scallop") {
    outer = resample(outer, s.texture === "coily" ? 11 : 14);
  } else {
    // Dense points with sharp clump tips every few samples; the tips lean back over the head like brushed hair.
    const every = s.edge === "spiky" ? 3 : s.edge === "wavy" ? 4 : 5;
    outer = resample(outer, 4);
    outer = outer.map((p, i) => {
      if (i < 2 || i > outer.length - 3) return p;
      const n = normalAt(outer, i);
      const tip = i % every === 0;
      let amp = (h(i) - 0.5) * 0.9;
      // Mostly small clump tips with the odd larger one, so the edge never reads as a regular sawtooth.
      if (tip) amp = s.edge === "spiky" ? 5 + h(i) * 6 : s.edge === "wavy" ? 2 + h(i) * 2 : 1.4 + h(i) * 2.2 + (h(i + 33) > 0.75 ? 3.5 : 0);
      const lean = tip ? (p[0] > CX ? 1 : -1) * amp * 0.45 : 0;
      return [p[0] + n[0] * -amp + lean, p[1] + n[1] * -amp] as Pt;
    });
  }

  // ---- assemble the cap: outer silhouette, down the left side, across the front, down the right side
  const sideCutR = until(sideR, capBottom);
  const sideCutL = until(sideL, capBottom);
  const outerD = s.edge === "scallop" ? scallopPath(outer) : poly(outer);
  // Where the solid hair stops on the sides, it ends in short clumps rather than a ruled line.
  const bottomTips = (from: Pt, to: Pt, k: number): Pt[] => {
    const out: Pt[] = [];
    const n = Math.max(2, Math.round(dist(from, to) / 6));
    for (let i = 1; i < n; i++) {
      const p: Pt = [lerp(from[0], to[0], i / n), lerp(from[1], to[1], i / n)];
      out.push(i % 2 ? [p[0], p[1] + 3 + h(k + i) * 4] : [p[0], p[1] - 0.5]);
    }
    return out;
  };
  const oR = outer[0];
  const oL = outer[outer.length - 1];
  const bl = sideCutL[sideCutL.length - 1];
  const br = sideCutR[sideCutR.length - 1];
  const cap = `${outerD}${polyCont(bottomTips(oL, bl, 50))}${polyCont(sideCutL.slice().reverse())}${polyCont(front.slice().reverse())}${polyCont(sideCutR)}${polyCont(bottomTips(br, oR, 70))}Z`;

  const fades: string[] = [];
  if (s.fade > 0 && capBottom < endY) {
    for (const sign of [1, -1] as const) {
      const sf = sign > 0 ? sideR : sideL;
      const below = sf.filter((p) => p[1] > capBottom);
      const startF = until(sf, capBottom);
      const a = startF[startF.length - 1];
      const ys = Array.from({ length: 7 }, (_, i) => capBottom + ((endY - capBottom) * i) / 6);
      const outline = ys.map((y) => [CX + sign * (head.half(y, sign) + 12), y] as Pt);
      fades.push(`${poly([a, ...below])}${polyCont(outline.slice().reverse())}Z`);
    }
  }
  const shape = [[...outer, ...sideCutL.slice().reverse(), ...front.slice().reverse(), ...sideCutR]];
  if (s.horseshoe) {
    // Only the sides and back remain: two patches above the ears, the crown is bare.
    const patches = ([1, -1] as const).map((sign) => {
      const y0 = f.top + (f.browY - f.top) * 0.38;
      const ys = Array.from({ length: 8 }, (_, i) => y0 + ((endY - y0) * i) / 7);
      const outerP = ys.map((y, i) => [CX + sign * (head.half(y, sign) + thickSide + (i % 2 ? 1.5 : 0)), y] as Pt);
      const innerP = ys.map((y) => [CX + sign * (head.half(y, sign) - 10), y + 2] as Pt);
      return [...outerP, ...innerP.reverse()];
    });
    return { s, seed, outer: [], front: [], sideR: [], sideL: [], capBottom: endY, endY, hlY, thickTop, thickSide, cap: patches.map((q) => poly(q, true)).join(""), fades: [], dir, shape: patches };
  }
  return { s, seed, outer, front, sideR, sideL, capBottom, endY, hlY, thickTop, thickSide, cap, fades, dir, shape };
}

function scallopPath(pts: Pt[]): string {
  let d = q(`M${r1(pts[0][0])} ${r1(pts[0][1])}`);
  for (let i = 1; i < pts.length; i++) {
    const rad = dist(pts[i], pts[i - 1]) * 0.66;
    d += `A${r1(rad)} ${r1(rad)} 0 0 1 ${r1(pts[i][0])} ${r1(pts[i][1])}`;
  }
  return d;
}

// ------------------------------------------------------------------ layers

/**
 * Everything the hair does to the skin, drawn inside the head clip so the head outline stays on top: the shadow
 * cast on the forehead, faded sides (hair colour mixed into the skin in two stepped bands) and shaved scalps.
 */
export function HairOnSkin({ ctx, g }: { ctx: HairCtx; g: HairGeom }) {
  const { style: s, skin, color, uid, head } = ctx;
  const els: ReactNode[] = [];
  const t = tones(color);
  const flecks = (
    <pattern key="pat" id={`${uid}buzz`} width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(24)">
      <path d="M0.6 0.8l0.4 1M2.2 2.3l0.4 0.9" stroke={darken(t.base, 0.25)} strokeWidth="0.7" strokeLinecap="round" />
    </pattern>
  );
  els.push(<defs key="defs">{flecks}</defs>);
  if (s.density < 0.5) {
    els.push(<path key="scalp" d={g.cap} fill={mix(skin.base, t.base, s.density * 1.2)} />, <path key="scalpt" d={g.cap} fill={`url(#${uid}buzz)`} opacity={0.8} />);
    return <g>{els}</g>;
  }
  if (!s.horseshoe && g.front.length) {
    const drop = s.fringe === "none" || s.fringe === "quiff" ? 4 : 6.5;
    const line = [...g.sideR.slice().reverse(), ...g.front.slice().reverse(), ...g.sideL].map((p) => [p[0], p[1] + drop * 0.55] as Pt);
    els.push(<path key="shadow" d={ribbon(line, (u) => (u > 0.2 && u < 0.8 ? drop * 1.6 : drop))} fill={skin.shade} />);
  }
  if (g.fades.length) {
    const strong = [0, 0.62, 0.55, 0.45][s.fade];
    const soft = [0, 0.4, 0.3, 0.14][s.fade];
    g.fades.forEach((d, i) => {
      const sign = i === 0 ? 1 : -1;
      const y1 = g.capBottom + (g.endY - g.capBottom) * 0.42;
      // The upper band ends in a slightly ragged line, like clipper work.
      const ragged: Pt[] = Array.from({ length: 7 }, (_, k) => [CX + sign * (head.half(y1, sign) - 18 + k * 5), y1 + (k % 2 ? 2 : -1.5)] as Pt);
      els.push(
        <defs key={`fx${i}`}>
          <path id={`${uid}fd${i}`} d={d} />
        </defs>,
        <use key={`fs${i}`} href={`#${uid}fd${i}`} fill={mix(skin.base, t.base, soft)} />,
        <path key={`fu${i}`} d={q(`${poly([[CX + sign * (head.half(g.capBottom, sign) - 30), g.capBottom - 4], [CX + sign * (head.half(g.capBottom, sign) + 14), g.capBottom - 4], [CX + sign * (head.half(y1, sign) + 14), y1], ...ragged.slice().reverse()])}Z`)} fill={mix(skin.base, t.base, strong)} clipPath={`url(#${uid}fade${i})`} />,
        <clipPath key={`fc${i}`} id={`${uid}fade${i}`}>
          <use href={`#${uid}fd${i}`} />
        </clipPath>,
        ctx.lite ? null : <use key={`ft${i}`} href={`#${uid}fd${i}`} fill={`url(#${uid}buzz)`} opacity={0.6} />,
      );
    });
  }
  return <g>{els}</g>;
}

export function HairBack({ ctx }: { ctx: HairCtx }) {
  const { style: s, f, head, color } = ctx;
  const t = tones(color);
  const parts: ReactNode[] = [];
  const top = f.top - s.top * 1.5;
  if (s.strands === "bun") {
    parts.push(<circle key="bun" cx={CX + 2} cy={top - 6} r={17} fill={t.base} stroke={INK} strokeWidth={OUT * 0.85} />, <path key="bt" d={q(`M${CX - 12} ${top - 12}q12 -9 26 2M${CX - 10} ${top - 2}q12 -7 24 2`)} stroke={t.dark} {...sw(1.6)} />);
  }
  if (s.strands === "ponytail") {
    parts.push(<path key="pt" d={q(`M${CX + 40} ${top + 34}C${CX + 110} ${top + 10} ${CX + 118} ${top + 150} ${CX + 82} ${top + 230}C${CX + 78} ${top + 180} ${CX + 62} ${top + 120} ${CX + 36} ${top + 70}Z`)} fill={t.dark} stroke={INK} strokeWidth={OUT * 0.85} strokeLinejoin="round" />);
  }
  if (s.back > 0 && s.strands !== "locs" && s.strands !== "braids") {
    const end = [0, f.jawY - 8, f.chinY + 6, f.chinY + 44, 336][s.back];
    const wTop = head.half(f.eyeY) + 1.5 + s.side * 1.35 + 2;
    const wBot = head.half(f.cheekDy + f.eyeY) + 6 + s.side + s.back * 3;
    const seed = 31 * (ctx.index + 5);
    const bottom: Pt[] = [];
    for (let i = 0; i <= 8; i++) {
      const x = CX - wBot + (2 * wBot * i) / 8;
      bottom.push([x, end - (i % 2 ? 0 : 6 + hash01(seed, i) * 6) - Math.abs(i - 4) * 1.5]);
    }
    const y0 = f.browY - 10;
    const d = q(`M${CX + wTop} ${y0}C${CX + wTop + 4} ${y0 + 60} ${CX + wBot + 2} ${end - 50} ${CX + wBot} ${end - 6}${polyCont(bottom.slice().reverse())}L${CX - wBot} ${end - 6}C${CX - wBot - 2} ${end - 50} ${CX - wTop - 4} ${y0 + 60} ${CX - wTop} ${y0}Z`);
    parts.push(<path key="back" d={d} fill={darken(t.base, 0.22)} stroke={INK} strokeWidth={OUT * 0.85} strokeLinejoin="round" />);
    for (let i = 0; i < 6; i++) {
      const x = CX + (i < 3 ? -1 : 1) * (wBot - 6 - (i % 3) * 6);
      parts.push(<path key={`bs${i}`} d={q(`M${x} ${f.eyeY + 10}Q${x + (i < 3 ? -3 : 3)} ${(f.eyeY + end) / 2} ${x} ${end - 12}`)} stroke={t.dark} opacity={0.7} {...sw(1.4)} />);
    }
  }
  if (s.strands === "locs" || s.strands === "braids") {
    const braid = s.strands === "braids";
    const end = [0, f.jawY - 6, f.chinY + 6, f.chinY + 40, 330][Math.max(1, s.back)];
    const n = braid ? 12 : 10;
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n - 0.5;
      const x0 = CX + u * 2 * (head.half(f.browY - 20) + 4);
      const xe = CX + u * 2 * (head.half(f.eyeY + 20) + 24 + s.side);
      const ye = end - (i % 3) * 9 - Math.abs(u) * 14;
      const pts = along([[x0, f.top + 20], [x0 + (xe - x0) * 0.6, f.eyeY], [xe, ye]], 6);
      const wd = braid ? 8 : 11;
      parts.push(<path key={`s${i}`} d={ribbon(pts, () => wd)} fill={i % 2 ? t.dark : darken(t.base, 0.15)} stroke={INK} strokeWidth={FINE * 1.2} strokeLinejoin="round" />);
      if (braid) parts.push(<path key={`sb${i}`} d={pts.slice(1).map((p, k) => q(`M${r1(p[0] - 3)} ${r1(p[1] - 2 + (k % 2))}l6 3`)).join("")} stroke={INK} opacity={0.5} {...sw(0.9)} />);
    }
  }
  if (!parts.length) return null;
  return <g>{parts}</g>;
}

export function HairFront({ ctx, g }: { ctx: HairCtx; g: HairGeom }) {
  const { style: s, f, color, skin, uid } = ctx;
  const t = tones(color);
  const els: ReactNode[] = [];
  const thin = s.density < 0.5;

  if (thin) return null;

  const cid = `${uid}hair`;
  const inner: ReactNode[] = [];
  // Form: shadow on the right of the mass and along its lower edge, light on the crown.
  inner.push(
    <path key="shade" d={q(`M${CX + 18} ${f.top - 80}C${CX + 34} ${f.top} ${CX + f.templeW * 0.5} ${g.hlY + 8} ${CX + 20} ${f.chinY}L${CX + 200} ${f.chinY}L${CX + 200} ${f.top - 80}Z`)} fill={t.dark} opacity={0.42} />,
    g.front.length ? <path key="rim" d={ribbon([...g.sideR.slice().reverse(), ...g.front.slice().reverse(), ...g.sideL].map((p) => [p[0], p[1] - 3] as Pt), () => 6)} fill={t.dark} opacity={0.35} /> : null,
  );
  inner.push(...texture(ctx, g, t));
  if (s.part !== 0 && (s.fringe === "side" || s.fringe === "none")) {
    const px = CX - g.dir * 18;
    inner.push(<path key="part" d={q(`M${px} ${g.hlY + 4}Q${px + g.dir * 1.5} ${(g.hlY + f.top) / 2} ${px + g.dir * 5} ${f.top + 2}`)} stroke={mix(skin.base, t.base, 0.45)} {...sw(1.3)} />);
  }
  els.push(
    <defs key="defs">
      <path id={`${cid}d`} d={g.cap} />
      <clipPath id={cid}>
        <use href={`#${cid}d`} />
      </clipPath>
    </defs>,
    <use key="cap" href={`#${cid}d`} fill={t.base} fillOpacity={s.density} />,
    <g key="inner" clipPath={`url(#${cid})`} opacity={s.density}>
      {inner}
    </g>,
  );
  if (s.horseshoe) {
    els.push(<path key="ink" d={g.cap} fill="none" stroke={INK} strokeWidth={MID} strokeLinejoin="round" />);
    return <g>{els}</g>;
  }
  // Ink: a heavy silhouette, a lighter line where the hair meets the face.
  const outerD = s.edge === "scallop" ? scallopPath(g.outer) : poly(g.outer);
  const frontD = poly([...until(g.sideL, g.capBottom).slice().reverse(), ...g.front.slice().reverse(), ...until(g.sideR, g.capBottom)]);
  els.push(<path key="ink" d={outerD} stroke={INK} {...sw(OUT * 0.9)} />, <path key="inkf" d={frontD} stroke={INK} {...sw(MID * 0.9)} />);
  els.push(...strands(ctx, t));
  return <g>{els}</g>;
}

/** Directional clumps and separations (straight, wavy) or curl clusters (curly, coily), drawn inside the cap. */
function texture(ctx: HairCtx, g: HairGeom, t: Tone): ReactNode[] {
  const { style: s, f } = ctx;
  const els: ReactNode[] = [];
  const h = (i: number) => hash01(g.seed + 17, i);
  if (s.strands === "rows") {
    for (let i = -6; i <= 6; i++) {
      const x0 = CX + i * 10.5;
      const pts = along([[x0, g.hlY + 2], [CX + i * 8, f.top + 18], [CX + i * 3.5, f.top - 2]], 5);
      els.push(<path key={`r${i}`} d={ribbon(pts, () => 6)} fill={t.light} opacity={0.32} />, <path key={`rd${i}`} d={ribbon(pts.map((p) => [p[0] + 5, p[1]] as Pt), () => 1.4)} fill={t.dark} opacity={0.8} />);
    }
    return els;
  }
  if (s.texture === "straight" || s.texture === "wavy") {
    // Clumps spread over the whole mass, each following the way the hair is brushed: out from the crown,
    // then forward and across towards the fringe. Lit clumps on the upper left, dark partings everywhere.
    const origin: Pt = [CX - g.dir * 12, f.top - g.thickTop * 0.35];
    const sweep: Pt = s.fringe === "side" || s.fringe === "sweep" ? [g.dir * 0.7, 0.5] : s.fringe === "none" || s.fringe === "quiff" ? [0, -0.2] : [0, 0.6];
    const minX = CX - f.skullW - g.thickSide - 6;
    const maxX = CX + f.skullW + g.thickSide + 6;
    const minY = f.top - g.thickTop - 8;
    const gap = ctx.lite ? 15 : 10;
    let k = 0;
    for (let y = minY; y < g.capBottom + 4; y += gap * 0.8) {
      for (let x = minX + ((Math.round(y) / gap) % 2) * gap * 0.5; x < maxX; x += gap) {
        const p: Pt = [x + (h(k) - 0.5) * 5, y + (h(k + 500) - 0.5) * 4];
        k++;
        if (!g.shape.some((q) => inside(q, p))) continue;
        const out = unit(sub(p, origin));
        const frontness = clamp((p[1] - (g.hlY - 30)) / 30, 0, 1);
        const v = unit([out[0] + sweep[0] * frontness, out[1] + sweep[1] * frontness]);
        const len = 13 + h(k + 900) * 11;
        const a: Pt = [p[0] - v[0] * len * 0.35, p[1] - v[1] * len * 0.35];
        const bend = (s.texture === "wavy" ? 4 : 1.8) * (h(k + 1300) > 0.5 ? 1 : -1);
        const m: Pt = [p[0] + v[0] * len * 0.15 - v[1] * bend, p[1] + v[1] * len * 0.15 + v[0] * bend];
        const e: Pt = [p[0] + v[0] * len * 0.65, p[1] + v[1] * len * 0.65];
        const pts = along([a, m, e], 3);
        const lit = (p[0] < CX + 14 - (p[1] - minY) * 0.25 && h(k + 1700) > 0.25) || h(k + 1900) > 0.9;
        if (lit) els.push(<path key={`hl${k}`} d={ribbon(pts, taper(2.4 + h(k + 2100) * 2.2, 0.15, 0.45))} fill={t.light} opacity={0.8} />);
        else if (h(k + 2500) > 0.35) els.push(<path key={`sp${k}`} d={ribbon(pts, taper(1.3, 0.1, 0.6))} fill={t.dark} opacity={0.85} />);
      }
    }
    if (s.sheen) els.push(<path key="sheen" d={ribbon(along([[CX - 44, f.top + 14], [CX - 14, f.top - g.thickTop * 0.5 + 3], [CX + 18, f.top - g.thickTop * 0.42 + 6]], 6), taper(5, 0.5))} fill={t.light} opacity={0.55} />);
    return els;
  }
  // Curly / coily: individual curls at varied angles and sizes, darker on the shadow side, catching light on the left.
  const coil = s.texture === "coily";
  const rad = coil ? 3.4 : 4.8;
  const gapC = rad * (ctx.lite ? 3.6 : 2.5);
  let k = 0;
  for (let y = f.top - g.thickTop - 4; y < g.capBottom + 2; y += gapC * 0.82) {
    for (let x = CX - f.skullW - g.thickSide - 8 + ((Math.round(y / gapC) % 2) * gapC) / 2; x < CX + f.skullW + g.thickSide + 8; x += gapC) {
      const p: Pt = [x + (h(k) - 0.5) * rad, y + (h(k + 300) - 0.5) * rad];
      k++;
      if (!g.shape.some((q) => inside(q, p))) continue;
      const r = rad * (0.75 + h(k + 600) * 0.5);
      const a0 = h(k + 900) * Math.PI * 2;
      const arc: Pt[] = Array.from({ length: 7 }, (_, i) => {
        const a = a0 + (i / 6) * Math.PI * 1.35;
        return [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r * 0.85] as Pt;
      });
      const lit = p[0] < CX + 6 - (p[1] - f.top) * 0.3 && h(k + 1200) > 0.3;
      els.push(<path key={`c${k}`} d={ribbon(arc, taper(coil ? 1.5 : 2, 0.2))} fill={lit ? t.light : t.dark} opacity={lit ? 0.85 : 0.8} />);
    }
  }
  return els;
}

/** Strands that hang in front of the face: locs, braids and twists. */
function strands(ctx: HairCtx, t: Tone): ReactNode[] {
  const { style: s, f, head } = ctx;
  const els: ReactNode[] = [];
  if (s.strands === "twists") {
    for (let i = 0; i < 15; i++) {
      const a = Math.PI + (Math.PI * (i + 0.5)) / 15;
      const rx = head.half(f.top + 40) + 4;
      const ry = f.top + 50 - (f.top - s.top * 1.5);
      const x = CX + Math.cos(a) * rx * 0.94;
      const y = f.top + 50 + Math.sin(a) * ry * 0.9;
      const tip: Pt = [x + Math.cos(a) * 12, y + Math.sin(a) * 12];
      els.push(<path key={`tw${i}`} d={ribbon([[x, y], tip], taper(8, 4, 0.4))} fill={i % 2 ? t.dark : t.base} stroke={INK} strokeWidth={FINE} strokeLinejoin="round" />);
    }
  }
  if (s.strands === "locs" || s.strands === "braids") {
    const braid = s.strands === "braids";
    const short = s.back <= 1;
    const wd = braid ? 7.5 : 10.5;
    const draw = (key: string, pts: Pt[], i: number) => {
      els.push(<path key={key} d={ribbon(pts, () => wd)} fill={i % 2 ? t.dark : t.base} stroke={INK} strokeWidth={FINE * 1.3} strokeLinejoin="round" />);
      if (braid) els.push(<path key={`${key}b`} d={pts.slice(1).map((p, k) => q(`M${r1(p[0] - 3)} ${r1(p[1] - 2 + (k % 2))}l6 3`)).join("")} stroke={INK} opacity={0.55} {...sw(0.9)} />);
      else els.push(<path key={`${key}h`} d={ribbon(pts.map((p) => [p[0] - 2, p[1]] as Pt), taper(1.6, 0.3))} fill={t.light} opacity={0.6} />);
    };
    // Fringe strands fall forward from the crown, fanning out, and stop at different lengths above the brows.
    const fringe = braid ? 4 : 5;
    for (let i = 0; i < fringe; i++) {
      const u = (i + 0.5) / fringe - 0.5;
      const ye = f.browY - 14 - hash01(ctx.index, i) * 16;
      const x1 = CX + u * 2 * f.templeW * 0.62;
      draw(`f${i}`, along([[CX + u * 30, f.top - 4], [lerp(CX + u * 30, x1, 0.6) + u * 10, (f.top + ye) / 2], [x1 + u * 14, ye]], 5), i);
    }
    // Side strands start at the temples and hang outside the face, over the ears and shoulders.
    const per = braid ? 3 : 3;
    for (const sign of [1, -1] as const) {
      for (let j = 0; j < per; j++) {
        const x0 = CX + sign * f.templeW * (0.62 + j * 0.14);
        const y0 = f.top + 14 + j * 10;
        const ye = short ? f.eyeY + 4 + j * 6 : f.chinY + 10 + j * 14;
        const xe = CX + sign * (head.half(Math.min(ye, f.jawY), sign) + 4 + j * 8 + s.side);
        draw(`s${sign}${j}`, along([[x0, y0], [CX + sign * (head.half(f.browY, sign) + 2 + j * 5), f.browY], [xe, ye]], 6), j);
      }
    }
  }
  return els;
}
