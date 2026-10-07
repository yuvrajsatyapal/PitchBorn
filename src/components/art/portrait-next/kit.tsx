import { CX, hash01, lerp, type Pt } from "../portrait/geometry";
import type { NextSpec } from "./head";
import { blob, ring, stroke, strokeLine } from "./ink";
import { neckline, type CollarCut, type Neckline } from "./neck";
import { INK, shift } from "./palette";
import type { Detail } from "./face";

/** Period shirt collars. Chosen per player, so a squad doesn't all wear the same cut. */
export const COLLARS = ["crew", "ribbed", "vneck", "fold", "polo"] as const;
export type Collar = (typeof COLLARS)[number];

const CUTS: Record<Collar, CollarCut> = {
  crew: { dip: 9, h: 5.5, back: 6 },
  ribbed: { dip: 9, h: 8, back: 7 },
  vneck: { dip: 30, h: 6.5, back: 5, v: true },
  fold: { dip: 7, h: 4.5, back: 6 },
  // A polo's collar stands up behind the neck.
  polo: { dip: 6, h: 5, back: 10 },
};

export const necklineFor = (f: NextSpec, collar: Collar): Neckline => neckline(f, CUTS[collar]);

const P = (x: number, y: number): Pt => [x, y];

interface KitProps {
  f: NextSpec;
  kit: string;
  trim: string;
  collar: Collar;
  d: Detail;
  line: Neckline;
}

function colours(kit: string, trim: string) {
  return {
    shade: shift(kit, -4, 0.02, -0.12),
    deep: shift(kit, -6, 0.04, -0.2),
    inside: shift(kit, -8, 0.02, -0.28),
    light: shift(kit, 4, -0.04, 0.08),
    trimShade: shift(trim, -4, 0.02, -0.14),
    trimDeep: shift(trim, -6, 0.04, -0.26),
  };
}

function shoulders(line: Neckline) {
  const { Lo, Ro } = line;
  // The shoulder line leaves the collar, rises a touch over the trapezius, then falls away to the card edge.
  const right: Pt[] = [Ro, P(Ro[0] + 28, Ro[1] + 7), P(Ro[0] + 70, 317), P(330, 336)];
  const left: Pt[] = [Lo, P(Lo[0] - 28, Lo[1] + 8), P(Lo[0] - 70, 318), P(-30, 338)];
  return { left, right };
}

const band = (a: Pt[], b: Pt[]) => ring([...a, ...b.slice().reverse()]);

/**
 * Everything of the shirt that lies behind the neck: the torso (its top edge runs over the shoulders and round the
 * back of the collar), its shading, the dark inside of the opening and the back of the collar.
 */
export function KitBack({ kit, trim, d, line }: KitProps) {
  const c = colours(kit, trim);
  const { left, right } = shoulders(line);
  const body = ring([P(-30, 362), ...left.slice().reverse(), ...line.backOut.slice(1, -1), ...right, P(330, 362)]);
  const { Lo, Ro, y, open } = line;
  return (
    <g>
      <path d={body} fill={kit} />
      {/* Shadow plane on the far shoulder, light on the near one, and the shadow the collar casts on the chest. */}
      <path d={blob([P(CX + open * 0.5, y + 18), P(Ro[0] + 20, y + 12), P(332, 330), P(332, 364), P(CX + 74, 364), P(CX + 58, 334)], 0.45)} fill={c.shade} />
      <path d={blob([P(Lo[0] - 46, 315), P(Lo[0] - 14, y + 10), P(Lo[0] + 6, y + 22), P(Lo[0] - 30, 327)], 0.5)} fill={c.light} opacity={0.55} />
      <path d={strokeLine(line.frontOut.map((p) => P(p[0] + 1, p[1] + 3)), { w: 5, start: 0.3, end: 0.6, peak: 0.65, seed: 205 })} fill={c.shade} opacity={0.7} />
      {d > 0 && (
        <>
          <path d={stroke([P(60, 333), P(72, 343), P(77, 360)], { w: 2.4, start: 0.1, end: 0.2, seed: 201 })} fill={c.shade} />
          <path d={stroke([P(CX + 40, 334), P(CX + 46, 346), P(CX + 44, 362)], { w: 2.6, start: 0.1, end: 0.2, seed: 203 })} fill={c.deep} opacity={0.6} />
        </>
      )}
      {/* Inside of the shirt, seen through the opening beside the neck. */}
      <path d={band(line.backIn, line.frontIn)} fill={c.inside} />
      {/* Back of the collar, in shadow, rising behind the neck. */}
      <path d={band(line.backOut, line.backIn)} fill={c.trimShade} />
      <path d={band(line.backOut.filter((p) => p[0] > CX), line.backIn.filter((p) => p[0] > CX))} fill={c.trimDeep} opacity={0.5} />
      {d > 0 && <path d={strokeLine(line.backOut, { w: 0.9, start: 0.6, end: 0.6, seed: 207 })} fill={INK} opacity={0.6} />}
    </g>
  );
}

