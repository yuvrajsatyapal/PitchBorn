import { INK } from "@/engine/appearance/options";
import { CX, darken, type Contour, type Pt } from "./geometry";
import { MOUTH_Y, NOSE_BASE } from "./features";

const f = (n: number) => Math.round(n * 10) / 10;
const sw = (n: number) => ({ strokeWidth: n, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

const poly = (pts: readonly Pt[]) => pts.map((p) => `${f(p[0])} ${f(p[1])}`).join("L");

function col(c: Contour, y0: number, y1: number, n = 8): number[] {
  return Array.from({ length: n + 1 }, (_, i) => y0 + ((y1 - y0) * i) / n);
}

interface BeardSpec {
  y0: number;
  /** Band thickness along the jaw; 0 means the beard fills the cheek (full beard). */
  band: number;
  drop: number;
  fill?: boolean;
  /** Joined to a moustache. */
  moustache?: 0 | 1 | 2;
  /** Stubble opacity. */
  stubble?: number;
  /** Square, boxed chin. */
  box?: boolean;
}

const BEARDS: Record<number, BeardSpec> = {
  1: { y0: 112, band: 0, drop: 2, fill: true, stubble: 0.22 },
  2: { y0: 108, band: 0, drop: 3, fill: true, stubble: 0.46 },
  8: { y0: 122, band: 9, drop: 4 },
  9: { y0: 112, band: 12, drop: 5, box: true },
  10: { y0: 104, band: 0, drop: 14, fill: true, moustache: 1 },
  11: { y0: 104, band: 0, drop: 38, fill: true, moustache: 1 },
};

/** A jaw-hugging region built from the face contour so it always lines up. */
function jawRegion(c: Contour, s: BeardSpec): string {
  const ys = col(c, s.y0, c.chin);
  const right: Pt[] = ys.map((y) => [CX + c.half(y) + 0.8, y]);
  const left: Pt[] = ys.map((y) => [CX - c.half(y) - 0.8, y]);
  const cw = c.half(c.chin);
  const under: Pt[] = [
    [CX + cw + 0.8, c.chin],
    [CX + cw * 0.7, c.chin + s.drop * 0.7],
    [CX + (s.box ? cw * 0.6 : 0), c.chin + s.drop],
    [CX - cw * 0.7, c.chin + s.drop * 0.7],
    [CX - cw - 0.8, c.chin],
  ];
  let d = `M${poly(right)}L${poly(under)}L${poly(left.slice().reverse())}`;
  if (s.band > 0) {
    const th = (y: number) => 2 + s.band * Math.pow((y - s.y0) / (c.chin - s.y0), 0.65);
    const iLeft: Pt[] = ys.map((y) => [CX - c.half(y) + th(y), y]);
    const iRight: Pt[] = ys.map((y) => [CX + c.half(y) - th(y), y]);
    d += `L${poly(iLeft)}L${f(CX - 13)} 163L${f(CX + 13)} 163L${poly(iRight.slice().reverse())}Z`;
  } else {
    // The upper edge of a full beard follows the cheek in a curve, rather than a ruled line.
    const yy = s.y0;
    d += `Q${f(CX - 31)} ${yy + 10} ${f(CX - 17)} 146Q${f(CX)} 142 ${f(CX + 17)} 146Q${f(CX + 31)} ${yy + 10} ${f(CX + c.half(yy) + 0.8)} ${yy}Z`;
    d += `M${f(CX - 14)} ${MOUTH_Y}a14 8.5 0 1 0 28 0a14 8.5 0 1 0 -28 0Z`;
  }
  return d;
}

function moustache(thick: number, w: number): string {
  const y = NOSE_BASE + 3;
  const o = w;
  return `M${CX} ${y}C${CX + o * 0.35} ${y - 2.4} ${CX + o * 0.8} ${y - 1} ${CX + o} ${y + 8 + thick * 0.4}C${CX + o * 0.7} ${y + 5 + thick} ${CX + o * 0.3} ${y + 4.6 + thick} ${CX} ${y + 5.6 + thick * 0.6}C${CX - o * 0.3} ${y + 4.6 + thick} ${CX - o * 0.7} ${y + 5 + thick} ${CX - o} ${y + 8 + thick * 0.4}C${CX - o * 0.8} ${y - 1} ${CX - o * 0.35} ${y - 2.4} ${CX} ${y}Z`;
}

export function FacialHair({ style, color, contour: c, grey, youth, uid }: { style: number; color: string; contour: Contour; grey: number; youth: number; uid: string }) {
  if (style === 0) return null;
  const tint = grey > 0 ? darken(color, 0) : color;
  const ink = darken(tint, 0.35);
  const thin = 1 - 0.45 * youth;
  const parts: React.ReactNode[] = [
    <defs key="defs">
      {/* short flecks for stubble, longer directional ticks for beards */}
      <pattern id={`${uid}st`} width="4.2" height="4.2" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
        <path d="M0.6 1.2l0.5 1.2M2.6 0.2l0.4 1.1M2.3 3.2l0.5 1.1M0.4 3.6l0.3 0.7" stroke={ink} strokeWidth="0.75" strokeLinecap="round" />
      </pattern>
      <pattern id={`${uid}bd`} width="5" height="6" patternUnits="userSpaceOnUse">
        <path d="M0.8 0.6q0.8 2 0.4 4.2M3.4 1.2q0.8 2 0.2 4.4" stroke={ink} strokeWidth="0.8" strokeLinecap="round" fill="none" opacity="0.8" />
      </pattern>
    </defs>,
  ];
  const spec = BEARDS[style];
  const stroke = (w = 2) => ({ stroke: INK, ...sw(w) });

  if (spec) {
    const d = jawRegion(c, spec);
    if (spec.stubble) {
      const region = d.replace(/M[^M]*$/, (m) => (m.includes("a14") ? "" : m));
      parts.push(<path key="st" d={region} fill={tint} fillRule="evenodd" opacity={spec.stubble * 0.7 * thin} />);
      parts.push(<path key="st1" d={region} fill={`url(#${uid}st)`} fillRule="evenodd" opacity={Math.min(1, spec.stubble * 2.2) * thin} />);
      parts.push(<path key="st2" d={moustache(3.6, 16)} fill={tint} opacity={spec.stubble * 0.7 * thin} />);
      parts.push(<path key="st3" d={moustache(3.6, 16)} fill={`url(#${uid}st)`} opacity={Math.min(1, spec.stubble * 2.2) * thin} />);
    } else {
      parts.push(<path key="b" d={d} fill={tint} fillRule="evenodd" {...stroke(2.2)} />);
      parts.push(<path key="bt" d={d} fill={`url(#${uid}bd)`} fillRule="evenodd" />);
      parts.push(<path key="bs" d={`M${CX - 14} ${c.chin - 6}Q${CX} ${c.chin + 3} ${CX + 14} ${c.chin - 6}`} fill="none" stroke={ink} opacity={0.5} {...sw(1.2)} />);
      if (spec.moustache) parts.push(<path key="m" d={moustache(3.8, 18)} fill={tint} {...stroke(1.8)} />);
    }
  }
  switch (style) {
    case 3:
      parts.push(<path key="m3" d={moustache(3.6, 18)} fill={tint} {...stroke(1.9)} />);
      break;
    case 4:
      parts.push(<path key="m4" d={moustache(2.2, 18)} fill={tint} {...stroke(1.4)} />);
      break;
    case 5:
    case 6: {
      const ring = `M${CX - 20} ${MOUTH_Y - 4}C${CX - 21} ${MOUTH_Y + 12} ${CX + 21} ${MOUTH_Y + 12} ${CX + 20} ${MOUTH_Y - 4}L${CX + 16} ${MOUTH_Y - 4}C${CX + 15} ${MOUTH_Y + 6} ${CX - 15} ${MOUTH_Y + 6} ${CX - 16} ${MOUTH_Y - 4}Z`;
      parts.push(<path key="g" d={`M${CX - 10} 164C${CX - 12} ${c.chin - 6} ${CX - 7} ${c.chin + 1} ${CX} ${c.chin + 2}C${CX + 7} ${c.chin + 1} ${CX + 12} ${c.chin - 6} ${CX + 10} 164Z`} fill={tint} {...stroke(2)} />);
      parts.push(<path key="gr" d={ring} fill={tint} {...stroke(1.6)} />);
      if (style === 6) parts.push(<path key="m6" d={moustache(3.6, 17)} fill={tint} {...stroke(1.8)} />);
      break;
    }
    case 7:
      parts.push(<ellipse key="sp" cx={CX} cy={165} rx={4.2} ry={3.6} fill={tint} {...stroke(1.4)} />);
      break;
    case 12:
      parts.push(<path key="cb" d={`M${CX - 17} 164C${CX - 18} ${c.chin - 2} ${CX - 8} ${c.chin + 10} ${CX} ${c.chin + 15}C${CX + 8} ${c.chin + 10} ${CX + 18} ${c.chin - 2} ${CX + 17} 164Z`} fill={tint} {...stroke(2)} />);
      break;
    case 13:
    case 14: {
      const reach = style === 14 ? 148 : 124;
      const w = style === 14 ? 12 : 6.5;
      for (const sign of [1, -1] as const) {
        const ys = col(c, 90, reach, 6);
        const outer = ys.map((y) => [CX + sign * (c.half(y) + 0.8), y] as Pt);
        const inner = ys.map((y, i) => [CX + sign * (c.half(y) - w * (i < 2 ? 0.55 : 1) * (style === 14 && i > 4 ? 1.2 : 1)), y] as Pt);
        parts.push(<path key={`sb${sign}`} d={`M${poly(outer)}L${poly(inner.slice().reverse())}Z`} fill={tint} {...stroke(1.8)} />);
      }
      break;
    }
    case 15: {
      for (const sign of [1, -1] as const) {
        const ys = col(c, 98, c.chin - 2, 8);
        const outer = ys.map((y) => [CX + sign * (c.half(y) + 0.8), y] as Pt);
        const inner = ys.map((y) => [CX + sign * (c.half(y) - 4), y] as Pt);
        parts.push(<path key={`cs${sign}`} d={`M${poly(outer)}L${poly(inner.slice().reverse())}Z`} fill={tint} {...stroke(1.6)} />);
      }
      parts.push(<path key="csb" d={`M${CX - 12} ${c.chin - 4}Q${CX} ${c.chin + 6} ${CX + 12} ${c.chin - 4}L${CX + 12} ${c.chin - 8}Q${CX} ${c.chin + 1} ${CX - 12} ${c.chin - 8}Z`} fill={tint} {...stroke(1.4)} />);
      break;
    }
    default:
      break;
  }
  return <g>{parts}</g>;
}
