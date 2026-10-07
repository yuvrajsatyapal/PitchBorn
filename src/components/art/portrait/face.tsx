import type { FaceSpec, Head } from "./anatomy";
import { q, CX, FINE, INK, MID, OUT, along, cubicAt, darken, lighten, luminance, mix, poly, r1, ribbon, spline, sw, taper, type Pt, type Seg } from "./geometry";

export interface Skin {
  base: string;
  shade: string;
  deep: string;
  light: string;
  lipUp: string;
  lipLo: string;
  lipHi: string;
}

/** Three flat tones (base, shadow, highlight) plus lip colours, tuned so dark skin keeps visible modelling. */
export function skinPalette(base: string): Skin {
  const lum = luminance(base);
  const dark = 1 - lum;
  return {
    base,
    shade: mix(darken(base, 0.16 + 0.04 * lum), "#7c2c18", 0.1 + 0.04 * lum),
    deep: mix(darken(base, 0.42), "#3e140b", 0.18),
    light: mix(lighten(base, 0.1 + 0.16 * dark), "#ffe2c4", 0.12 + 0.1 * dark),
    lipUp: mix(darken(base, 0.27 + 0.06 * dark), "#7a2a26", 0.36 - 0.12 * dark),
    lipLo: mix(darken(base, 0.06), "#b4574c", 0.36 - 0.14 * dark),
    lipHi: mix(lighten(base, 0.14 + 0.12 * dark), "#f0b8a8", 0.2),
  };
}

const P = (x: number, y: number): Pt => [x, y];

// ------------------------------------------------------------------ head and shading

/**
 * Flat, deliberately shaped shadow planes (no gradients), lit from the upper left: the right side plane with a
 * cheekbone step, hollows under both cheekbones, temples, the chin's underside and highlights on the lit planes.
 */
