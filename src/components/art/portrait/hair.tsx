import { HAIR_STYLES, INK, type HairStyle } from "@/engine/appearance/options";
import { bezier, CX, darken, lighten, line as polyline, mix, smooth, type Contour, type Pt } from "./geometry";

export interface HairCtx {
  style: HairStyle;
  color: string;
  contour: Contour;
  /** 0-1 hairline retreat from age/genes. */
  recede: number;
  skin: string;
}

const sw = (n: number) => ({ strokeWidth: n, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });
const r1 = (n: number) => Math.round(n * 10) / 10;

export const hairStyleOf = (i: number): HairStyle => HAIR_STYLES[i] ?? HAIR_STYLES[0];

/** Where the crown of the hair sits. */
const crownY = (s: HairStyle, c: Contour) => c.top - s.top;

/** Outer silhouette points, right base -> crown -> left base, hugging the skull. */
function outerPoints(s: HairStyle, c: Contour, baseY: number, steps: number): Pt[] {
  const top = crownY(s, c);
  const h = baseY - top;
  // Big hair is widest well above its base and tucks back in towards the head, rather than ending in a brim.
  const xw = CX + c.half(baseY - h * 0.4) + s.side + 1.6;
  const xs = CX + c.half(baseY) + 1.6 + s.side * 0.3;
  const k = s.flat ? 0.78 : 0.5523;
  const right = bezier([xs, baseY], [xw + s.side * 0.12, baseY - h * 0.22], [CX + k * (xw - CX), top], [CX, top], steps);
  const left = right.map((p) => [2 * CX - p[0], p[1]] as Pt).reverse().slice(1);
  return [...right, ...left];
}

function decorate(pts: Pt[], s: HairStyle): Pt[] {
  const out = pts.map((p) => [p[0], p[1]] as [number, number]);
  const mid = out.length / 2;
  if (s.edge === "tuft") {
    for (const p of out) p[1] -= 11 * Math.exp(-(((p[0] - (CX + 14)) / 17) ** 2));
  }
  if (s.edge === "spiky") {
    for (let i = 2; i < out.length - 2; i++) {
      if (i % 2 === 0) continue;
      const dx = out[i][0] - CX;
      const dy = out[i][1] - 96;
      const len = Math.hypot(dx, dy) || 1;
      const amp = 4.5 + (i % 4);
      out[i] = [out[i][0] + (dx / len) * amp, out[i][1] + (dy / len) * amp];
    }
  }
  if (s.edge === "wavy") {
    for (let i = 1; i < out.length - 1; i++) {
      const dx = out[i][0] - CX;
      const dy = out[i][1] - 96;
      const len = Math.hypot(dx, dy) || 1;
      const amp = i % 2 ? 2 : -1;
      out[i] = [out[i][0] + (dx / len) * amp, out[i][1] + (dy / len) * amp];
    }
  }
  void mid;
  return out;
}

function edgePath(pts: Pt[], s: HairStyle): string {
  if (s.edge === "scallop") {
    // Bumps of roughly constant size along the silhouette.
    const sampled: Pt[] = [];
    let acc = 0;
    sampled.push(pts[0]);
    const want = s.texture === "coily" ? 9 : 11;
    for (let i = 1; i < pts.length; i++) {
      acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (acc >= want) {
        sampled.push(pts[i]);
        acc = 0;
      }
    }
    const last = pts[pts.length - 1];
    if (sampled[sampled.length - 1] !== last) sampled.push(last);
    let d = `M${r1(sampled[0][0])} ${r1(sampled[0][1])}`;
    for (let i = 1; i < sampled.length; i++) {
      const rad = Math.hypot(sampled[i][0] - sampled[i - 1][0], sampled[i][1] - sampled[i - 1][1]) * 0.72;
      d += `A${r1(rad)} ${r1(rad)} 0 0 1 ${r1(sampled[i][0])} ${r1(sampled[i][1])}`;
    }
    return d;
  }
  if (s.edge === "spiky") return polyline(pts).replace(/^M/, "M");
  return smooth(pts, false, 0.5);
}

