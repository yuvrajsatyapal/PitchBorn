import type { ReactNode } from "react";
import type { FaceSpec, Head } from "./anatomy";
import type { Skin } from "./face";
import { q, CX, INK, OUT, clamp, darken, hash01, inside, lerp, mix, poly, ribbon, taper, unit, type Pt } from "./geometry";

/**
 * Facial hair is built from the same landmarks as the face: it follows the jaw outline, the cheek line from the
 * sideburn to the moustache, and leaves the lips clear. Stubble is fine flecks over a light tint; beards are solid
 * with directional strands, an inked outer edge and a tufted upper edge.
 */
interface BeardShape {
  /** Region as a polygon, plus an optional hole (the mouth). */
  pts: Pt[];
  hole?: Pt[];
  /** Points of the outer edge, inked when the beard is solid. */
  edge?: Pt[];
}

const smooth01 = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

function sideOutline(head: Head, sign: 1 | -1, y0: number, y1: number): Pt[] {
  const pts = sign > 0 ? head.rightPts : head.leftPts;
  return pts.filter((p) => p[1] >= y0 && p[1] <= y1);
}

/** Push outline points away from the face centre: the beard's thickness, growing towards the chin. */
function pushed(f: FaceSpec, pts: Pt[], drop: number, box: boolean): Pt[] {
  const c: Pt = [CX, f.eyeY];
  return pts.map((p) => {
    const t = smooth01((p[1] - (f.jawY - 28)) / (f.chinY - f.jawY + 28));
    const d = 1.2 + drop * t;
    const n = unit([p[0] - c[0], p[1] - c[1]]);
    const q: Pt = [p[0] + n[0] * d, p[1] + n[1] * d];
    return box ? [q[0], Math.min(q[1], f.chinY + drop * 0.9)] : q;
  });
}

function mouthHole(f: FaceSpec): Pt[] {
  const m = f.mouth;
  const cy = f.mouthY + (m.lo - m.up) / 2;
  const rx = m.w + 1.5;
  const ry = (m.up + m.lo) / 2 + 1.8;
  return Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return [CX + Math.cos(a) * rx, cy + Math.sin(a) * ry] as Pt;
  });
}

/** The cheek line from one sideburn, across the cheek and under the nose, to the other. */
function cheekLine(f: FaceSpec, head: Head, y0: number, low: number): Pt[] {
  const side = (s: 1 | -1): Pt[] => [
    [CX + s * (head.half(y0, s) - 9), y0],
    [CX + s * (head.half(f.noseY, s) - 17 - low * 6), f.noseY - 4 + low * 9],
    [CX + s * (f.mouth.w + 9), f.mouthY - 8 + low * 2],
    [CX + s * (f.nose.w * 0.9), f.noseY + 4.5],
  ];
  return [...side(-1), [CX, f.noseY + 5.5], ...side(1).reverse()];
}

function fullBeard(f: FaceSpec, head: Head, drop: number, low: number, box = false, long = 0): BeardShape {
  const y0 = f.ear.top + 12;
  let right = pushed(f, sideOutline(head, 1, y0, f.chinY + 1), drop, box);
  let left = pushed(f, sideOutline(head, -1, y0, f.chinY + 1), drop, box);
  // A long beard leaves the jaw at the chin corners and hangs in a broad, rounded point.
  if (long > 0) {
    right = right.filter((p) => p[0] > CX + f.chinW * 0.9);
    left = left.filter((p) => p[0] < CX - f.chinW * 0.9);
  }
  const bottom: Pt[] = long > 0 ? [[CX + f.chinW * 0.95, f.chinY + drop + long * 0.6], [CX + f.chinW * 0.45, f.chinY + drop + long * 0.95], [CX, f.chinY + drop + long], [CX - f.chinW * 0.45, f.chinY + drop + long * 0.95], [CX - f.chinW * 0.95, f.chinY + drop + long * 0.6]] : [];
  const edge = [...right, ...bottom, ...left.slice().reverse()];
  const cheek = cheekLine(f, head, y0, low);
  // A tufted upper edge: tiny hair tips along the cheek line.
  const tufted: Pt[] = [];
  for (let i = 0; i < cheek.length - 1; i++) {
    const a = cheek[i];
    const b = cheek[i + 1];
    tufted.push(a);
    const steps = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 6));
    for (let k = 1; k < steps; k++) {
      const t = k / steps;
      tufted.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t) - (k % 2 ? 1.6 : 0)]);
    }
  }
  tufted.push(cheek[cheek.length - 1]);
  return { pts: [...edge, ...tufted], hole: mouthHole(f), edge };
}