export function FacePlanes({ f, head, skin, halftone }: { f: FaceSpec; head: Head; skin: Skin; halftone?: string }) {
  const R = head.right;
  const L = head.left;
  const e = f.eye;
  const eyeOut = CX + e.gap + e.w;
  // Right side plane: temple, around the eye socket, a hard step at the cheekbone, in under it, down the jaw.
  const side = spline(
    [
      P(CX + f.skullW * 0.55, f.top - 4),
      P(CX + f.skullW * 0.74, f.top + 22),
      P(R.T[0] - 11, R.T[1] - 4),
      P(eyeOut + 9, f.eyeY - 6),
      P(R.K[0] - 13, R.K[1] - 3),
      P(R.K[0] - 25, R.K[1] + 17),
      P(CX + f.mouth.w + 17, f.mouthY - 2),
      P(R.J[0] - 15, R.J[1] - 1),
      P(R.Q[0] + 2, R.Q[1] + 2),
      P(CX + f.chinW * 0.4, f.chinY + 6),
    ],
    false,
    0.35,
  );
  const sideD = `${side}L${CX + 140} ${f.chinY + 20}L${CX + 140} ${f.top - 20}Z`;
  // Lit side: a narrow temple shadow and the hollow under the cheekbone.
  const templeL = spline([P(L.T[0] - 4, f.top + 30), P(L.T[0] + 7, L.T[1] - 10), P(L.T[0] + 5, L.T[1] + 14), P(L.K[0] - 4, L.K[1] - 8)], false, 0.4);
  const templeLD = `${templeL}L${L.K[0] - 30} ${L.K[1]}L${L.T[0] - 30} ${f.top + 30}Z`;
  const hollow = (s: 1 | -1, k: Pt) =>
    spline(
      [
        P(k[0] - s * 3, k[1] + 6),
        P(CX + s * (f.mouth.w + 16), f.mouthY - 10),
        P(CX + s * (f.mouth.w + 12), f.mouthY + 2),
        P(k[0] - s * 8, (k[1] + f.jawY) / 2 + 4),
        P(k[0] + s * 6, k[1] + 14),
      ],
      true,
      0.3,
    );
  // The underside of the chin and jaw turns away from the light.
  const chinUnder = q(`M${CX - f.chinW - 14} ${f.chinY - 5}Q${CX} ${f.chinY + 1} ${CX + f.chinW + 14} ${f.chinY - 5}L${CX + f.chinW + 60} ${f.chinY + 30}L${CX - f.chinW - 60} ${f.chinY + 30}Z`);
  // Highlights: forehead, the lit cheekbone and the chin pad.
  const fore = spline([P(CX - f.templeW * 0.6, f.browY - 14), P(CX - f.templeW * 0.45, f.browY - 30), P(CX - 10, f.browY - 34), P(CX - 2, f.browY - 22), P(CX - 14, f.browY - 13)], true, 0.45);
  const cheekHi = spline([P(L.K[0] + 7, L.K[1] - 16), P(L.K[0] + 22, L.K[1] - 13), P(L.K[0] + 30, L.K[1] - 6), P(L.K[0] + 12, L.K[1] - 6)], true, 0.4);
  return (
    <g>
      <path d={sideD} fill={skin.shade} />
      <path d={templeLD} fill={skin.shade} opacity={0.75} />
      <path d={hollow(-1, L.K)} fill={skin.shade} opacity={0.5} />
      <path d={hollow(1, R.K)} fill={skin.shade} />
      {/* Retro print only: a halftone screen in the deepest part of the side plane. */}
      {halftone && <path d={hollow(1, R.K)} fill={halftone} opacity={0.5} />}
      <path d={chinUnder} fill={skin.shade} />
      <path d={fore} fill={skin.light} opacity={0.38} />
      <path d={cheekHi} fill={skin.light} opacity={0.55} />
      <path d={q(`M${CX - f.chinW * 0.62} ${f.chinY - 11}Q${CX - 4} ${f.chinY - 19} ${CX + f.chinW * 0.4} ${f.chinY - 12}Q${CX - 4} ${f.chinY - 14} ${CX - f.chinW * 0.62} ${f.chinY - 11}Z`)} fill={skin.light} opacity={0.7} />
      {f.cleft > 0 && <path d={q(`M${CX + 0.5} ${f.chinY - 15}q-1 5 0.5 9`)} stroke={INK} opacity={0.5 * f.cleft} {...sw(FINE)} />}
    </g>
  );
}

// ------------------------------------------------------------------ eyes

function eyeParts(f: FaceSpec, s: 1 | -1) {
  const e = f.eye;
  const right = s > 0;
  const h = e.h * (right ? 1 - f.asym.eye : 1);
  const ex = CX + s * e.gap;
  const ey = f.eyeY + (right ? f.asym.eye * 6 : 0);
  const X = (u: number) => ex + s * (-e.w + 2 * e.w * u);
  const I = P(X(0), ey + 0.9);
  const O = P(X(1), ey + e.tilt);
  const up: Seg = [I, P(X(0.12), ey - h * 0.9), P(X(0.64), ey - h * 1.24), O];
  const lo: Seg = [O, P(X(0.76), ey + e.lo * 1.12 + e.tilt * 0.4), P(X(0.26), ey + e.lo * 1.02), I];
  return { e, h, ex, ey, X, I, O, up, lo };
}

const segD = (s: Seg) => q(`M${r1(s[0][0])} ${r1(s[0][1])}C${r1(s[1][0])} ${r1(s[1][1])} ${r1(s[2][0])} ${r1(s[2][1])} ${r1(s[3][0])} ${r1(s[3][1])}`);
const segC = (s: Seg) => `C${r1(s[1][0])} ${r1(s[1][1])} ${r1(s[2][0])} ${r1(s[2][1])} ${r1(s[3][0])} ${r1(s[3][1])}`;