/** The inner (hairline) edge from the left temple to the right temple. */
function hairline(s: HairStyle, c: Contour, recede: number): { pts: Pt[]; yL: number; part?: Pt; dir: number } {
  const dir = s.part === 0 ? 1 : s.part;
  const crown = c.top;
  const line = Math.max(crown + 8, s.line - recede * 8);
  const temple = Math.max(crown + 10, s.temple - recede * 18);
  const T = (y: number, sign: 1 | -1): Pt => [CX + sign * (c.half(y) + 0.6), y];
  if (s.horseshoe) {
    return { pts: [T(100, -1), [CX - 38, 80], [CX - 26, crown + 6], [CX, crown + 3], [CX + 26, crown + 6], [CX + 38, 80], T(100, 1)], yL: 100, dir };
  }
  switch (s.fringe) {
    case "straight":
    case "caesar": {
      const fy = Math.max(line + 6, 76);
      const j = s.fringe === "caesar" ? 2.2 : 1;
      return { pts: [T(fy - 2, -1), [CX - 24, fy + 1 * j], [CX - 12, fy - 1 * j], [CX, fy + 2 * j], [CX + 12, fy - 1], [CX + 24, fy + 1.5 * j], T(fy - 2, 1)], yL: fy - 2, dir };
    }
    case "side":
    case "sweep": {
      const low = s.fringe === "sweep" ? 14 : 9;
      const hi = line - 6;
      const a: Pt = T(temple - 4, (-dir) as 1 | -1);
      const b: Pt = T(line + low + 2, dir as 1 | -1);
      return { pts: [a, [CX - dir * 14, hi + 1], [CX + dir * 2, line - 1], [CX + dir * 18, line + low - 2], b], yL: dir > 0 ? temple - 4 : line + low + 2, dir, part: [CX - dir * 14, hi] };
    }
    case "curtain":
      return { pts: [T(100, -1), [CX - half(c, 84) + 8, 86], [CX - 22, 72], [CX - 9, line - 2], [CX, line - 6], [CX + 9, line - 2], [CX + 22, 72], [CX + half(c, 84) - 8, 86], T(100, 1)], yL: 100, dir, part: [CX, line - 6] };
    case "messy": {
      const fy = Math.max(line + 5, 74);
      return { pts: [T(temple, -1), [CX - 26, fy - 2], [CX - 17, fy + 4], [CX - 8, fy - 1], [CX + 2, fy + 5], [CX + 12, fy], [CX + 22, fy + 4], [CX + 30, fy - 3], T(temple, 1)], yL: temple, dir };
    }
    case "quiff":
      return { pts: [T(temple, -1), [CX - 26, line + 1], [CX, line - 3], [CX + 26, line + 1], T(temple, 1)], yL: temple, dir };
    default:
      return { pts: [T(temple, -1), [CX - 24, line + 3], [CX, line], [CX + 24, line + 3], T(temple, 1)], yL: temple, dir, part: s.part ? [CX + s.part * -12, line - 1] : undefined };
  }
}

const half = (c: Contour, y: number) => c.half(y);

/** Face-contour points on one side between two heights. */
function sidePoints(c: Contour, y0: number, y1: number, sign: 1 | -1): Pt[] {
  const out: Pt[] = [];
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const y = y0 + ((y1 - y0) * i) / n;
    out.push([CX + sign * (c.half(y) + 0.4), y]);
  }
  return out;
}

// ------------------------------------------------------------------ back layer

const BACK_END = [0, 140, 158, 196, 236];
const BACK_W = [0, 0.96, 1.02, 1.08, 1.14];

