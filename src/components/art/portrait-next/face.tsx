import type { Head } from "../portrait/anatomy";
import { CX, along, cubicAt, lerp, q, type Pt, type Seg } from "../portrait/geometry";
import type { NextSpec } from "./head";
import { blob, noise1, pieces, roughen, stroke, strokeLine } from "./ink";
import { INK, type SkinTones } from "./palette";

/** 0 small (list thumbnails), 1 medium, 2 large close-ups. Detail is added, never just scaled. */
export type Detail = 0 | 1 | 2;

const P = (x: number, y: number): Pt => [x, y];

// ------------------------------------------------------------------ head outline

/**
 * The silhouette in pen, not a sticker outline: heavier down the shadowed right side and under the jaw, light on the
 * lit side and broken where light hits the cheekbone.
 */
export function HeadInk({ head, d }: { head: Head; d: Detail }) {
  const R = head.rightPts;
  const L = head.leftPts;
  const idx = (pts: Pt[], y: number) => Math.max(1, pts.findIndex((p) => p[1] >= y));
  const tR = idx(R, head.right.T[1]);
  const tL = idx(L, head.left.T[1]);
  const cheekA = idx(L, head.left.K[1] - 8);
  const cheekB = idx(L, head.left.K[1] + 22);
  const k = d === 0 ? 1.4 : 1;
  // Dome: one line from the left temple over the crown to the right temple, light where the light falls on it.
  const dome = [...L.slice(0, tL + 1).reverse(), ...R.slice(1, tR + 1)];
  return (
    <g fill={INK}>
      <path d={strokeLine(dome, { w: 2 * k, start: 0.6, end: 0.85, peak: 0.8, seed: 2, wobble: 0.12 })} />
      <path d={strokeLine(R.slice(tR), { w: 2.3 * k, start: 0.75, end: 0.6, peak: 0.7, seed: 3 })} />
      <path d={strokeLine(L.slice(tL, cheekA + 1), { w: 1.4 * k, start: 0.85, end: 0.25, peak: 0.2, seed: 5 })} />
      <path d={strokeLine(L.slice(cheekB), { w: 1.9 * k, start: 0.15, end: 0.7, peak: 0.7, seed: 7 })} />
    </g>
  );
}

// ------------------------------------------------------------------ shading