export function EyeSockets({ f, skin }: { f: FaceSpec; skin: Skin }) {
  const one = (s: 1 | -1) => {
    const { e, h, ey, X } = eyeParts(f, s);
    const top = ey - h - e.crease - 5 - e.deep * 3;
    const d = q(`M${X(-0.08)} ${ey}C${X(0.1)} ${top} ${X(0.7)} ${top - 1} ${X(1.16)} ${ey + e.tilt - 3}C${X(0.8)} ${ey - h * 0.7} ${X(0.3)} ${ey - h * 0.9} ${X(-0.08)} ${ey}Z`);
    return <path key={s} d={d} fill={skin.shade} opacity={s > 0 ? 1 : 0.55 + e.deep * 0.4} />;
  };
  return (
    <g>
      {one(1)}
      {one(-1)}
    </g>
  );
}

export function Eyes({ f, skin, iris, uid, lines }: { f: FaceSpec; skin: Skin; iris: string; uid: string; lines: number }) {
  const one = (s: 1 | -1) => {
    const { e, h, ex, ey, X, I, O, up, lo } = eyeParts(f, s);
    const id = `${uid}eye${s > 0 ? "r" : "l"}`;
    const shape = `${segD(up)}${segC(lo)}Z`;
    // Gaze is straight ahead with the irises a touch inwards: focused, not wide-eyed.
    const ix = ex - s * 0.7;
    const iy = ey - h * 0.16;
    const ir = e.iris;
    // Upper-lid ink: thin at the inner corner, heavy towards the outer corner, ending in a short flick.
    const lidPts: Pt[] = Array.from({ length: 13 }, (_, i) => cubicAt(up, i / 12));
    const flick = P(O[0] + s * 3.4, O[1] - 1.3 + Math.max(0, e.tilt) * 0.5);
    const lash = ribbon([...lidPts, flick], (u) => e.lash * (0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, u * 0.78 + 0.08))) * (u > 0.93 ? 0.55 : 1));
    // Lash band sits slightly above the lid line so the white keeps its shape.
    const crease = q(`M${X(0.06)} ${ey - h * 0.95 - 0.8}C${X(0.3)} ${ey - h - e.crease * 1.2} ${X(0.78)} ${ey - h * 0.95 - e.crease * 0.95 + e.tilt * 0.5} ${X(1.1)} ${ey + e.tilt - h * 0.35}`);
    const lower = q(`M${X(0.12)} ${ey + e.lo * 0.92}C${X(0.42)} ${ey + e.lo * 1.3} ${X(0.8)} ${ey + e.lo * 1.08 + e.tilt * 0.45} ${O[0] - s * 0.6} ${O[1] + 0.4}`);
    const under = q(`M${X(0.12)} ${ey + e.lo + 4.6 + e.bag}Q${X(0.5)} ${ey + e.lo + 7.4 + e.bag * 1.6} ${X(0.98)} ${ey + e.lo + 3.2 + e.tilt * 0.6}`);
    const lidShadow = `${segD(up)}L${O[0]} ${O[1] + h * 0.5}C${X(0.62)} ${ey - h * 0.15} ${X(0.12)} ${ey - h * 0.05} ${I[0]} ${I[1] + h * 0.35}Z`;
    return (
      <g key={s}>
        <defs>
          <clipPath id={id}>
            <path d={shape} />
          </clipPath>
        </defs>
        <path d={shape} fill="#efe7da" />
        <g clipPath={`url(#${id})`}>
          <circle cx={ix} cy={iy} r={ir} fill={iris} />
          <circle cx={ix} cy={iy} r={ir * 0.62} fill={darken(iris, 0.25)} opacity={0.55} />
          <circle cx={ix} cy={iy} r={ir * 0.42} fill="#140d0a" />
          <circle cx={ix} cy={iy} r={ir - 0.4} stroke={darken(iris, 0.5)} {...sw(0.9)} />
          <path d={lidShadow} fill="#2a1b14" opacity={0.26} />
          <circle cx={ix - ir * 0.36} cy={iy - ir * 0.34} r={Math.max(0.9, ir * 0.2)} fill="#fffaf2" />
        </g>
        <path d={lower} stroke={INK} opacity={0.55} {...sw(FINE * 0.85)} />
        <path d={lash} fill={INK} />
        <path d={q(`M${I[0] - s * 0.4} ${I[1] - 0.2}l${-s * 1.6} ${0.7}`)} stroke={INK} {...sw(FINE)} />
        {e.hood > 0 ? (
          <path d={q(`M${X(0.04)} ${ey - h * 0.9}C${X(0.3)} ${ey - h - e.crease * 0.9} ${X(0.8)} ${ey - h - e.crease * 0.6} ${X(1.12)} ${ey + e.tilt - h * 0.15}C${X(0.8)} ${ey - h * 0.8} ${X(0.35)} ${ey - h * 1.05} ${X(0.04)} ${ey - h * 0.9}Z`)} fill={skin.shade} stroke={INK} strokeOpacity={0.6} {...{ strokeWidth: FINE, strokeLinejoin: "round" as const }} />
        ) : (
          <path d={crease} stroke={INK} opacity={0.5} {...sw(FINE)} />
        )}
        <path d={under} stroke={skin.shade} opacity={0.55 + e.bag * 0.3} {...sw(1.6)} />
        {(e.bag > 0.5 || lines > 0.3) && <path d={under} stroke={INK} opacity={0.18 + 0.2 * Math.max(lines, e.bag * 0.5)} {...sw(FINE * 0.8)} />}
        {lines > 0.35 && <path d={q(`M${O[0] + s * 3} ${O[1] + 1}l${s * 4} 1.6M${O[0] + s * 2.4} ${O[1] + 4}l${s * 3.6} 2.8`)} stroke={INK} opacity={0.35 * lines} {...sw(FINE * 0.8)} />}
      </g>
    );
  };
  return (
    <g>
      {one(1)}
      {one(-1)}
    </g>
  );
}