export function HairBack({ style: s, color, contour: c, skin }: HairCtx) {
  void skin;
  const dark = darken(color, 0.28);
  const parts: React.ReactNode[] = [];
  const top = crownY(s, c);

  if (s.strands === "bun") {
    parts.push(<circle key="bun" cx={CX} cy={top - 7} r={12} fill={color} stroke={INK} {...sw(2.4)} />, <path key="bunb" d={`M${CX - 11} ${top - 3}Q${CX} ${top + 3} ${CX + 11} ${top - 3}`} fill="none" stroke={dark} {...sw(2)} />);
  }
  if (s.strands === "ponytail") {
    parts.push(
      <path key="pt" d={`M${CX + 22} ${top + 12}C${CX + 66} ${top - 6} ${CX + 78} ${top + 80} ${CX + 54} ${top + 128}C${CX + 52} ${top + 102} ${CX + 40} ${top + 70} ${CX + 20} ${top + 38}Z`} fill={color} stroke={INK} {...sw(2.4)} />,
      <circle key="ptt" cx={CX + 30} cy={top + 20} r={3.4} fill={dark} stroke={INK} {...sw(1.4)} />,
    );
  }
  if (s.back > 0 && !s.strands.match(/locs|braids/)) {
    const yb = BACK_END[s.back];
    const ys = 106;
    const wTop = c.half(ys) + s.side + 2.5;
    const wBot = (c.half(138) + 3 + s.side * 0.6) * BACK_W[s.back];
    const inner = 24;
    const sag = s.texture === "straight" ? 0 : 4;
    const body = `M${CX + wTop} ${ys}C${CX + wTop + 2} ${ys + (yb - ys) * 0.4} ${CX + wBot + 2} ${yb - 36} ${CX + wBot} ${yb - 4}Q${CX + wBot - 4} ${yb + sag} ${CX + inner} ${yb}L${CX - inner} ${yb}Q${CX - wBot + 4} ${yb + sag} ${CX - wBot} ${yb - 4}C${CX - wBot - 2} ${yb - 36} ${CX - wTop - 2} ${ys + (yb - ys) * 0.4} ${CX - wTop} ${ys}Z`;
    parts.push(<path key="back" d={body} fill={dark} stroke={INK} {...sw(2.4)} />);
  }
  if (s.strands === "locs" || s.strands === "braids") {
    const braid = s.strands === "braids";
    const yEnd = BACK_END[Math.max(1, s.back)] - (braid ? 10 : 0);
    const n = braid ? 11 : 9;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n - 0.5; // -0.5..0.5
      const x0 = CX + t * 2 * (c.half(86) + s.side - 3);
      const y0 = top + 12 + Math.abs(t) * 38;
      const spread = t * 2 * (c.half(120) + 18 + s.side);
      const yb = yEnd - (i % 3) * 7 - Math.abs(t) * 10;
      const wid = braid ? 6.2 : 8.4;
      const d = `M${r1(x0)} ${r1(y0)}C${r1(x0 + spread * 0.4)} ${r1(y0 + 40)} ${r1(CX + spread)} ${r1(yb - 40)} ${r1(CX + spread * 0.94)} ${r1(yb)}`;
      parts.push(
        <path key={`s${i}`} d={d} fill="none" stroke={INK} {...sw(wid + 2.6)} />,
        <path key={`c${i}`} d={d} fill="none" stroke={i % 2 ? dark : color} {...sw(wid)} />,
        braid ? <path key={`b${i}`} d={d} fill="none" stroke={INK} opacity={0.5} strokeWidth={wid} strokeDasharray="1.2 3.2" strokeLinecap="butt" /> : <path key={`b${i}`} d={d} fill="none" stroke={lighten(color, 0.14)} opacity={0.5} strokeWidth={1.2} strokeLinecap="round" />,
      );
    }
  }
  if (!parts.length) return null;
  return <g>{parts}</g>;
}

// ------------------------------------------------------------------ front layer