function moustache(f: FaceSpec, thick: number): BeardShape {
  const m = f.mouth;
  const n = f.nose;
  const top = (s: 1 | -1): Pt[] => [[CX + s * (m.w + 3), f.mouthY + 1.5], [CX + s * (m.w * 0.8), f.mouthY - m.up - thick * 0.7], [CX + s * n.w * 0.8, Math.max(f.noseY + 5, f.mouthY - m.up - thick * 1.35)]];
  const bottom = (s: 1 | -1): Pt[] => [[CX + s * (m.w * 0.55), f.mouthY - m.up * 0.55], [CX + s * 2, f.mouthY - m.up * 0.8]];
  const pts: Pt[] = [...top(-1), [CX, Math.max(f.noseY + 6.5, f.mouthY - m.up - thick * 1.25)], ...top(1).reverse(), ...bottom(1).reverse(), ...bottom(-1)];
  return { pts, edge: pts };
}

function chinPatch(f: FaceSpec, w: number, drop: number, fromLip = true): BeardShape {
  const m = f.mouth;
  const y0 = f.mouthY + m.lo + 2.4;
  const pts: Pt[] = [
    [CX - w * 0.55, y0 + 0.5],
    [CX - w * 0.2, fromLip ? y0 - 0.6 : y0 + 2],
    [CX + w * 0.2, fromLip ? y0 - 0.6 : y0 + 2],
    [CX + w * 0.55, y0 + 0.5],
    [CX + w, f.chinY - 8],
    [CX + w * 0.6, f.chinY + drop * 0.7],
    [CX, f.chinY + drop],
    [CX - w * 0.6, f.chinY + drop * 0.7],
    [CX - w, f.chinY - 8],
  ];
  return { pts, edge: pts.slice(4) };
}

function band(f: FaceSpec, head: Head, y0: number, y1: number, width: (t: number) => number, around: boolean): BeardShape {
  const sideBand = (s: 1 | -1) => {
    const out = sideOutline(head, s, y0, y1).map((p) => [p[0] + s * 1.5, p[1]] as Pt);
    const inn = out.map((p, i) => [p[0] - s * width(i / Math.max(1, out.length - 1)), p[1]] as Pt);
    return { out, inn };
  };
  const r = sideBand(1);
  const l = sideBand(-1);
  if (around) {
    // One strap from ear to ear around the chin.
    const outer = [...r.out, ...l.out.slice().reverse()];
    const c: Pt = [CX, f.eyeY + 10];
    const inner = outer.map((p) => {
      const n = unit([p[0] - c[0], p[1] - c[1]]);
      return [p[0] - n[0] * width(0.5), p[1] - n[1] * width(0.5)] as Pt;
    });
    return { pts: [...outer, ...inner.reverse()], edge: outer };
  }
  return { pts: [...r.out, ...r.inn.slice().reverse(), [Infinity, Infinity], ...l.out, ...l.inn.slice().reverse()] };
}

function shapes(f: FaceSpec, head: Head, style: number): { list: BeardShape[]; stubble: number } {
  switch (style) {
    case 1:
      return { list: [fullBeard(f, head, 1, 0.3)], stubble: 0.4 };
    case 2:
      return { list: [fullBeard(f, head, 1.5, 0.15)], stubble: 1 };
    case 3:
      return { list: [moustache(f, 4.8)], stubble: 0 };
    case 4:
      return { list: [moustache(f, 2.6)], stubble: 0 };
    case 5:
      return { list: [chinPatch(f, f.mouth.w * 0.62, 4)], stubble: 0 };
    case 6: {
      const m = f.mouth;
      const ring: Pt[] = [
        [CX - m.w - 3, f.mouthY + 1.5],
        [CX - m.w - 6, f.mouthY + m.lo + 4],
        [CX - f.chinW * 0.95, f.chinY - 6],
        [CX, f.chinY + 4],
        [CX + f.chinW * 0.95, f.chinY - 6],
        [CX + m.w + 6, f.mouthY + m.lo + 4],
        [CX + m.w + 3, f.mouthY + 1.5],
      ];
      return { list: [{ pts: ring, hole: mouthHole(f), edge: ring }, moustache(f, 5)], stubble: 0 };
    }
    case 7:
      return { list: [{ pts: [[CX - 4.5, f.mouthY + f.mouth.lo + 2.6], [CX + 4.5, f.mouthY + f.mouth.lo + 2.6], [CX + 2, f.mouthY + f.mouth.lo + 10], [CX - 2, f.mouthY + f.mouth.lo + 10]] }], stubble: 0 };
    case 8:
      return { list: [fullBeard(f, head, 3, 0.5)], stubble: 0 };
    case 9:
      return { list: [fullBeard(f, head, 6, 0.9, true)], stubble: 0 };
    case 10:
      return { list: [fullBeard(f, head, 11, 0)], stubble: 0 };
    case 11:
      return { list: [fullBeard(f, head, 12, 0, false, 32)], stubble: 0 };
    case 12:
      return { list: [chinPatch(f, f.chinW + 9, 10, false)], stubble: 0 };
    case 13:
      return { list: [band(f, head, f.ear.top - 4, f.noseY, () => 8, false)], stubble: 0 };
    case 14:
      return { list: [band(f, head, f.ear.top - 4, f.mouthY + 6, (t) => 8 + t * 14, false)], stubble: 0 };
    case 15:
      return { list: [band(f, head, f.ear.top + 8, f.chinY + 2, () => 5, true)], stubble: 0 };
    default:
      return { list: [], stubble: 0 };
  }
}