// ------------------------------------------------------------------ eyebrows

export function Brows({ f, color, lite }: { f: FaceSpec; color: string; lite?: boolean }) {
  const b = f.brow;
  const one = (s: 1 | -1) => {
    const dy = s > 0 ? f.asym.brow : 0;
    const x0 = CX + s * b.gap;
    const x1 = CX + s * (b.gap + b.len);
    const y0 = f.eyeY - b.low + dy;
    const y1 = y0 - b.lift - (s > 0 ? f.asym.brow * 0.4 : 0);
    const xp = x0 + s * b.len * b.peak;
    const yp = y0 + (y1 - y0) * b.peak - b.arch;
    // Straighter underside, arched top, a blunt head with a few hairs and a pointed tail.
    const bottom = along([P(x0, y0 + b.head * 0.42), P(xp, yp + b.mid * 0.42), P(x1 + s * 1.5, y1 + b.tail * 0.35)], 6, 0.5);
    const top = along([P(x1 + s * 1.5, y1 + b.tail * 0.35), P(x1 - s * 4, y1 - b.tail * 0.5), P(xp, yp - b.mid * 0.62), P(x0 + s * 2, y0 - b.head * 0.62)], 6, 0.5);
    const headHairs: Pt[] = [P(x0 + s * 0.6, y0 - b.head * 0.55), P(x0 - s * 1.6, y0 - b.head * 0.35), P(x0 + s * 0.4, y0 - b.head * 0.12), P(x0 - s * 1.3, y0 + b.head * 0.12), P(x0 + s * 0.2, y0 + b.head * 0.3)];
    const d = `${poly([...bottom, ...top.slice(1), ...headHairs])}Z`;
    const hairs: string[] = [];
    for (let i = 0; i < 7; i++) {
      const u = 0.08 + i * 0.12;
      const x = x0 + (x1 - x0) * u;
      const y = u < b.peak ? y0 + (yp - y0) * (u / b.peak) : yp + (y1 - yp) * ((u - b.peak) / (1 - b.peak));
      hairs.push(`M${r1(x)} ${r1(y + b.mid * 0.25)}l${r1(s * (2.2 + (i % 2)))} ${r1(-b.mid * 0.5)}`);
    }
    return (
      <g key={s}>
        <path d={d} fill={color} />
        {!lite && <path d={hairs.join("")} stroke={darken(color, 0.35)} opacity={0.6} {...sw(0.9)} />}
        {b.ragged > 0 && <path d={top.filter((_, i) => i % 2 === 1).map((p, i) => q(`M${r1(p[0])} ${r1(p[1] + 1)}l${r1(s * (2.6 + (i % 2)))} ${r1(-1.4 * b.ragged - 0.6)}`)).join("")} stroke={color} opacity={0.85} {...sw(1.2)} />}
      </g>
    );
  };
  return (
    <g>
      {one(1)}
      {one(-1)}
    </g>
  );
}