export function HairFront({ style: s, color, contour: c, recede, skin }: HairCtx) {
  const dark = darken(color, 0.3);
  const light = lighten(color, 0.2);
  const top = crownY(s, c);
  const capEnd = s.fade > 0 ? s.end - [0, 14, 24, 34][s.fade] : s.end;
  const baseY = Math.min(s.end, 112);
  const capBase = Math.min(capEnd, baseY);
  const outer = decorate(outerPoints(s, c, capBase, 14), s);
  const hl = hairline(s, c, s.fringe === "none" || s.horseshoe ? recede : recede * 0.4);
  const left = sidePoints(c, hl.yL, capBase, -1); // temple down to base on the left
  const rightSide = sidePoints(c, hl.yL, capBase, 1).reverse(); // base up to temple on the right (reverse of temple->base)

  // Hair region: outer silhouette (right base -> left base), up the left face edge, along the hairline, down the right face edge.
  const outerD = edgePath(outer, s);
  const hairlineD = s.fringe === "messy" || s.fringe === "caesar" ? polyline(hl.pts).replace("M", "L") : smooth(hl.pts).replace("M", "L");
  const leftUp = `L${left
    .slice()
    .reverse()
    .map((p) => `${r1(p[0])} ${r1(p[1])}`)
    .join("L")}`;
  const rightDown = rightSide.map((p) => `L${r1(p[0])} ${r1(p[1])}`).join("");
  const region = `${outerD}${leftUp}${hairlineD}${rightDown}Z`;

  const els: React.ReactNode[] = [];
  const baldCap = s.density < 0.4;

  // Side fade bands (translucent hair colour on skin, stepped like a retro print).
  if (s.fade > 0 && capBase < s.end) {
    const bands = 3;
    for (let b = 0; b < bands; b++) {
      const y0 = capBase + ((s.end - capBase) * b) / bands;
      const op = [0.62, 0.38, 0.17][b];
      for (const sign of [1, -1] as const) {
        const w0 = c.half(y0) + s.side + 1.6;
        const w1 = c.half(s.end) + s.side + 1.6;
        const yEnd = s.end;
        const pts = `${CX + sign * (c.half(y0) + 0.4)} ${y0}L${CX + sign * w0} ${y0}L${CX + sign * w1} ${yEnd}L${CX + sign * (c.half(yEnd) + 0.4)} ${yEnd}`;
        els.push(<path key={`f${b}${sign}`} d={`M${pts}Z`} fill={color} opacity={op} />);
      }
    }
  }

  els.push(<path key="cap" d={region} fill={color} fillOpacity={s.density} stroke={baldCap ? "none" : INK} strokeOpacity={Math.min(1, s.density + 0.2)} {...sw(s.density < 0.8 ? 1.2 : 2.4)} />);

  if (!baldCap) {
    // Sheen and texture drawn on top, inside the cap.
    if (s.sheen) {
      els.push(<path key="sheen" d={`M${CX - 26} ${top + 14}Q${CX - 4} ${top + 3} ${CX + 24} ${top + 12}`} fill="none" stroke={light} opacity={0.38} {...sw(3.4)} />);
    }
    els.push(...texture(s, c, outer, hl.yL, dark, light, top, color));
    if (hl.part) els.push(<path key="part" d={`M${r1(hl.part[0])} ${r1(hl.part[1])}Q${r1(hl.part[0] + hl.dir * 4)} ${r1(top + 8)} ${r1(hl.part[0] + hl.dir * 10)} ${r1(top + 3)}`} fill="none" stroke={dark} {...sw(1.8)} />);
  }

  // Strands that hang over the face (locs / braids) and short twist coils.
  els.push(...frontStrands(s, c, color, dark, top));
  void skin;
  return <g>{els}</g>;
}

function texture(s: HairStyle, c: Contour, outer: Pt[], yL: number, dark: string, light: string, top: number, color: string): React.ReactNode[] {
  const els: React.ReactNode[] = [];
  const thick = s.top + 10;
  if (s.strands === "rows") {
    for (let i = -5; i <= 5; i++) {
      const x0 = CX + i * 8.6;
      const y0 = Math.max(yL - 1, 66);
      els.push(<path key={`r${i}`} d={`M${x0} ${y0}Q${CX + i * 7} ${top + 6} ${CX + i * 3.2} ${top + 1}`} fill="none" stroke={light} opacity={0.5} {...sw(1.5)} />);
    }
    return els;
  }
  if (s.texture === "straight") {
    for (let i = -3; i <= 3; i++) {
      if (s.horseshoe) break;
      els.push(<path key={`t${i}`} d={`M${CX + i * 9} ${top + 4 + Math.abs(i)}Q${CX + i * 12} ${top + thick * 0.6} ${CX + i * 14} ${yL - 1}`} fill="none" stroke={dark} opacity={0.38} {...sw(1.1)} />);
    }
  } else if (s.texture === "wavy") {
    for (let i = -3; i <= 3; i++) {
      els.push(<path key={`w${i}`} d={`M${CX + i * 10 - 4} ${top + 6}q4 -4 7 0t7 0`} fill="none" stroke={dark} opacity={0.42} {...sw(1.3)} />, <path key={`w2${i}`} d={`M${CX + i * 10 - 6} ${top + 17}q4 -4 7 0t7 0`} fill="none" stroke={dark} opacity={0.3} {...sw(1.2)} />);
    }
  } else if (thick > 14) {
    // Curl and coil marks sit just inside the silhouette.
    const inset = Math.min(thick * 0.5, 11);
    for (let i = 3; i < outer.length - 3; i += 3) {
      const p = outer[i];
      const dx = CX - p[0];
      const dy = 96 - p[1];
      const len = Math.hypot(dx, dy) || 1;
      const x = p[0] + (dx / len) * inset;
      const y = p[1] + (dy / len) * inset;
      if (y > yL + 4) continue;
      els.push(<path key={`c${i}`} d={`M${r1(x - 3)} ${r1(y)}a3.2 3.2 0 1 1 6.4 0`} fill="none" stroke={dark} opacity={0.55} {...sw(1.3)} />);
    }
  }
  void color;
  return els;
}