/** Split a polygon list on the Infinity separators used for two-sided shapes. */
function parts(pts: Pt[]): Pt[][] {
  const out: Pt[][] = [[]];
  for (const p of pts) {
    if (!Number.isFinite(p[0])) out.push([]);
    else out[out.length - 1].push(p);
  }
  return out.filter((x) => x.length > 2);
}

export function FacialHair({ f, head, style, color, grey, youth, skin, uid, lite }: { f: FaceSpec; head: Head; style: number; color: string; grey: number; youth: number; skin: Skin; uid: string; lite?: boolean }) {
  if (!style) return null;
  void grey;
  const { list, stubble } = shapes(f, head, style);
  if (!list.length) return null;
  const thin = 1 - 0.5 * youth;
  const dark = darken(color, 0.35);
  const light = mix(color, "#d8c0a0", 0.3);
  const els: ReactNode[] = [];
  const pathOf = (b: BeardShape) => parts(b.pts).map((p) => poly(p, true)).join("") + (b.hole ? poly(b.hole, true) : "");

  if (stubble > 0) {
    // Stubble: a light tint of the hair colour on the skin, then short flecks. No outline.
    const d = list.map(pathOf).join("");
    els.push(
      <defs key="d">
        <pattern id={`${uid}stub`} width="3.4" height="3.4" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
          <path d="M0.5 1.1l0.45 1.1M2.3 0.2l0.4 1M2.1 2.6l0.45 1M0.4 2.9l0.3 0.6" stroke={dark} strokeWidth="0.75" strokeLinecap="round" />
        </pattern>
      </defs>,
      <path key="tint" d={d} fill={mix(skin.base, color, 0.2 * stubble + 0.02)} fillRule="evenodd" opacity={thin} />,
      <path key="fleck" d={d} fill={`url(#${uid}stub)`} fillRule="evenodd" opacity={(0.2 + 0.6 * stubble) * thin} />,
    );
    return <g>{els}</g>;
  }

  list.forEach((b, bi) => {
    const d = pathOf(b);
    const cid = `${uid}beard${bi}`;
    const polys = parts(b.pts);
    const strands: ReactNode[] = [];
    const xs = polys.flat().map((p) => p[0]);
    const ys = polys.flat().map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    let k = 0;
    const step = lite ? 11 : 6.5;
    for (let y = minY + 2; y < maxY; y += step * 0.85) {
      for (let x = minX + ((Math.round(y / step) % 2) * step) / 2; x < maxX; x += step) {
        const p: Pt = [x + (hash01(style * 13 + bi, k) - 0.5) * 3, y];
        k++;
        if (!polys.some((q) => inside(q, p)) || (b.hole && inside(b.hole, p))) continue;
        const above = p[1] < f.mouthY;
        const v = above ? unit([Math.sign(p[0] - CX || 1), 0.75]) : unit([(p[0] - CX) * 0.014, 1]);
        const len = 6 + hash01(style * 17, k) * 5;
        const pts: Pt[] = [[p[0] - v[0] * len * 0.4, p[1] - v[1] * len * 0.4], p, [p[0] + v[0] * len * 0.6, p[1] + v[1] * len * 0.6]];
        const lit = p[0] < CX - 4 && hash01(style * 19, k) > 0.4;
        strands.push(<path key={k} d={ribbon(pts, taper(lit ? 1.8 : 1.3, 0.15))} fill={lit ? light : dark} opacity={lit ? 0.7 : 0.8} />);
      }
    }
    els.push(
      <path key={`b${bi}`} d={d} fill={color} fillRule="evenodd" opacity={thin} />,
      <clipPath key={`c${bi}`} id={cid}>
        <path d={d} clipRule="evenodd" />
      </clipPath>,
      <g key={`t${bi}`} clipPath={`url(#${cid})`} opacity={thin}>
        <path d={q(`M${CX + 6} ${minY - 4}L${maxX + 10} ${minY - 4}L${maxX + 10} ${maxY + 10}L${CX + 2} ${maxY + 10}Z`)} fill={dark} opacity={0.35} />
        {strands}
      </g>,
    );
    if (b.edge) els.push(<path key={`e${bi}`} d={poly(b.edge)} fill="none" stroke={INK} strokeWidth={OUT * 0.7} strokeLinejoin="round" strokeLinecap="round" opacity={thin} />);
    if (b.hole) els.push(<path key={`h${bi}`} d={poly(b.hole, true)} fill="none" stroke={dark} strokeWidth={1} opacity={0.5 * thin} />);
  });
  return <g>{els}</g>;
}