// ------------------------------------------------------------------ nose

export function Nose({ f, skin }: { f: FaceSpec; skin: Skin }) {
  const n = f.nose;
  const ny = f.noseY;
  const nx = CX + n.crook;
  const w = n.w;
  const top = f.browY + 6;
  const midY = f.eyeY + (ny - f.eyeY) * 0.4;
  // Side plane in shadow on the right: from beside the bridge down to the wing, against the cheek.
  const plane = q(`M${CX + n.bridge * 0.5} ${top}C${CX + n.bridge + n.hump * 0.7 + n.crook * 0.3} ${midY} ${nx + w * 0.5} ${ny - 20} ${nx + w * 0.74} ${ny - 11}L${nx + w + n.flare} ${ny - 5}C${nx + w + 7} ${ny - 18} ${CX + n.bridge + 11} ${f.eyeY + 4} ${CX + n.bridge + 8} ${top + 2}Z`);
  const bridgeR = q(`M${CX + n.bridge * 0.75} ${f.eyeY - 3}C${CX + n.bridge + n.hump + n.crook * 0.4} ${midY} ${nx + w * 0.48} ${ny - 21} ${nx + w * 0.72} ${ny - 11.5}`);
  const bridgeL = q(`M${CX - n.bridge * 0.85 + n.crook * 0.3} ${midY + 6}C${CX - n.bridge - 0.6 + n.crook * 0.5} ${ny - 22} ${nx - w * 0.52} ${ny - 17} ${nx - w * 0.72} ${ny - 11.5}`);
  const wing = (s: 1 | -1) => q(`M${nx + s * w * 0.64} ${ny - 13.5}C${nx + s * (w + n.flare + 1.6)} ${ny - 13} ${nx + s * (w + n.flare * 0.8 + 1)} ${ny - 2.5} ${nx + s * w * 0.86} ${ny - 0.4}`);
  const nostril = (s: 1 | -1) => {
    const cx = nx + s * (n.tip * 0.4 + w * 0.2);
    const cy = ny - 0.4 - n.up * 0.5;
    const rx = 3.6 * n.nostril + n.up * 0.4;
    const ry = 1.25 * n.nostril + n.up * 0.9;
    return <ellipse key={s} cx={cx} cy={cy} rx={rx} ry={ry} transform={`rotate(${-s * 10} ${cx} ${cy})`} fill="#1c110c" opacity={0.9} />;
  };
  const tipUnder = q(`M${nx - n.tip * 0.3} ${ny + 0.2}Q${nx} ${ny + n.drop + 1.6} ${nx + n.tip * 0.3} ${ny + 0.2}`);
  const tipEdge = q(`M${nx + n.tip * 0.92} ${ny - 10}Q${nx + n.tip * 1.08} ${ny - 4.5} ${nx + n.tip * 0.66} ${ny - 1.6}`);
  const cast = q(`M${nx - n.tip * 0.7} ${ny + 1.4}Q${nx + 3} ${ny + 10} ${nx + w + 4} ${ny + 1.4}Q${nx + w * 0.5} ${ny + 3.2} ${nx - n.tip * 0.7} ${ny + 1.4}Z`);
  return (
    <g>
      <path d={plane} fill={skin.shade} />
      <path d={cast} fill={skin.shade} />
      <path d={cast} fill={skin.deep} opacity={0.25} />
      <path d={q(`M${CX - n.bridge * 0.25} ${f.eyeY + 1}C${CX - n.bridge * 0.25 + n.crook * 0.2} ${midY + 8} ${nx - 1.5} ${ny - 18} ${nx - 1.5} ${ny - 13}`)} stroke={skin.light} {...sw(3.2)} />
      <ellipse cx={nx - n.tip * 0.22} cy={ny - 7} rx={n.tip * 0.42} ry={2.4} fill={skin.light} />
      <path d={bridgeR} stroke={INK} opacity={0.85} {...sw(FINE * 1.1)} />
      <path d={bridgeL} stroke={INK} opacity={0.4} {...sw(FINE)} />
      <path d={tipEdge} stroke={INK} opacity={0.45} {...sw(FINE)} />
      {nostril(1)}
      {nostril(-1)}
      <path d={wing(1)} stroke={INK} {...sw(MID)} />
      <path d={wing(-1)} stroke={INK} opacity={0.8} {...sw(MID * 0.85)} />
      <path d={tipUnder} stroke={INK} opacity={0.8} {...sw(FINE)} />
    </g>
  );
}