function frontStrands(s: HairStyle, c: Contour, color: string, dark: string, top: number): React.ReactNode[] {
  const els: React.ReactNode[] = [];
  if (s.strands === "twists") {
    for (let i = 0; i < 12; i++) {
      const a = Math.PI + (Math.PI * (i + 0.5)) / 12;
      const rx = c.half(80) + s.side + 1;
      const x = CX + Math.cos(a) * rx * 0.96;
      const y = c.top + 26 + Math.sin(a) * (c.top + 26 - top) * 0.98;
      const ox = Math.cos(a) * 9;
      const oy = Math.sin(a) * 9;
      els.push(
        <path key={`tw${i}`} d={`M${r1(x)} ${r1(y)}l${r1(ox)} ${r1(oy)}`} stroke={INK} {...sw(8.4)} />,
        <path key={`tc${i}`} d={`M${r1(x)} ${r1(y)}l${r1(ox)} ${r1(oy)}`} stroke={i % 2 ? dark : color} {...sw(5.6)} />,
      );
    }
  }
  if (s.strands === "locs") {
    const short = s.back <= 1;
    const items = short ? 9 : 10;
    for (let i = 0; i < items; i++) {
      const t = (i + 0.5) / items - 0.5;
      const x0 = CX + t * 2 * (c.half(76) + s.side - 2);
      const y0 = top + 10 + Math.abs(t) * 34;
      const hang = short ? 28 + (i % 3) * 5 : 0;
      const side = Math.abs(t) > 0.28;
      if (!short && !side && i % 2) continue;
      const yEnd = short ? y0 + hang + 6 : side ? 168 + (i % 3) * 8 : 96 + (i % 3) * 7;
      const xEnd = side ? CX + t * 2 * (c.half(130) + s.side + 8) : x0 + (i % 2 ? 4 : -4);
      const d = `M${r1(x0)} ${r1(y0)}C${r1(x0 + (xEnd - x0) * 0.2)} ${r1(y0 + (yEnd - y0) * 0.4)} ${r1(xEnd)} ${r1(yEnd - (yEnd - y0) * 0.35)} ${r1(xEnd)} ${r1(yEnd)}`;
      els.push(<path key={`l${i}`} d={d} fill="none" stroke={INK} {...sw(10.4)} />, <path key={`lc${i}`} d={d} fill="none" stroke={i % 2 ? dark : color} {...sw(7.6)} />, <path key={`lh${i}`} d={d} fill="none" stroke={lighten(color, 0.16)} opacity={0.45} {...sw(1.2)} />);
    }
  }
  if (s.strands === "braids") {
    const items = s.back >= 3 ? 8 : 6;
    for (let i = 0; i < items; i++) {
      const t = (i + 0.5) / items - 0.5;
      const x0 = CX + t * 2 * (c.half(76) + s.side - 2);
      const y0 = top + 12 + Math.abs(t) * 30;
      const side = Math.abs(t) > 0.2;
      if (!side && i % 2) continue;
      const yEnd = s.back >= 3 ? (side ? 186 : 110) : side ? 140 : 100;
      const xEnd = side ? CX + t * 2 * (c.half(120) + s.side + 6) : x0;
      const d = `M${r1(x0)} ${r1(y0)}C${r1(x0 + (xEnd - x0) * 0.1)} ${r1(y0 + 30)} ${r1(xEnd)} ${r1(yEnd - 40)} ${r1(xEnd)} ${r1(yEnd)}`;
      els.push(<path key={`b${i}`} d={d} fill="none" stroke={INK} {...sw(8)} />, <path key={`bc${i}`} d={d} fill="none" stroke={color} {...sw(5.4)} />, <path key={`bd${i}`} d={d} fill="none" stroke={INK} opacity={0.5} strokeWidth={5.4} strokeDasharray="1.2 3.2" strokeLinecap="butt" />);
    }
  }
  return els;
}

export const hairTint = (base: string, grey: number) => (grey > 0 ? mix(base, "#b8b8bb", grey * 0.85) : base);
