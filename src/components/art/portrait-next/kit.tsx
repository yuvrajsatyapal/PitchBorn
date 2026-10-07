import { CX, hash01, lerp, q, type Pt } from "../portrait/geometry";
import type { NextSpec } from "./head";
import { blob, stroke } from "./ink";
import { INK, shift } from "./palette";
import type { Detail } from "./face";

/** Period shirt collars. Chosen per player, so a squad doesn't all wear the same cut. */
export const COLLARS = ["crew", "ribbed", "vneck", "fold", "polo"] as const;
export type Collar = (typeof COLLARS)[number];

const P = (x: number, y: number): Pt => [x, y];

/**
 * The shirt: shoulders falling away from the neck, one shadow plane on the right, two or three soft folds and a
 * collar built for its cut. Thin ink, heavier only along the outer shoulder line.
 */
export function KitNext({ f, kit, trim, collar, d }: { f: NextSpec; kit: string; trim: string; collar: Collar; d: Detail }) {
  const nw = f.neckW;
  const shade = shift(kit, -4, 0.02, -0.12);
  const deep = shift(kit, -6, 0.04, -0.2);
  const light = shift(kit, 4, -0.04, 0.08);
  const trimShade = shift(trim, -4, 0.02, -0.14);
  const xl = CX - nw - 15;
  const xr = CX + nw + 15;
  const yN = 297;
  // Shoulder line: rises a little at the trapezius, then falls away.
  const shoulderR: Pt[] = [P(xr - 2, yN + 1), P(xr + 30, yN + 8), P(xr + 72, 318), P(330, 336)];
  const shoulderL: Pt[] = [P(xl + 2, yN + 1), P(xl - 30, yN + 9), P(xl - 72, 319), P(-30, 338)];
  const body = q(
    `M-30 362L${shoulderL
      .slice()
      .reverse()
      .map((p) => `${p[0]} ${p[1]}`)
      .join("L")}L${CX} ${yN + 6}L${shoulderR.map((p) => `${p[0]} ${p[1]}`).join("L")}L330 362Z`,
  );
  const neckLine = (dy: number) => [P(xl + 2, yN + 1), P(CX - nw * 0.5, yN + 8 + dy), P(CX, yN + 11 + dy), P(CX + nw * 0.5, yN + 8 + dy), P(xr - 2, yN + 1)];
  const els = [];
  els.push(<path key="body" d={body} fill={kit} />);
  // Shadow plane on the far shoulder and under the collar, with a soft-edged fold.
  els.push(<path key="sh" d={blob([P(CX + nw * 0.4, yN + 14), P(xr + 20, yN + 10), P(332, 330), P(332, 364), P(CX + 74, 364), P(CX + 58, 334)], 0.45)} fill={shade} />);
  els.push(<path key="under" d={blob([P(xl + 8, yN + 8), P(CX, yN + 22), P(xr - 8, yN + 8), P(CX + 4, yN + 30)], 0.5)} fill={shade} opacity={0.6} />);
  els.push(<path key="lit" d={blob([P(xl - 46, 314), P(xl - 14, yN + 9), P(xl + 6, yN + 20), P(xl - 30, 326)], 0.5)} fill={light} opacity={0.55} />);
  if (d > 0) {
    els.push(
      <path key="f1" d={stroke([P(60, 333), P(72, 343), P(77, 360)], { w: 2.4, start: 0.1, end: 0.2, seed: 201 })} fill={shade} />,
      <path key="f2" d={stroke([P(CX + 40, 334), P(CX + 46, 346), P(CX + 44, 362)], { w: 2.6, start: 0.1, end: 0.2, seed: 203 })} fill={deep} opacity={0.6} />,
    );
  }

  // Collars
  const band = (outer: Pt[], inner: Pt[]) => q(`M${[...outer, ...inner.slice().reverse()].map((p) => `${p[0]} ${p[1]}`).join("L")}Z`);
  if (collar === "crew" || collar === "ribbed") {
    const h = collar === "ribbed" ? 8 : 5.5;
    const outer = neckLine(0).map((p, i) => P(p[0] + (i === 0 ? -3 : i === 4 ? 3 : 0), p[1] + h * (i === 0 || i === 4 ? 0.6 : 1)));
    const inner = neckLine(-h);
    els.push(<path key="c" d={band(outer, inner)} fill={trim} />);
    els.push(<path key="cs" d={band(outer.slice(2), inner.slice(2))} fill={trimShade} opacity={0.75} />);
    if (collar === "ribbed" && d > 0) {
      for (let i = 1; i < 14; i++) {
        const u = i / 14;
        const a = sampleLine(inner, u);
        const b = sampleLine(outer, u);
        els.push(<path key={`r${i}`} d={stroke([a, b], { w: 0.6, steps: 2, seed: 210 + i })} fill={trimShade} opacity={0.7} />);
      }
    }
    els.push(<path key="ci" d={stroke(inner, { w: 1.1, start: 0.3, end: 0.3, seed: 221 })} fill={INK} opacity={0.75} />);
  } else if (collar === "vneck") {
    const depth = 34;
    const outerL = [P(xl - 2, yN + 2), P(CX - 12, yN + depth * 0.6), P(CX, yN + depth + 8)];
    const outerR = [P(CX, yN + depth + 8), P(CX + 12, yN + depth * 0.6), P(xr + 2, yN + 2)];
    const innerL = [P(xl + 9, yN - 1), P(CX - 7, yN + depth * 0.55), P(CX, yN + depth - 2)];
    const innerR = [P(CX, yN + depth - 2), P(CX + 7, yN + depth * 0.55), P(xr - 9, yN - 1)];
    // The skin of the chest shows inside the V.
    els.push(<path key="v" d={band([...outerL, ...outerR.slice(1)], [...innerL, ...innerR.slice(1)])} fill={trim} />);
    els.push(<path key="vs" d={band(outerR, innerR)} fill={trimShade} opacity={0.8} />);
    els.push(<path key="vi" d={stroke([...innerL, ...innerR.slice(1)], { w: 1.1, start: 0.3, end: 0.3, seed: 223 })} fill={INK} opacity={0.75} />);
  } else if (collar === "fold") {
    // Retro fold-down collar: two pointed leaves lying on the shoulders, meeting at a short placket.
    const leaf = (k: 1 | -1) => [P(CX + k * 1.5, yN + 20), P(CX + k * (nw * 0.45), yN + 5), P(CX + k * (nw + 10), yN - 1), P(CX + k * (nw + 15), yN + 7), P(CX + k * (nw * 0.62), yN + 22), P(CX + k * 7, yN + 34)];
    els.push(<path key="pl" d={q(`M${CX - 4} ${yN + 14}L${CX + 4} ${yN + 14}L${CX + 3.5} ${yN + 52}L${CX - 3.5} ${yN + 52}Z`)} fill={shade} />);
    els.push(<path key="lfR" d={blob(leaf(1), 0.3)} fill={trimShade} />);
    els.push(<path key="lfL" d={blob(leaf(-1), 0.3)} fill={trim} />);
    els.push(<path key="lfRi" d={stroke([...leaf(1).slice(1), leaf(1)[0]], { w: 1.1, start: 0.3, end: 0.3, seed: 225 })} fill={INK} opacity={0.75} />);
    els.push(<path key="lfLi" d={stroke([...leaf(-1).slice(1), leaf(-1)[0]], { w: 0.9, start: 0.3, end: 0.3, seed: 227 })} fill={INK} opacity={0.6} />);
    els.push(<circle key="bt" cx={CX} cy={yN + 44} r={1.6} fill={trimShade} />);
  } else {
    // Polo: a standing collar band and a buttoned placket.
    const outer = neckLine(0).map((p, i) => P(p[0] + (i === 0 ? -4 : i === 4 ? 4 : 0), p[1] + (i === 0 || i === 4 ? 4 : 9)));
    const inner = neckLine(-4);
    els.push(<path key="pl" d={q(`M${CX - 6} ${yN + 12}L${CX + 6} ${yN + 12}L${CX + 5} ${yN + 50}L${CX - 5} ${yN + 50}Z`)} fill={trim} />);
    els.push(<path key="pls" d={stroke([P(CX + 6, yN + 13), P(CX + 5, yN + 50)], { w: 1, seed: 229 })} fill={INK} opacity={0.5} />);
    els.push(<path key="c" d={band(outer, inner)} fill={trim} />);
    els.push(<path key="cs" d={band(outer.slice(2), inner.slice(2))} fill={trimShade} opacity={0.8} />);
    els.push(<path key="ci" d={stroke(inner, { w: 1.1, start: 0.3, end: 0.3, seed: 231 })} fill={INK} opacity={0.75} />);
    els.push(<circle key="b1" cx={CX} cy={yN + 24} r={1.5} fill={trimShade} />, <circle key="b2" cx={CX} cy={yN + 38} r={1.5} fill={trimShade} />);
  }
  // Outer shoulder line: the only heavy ink on the shirt; it fades towards the card edge.
  els.push(<path key="oR" d={stroke(shoulderR, { w: 2, start: 0.6, end: 0.1, peak: 0.2, seed: 241 })} fill={INK} />);
  els.push(<path key="oL" d={stroke(shoulderL, { w: 1.5, start: 0.6, end: 0.1, peak: 0.2, seed: 243 })} fill={INK} />);
  return <g>{els}</g>;
}

function sampleLine(pts: Pt[], u: number): Pt {
  const n = pts.length - 1;
  const x = Math.min(n - 1e-6, u * n);
  const i = Math.floor(x);
  const t = x - i;
  return P(lerp(pts[i][0], pts[i + 1][0], t), lerp(pts[i][1], pts[i + 1][1], t));
}

/** A collar per player, stable for life. */
export const collarFor = (seed: number): Collar => COLLARS[Math.floor(hash01(seed, 404) * COLLARS.length)];