// ------------------------------------------------------------------ mouth

export function Mouth({ f, skin }: { f: FaceSpec; skin: Skin }) {
  const m = f.mouth;
  const my = f.mouthY;
  const a = f.asym.mouth;
  const L = P(CX - m.w, my - m.corner + m.smirk * 0.3);
  const R = P(CX + m.w + a * 0.6, my - m.corner - m.smirk + a * 0.5);
  const centre = [L, P(CX - m.w * 0.45, my + 0.4), P(CX, my + 1.1), P(CX + m.w * 0.45, my + 0.4 + a * 0.2), R];
  const line = along(centre, 6, 0.5);
  const upperEdge = along([L, P(CX - m.w * 0.64, my - m.up * 0.58), P(CX - m.bow, my - m.up), P(CX, my - m.up * 0.72), P(CX + m.bow, my - m.up), P(CX + m.w * 0.64, my - m.up * 0.58 + a * 0.3), R], 5, 0.5);
  const lowerEdge = along([L, P(CX - m.w * 0.52, my + m.lo * 0.8), P(CX, my + m.lo + m.part), P(CX + m.w * 0.52, my + m.lo * 0.8 + a * 0.3), R], 6, 0.5);
  const upper = `${poly(upperEdge)}${line.slice().reverse().map((p) => `L${r1(p[0])} ${r1(p[1])}`).join("")}Z`;
  const lower = `${poly(line)}${lowerEdge.slice().reverse().map((p) => `L${r1(p[0])} ${r1(p[1])}`).join("")}Z`;
  const gap = m.part > 0 ? ribbon(line, taper(m.part * 2 + 1.8, 0.5)) : null;
  const mouthLine = ribbon(line, (u) => 0.55 + 1.85 * Math.pow(Math.sin(Math.PI * u), 0.6));
  const lb = my + m.lo + m.part;
  return (
    <g>
      {/* philtrum and the shadow under the lower lip */}
      <path d={q(`M${CX - 3.6} ${f.noseY + 4}L${CX + 3.6} ${f.noseY + 4}L${CX + m.bow * 0.85} ${my - m.up - 0.6}L${CX - m.bow * 0.85} ${my - m.up - 0.6}Z`)} fill={skin.shade} opacity={0.6} />
      <path d={q(`M${CX - m.w * 0.62} ${lb + 0.4}Q${CX} ${lb + 9} ${CX + m.w * 0.7} ${lb + 0.4}Q${CX} ${lb + 3.5} ${CX - m.w * 0.62} ${lb + 0.4}Z`)} fill={skin.shade} />
      <path d={lower} fill={skin.lipLo} />
      <path d={q(`M${CX - m.w * 0.42} ${my + m.lo * 0.42 + m.part}Q${CX - m.w * 0.12} ${my + m.lo * 0.66 + m.part} ${CX + m.w * 0.12} ${my + m.lo * 0.44 + m.part}Q${CX - m.w * 0.14} ${my + m.lo * 0.38 + m.part} ${CX - m.w * 0.42} ${my + m.lo * 0.42 + m.part}Z`)} fill={skin.lipHi} opacity={0.8} />
      <path d={upper} fill={skin.lipUp} />
      <path d={poly(upperEdge)} stroke={INK} opacity={0.22} {...sw(FINE * 0.8)} />
      {gap && <path d={gap} fill="#2a110c" />}
      {m.teeth > 0 && <path d={ribbon(along([P(CX - m.w * 0.6, my + 0.8), P(CX, my + 1.6), P(CX + m.w * 0.6, my + 0.8)], 5), taper(m.teeth, 0.6))} fill="#efe8dc" />}
      <path d={mouthLine} fill={INK} />
      <path d={q(`M${L[0] + 0.4} ${L[1]}q-1.4 ${m.corner < 0 ? 0.8 : -0.4} -1.6 ${m.corner < 0 ? 1.8 : 0.8}M${R[0] - 0.4} ${R[1]}q1.4 ${m.corner < 0 ? 0.8 : -0.4} 1.6 ${m.corner < 0 ? 1.8 : 0.8}`)} stroke={INK} opacity={0.5} {...sw(FINE * 0.9)} />
    </g>
  );
}