/** Cel planes with organic edges, following this head's own structure. Clip to the head. */
export function Planes({ f, head, t, d, uid }: { f: NextSpec; head: Head; t: SkinTones; d: Detail; uid: string }) {
  const R = head.right;
  const Lf = head.left;
  const e = f.eye;
  const m = f.mouth;
  const seed = Math.round(f.jawW * 10 + f.cheekW);
  const eyeOut = CX + e.gap + e.w;
  // Right side plane: in from the temple, around the outer socket, turning at the cheekbone, under it, down the jaw.
  const edge = roughen(
    along(
      [
        P(CX + head.half(f.top + 16, 1) + 4, f.top + 12),
        P(CX + head.half(f.top + 30, 1) - 9, f.top + 32),
        P(R.T[0] - 14, R.T[1] - 16),
        P(R.T[0] - 9, R.T[1] + 2),
        P(eyeOut + 5, f.eyeY - 2),
        P(R.K[0] - 17, R.K[1] + 1),
        P(R.K[0] - 23 - f.hollow * 4, (R.K[1] + R.J[1]) / 2 - 2),
        P(R.J[0] - 15, R.J[1] - 2),
        P(R.Q[0] + 2, R.Q[1] + 3),
        P(CX + f.chinW * 0.35, f.chinY + 5),
      ],
      6,
    ),
    0.7,
    seed,
  );
  const side = q(`M${edge.map((p) => `${p[0]} ${p[1]}`).join("L")}L${CX + 150} ${f.chinY + 20}L${CX + 150} ${f.top + 12}Z`);
  // Under the cheekbone on both sides: the cheek plane turning away, softer on the lit side.
  const cheek = (s: 1 | -1, K: Pt, J: Pt) =>
    blob(
      [
        P(K[0] - s * 5, K[1] + 7),
        P(lerp(K[0], CX + s * (m.w + 10), 0.55) - s * 2, lerp(K[1], f.mouthY - 8, 0.55) - 2),
        P(CX + s * (m.w + 11), f.mouthY - 5),
        P(lerp(K[0], CX + s * (m.w + 14), 0.5) + s * 1, lerp(K[1], f.mouthY, 0.5) + 9 + f.hollow * 2),
        P(J[0] - s * 10, (K[1] + J[1]) / 2 + 4),
      ],
      0.55,
    );
  // Temple on the lit side.
  const temple = blob([P(Lf.T[0] + 3, f.top + 40), P(Lf.T[0] + 10, Lf.T[1] - 10), P(Lf.T[0] + 7, Lf.T[1] + 12), P(Lf.T[0] + 1, Lf.T[1] + 6)], 0.5);
  // Jaw underside: a band just inside the jawline.
  const jawBand = (pts: Pt[], s: 1 | -1) => {
    const j = pts.filter((p) => p[1] > f.jawY - 18);
    const inner = j.map((p, i) => [p[0] - s * (3 + 3 * Math.sin((i / Math.max(1, j.length - 1)) * Math.PI)), p[1] - 4] as Pt).reverse();
    return q(`M${[...j, ...inner].map((p) => `${p[0]} ${p[1]}`).join("L")}Z`);
  };
  // Light: brow ridge on the lit side, top of the lit cheekbone, the chin pad. Small, shaped, never a pasted blob.
  // Light on the top of the lit cheekbone only: a small shape, out towards the side of the face.
  const cheekLight = blob([P(Lf.K[0] + 7, Lf.K[1] - 11), P(Lf.K[0] + 17, Lf.K[1] - 13), P(Lf.K[0] + 24, Lf.K[1] - 10), P(Lf.K[0] + 14, Lf.K[1] - 6)], 0.5);
  const chinLight = blob([P(CX - f.chinW * 0.55, f.chinY - 11), P(CX - 6, f.chinY - 18), P(CX + f.chinW * 0.3, f.chinY - 13), P(CX - 3, f.chinY - 10)], 0.5);
  return (
    <g>
      {d === 2 && (
        <defs>
          <pattern id={`${uid}ht`} width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
            <circle cx="1.6" cy="1.6" r="0.55" fill={t.deep} />
          </pattern>
        </defs>
      )}
      <path d={side} fill={t.shade} />
      <path d={cheek(1, R.K, R.J)} fill={t.shade} />
      <path d={cheek(-1, Lf.K, Lf.J)} fill={t.shade} opacity={0.35} />
      <path d={temple} fill={t.shade} opacity={0.4} />
      <path d={jawBand(head.rightPts, 1)} fill={t.deep} opacity={0.35} />
      <path d={jawBand(head.leftPts, -1)} fill={t.shade} opacity={0.45} />
      {d === 2 && <path d={cheek(1, R.K, R.J)} fill={`url(#${uid}ht)`} opacity={0.25} />}
      {d > 0 && (
        <>
          <ellipse cx={CX - e.gap - 4} cy={f.eyeY + 21} rx={10} ry={5.5} fill={t.blush} opacity={0.16} />
          <ellipse cx={CX + e.gap + 6} cy={f.eyeY + 22} rx={9} ry={5} fill={t.blush} opacity={0.12} />
        </>
      )}
      <path d={cheekLight} fill={t.light} opacity={0.3} />
      <path d={chinLight} fill={t.light} opacity={0.28} />
      {f.cleft > 0 && <path d={stroke([P(CX + 0.5, f.chinY - 15), P(CX, f.chinY - 10), P(CX + 0.4, f.chinY - 6)], { w: 1, seed: 9 })} fill={t.line} opacity={0.5 * f.cleft} />}
    </g>
  );
}

// ------------------------------------------------------------------ eyes

function eyeGeom(f: NextSpec, s: 1 | -1) {
  const e = f.eye;
  const right = s > 0;
  const h = e.h * (right ? 1 - f.asym.eye : 1);
  const ex = CX + s * e.gap;
  const ey = f.eyeY + (right ? f.asym.eye * 8 : 0);
  const X = (u: number) => ex + s * (-e.w + 2 * e.w * u);
  const I = P(X(0), ey + 0.8);
  const O = P(X(1), ey + e.tilt);
  const up: Seg = [I, P(X(0.14), ey - h * 0.92), P(X(0.62), ey - h * 1.26), O];
  const lo: Seg = [O, P(X(0.76), ey + e.lo * 1.08 + e.tilt * 0.4), P(X(0.26), ey + e.lo * 1.0), I];
  return { e, h, ex, ey, X, I, O, up, lo };
}

const segD = (s: Seg) => `M${s[0][0]} ${s[0][1]}C${s[1][0]} ${s[1][1]} ${s[2][0]} ${s[2][1]} ${s[3][0]} ${s[3][1]}`;
const segC = (s: Seg) => `C${s[1][0]} ${s[1][1]} ${s[2][0]} ${s[2][1]} ${s[3][0]} ${s[3][1]}`;