/** The front of the collar (in front of the neck), its details, and the shoulder ink. */
export function KitFront({ kit, trim, collar, d, line }: KitProps) {
  const c = colours(kit, trim);
  const { left, right } = shoulders(line);
  const { y, open, frontIn, frontOut } = line;
  const cut = CUTS[collar];
  const els = [];
  const rightHalf = (pts: Pt[]) => pts.filter((p) => p[0] >= CX - 0.01);
  if (collar === "fold") {
    // Retro fold-down collar: two leaves lying on the chest, folded over at the neckline, a short placket between.
    const leaf = (s: 1 | -1) => {
      const half = frontIn.filter((p) => s * (p[0] - CX) >= -0.01);
      const fromCentre = s > 0 ? half : half.slice().reverse();
      return ring([...fromCentre, P(CX + s * (open + 9), y + 3), P(CX + s * (open * 0.62), y + 27), P(CX + s * 2.5, y + cut.dip + 7)]);
    };
    els.push(<path key="pl" d={ring([P(CX - 3.5, y + cut.dip), P(CX + 3.5, y + cut.dip), P(CX + 3, y + 52), P(CX - 3, y + 52)])} fill={c.shade} />);
    els.push(<path key="lfR" d={leaf(1)} fill={c.trimShade} />, <path key="lfL" d={leaf(-1)} fill={trim} />);
    if (d > 0) els.push(<circle key="bt" cx={CX} cy={y + 42} r={1.6} fill={c.trimDeep} />);
    els.push(
      <path key="lfRi" d={stroke([P(CX + open + 9, y + 3), P(CX + open * 0.62, y + 27), P(CX + 2.5, y + cut.dip + 7)], { w: 1.1, start: 0.4, end: 0.4, seed: 225, steps: 3 })} fill={INK} opacity={0.75} />,
      <path key="lfLi" d={stroke([P(CX - open - 9, y + 3), P(CX - open * 0.62, y + 27), P(CX - 2.5, y + cut.dip + 7)], { w: 0.9, start: 0.4, end: 0.4, seed: 227, steps: 3 })} fill={INK} opacity={0.6} />,
    );
  } else {
    if (collar === "polo") {
      els.push(<path key="pl" d={ring([P(CX - 6, y + cut.dip + 2), P(CX + 6, y + cut.dip + 2), P(CX + 5, y + 50), P(CX - 5, y + 50)])} fill={trim} />);
      els.push(<path key="pls" d={stroke([P(CX + 6, y + cut.dip + 3), P(CX + 5, y + 50)], { w: 1, seed: 229, steps: 2 })} fill={INK} opacity={0.45} />);
      if (d > 0) els.push(<circle key="b1" cx={CX} cy={y + 24} r={1.5} fill={c.trimDeep} />, <circle key="b2" cx={CX} cy={y + 38} r={1.5} fill={c.trimDeep} />);
    }
    els.push(<path key="c" d={band(frontOut, frontIn)} fill={trim} />);
    els.push(<path key="cs" d={band(rightHalf(frontOut), rightHalf(frontIn))} fill={c.trimShade} opacity={0.8} />);
    if (collar === "ribbed" && d > 0) {
      const n = d === 2 ? 16 : 10;
      for (let i = 1; i < n; i++) {
        const u = i / n;
        els.push(<path key={`r${i}`} d={stroke([sample(frontIn, u), sample(frontOut, u)], { w: 0.6, steps: 2, seed: 210 + i })} fill={c.trimDeep} opacity={0.55} />);
      }
    }
    if (d > 0) els.push(<path key="co" d={strokeLine(rightHalf(frontOut), { w: 0.9, start: 0.3, end: 0.6, seed: 233 })} fill={INK} opacity={0.45} />);
  }
  // The edge the neck disappears behind, and the outer shoulder line (the only heavy ink on the shirt).
  els.push(<path key="ci" d={strokeLine(frontIn, { w: 1.1, start: 0.5, end: 0.5, seed: 221, wobble: 0.1 })} fill={INK} opacity={0.75} />);
  els.push(<path key="oR" d={stroke(right, { w: 2, start: 0.6, end: 0.1, peak: 0.2, seed: 241 })} fill={INK} />);
  els.push(<path key="oL" d={stroke(left, { w: 1.5, start: 0.6, end: 0.1, peak: 0.2, seed: 243 })} fill={INK} />);
  return <g>{els}</g>;
}

/** Point at fraction u along a polyline (by index). */
function sample(pts: Pt[], u: number): Pt {
  const n = pts.length - 1;
  const x = Math.min(n - 1e-6, u * n);
  const i = Math.floor(x);
  const t = x - i;
  return P(lerp(pts[i][0], pts[i + 1][0], t), lerp(pts[i][1], pts[i + 1][1], t));
}

/** A collar per player, stable for life. */
export const collarFor = (seed: number): Collar => COLLARS[Math.floor(hash01(seed, 404) * COLLARS.length)];