// ------------------------------------------------------------------ ears

export function Ears({ f, head, skin, studs }: { f: FaceSpec; head: Head; skin: Skin; studs?: boolean }) {
  const one = (s: 1 | -1) => {
    const e = f.ear;
    const dy = s > 0 ? f.asym.ear : 0;
    const t = e.top + dy;
    const b = e.bot + dy * 0.6;
    const h = b - t;
    const w = e.w * (s > 0 ? 1.04 : 1);
    const ax = CX + s * (head.half(t + h * 0.4, s) - 5);
    const X = (dx: number) => ax + s * dx;
    const outer = q(`M${X(0)} ${t + 2}C${X(w * 0.55)} ${t - 7} ${X(w * 1.15)} ${t - 2} ${X(w * 1.08)} ${t + h * 0.3}C${X(w * 1.02)} ${t + h * 0.55} ${X(w * 0.68)} ${t + h * 0.72} ${X(w * 0.5)} ${b - 6}C${X(w * 0.4)} ${b + 2} ${X(w * 0.02)} ${b + 2} ${X(-2)} ${b - 4}Z`);
    const rim = q(`M${X(2.5)} ${t + 3.5}C${X(w * 0.55)} ${t - 2} ${X(w * 0.9)} ${t + 2} ${X(w * 0.84)} ${t + h * 0.32}C${X(w * 0.8)} ${t + h * 0.5} ${X(w * 0.52)} ${t + h * 0.6} ${X(w * 0.4)} ${t + h * 0.74}`);
    const concha = q(`M${X(w * 0.18)} ${t + h * 0.3}C${X(w * 0.6)} ${t + h * 0.2} ${X(w * 0.66)} ${t + h * 0.46} ${X(w * 0.38)} ${t + h * 0.66}C${X(w * 0.2)} ${t + h * 0.7} ${X(w * 0.08)} ${t + h * 0.6} ${X(w * 0.1)} ${t + h * 0.5}Z`);
    return (
      <g key={s}>
        <path d={outer} fill={s > 0 ? skin.shade : skin.base} stroke={INK} strokeWidth={OUT * 0.85} strokeLinejoin="round" />
        <path d={concha} fill={s > 0 ? skin.deep : skin.shade} opacity={s > 0 ? 0.5 : 0.85} />
        <path d={rim} stroke={INK} opacity={0.75} {...sw(FINE)} />
        <path d={q(`M${X(1.5)} ${t + h * 0.52}q${s * 3} 1 ${s * 3.4} 4.6`)} stroke={INK} opacity={0.6} {...sw(FINE)} />
        {studs && <circle cx={X(w * 0.32)} cy={b - 3} r={2.2} fill="#e8d28a" stroke={INK} strokeWidth={0.9} />}
      </g>
    );
  };
  return (
    <g>
      {one(1)}
      {one(-1)}
    </g>
  );
}