/** Brow-socket shadows: painted under the brow ridge, deeper for deep-set eyes, always deeper on the shadow side. */
export function Sockets({ f, t }: { f: NextSpec; t: SkinTones }) {
  const one = (s: 1 | -1) => {
    const { e, h, ey, X } = eyeGeom(f, s);
    const top = ey - h - e.crease - 4 - e.deep * 4;
    const pts = [P(X(-0.12), ey + 1), P(X(0.05), top + 3), P(X(0.45), top - 1), P(X(0.95), top + 2), P(X(1.18), ey + e.tilt - 1), P(X(0.75), ey - h * 0.85), P(X(0.3), ey - h * 0.95)];
    return <path key={s} d={blob(pts, 0.55)} fill={s > 0 ? t.shade : t.shade} opacity={s > 0 ? 0.95 : 0.4 + e.deep * 0.45} />;
  };
  return (
    <g>
      {one(1)}
      {one(-1)}
    </g>
  );
}

export function EyesNext({ f, t, iris, uid, d, lines }: { f: NextSpec; t: SkinTones; iris: string; uid: string; d: Detail; lines: number }) {
  const one = (s: 1 | -1) => {
    const { e, h, ex, ey, X, I, O, up, lo } = eyeGeom(f, s);
    const id = `${uid}eye${s > 0 ? "r" : "l"}`;
    const shape = q(`${segD(up)}${segC(lo)}Z`);
    const ix = ex - s * 0.8;
    const iy = ey - h * 0.12;
    const ir = e.iris * 0.92;
    const lid = Array.from({ length: 14 }, (_, i) => cubicAt(up, 0.06 + (i / 13) * 0.94));
    const flick = P(O[0] + s * 2.2, O[1] - 0.9 + Math.max(0, e.tilt) * 0.4);
    // Thin upper lid, darkest over the outer third; it starts just after the inner corner instead of closing it.
    const lidW = (e.lash * 0.55 + (e.hood ? 0.25 : 0)) * (d === 0 ? 1.3 : 1);
    const lidD = strokeLine([...lid, flick], { w: lidW, start: 0.25, end: 0.3, peak: 0.72, seed: s > 0 ? 11 : 13, wobble: 0.1 });
    // Upper lid covers more of the iris on heavy or hooded eyes.
    const cover = `${segD(up)}L${O[0]} ${O[1] + h * (0.35 + e.hood * 0.2)}C${X(0.62)} ${ey - h * (0.25 - e.hood * 0.25)} ${X(0.14)} ${ey - h * 0.1} ${I[0]} ${I[1] + h * 0.25}Z`;
    const lowerKeep = pieces([P(X(0.4), ey + e.lo * 1.08), P(X(0.75), ey + e.lo * 0.95 + e.tilt * 0.45), P(O[0] - s * 1.2, O[1] + 0.6)], [[0, 1]]);
    const crease = pieces([P(X(0.1), ey - h - 1), P(X(0.45), ey - h - e.crease * 1.15), P(X(0.85), ey - h * 0.9 - e.crease * 0.85 + e.tilt * 0.5), P(X(1.05), ey + e.tilt - h * 0.45)], [[0.12, 0.88]]);
    const under = [P(X(0.18), ey + e.lo + 4.5 + e.bag), P(X(0.55), ey + e.lo + 7 + e.bag * 1.5), P(X(0.92), ey + e.lo + 3.5 + e.tilt * 0.5)];
    return (
      <g key={s}>
        <defs>
          <clipPath id={id}>
            <path d={shape} />
          </clipPath>
        </defs>
        <path d={shape} fill={t.white} />
        <g clipPath={`url(#${id})`}>
          <circle cx={ix} cy={iy} r={ir} fill={iris} />
          <circle cx={ix} cy={iy} r={ir} fill="none" stroke={INK} strokeWidth={0.7} opacity={0.55} />
          <circle cx={ix} cy={iy} r={ir * 0.4} fill="#120b07" />
          <path d={q(cover)} fill="#1c120c" opacity={0.3} />
          {d > 0 && <circle cx={ix - ir * 0.38} cy={iy - ir * 0.3} r={Math.max(0.7, ir * 0.16)} fill="#fbf6ee" opacity={0.9} />}
        </g>
        {e.hood > 0 && <path d={blob([P(X(0.02), ey - h * 0.9), P(X(0.4), ey - h - e.crease * 0.7), P(X(0.85), ey - h - e.crease * 0.4), P(X(1.12), ey + e.tilt - h * 0.2), P(X(0.7), ey - h * 0.85)], 0.5)} fill={t.shade} />}
        <path d={lidD} fill={INK} />
        {lowerKeep.map((pts, i) => (
          <path key={`lo${i}`} d={strokeLine(pts, { w: 0.75, start: 0.1, end: 0.5, peak: 0.7, seed: 17 })} fill={t.line} opacity={0.45} />
        ))}
        {!e.hood && crease.map((pts, i) => <path key={`cr${i}`} d={strokeLine(pts, { w: 0.85, start: 0.2, end: 0.2, peak: 0.5, seed: 19 })} fill={t.line} opacity={0.5} />)}
        {d === 2 && <path d={stroke(under, { w: 0.8 + e.bag * 0.4 + lines * 0.3, start: 0.1, end: 0.1, seed: 23 })} fill={t.line} opacity={0.18 + e.bag * 0.15 + lines * 0.15} />}
        {d === 2 && lines > 0.35 && <path d={stroke([P(O[0] + s * 3, O[1] + 1.5), P(O[0] + s * 7, O[1] + 3.5)], { w: 0.7, seed: 29 })} fill={t.line} opacity={0.3 * lines} />}
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

/** Brows: an uneven soft mass plus hair strokes that follow growth (upward at the head, sweeping out to the tail). */
export function BrowsNext({ f, color, d }: { f: NextSpec; color: string; d: Detail }) {
  const b = f.brow;
  const one = (s: 1 | -1) => {
    const dy = s > 0 ? f.asym.brow : 0;
    const x0 = CX + s * b.gap;
    const x1 = CX + s * (b.gap + b.len);
    const y0 = f.eyeY - b.low + dy;
    const y1 = y0 - b.lift - (s > 0 ? f.asym.brow * 0.4 : 0);
    const yp = y0 + (y1 - y0) * b.peak - b.arch;
    const yAt = (u: number) => (u < b.peak ? lerp(y0, yp, Math.sin((u / b.peak) * Math.PI * 0.5)) : lerp(yp, y1, (u - b.peak) / (1 - b.peak)));
    const thick = (u: number) => (u < b.peak ? lerp(b.head, b.mid, u / b.peak) : lerp(b.mid, b.tail, (u - b.peak) / (1 - b.peak)));
    const seed = (s > 0 ? 31 : 37) + Math.round(b.len);
    // Mass: top edge uneven, bottom straighter, a soft (low-opacity) head.
    const top: Pt[] = [];
    const bot: Pt[] = [];
    for (let i = 0; i <= 10; i++) {
      const u = i / 10;
      const x = lerp(x0, x1, u);
      const y = yAt(u);
      const th = thick(u) * (u > 0.92 ? 0.6 : 1);
      top.push(P(x, y - th * 0.58 + noise1(seed, u * 7) * 0.5 * (1 + b.ragged)));
      bot.push(P(x, y + th * 0.42 + noise1(seed + 5, u * 6) * 0.25));
    }
    const mass = q(`M${[...top, P(x1 + s * 1.5, y1 + 0.3), ...bot.reverse()].map((p) => `${p[0]} ${p[1]}`).join("L")}Z`);
    const strokes: string[] = [];
    if (d > 0) {
      const count = Math.round(b.len / (d === 2 ? 2.8 : 4.2));
      for (let i = 0; i < count; i++) {
        const u = (i + 0.5) / count;
        const x = lerp(x0, x1, u) + noise1(seed + 9, i) * 0.8;
        const y = yAt(u) + thick(u) * (0.35 - 0.45 * ((i * 7) % 5) / 5);
        // Hairs stand up at the head and lie down towards the tail.
        const ang = lerp(-0.85, -0.1, Math.min(1, u * 1.6));
        const len = thick(u) * (0.9 + 0.35 * (((i * 3) % 4) / 4));
        const dx = s * Math.cos(ang) * len;
        const dyy = Math.sin(ang) * len;
        strokes.push(stroke([P(x, y), P(x + dx * 0.55, y + dyy * 0.55), P(x + dx, y + dyy)], { w: d === 2 ? 0.75 : 0.9, start: 0.6, end: 0.1, peak: 0.25, seed: seed + i, steps: 2 }));
      }
    }
    return (
      <g key={s}>
        <path d={mass} fill={color} opacity={0.82} />
        <path d={stroke([P(x0 - s * 0.5, y0 + 1), P(x0 + s * 3, y0 - b.head * 0.2)], { w: b.head * 0.6, seed })} fill={color} opacity={0.35} />
        {strokes.length > 0 && <path d={strokes.join("")} fill={color} opacity={0.95} />}
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

/**
 * Suggested, not drawn: a bridge line on the shadow side that fades, the shaded side plane, nostril marks,
 * a short wing line, the shadow under the tip and a small light on the bridge and tip.
 */
export function NoseNext({ f, t, d }: { f: NextSpec; t: SkinTones; d: Detail }) {
  const n = f.nose;
  const k = d === 0 ? 1.5 : 1;
  const ny = f.noseY;
  const nx = CX + n.crook;
  const top = f.browY + 5;
  const len = ny - top;
  const proj = n.tip * 0.5 + n.drop * 1.2 + n.hump * 0.6;
  // Side plane, curving with the bridge (hump, crook) and widening into the wing.
  const plane = blob(
    [
      P(CX + n.bridge * 0.55, top + 2),
      P(CX + n.bridge + n.hump * 0.9 + n.crook * 0.3 + 1, top + len * 0.42),
      P(nx + n.tip * 0.75, ny - 11),
      P(nx + n.w * 0.85 + n.flare * 0.4, ny - 5),
      P(nx + n.w + n.flare * 0.5 + 2.5, ny - 9),
      P(CX + n.bridge + 9, top + len * 0.45),
      P(CX + n.bridge + 6, top + 3),
    ],
    0.5,
  );
  const cast = blob([P(nx - n.tip * 0.5, ny + 1.5), P(nx + 2, ny + 3 + proj * 0.5), P(nx + n.w * 0.7, ny + 3.5 + proj * 0.2), P(nx + n.w + 3, ny + 1), P(nx + n.w * 0.4, ny + 1.8)], 0.5);
  const bridge = pieces([P(CX + n.bridge * 0.75, top + 3), P(CX + n.bridge + n.hump + n.crook * 0.4, top + len * 0.45), P(nx + n.tip * 0.85, ny - 11)], [[0, n.hump > 1 ? 0.85 : 0.62]]);
  const tipEdge = [P(nx + n.tip * 0.92, ny - 9.5), P(nx + n.tip * 1.02, ny - 5), P(nx + n.tip * 0.7, ny - 2)];
  // The wing on the shadow side: down round the back of the ala and hooking in to the nostril, heaviest at the
  // hook. On the lit side only the hook shows. Never two matching brackets.
  const wingR = [P(nx + n.w * 0.6, ny - 10.5), P(nx + n.w + n.flare * 0.6 + 0.5, ny - 5.5), P(nx + n.w * 0.92, ny - 0.8), P(nx + n.w * 0.55, ny + 0.3)];
  const wingL = [P(nx - n.w - n.flare * 0.5, ny - 4.5), P(nx - n.w * 0.86, ny - 0.6), P(nx - n.w * 0.58, ny + 0.2)];
  // Nostrils: curved commas, not ovals. Wider and more visible on flared or upturned noses.
  const nostril = (s: 1 | -1) => {
    const c = nx + s * (n.tip * 0.42 + n.w * 0.16);
    const w = 3 + n.nostril * 1.8 + n.flare * 0.4;
    return stroke([P(c - s * w * 0.5, ny - 0.6 - n.up * 0.3), P(c, ny - 1.6 - n.up), P(c + s * w * 0.55, ny - 0.4)], { w: 1.4 + n.nostril * 0.6 + n.up * 0.5, start: 0.3, end: 0.15, peak: 0.4, seed: s > 0 ? 41 : 43, steps: 4 });
  };
  return (
    <g>
      <path d={plane} fill={t.shade} opacity={0.85} />
      <path d={cast} fill={t.deep} opacity={0.5} />
      {d === 2 && <path d={stroke([P(CX - n.bridge * 0.25, f.eyeY + 6), P(CX - n.bridge * 0.2 + n.crook * 0.3, f.eyeY + len * 0.3), P(nx - 1, ny - 13)], { w: 1.6, start: 0.1, end: 0.3, seed: 47 })} fill={t.light} opacity={0.3} />}
      <ellipse cx={nx - n.tip * 0.2} cy={ny - 6.5} rx={n.tip * 0.3} ry={1.6} fill={t.light} opacity={0.45} />
      {bridge.map((pts, i) => (
        <path key={`b${i}`} d={strokeLine(pts, { w: 1.05, start: 0.5, end: 0.05, peak: 0.25, seed: 53 })} fill={t.line} opacity={0.85} />
      ))}
      {d === 2 && <path d={stroke(tipEdge, { w: 0.8, start: 0.1, end: 0.3, seed: 59 })} fill={t.line} opacity={0.35} />}
      <path d={stroke(wingR, { w: 1.35 * k, start: 0.1, end: 0.6, peak: 0.72, seed: 61 })} fill={t.line} opacity={0.85} />
      {d > 0 && <path d={stroke(wingL, { w: 0.9, start: 0.1, end: 0.5, peak: 0.6, seed: 67 })} fill={t.line} opacity={0.4} />}
      <path d={nostril(1)} fill={INK} opacity={0.85} />
      <path d={nostril(-1)} fill={INK} opacity={0.65} />
    </g>
  );
}

// ------------------------------------------------------------------ mouth

/** Lips as colour: a darker upper lip, a lighter lower lip with a small light, a central mouth line that fades out. */
export function MouthNext({ f, t, d }: { f: NextSpec; t: SkinTones; d: Detail }) {
  const m = f.mouth;
  const my = f.mouthY;
  const a = f.asym.mouth;
  const L = P(CX - m.w, my - m.corner + m.smirk * 0.3);
  const R = P(CX + m.w + a * 0.6, my - m.corner - m.smirk + a * 0.5);
  const centre = [L, P(CX - m.w * 0.45, my + 0.5), P(CX, my + 1.1), P(CX + m.w * 0.45, my + 0.5 + a * 0.2), R];
  const line = along(centre, 6);
  const upperEdge = along([L, P(CX - m.w * 0.62, my - m.up * 0.55), P(CX - m.bow, my - m.up), P(CX, my - m.up * 0.72), P(CX + m.bow, my - m.up), P(CX + m.w * 0.62, my - m.up * 0.55 + a * 0.3), R], 5);
  const lowerEdge = along([L, P(CX - m.w * 0.5, my + m.lo * 0.82), P(CX, my + m.lo + m.part), P(CX + m.w * 0.52, my + m.lo * 0.8 + a * 0.3), R], 6);
  const join = (a1: Pt[], b1: Pt[]) => q(`M${[...a1, ...b1.slice().reverse()].map((p) => `${p[0]} ${p[1]}`).join("L")}Z`);
  const lb = my + m.lo + m.part;
  // The mouth line is darkest just off centre and fades before the corners.
  const keep = line.slice(Math.round(line.length * 0.07), Math.round(line.length * 0.95));
  return (
    <g>
      <path d={blob([P(CX - m.w * 0.55, lb + 1.5), P(CX - 2, lb + 7.5), P(CX + m.w * 0.65, lb + 2), P(CX + m.w * 0.1, lb + 3)], 0.5)} fill={t.shade} />
      <path d={join(line, lowerEdge)} fill={t.lipLo} />
      {d > 0 && <path d={blob([P(CX - m.w * 0.4, my + m.lo * 0.45 + m.part), P(CX - m.w * 0.05, my + m.lo * 0.33 + m.part), P(CX + m.w * 0.15, my + m.lo * 0.48 + m.part), P(CX - m.w * 0.12, my + m.lo * 0.62 + m.part)], 0.5)} fill={t.lipHi} opacity={0.75} />}
      <path d={join(upperEdge, line)} fill={t.lipUp} />
      {m.part > 0 && <path d={strokeLine(line, { w: m.part * 1.6 + 1.2, start: 0.3, end: 0.3 })} fill="#2a120c" />}
      {m.teeth > 0 && <path d={stroke([P(CX - m.w * 0.55, my + 0.9), P(CX, my + 1.7), P(CX + m.w * 0.55, my + 0.9)], { w: m.teeth, start: 0.5, end: 0.5 })} fill="#ece4d6" />}
      <path d={strokeLine(keep, { w: 1.5, start: 0.15, end: 0.12, peak: 0.42, seed: 73 })} fill={INK} opacity={0.88} />
      <path d={stroke([P(L[0] + 0.5, L[1] - 0.3), P(L[0] - 1.2, L[1] + (m.corner < 0 ? 1.4 : -0.4))], { w: 1, start: 0.6, end: 0.1, seed: 79, steps: 2 })} fill={t.line} opacity={0.5} />
      <path d={stroke([P(R[0] - 0.5, R[1] - 0.3), P(R[0] + 1.2, R[1] + (m.corner < 0 ? 1.4 : -0.4))], { w: 1, start: 0.6, end: 0.1, seed: 83, steps: 2 })} fill={t.line} opacity={0.5} />
      {d === 2 && <path d={stroke([P(CX - m.bow * 0.9, my - m.up - 1.5), P(CX - 3, f.noseY + 6)], { w: 0.8, seed: 89 })} fill={t.shade} opacity={0.8} />}
    </g>
  );
}

// ------------------------------------------------------------------ ears

export function EarsNext({ f, head, t, d, stud }: { f: NextSpec; head: Head; t: SkinTones; d: Detail; stud?: boolean }) {
  const one = (s: 1 | -1) => {
    const e = f.ear;
    const dy = s > 0 ? f.asym.ear : 0;
    const top = e.top + dy;
    const bot = e.bot + dy * 0.6;
    const h = bot - top;
    const w = e.w * (s > 0 ? 1.04 : 1);
    const ax = CX + s * (head.half(top + h * 0.4, s) - 5);
    const X = (dx: number) => ax + s * dx;
    const outer: Pt[] = [P(X(0), top + 3), P(X(w * 0.6), top - 5), P(X(w * 1.08), top + h * 0.2), P(X(w * 0.98), top + h * 0.52), P(X(w * 0.6), top + h * 0.78), P(X(w * 0.42), bot - 2), P(X(w * 0.12), bot + 1), P(X(-2), bot - 4)];
    const fill = q(`M${along(outer, 5).map((p) => `${p[0]} ${p[1]}`).join("L")}Z`);
    const rim = [P(X(2.5), top + 3.5), P(X(w * 0.58), top - 1), P(X(w * 0.86), top + h * 0.3), P(X(w * 0.5), top + h * 0.6), P(X(w * 0.38), top + h * 0.74)];
    const concha = blob([P(X(w * 0.16), top + h * 0.3), P(X(w * 0.55), top + h * 0.24), P(X(w * 0.58), top + h * 0.5), P(X(w * 0.35), top + h * 0.66), P(X(w * 0.12), top + h * 0.55)], 0.5);
    return (
      <g key={s}>
        <path d={fill} fill={s > 0 ? t.shade : t.base} />
        {d > 0 && <ellipse cx={X(w * 0.5)} cy={top + h * 0.45} rx={w * 0.45} ry={h * 0.35} fill={t.blush} opacity={0.18} />}
        <path d={concha} fill={s > 0 ? t.deep : t.shade} opacity={s > 0 ? 0.55 : 0.85} />
        <path d={strokeLine(along(outer.slice(0, 7), 5), { w: s > 0 ? 1.6 : 1.2, start: 0.2, end: 0.5, peak: 0.45, seed: s > 0 ? 97 : 101 })} fill={INK} />
        {d > 0 && <path d={stroke(rim, { w: 0.85, start: 0.2, end: 0.1, seed: 103 })} fill={t.line} opacity={0.75} />}
        {d === 2 && <path d={stroke([P(X(1.5), top + h * 0.55), P(X(3.5), top + h * 0.62), P(X(4.2), top + h * 0.72)], { w: 0.8, seed: 107 })} fill={t.line} opacity={0.6} />}
        {stud && <circle cx={X(w * 0.3)} cy={bot - 3} r={2.1} fill="#e8d28a" stroke={INK} strokeWidth={0.7} />}
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

// ------------------------------------------------------------------ neck

export function NeckNext({ f, head, t, d }: { f: NextSpec; head: Head; t: SkinTones; d: Detail }) {
  const nw = f.neckW;
  const y0 = f.jawY - 30;
  const base = 352;
  const shape = q(`M${CX - nw} ${y0}C${CX - nw + 1} ${y0 + 40} ${CX - nw - 3} ${base - 30} ${CX - nw - 8} ${base}L${CX + nw + 8} ${base}C${CX + nw + 3} ${base - 30} ${CX + nw - 1} ${y0 + 40} ${CX + nw} ${y0}Z`);
  const R = head.right;
  const L = head.left;
  // The jaw's shadow on the neck follows the jawline: deep under the chin and towards the shadow side.
  const cast = blob(
    [
      P(CX - nw - 4, y0),
      P(CX + nw + 4, y0),
      P(CX + nw + 4, R.J[1] + 36),
      P(R.J[0] - 22, R.J[1] + 30),
      P(CX + f.chinW + 8, f.chinY + 19),
      P(CX - 4, f.chinY + 22),
      P(CX - f.chinW - 12, f.chinY + 17),
      P(L.J[0] + 20, L.J[1] + 18),
      P(CX - nw - 4, L.J[1] + 20),
    ],
    0.45,
  );
  const sideR = blob([P(CX + nw - 14, y0 + 30), P(CX + nw + 6, y0 + 30), P(CX + nw + 8, 312), P(CX + nw - 20, 312), P(CX + nw - 14, 270)], 0.4);
  const tendon = (s: 1 | -1) => [P(CX + s * (nw - 9), f.jawY + 8), P(CX + s * (nw - 17), f.jawY + 38), P(CX + s * 15, 298), P(CX + s * 8, 314)];
  return (
    <g>
      <path d={shape} fill={t.base} />
      <path d={sideR} fill={t.shade} />
      <path d={cast} fill={t.shade} />
      <path d={blob([P(CX - f.chinW - 6, f.chinY + 2), P(CX + f.chinW + 10, f.chinY + 2), P(R.J[0] - 18, R.J[1] + 12), P(CX + f.chinW + 4, f.chinY + 14), P(CX - 4, f.chinY + 13)], 0.5)} fill={t.deep} opacity={0.45} />
      <path d={stroke([P(CX - nw + 0.5, y0 + 10), P(CX - nw - 1, y0 + 60), P(CX - nw - 5, 300)], { w: 1.3, start: 0.4, end: 0.05, peak: 0.3, seed: 109 })} fill={INK} />
      <path d={stroke([P(CX + nw - 0.5, y0 + 10), P(CX + nw + 1, y0 + 60), P(CX + nw + 5, 302)], { w: 1.8, start: 0.4, end: 0.1, peak: 0.3, seed: 113 })} fill={INK} />
      {d === 2 && (
        <>
          <path d={stroke(tendon(-1), { w: 0.8, start: 0.1, end: 0.05, peak: 0.5, seed: 127 })} fill={t.line} opacity={0.2} />
          <path d={stroke(tendon(1), { w: 0.9, start: 0.1, end: 0.05, peak: 0.5, seed: 131 })} fill={t.line} opacity={0.25} />
        </>
      )}
      {f.adam > 0.2 && d > 0 && <path d={stroke([P(CX - 3.5, f.chinY + 35), P(CX + 0.5, f.chinY + 37 + 3 * f.adam), P(CX + 4, f.chinY + 35)], { w: 0.9, seed: 137 })} fill={t.line} opacity={0.3 * f.adam} />}
    </g>
  );
}

// ------------------------------------------------------------------ age and structure lines

/**
 * The fold from the nose wing towards the mouth corner is structure, so it is always faintly there, but only its
 * upper part, fading out before the mouth. Forehead and frown lines arrive with age: few, short, broken.
 */
export function AgeLinesNext({ f, t, lines, d }: { f: NextSpec; t: SkinTones; lines: number; d: Detail }) {
  const n = f.nose;
  const m = f.mouth;
  const fold = (s: 1 | -1) => [P(CX + s * (n.w + 2.5), f.noseY - 6), P(CX + s * (n.w + 7.5), f.noseY + 3), P(CX + s * (m.w + 5), f.mouthY - 6 + lines * 2), P(CX + s * (m.w + 4), f.mouthY + 3 + lines * 5)];
  const keep = 0.45 + lines * 0.45;
  const els: string[] = [];
  const faint: string[] = [];
  for (const s of [1, -1] as const) {
    for (const p of pieces(fold(s), [[0, keep]])) (s > 0 ? els : faint).push(strokeLine(p, { w: 1.3 + lines * 0.5, start: 0.6, end: 0.05, peak: 0.25, seed: s > 0 ? 151 : 157 }));
  }
  const fore: string[] = [];
  if (lines > 0.45 && d > 0) {
    const y = f.browY - 22;
    fore.push(stroke([P(CX - 24, y + 1), P(CX - 6, y - 1.5), P(CX + 8, y - 1)], { w: 0.9, seed: 163 }), stroke([P(CX + 12, y - 0.5), P(CX + 22, y + 1)], { w: 0.8, seed: 167 }));
    if (lines > 0.7) fore.push(stroke([P(CX - 16, y + 8), P(CX + 2, y + 6.5), P(CX + 16, y + 8)], { w: 0.8, seed: 173 }));
  }
  if (lines > 0.65 && d > 0) fore.push(stroke([P(CX - 4, f.browY - 3), P(CX - 5, f.browY + 5)], { w: 0.9, seed: 179 }), stroke([P(CX + 4, f.browY - 3), P(CX + 5.5, f.browY + 4)], { w: 0.9, seed: 181 }));
  return (
    <g fill={t.deep}>
      <path d={els.join("")} opacity={0.35 + lines * 0.3} />
      <path d={faint.join("")} opacity={0.22 + lines * 0.25} />
      {fore.length > 0 && <path d={fore.join("")} opacity={(lines - 0.3) * 0.6} />}
    </g>
  );
}