// ------------------------------------------------------------------ neck and shirt

export function Neck({ f, head, skin }: { f: FaceSpec; head: Head; skin: Skin }) {
  const nw = f.neckW;
  const y0 = f.jawY - 30;
  const base = 352;
  const d = q(`M${CX - nw} ${y0}C${CX - nw + 1} ${y0 + 40} ${CX - nw - 3} ${base - 30} ${CX - nw - 8} ${base}L${CX + nw + 8} ${base}C${CX + nw + 3} ${base - 30} ${CX + nw - 1} ${y0 + 40} ${CX + nw} ${y0}Z`);
  // The jaw casts a shadow onto the neck that follows the jawline, deeper on the right.
  const R = head.right;
  const L = head.left;
  const cast = q(`M${CX - nw - 4} ${y0}L${CX + nw + 4} ${y0}L${CX + nw + 4} ${R.J[1] + 34}C${R.J[0] - 18} ${R.J[1] + 26} ${CX + f.chinW + 12} ${f.chinY + 16} ${CX} ${f.chinY + 19}C${CX - f.chinW - 14} ${f.chinY + 17} ${L.J[0] + 20} ${L.J[1] + 20} ${CX - nw - 4} ${L.J[1] + 22}Z`);
  const sideR = q(`M${CX + nw - 13} ${y0}C${CX + nw - 12} ${y0 + 40} ${CX + nw - 16} 290 ${CX + nw - 20} 310L${CX + nw + 10} 310L${CX + nw + 6} ${y0}Z`);
  const muscles = q(`M${CX - nw + 8} ${f.jawY + 6}C${CX - nw + 16} ${f.jawY + 36} ${CX - 18} 296 ${CX - 8} 314M${CX + nw - 8} ${f.jawY + 8}C${CX + nw - 16} ${f.jawY + 38} ${CX + 18} 296 ${CX + 8} 314`);
  return (
    <g>
      <path d={d} fill={skin.base} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
      <path d={sideR} fill={skin.shade} />
      <path d={cast} fill={skin.shade} />
      <path d={muscles} stroke={INK} opacity={0.32} {...sw(FINE)} />
      {f.adam > 0 && <path d={q(`M${CX - 4} ${f.chinY + 34}q4 ${4 * f.adam} 8 0`)} stroke={INK} opacity={0.35 * f.adam} {...sw(FINE)} />}
      <path d={q(`M${CX - 14} 318q14 8 28 0`)} stroke={skin.shade} {...sw(3)} />
    </g>
  );
}

export function Shirt({ kit, trim, f }: { kit: string; trim: string; f: FaceSpec }) {
  const nw = f.neckW;
  const shade = darken(kit, 0.24);
  const xl = CX - nw - 16;
  const xr = CX + nw + 16;
  // Shoulders slope away from the neck; a retro V-neck with a contrasting ribbed trim.
  const body = q(`M-20 360L-20 334C14 320 64 312 ${xl} 302L${CX} 342L${xr} 302C236 312 286 320 320 334L320 360Z`);
  const collar = q(`M${xl} 302L${CX} 342L${xr} 302L${xr - 11} 300L${CX} 329L${xl + 11} 300Z`);
  return (
    <g>
      <path d={body} fill={kit} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
      <path d={q(`M${xr + 18} 310C246 316 290 324 320 338L320 360L${CX + 64} 360C${CX + 70} 340 ${CX + 62} 322 ${xr + 18} 310Z`)} fill={shade} opacity={0.75} />
      <path d={q(`M48 330q16 8 22 30M${CX + 36} 340q6 10 4 22`)} stroke={shade} {...sw(2.4)} />
      <path d={collar} fill={trim} stroke={INK} strokeWidth={MID} strokeLinejoin="round" />
      <path d={q(`M${xl + 5} 301L${CX} 336L${xr - 5} 301`)} stroke={darken(trim, 0.2)} opacity={0.6} {...sw(1)} />
    </g>
  );
}

