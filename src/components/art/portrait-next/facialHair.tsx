import type { ReactNode } from "react";
import type { Head } from "../portrait/anatomy";
import { CX, add, along, clamp, hash01, lerp, q, scale, sub, unit, type Pt } from "../portrait/geometry";
import type { Anchors } from "./anchors";
import type { Detail } from "./face";
import type { NextSpec } from "./head";
import { blob, lodNow, noise1, pieces, ring, roughen, stroke, strokeLine } from "./ink";
import { P, burnY, inside, mouthGap, outline, smooth01 } from "./beardGeometry";
import { BeardMass, type MassKind } from "./beardMass";
import { beardTones, mixHex, type SkinTones } from "./palette";

/**
 * The beard area: from each sideburn down the jaw and round the chin, bounded above by the cheek line that runs
 * from the sideburn, under the cheekbone, round the mouth corner and under the nose. `inset` shrinks it (for the
 * denser core), `low` drops the cheek line.
 */
function beardArea(f: NextSpec, head: Head, inset: number, low: number, seed: number): Pt[] {
  const y0 = lerp(f.ear.top, f.ear.bot, 0.3) + inset * 1.5;
  const n = f.nose;
  const m = f.mouth;
  const cheek = (s: 1 | -1): Pt[] => [
    P(CX + s * (head.half(y0, s) - 8 - inset), y0),
    P(CX + s * (head.half(f.noseY + 6, s) - 14 - inset * 1.4 - low * 4), f.noseY + 6 + low * 8),
    P(CX + s * (m.w + 10 - inset * 0.4), f.mouthY - 9 + low * 2 + inset * 0.6),
    P(CX + s * (n.w * 0.85), f.noseY + 4 + inset * 0.6),
  ];
  const top = roughen(along([...cheek(-1), P(CX, f.noseY + 5 + inset * 0.6), ...cheek(1).reverse()], 5), 0.6, seed);
  const side = (pts: Pt[], s: 1 | -1) =>
    pts
      .filter((p) => p[1] >= y0)
      .map((p) => {
        // Inset along the outline: inwards on the sides, upwards under the chin.
        const t = clamp((p[1] - f.jawY) / Math.max(1, f.chinY - f.jawY), 0, 1);
        return P(p[0] - s * inset * (1 - t * 0.6), p[1] - inset * t + 4 * (1 - inset / 10));
      });
  const right = side(head.rightPts, 1);
  const left = side(head.leftPts, -1).reverse();
  return [...top, ...right, ...left];
}

/** The lips and a little skin round them stay clear. */
function mouthHole(f: NextSpec, grow: number): Pt[] {
  const m = f.mouth;
  const cy = f.mouthY + (m.lo - m.up) / 2 + 0.5;
  const rx = m.w + 1 + grow;
  const ry = (m.up + m.lo) / 2 + 1.2 + grow * 0.5;
  return Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2;
    return P(CX + Math.cos(a) * rx, cy + Math.sin(a) * ry * (Math.sin(a) < 0 ? 0.9 : 1));
  });
}

/**
 * Stubble as tone, never as noise: a translucent wash of the hair colour over the beard area, built from stacked
 * shapes so the edge fades instead of stopping on a line, densest on the chin and upper lip. Heavy stubble adds a
 * few short marks along the jaw and the cheek edge at larger sizes.
 */
export function StubbleNext({ f, head, t, color, heavy, youth, d, uid }: { f: NextSpec; head: Head; t: SkinTones; color: string; heavy: boolean; youth: number; d: Detail; uid: string }) {
  const seed = Math.round(f.jawW * 3 + f.chinY);
  const tone = mixHex(beardTones(color, t.base).base, t.deep, 0.4);
  const a = (heavy ? 0.44 : 0.3) * (1 - youth * 0.5);
  // Without the blur (small sizes) more, closer layers make the soft edge.
  const layers = d === 0 ? [{ inset: 0, low: 0, o: a * 0.75 }] : [
    { inset: -1, low: -0.3, o: a * 0.55 },
    { inset: 4, low: 0.6, o: a * 0.5 },
  ];
  const hole = ring(mouthHole(f, 1));
  const m = f.mouth;
  // Chin and the jaw corners hold the densest growth; the upper lip only a little.
  const lip = q(
    ring(
      along([P(CX - m.w - 2, f.mouthY - 1), P(CX - m.w * 0.5, f.mouthY - m.up - 3), P(CX, f.noseY + 7), P(CX + m.w * 0.5, f.mouthY - m.up - 3), P(CX + m.w + 2, f.mouthY - 1), P(CX, f.mouthY - m.up * 0.7)], 5),
    ),
  );
  const chin = q(ring(along([P(CX - f.chinW - 4, f.chinY - 14), P(CX, f.mouthY + m.lo + 6), P(CX + f.chinW + 4, f.chinY - 14), P(CX + f.chinW * 0.6, f.chinY + 2), P(CX - f.chinW * 0.6, f.chinY + 2)], 5)));
  const marks: string[] = [];
  if (heavy && d > 0) {
    const n = d === 2 ? 26 : 14;
    const jaw = head.rightPts.filter((p) => p[1] > f.ear.bot).concat(head.leftPts.filter((p) => p[1] > f.ear.bot).reverse());
    for (let i = 0; i < n; i++) {
      const p = jaw[Math.floor(hash01(seed, i) * jaw.length)];
      const s = p[0] > CX ? 1 : -1;
      const x = p[0] - s * (2 + hash01(seed, i + 50) * 7);
      const y = p[1] - 2 - hash01(seed, i + 90) * 6;
      marks.push(stroke([P(x, y), P(x + s * 0.6, y + 1.8)], { w: 0.75, start: 0.6, end: 0.2, steps: 2, seed: seed + i }));
    }
  }
  const soft = d > 0 ? `url(#${uid}soft)` : undefined;
  return (
    <g fill={tone}>
      {d > 0 && (
        <defs>
          <filter id={`${uid}soft`} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation={2.4} />
          </filter>
        </defs>
      )}
      <g filter={soft}>
        {layers.map((l, i) => (
          <path key={i} d={q(ring(beardArea(f, head, l.inset, l.low, seed + i)) + hole)} fillRule="evenodd" opacity={l.o} />
        ))}
        <path d={lip} opacity={a * 0.25} />
        <path d={chin} opacity={a * 0.3} />
        {/* Growth is densest along the jaw edge, where the plane turns away. */}
        <path d={q(ring(beardArea(f, head, -1, 2.2, seed + 7)) + ring(beardArea(f, head, 7, 2.2, seed + 7).reverse()))} fillRule="evenodd" opacity={a * 0.35} />
      </g>
      {marks.length > 0 && <path d={marks.join("")} opacity={0.4} />}
    </g>
  );
}


// ------------------------------------------------------------------ rising stubble

/** One region of early growth: how dense it is, how to fill it, and where a single hair mark can start inside it. */
interface Patch {
  dens: number;
  /** Fill shapes from the outer, faintest to the denser core (one for thumbnails). */
  shapes: Pt[][];
  /** The direction hair lies in this region at a point. */
  dir: (p: Pt) => Pt;
  at: (u: number, v: number) => Pt;
  wash: boolean;
}

/** An irregular, rounded patch: radii vary round the outline so it never reads as a circle. */
function patchBlob(cx: number, cy: number, rx: number, ry: number, seed: number): Pt[] {
  const n = 10;
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = 0.78 + 0.34 * hash01(seed, i * 3 + 1);
    return P(cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k);
  });
}

/** A band that follows the head outline between two heights, `w` wide and set `inset` in from the edge. */
function outlineBand(head: Head, s: 1 | -1, y0: number, y1: number, w: number, inset: number): Pt[] {
  const edge = outline(head, s, y0, y1).map((p) => P(p[0] - s * inset, p[1]));
  if (edge.length < 2) return [];
  const inner = edge.map((p) => P(p[0] - s * w, p[1] - 0.6));
  return [...edge, ...inner.reverse()];
}

/**
 * Rising stubble: early, uneven growth. Not a wash over the lower face (that is Light stubble) but separate regions
 * of different density: the chin and the upper lip strongest, a thin broken line along the jaw, a faint lower cheek,
 * a light sideburn, and nothing in the middle of the upper lip or high on the cheek. Each region is a soft, nested
 * shape; larger sizes add short hair marks, sampled by density, in one path.
 */
export function RisingStubbleNext({ f, head, a, t, color, youth, d, uid: _uid, pSeed = 0 }: { f: NextSpec; head: Head; a: Anchors; t: SkinTones; color: string; youth: number; d: Detail; uid: string; pSeed?: number }) {
  const seed = 19 * 31 + Math.round(f.jawW * 3 + f.chinY) + pSeed;
  const T = beardTones(color, t.base);
  const wash = mixHex(T.base, t.deep, 0.45);
  const markTone = mixHex(T.deep, T.shade, 0.35);
  const m = f.mouth;
  const lipTop = f.mouthY - m.up;
  const lipBot = f.mouthY + m.lo;
  const k = 1 - 0.3 * youth;
  // The two sides are never equally grown: one lip patch and one cheek patch are lighter.
  const lean = noise1(seed, 3);
  const nest = (pts: Pt[], cx: number, cy: number): Pt[][] => (d === 0 ? [pts] : [pts, pts.map((p) => P(cx + (p[0] - cx) * 0.62, cy + (p[1] - cy) * 0.62))]);
  const ell = (cx: number, cy: number, rx: number, ry: number, dens: number, dir: (p: Pt) => Pt, sd: number, washOn = true): Patch => ({
    dens: dens * k,
    shapes: nest(patchBlob(cx, cy, rx, ry, sd), cx, cy),
    dir,
    at: (u, v) => P(cx + (u * 2 - 1) * rx * 0.85, cy + (v * 2 - 1) * ry * 0.85),
    wash: washOn,
  });
  const down = (p: Pt): Pt => unit(P((CX - p[0]) * 0.02, 1));
  const outward = (p: Pt): Pt => unit(P(Math.sign(p[0] - CX || 1) * 0.6, 0.7));
  const patches: Patch[] = [];
  // Chin: the strongest region, two overlapping blobs, one lower and to a side.
  const cyChin = lerp(lipBot, f.chinY, 0.58);
  patches.push(ell(CX + 1.5 * lean, cyChin, f.chinW * 0.78 + 2, Math.max(5.5, (f.chinY - lipBot) * 0.42), 0.8, down, seed + 1));
  patches.push(ell(CX + Math.sign(lean || 1) * f.chinW * 0.42, f.chinY - 5.5, f.chinW * 0.5, 4.2, 0.55, down, seed + 2));
  // Upper lip: a thin moustache with a gap in the middle, one side lighter.
  for (const s of [-1, 1] as const) {
    const strength = s === Math.sign(lean || 1) ? 0.58 : 0.4;
    patches.push(ell(CX + s * (m.w * 0.55 + 2), lipTop - 3.6, m.w * 0.42, 3, strength, outward, seed + 3 + s));
  }
  // Along the jaw: broken, one segment sometimes missing on a side.
  for (const s of [-1, 1] as const) {
    const y0 = f.jawY - 6;
    const y1 = f.chinY - 7;
    const mid = lerp(y0, y1, 0.5 + 0.1 * noise1(seed + s, 5));
    const segs: [number, number][] = [[y0, mid - 3], [mid + 4, y1]];
    segs.forEach(([ya, yb], i) => {
      if (i === 1 && hash01(seed + s, 8) < 0.25) return;
      const band = outlineBand(head, s, ya, yb, 6.5, 3.5);
      if (band.length < 4) return;
      const edge = band.slice(0, band.length / 2);
      patches.push({
        dens: 0.32 * k,
        shapes: [band],
        dir: (p) => unit(P(-s * 0.35, 1)),
        at: (u, v) => {
          const e = edge[Math.min(edge.length - 1, Math.floor(u * edge.length))];
          return P(e[0] - s * (1 + v * 5), e[1] - v * 0.6);
        },
        wash: true,
      });
    });
  }
  // Lower cheeks: very sparse and uneven.
  for (const s of [-1, 1] as const) {
    const cheek = s > 0 ? a.cheekR : a.cheekL;
    const cx = CX + s * Math.min(Math.abs(cheek[0] - CX) * 0.8, head.half(f.noseY + 18, s) - 16);
    patches.push(ell(cx, f.noseY + 17 + 2 * noise1(seed + s, 11), 11, 8, s === Math.sign(lean || 1) ? 0.12 : 0.18, down, seed + 20 + s));
  }
  // A light sideburn.
  for (const s of [-1, 1] as const) {
    const band = outlineBand(head, s, burnY(f), burnY(f) + 15, 5, 2.5);
    if (band.length < 4) continue;
    const edge = band.slice(0, band.length / 2);
    patches.push({ dens: 0.26 * k, shapes: [band], dir: down, at: (u, v) => P(edge[Math.min(edge.length - 1, Math.floor(u * edge.length))][0] - s * (1 + v * 4), edge[Math.min(edge.length - 1, Math.floor(u * edge.length))][1]), wash: true });
  }
  // High on the cheek: no wash, only the odd mark at the largest sizes.
  const high = (s: 1 | -1) => (s > 0 ? a.cheekR : a.cheekL);
  if (d === 2) for (const s of [-1, 1] as const) patches.push(ell(high(s)[0] - s * 4, high(s)[1] + 18, 10, 7, 0.06, down, seed + 30 + s, false));

  const alpha = 0.42;
  const fills = patches.filter((p) => p.wash).flatMap((p, i) =>
    p.shapes.map((pts, j) => {
      // The nested core is denser; a band is one flat shape.
      const o = alpha * p.dens * (j === 0 ? (p.shapes.length > 1 ? 0.62 : 1) : 0.55);
      return { key: `${i}-${j}`, d: p.shapes.length === 1 && pts.length > 12 ? ring(pts) : blob(pts), o };
    }),
  );

  const marks: string[] = [];
  const n = d === 0 ? 0 : d === 1 ? 20 : 84;
  const total = patches.reduce((sum, p) => sum + p.dens, 0);
  for (let i = 0; i < n; i++) {
    let r = hash01(seed + 40, i * 3) * total;
    const p = patches.find((q) => (r -= q.dens) <= 0) ?? patches[0];
    const at = p.at(hash01(seed + 41, i * 3 + 1), hash01(seed + 42, i * 3 + 2));
    const dir = p.dir(at);
    const len = 1.7 + 1.5 * hash01(seed + 43, i);
    marks.push(stroke([sub(at, scale(dir, len * 0.4)), add(at, scale(dir, len * 0.6))], { w: 0.8, start: 0.55, end: 0.1, steps: 2, seed: seed + i }));
  }
  const soft = d > 0 ? `url(#${_uid}rs)` : undefined;
  return (
    <g>
      {d > 0 && (
        <defs>
          <filter id={`${_uid}rs`} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation={1.5} />
          </filter>
        </defs>
      )}
      <g filter={soft}>
        {fills.map((fl) => (
          <path key={fl.key} d={fl.d} fill={wash} opacity={fl.o} fillRule="evenodd" />
        ))}
      </g>
      {marks.length > 0 && <path d={marks.join("")} fill={markTone} opacity={0.62 * k} />}
    </g>
  );
}

// ------------------------------------------------------------------ beards

/** One piece of facial hair: its region (and a hole for the lips), the edge that is inked, and how hair grows on it. */
interface Growth {
  pts: Pt[];
  hole?: Pt[];
  /** The part of the outline that stands off the face (inked); the edge on the skin stays soft. */
  edge?: Pt[];
  /** "down": along the jaw and chin; "out": a moustache, from the centre to the corners. */
  flow: "down" | "out";
  /** Thin growth (straps, sideburns): how far the lit body sits above the shadow, so a band of shadow never turns
   * into a dark outline. */
  lift?: number;
  /** A trimmed upper edge: no soft wash where growth starts, the edge stays as drawn. */
  crisp?: boolean;
  /** A few short marks only. */
  calm?: boolean;
}


/** Outline points pushed off the face by the hair's thickness, which grows towards the chin. */
function thick(f: NextSpec, pts: Pt[], drop: number, box: boolean): Pt[] {
  const c = P(CX, f.eyeY);
  return pts.map((p) => {
    const t = smooth01((p[1] - (f.jawY - 28)) / (f.chinY - f.jawY + 28));
    const q2 = add(p, scale(unit(sub(p, c)), 0.8 + drop * t));
    return box ? P(q2[0], Math.min(q2[1], f.chinY + drop * 0.9)) : q2;
  });
}

/** The cheek line: from one sideburn, under the cheekbone, round the mouth corner and under the nose to the other. */
function cheekLine(f: NextSpec, head: Head, a: Anchors, y0: number, low: number, burnW: number): Pt[] {
  const side = (s: 1 | -1): Pt[] => {
    const cheek = s > 0 ? a.cheekR : a.cheekL;
    const corner = s > 0 ? a.mouthR : a.mouthL;
    // Under the cheekbone: between the cheek anchor and the jaw, never above the cheek.
    const yK = Math.max(cheek[1] + 16, f.noseY - 4) + low * 9;
    return [
      P(CX + s * (head.half(y0, s) - burnW), y0),
      P(CX + s * (head.half(yK, s) - 17 - low * 6), yK),
      P(corner[0] + s * 9, corner[1] - 8 + low * 2),
      P(CX + s * f.nose.w * 0.9, f.noseY + 4.5),
    ];
  };
  return along([...side(-1), P(CX, f.noseY + 5.5), ...side(1).reverse()], 4);
}

function jawBeard(f: NextSpec, head: Head, a: Anchors, o: { drop: number; low: number; box?: boolean; long?: number }): Growth {
  const y0 = burnY(f) + 4;
  let right = thick(f, outline(head, 1, y0, f.chinY + 1), o.drop, !!o.box);
  let left = thick(f, outline(head, -1, y0, f.chinY + 1), o.drop, !!o.box);
  const long = o.long ?? 0;
  // A long beard leaves the jaw at the chin corners and hangs in a broad, rounded point.
  if (long > 0) {
    right = right.filter((p) => p[0] > CX + f.chinW * 0.9);
    left = left.filter((p) => p[0] < CX - f.chinW * 0.9);
  }
  const yb = f.chinY + o.drop;
  const bottom: Pt[] = long > 0 ? along([P(CX + f.chinW * 0.95, yb + long * 0.6), P(CX + f.chinW * 0.45, yb + long * 0.95), P(CX + 2, yb + long), P(CX - f.chinW * 0.45, yb + long * 0.93), P(CX - f.chinW * 0.95, yb + long * 0.6)], 4) : [];
  const edge = [...right, ...bottom, ...left.slice().reverse()];
  const cheek = cheekLine(f, head, a, y0, o.low, 9);
  return { pts: [...edge, ...cheek], hole: mouthGap(f), edge: edge.filter((p) => p[1] > f.noseY), flow: "down" };
}

function moustache(f: NextSpec, a: Anchors, thick2: number, droop = 0): Growth {
  const m = f.mouth;
  const lipTop = f.mouthY - m.up;
  const topY = Math.max(f.noseY + 5, lipTop - thick2 * 1.3);
  const side = (s: 1 | -1): Pt[] => {
    const corner = s > 0 ? a.mouthR : a.mouthL;
    return [P(corner[0] + s * 3, corner[1] + 1.5 + droop), P(CX + s * m.w * 0.8, lipTop - thick2 * 0.7), P(CX + s * f.nose.w * 0.8, topY)];
  };
  const under = (s: 1 | -1): Pt[] => [P(CX + s * m.w * 0.55, lipTop + m.up * 0.45), P(CX + s * 2, lipTop + m.up * 0.2)];
  // The top edge dips a little under the nose (the philtrum); the lower edge runs corner to corner over the lip.
  const top = along([...side(-1), P(CX, topY + 1.2), ...side(1).reverse()], 4);
  const lower = along([side(1)[0], ...under(1), ...under(-1).reverse(), side(-1)[0]], 4);
  // Only the edge that hangs over the lip is inked; the top fades into the skin.
  return { pts: [...top, ...lower.slice(1, -1)], edge: lower, flow: "out" };
}


/**
 * A chin beard: from under the lower lip, down over the chin and round the front of the jaw, following the face
 * outline there (pushed out a little by its thickness), never a separate patch hanging below the chin.
 */
function chinBeard(f: NextSpec, head: Head, drop: number): Growth {
  const m = f.mouth;
  const reach = f.chinW + 13;
  const yTop = f.mouthY + m.lo + 2.5;
  const jaw = (s: 1 | -1) => thick(f, outline(head, s, yTop + 6, f.chinY + 1).filter((p) => Math.abs(p[0] - CX) <= reach), drop, false);
  const right = jaw(1);
  const left = jaw(-1).reverse();
  const edge = [...right, ...left];
  // Top: under the lip, slightly arched, out to where the jaw beard begins on each side.
  const top = along([left[left.length - 1], P(CX - m.w * 0.55, yTop + 1), P(CX, yTop - 0.5), P(CX + m.w * 0.55, yTop + 1), right[0]], 4);
  return { pts: [...edge, ...top.slice(1, -1)], edge, flow: "down" };
}

/** Sideburns and chops: a band down each side of the face from the hair's sideburn, its inner edge a little uneven. */
function sideBand(f: NextSpec, head: Head, s: 1 | -1, y1: number, width: (t: number) => number): Growth {
  const out = outline(head, s, burnY(f), y1).map((p) => P(p[0] + s * 1.2, p[1]));
  const inn = out.map((p, i) => {
    const t = i / Math.max(1, out.length - 1);
    return P(p[0] - s * width(t) * (1 + 0.12 * noise1(31 + s, t * 6)) * (0.55 + 0.45 * smooth01(t / 0.15)), p[1]);
  });
  return { pts: [...out, ...roughen(inn, 0.5, 40 + s, 0.6).reverse()], edge: out, flow: "down", lift: 1.6 };
}

/**
 * A chinstrap: hair growing along the jaw from sideburn to sideburn, not a line. Its width changes as it goes (thin
 * where it leaves the sideburn, fuller round the chin, a little uneven all along), both edges are soft and only
 * slightly irregular, and its shadow is a narrow band underneath.
 */
function strap(f: NextSpec, head: Head, w: number, seed: number): Growth {
  const y0 = burnY(f) + 6;
  const outer = [...outline(head, 1, y0, f.chinY + 1).map((p) => P(p[0] + 1.4, p[1])), ...outline(head, -1, y0, f.chinY + 1).reverse().map((p) => P(p[0] - 1.4, p[1]))];
  const c = P(CX, f.eyeY + 10);
  const n = outer.length - 1;
  const inner = outer.map((p, i) => {
    const u = i / n;
    const ends = 0.4 + 0.6 * smooth01(u / 0.2) * smooth01((1 - u) / 0.2);
    const chin = 1 + 0.3 * Math.max(0, 1 - Math.abs(u - 0.5) / 0.16);
    return sub(p, scale(unit(sub(p, c)), w * ends * chin * (1 + 0.16 * noise1(seed, u * 11))));
  });
  return { pts: [...roughen(outer, 0.35, seed + 1, 0.7), ...roughen(inner, 0.7, seed + 2, 0.6).reverse()], edge: undefined, flow: "down", lift: 1.4 };
}


/**
 * The imperial goatee's moustache: two broad masses with a small division at the philtrum. Each is thickest over the
 * middle of the lip, rides the upper lip's own curve along its lower edge (no gap above the lip, none over it), and
 * curves down over the mouth corner to a softly tapered end. Thickness, end length and droop differ a little between
 * the sides. The lips stay clear and the top edge keeps skin under the nose.
 */
function imperialMoustache(f: NextSpec, a: Anchors, seed: number): Growth {
  const m = f.mouth;
  const rx = m.w + 0.8;
  const cy = f.mouthY + (m.lo - m.up) / 2;
  const ry = (m.up + m.lo) / 2 + 0.7;
  // The upper lip's top edge at distance x from the middle.
  const lip = (x: number) => cy - ry * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2));
  const body = 6.4 + 0.6 * noise1(seed, 1);
  const floor = f.noseY + 5.5;
  const up = (x: number, thick: number) => Math.max(floor, lip(x) - thick);
  const sideTop = (s: 1 | -1): Pt[] => {
    const corner = s > 0 ? a.mouthR : a.mouthL;
    const k = 1 + 0.14 * noise1(seed + s, 3);
    const tk = 1 + 0.1 * noise1(seed + 3 * s, 6);
    const droop = 1.6 + 1.2 * (0.5 + 0.5 * noise1(seed + 2 * s, 4));
    return [
      P(corner[0] + s * 5.2 * k, f.mouthY + 1.4 + droop * 0.8),
      P(corner[0] + s * 3 * k, f.mouthY - 1.4),
      P(CX + s * rx * 0.88, up(rx * 0.88, body * 0.62 * tk)),
      P(CX + s * rx * 0.5, up(rx * 0.5, body * 1.0 * tk)),
      P(CX + s * Math.max(f.nose.w * 0.7, 3.2), up(rx * 0.2, body * 1.12 * tk) + 0.5),
    ];
  };
  const sideLow = (s: 1 | -1): Pt[] => {
    const corner = s > 0 ? a.mouthR : a.mouthL;
    const k = 1 + 0.14 * noise1(seed + s, 3);
    return [
      P(corner[0] + s * 3 * k, f.mouthY + 2.2 + 0.4 * (1 + noise1(seed + s, 9))),
      P(CX + s * rx * 0.96, lip(rx * 0.96) - 0.3),
      P(CX + s * rx * 0.72, lip(rx * 0.72) - 0.15),
      P(CX + s * rx * 0.4, lip(rx * 0.4) - 0.1),
      P(CX + s * 1.6, lip(1.6) - 0.1),
    ];
  };
  const top = along([...sideTop(-1), P(CX - 0.9, up(0, body * 1.12) + 1.4), P(CX, up(0, body * 1.12) + 2.4), P(CX + 0.9, up(0, body * 1.12) + 1.4), ...sideTop(1).reverse()], 4);
  const lower = along([...sideLow(1), ...sideLow(-1).reverse()], 4);
  // Ink only the body of the lower edge, never the tapered ends (they would end in hard ticks).
  const edge = lower.filter((p) => Math.abs(p[0] - CX) < m.w * 0.7);
  return { pts: [...top, ...lower], edge, flow: "out", crisp: true, calm: true };
}

/**
 * Sharp chinstrap: a thin band of even width that starts where the hair's sideburn ends and runs the whole jaw to the
 * other sideburn. Its inner (upper) edge is trimmed, so it hardly roughens and gets no soft wash; the lower edge may
 * wander a little; it is a touch fuller on the chin. Width follows the jaw (narrow jaws, a narrow strap).
 */
function sharpStrap(f: NextSpec, head: Head, seed: number): Growth {
  const y0 = burnY(f) - 1;
  const w = clamp(6.4 + (f.jawW - 60) * 0.05, 5.6, 7.4);
  const push = 0.2;
  const outer = [...outline(head, 1, y0, f.chinY + 1).map((p) => P(p[0] + push, p[1])), ...outline(head, -1, y0, f.chinY + 1).reverse().map((p) => P(p[0] - push, p[1]))];
  const c = P(CX, f.eyeY + 10);
  const n = outer.length - 1;
  const inner = outer.map((p, i) => {
    const u = i / n;
    // Full width right from the sideburn (it continues the hair), a slow fullness on the chin, a small wander.
    const chin = 1 + 0.32 * Math.max(0, 1 - Math.abs(u - 0.5) / 0.15);
    // It leaves the sideburn already at width, but its first few units are drawn in so the top end is not square.
    const start = 0.55 + 0.45 * smooth01(Math.min(u, 1 - u) / 0.07);
    return sub(p, scale(unit(sub(p, c)), w * chin * start * (1 + 0.1 * noise1(seed, u * 9))));
  });
  const outerEdge = lodNow() === 0 ? outer : roughen(outer, 0.45, seed + 1, 0.7);
  const innerEdge = lodNow() === 0 ? inner : roughen(inner, 0.22, seed + 2, 0.5);
  return { pts: [...outerEdge, ...innerEdge.slice().reverse()], flow: "down", lift: 1.1, crisp: true };
}

/** Facial hair styles (FACIAL_HAIR order) as growth regions fitted to this face. 1-2 are stubble, drawn as tone. */
export function growthFor(f: NextSpec, head: Head, a: Anchors, style: number, pSeed = 0): Growth[] {
  const m = f.mouth;
  switch (style) {
    case 3:
      return [moustache(f, a, 4.2, 0.6)];
    case 4:
      return [moustache(f, a, 2.6)];
    case 7: {
      const y = f.mouthY + m.lo + 2.6;
      return [{ pts: along([P(CX - 4.5, y), P(CX + 4.5, y), P(CX + 2, y + 7.5), P(CX - 2, y + 7.5)], 3), flow: "down" }];
    }
    case 8:
      return [jawBeard(f, head, a, { drop: 3, low: 0.5 })];
    case 9:
      return [jawBeard(f, head, a, { drop: 6, low: 0.9, box: true })];
    case 10:
      return [jawBeard(f, head, a, { drop: 11, low: 0 })];
    case 11:
      return [jawBeard(f, head, a, { drop: 12, low: 0, long: 32 })];
    case 12:
      return [chinBeard(f, head, 4)];
    case 13:
      return [sideBand(f, head, 1, f.noseY, () => 8), sideBand(f, head, -1, f.noseY, () => 8)];
    case 14:
      return [sideBand(f, head, 1, f.mouthY + 6, (t) => 8 + t * 14), sideBand(f, head, -1, f.mouthY + 6, (t) => 8 + t * 14)];
    case 15:
      return [strap(f, head, 6.5, Math.round(f.jawW * 7))];
    case 16:
      return [imperialMoustache(f, a, 16 * 31 + Math.round(f.chinY * 3 + f.jawW) + pSeed)];
    case 17:
      return [sharpStrap(f, head, 17 * 31 + Math.round(f.jawW * 7) + pSeed)];
    default:
      return [];
  }
}

/** Styles with a body of their own (boxed, long, chin): built by `BeardMass` instead of the shared growth regions. */
const MASS_STYLES: Partial<Record<number, MassKind>> = { 5: "goatee", 6: "ring", 9: "boxed", 11: "long", 12: "chin", 16: "imperial", 18: "maestro" };

/**
 * Beards and moustaches drawn by value, like the hair: a soft wash where growth starts on the cheek (never a ruled
 * edge), the mass in the beard colour turning to shadow underneath and on the far side, a lit area on the upper
 * left, and at larger sizes a few strokes in the direction of growth. Ink only where the beard stands off the face.
 */
export function BeardNext({ f, head, a, t, style, color, youth, d, uid, pSeed = 0, moustache = false }: { f: NextSpec; head: Head; a: Anchors; t: SkinTones; style: number; color: string; youth: number; d: Detail; uid: string; pSeed?: number; moustache?: boolean }): ReactNode {
  const mass = MASS_STYLES[style];
  // Called, not rendered as an element: the geometry must be written inside the size-aware pass.
  if (mass && !moustache) {
    const body = BeardMass({ kind: mass, f, head, a, t, B: beardTones(color, t.base), youth, d, uid, pSeed });
    // A moustache with its goatee: the moustache is the shared growth, drawn over the chin mass.
    if (style === 6) return <>{body}{BeardNext({ f, head, a, t, style: 3, color, youth, d, uid })}</>;
    if (style === 16) return <>{body}{BeardNext({ f, head, a, t, style, color, youth, d, uid, pSeed, moustache: true })}</>;
    return body;
  }
  const list = growthFor(f, head, a, style, pSeed);
  if (!list.length) return null;
  const T = beardTones(color, t.base);
  // Dark beard on dark skin: separated by a cooler, slightly lifted light on the beard mass and its growth, not by
  // a heavier outline (the outline takes the beard's own deeper tone instead of black).
  const sep = T.need;
  const seed = style * 31 + Math.round(f.chinY);
  // Young faces grow thinner beards.
  const thin = 1 - 0.45 * youth;
  return (
    <g opacity={thin}>
      {list.map((b, bi) => {
        const id = `${uid}bd${bi}`;
        const region = ring(b.pts) + (b.hole ? ring(b.hole) : "");
        const xs = b.pts.map((p) => p[0]);
        const ys = b.pts.map((p) => p[1]);
        const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
        // Growth strokes: few, short, following the flow; dark on the far side, light on the lit side.
        const dark: string[] = [];
        const lit: string[] = [];
        if (d > 0) {
          const n = b.calm ? (d === 2 ? 8 : 3) : d === 2 ? (b.crisp ? 34 : 22) : b.crisp ? 14 : 9;
          for (let k = 0, tries = 0; k < n && tries < n * (b.crisp ? 40 : 6); tries++) {
            const p = P(lerp(x0, x1, hash01(seed + bi, tries * 2)), lerp(y0, y1, hash01(seed + bi, tries * 2 + 1)));
            if (!inside(b.pts, p) || (b.hole && inside(b.hole, p))) continue;
            k++;
            const dir = b.flow === "out" ? unit(P(Math.sign(p[0] - CX || 1) * 1, 0.55)) : unit(P((p[0] - CX) * 0.012, 1));
            const len = 3.5 + hash01(seed, tries + 400) * 4;
            const line = [sub(p, scale(dir, len * 0.4)), add(p, scale(dir, len * 0.6))];
            (p[0] < CX - 6 && p[1] < lerp(y0, y1, 0.7) && hash01(seed, tries + 500) < 0.6 ? lit : dark).push(stroke(line, { w: d === 2 ? 0.9 : 1.2, start: 0.4, end: 0.15, steps: 2, seed: seed + tries }));
          }
        }
        const mouthLine = b.hole && d > 0 ? strokeLine(b.hole.slice(1, 8), { w: 1, start: 0.2, end: 0.2, seed }) : "";
        const ink = b.edge && b.edge.length > 2 ? pieces(b.edge, [[0, 1]], 1).map((p) => strokeLine(p, { w: d === 0 ? 2.2 : 1.6, start: 0.1, end: 0.1, peak: 0.6, seed: seed + 3, wobble: 0.15 })).join("") : "";
        return (
          <g key={bi}>
            <defs>
              <clipPath id={id}>
                <path d={region} clipRule="evenodd" />
              </clipPath>
            </defs>
            {/* Where growth starts on the skin: a slightly larger, translucent wash so the upper edge fades. */}
            {d > 0 && !b.crisp && <path d={ring(roughen(b.pts.map((p) => add(p, scale(unit(sub(p, P(CX, f.mouthY))), -1.6))), 1.2, seed + bi)) + (b.hole ? ring(b.hole) : "")} fill={mixHex(color, t.deep, 0.35)} fillRule="evenodd" opacity={0.3} />}
            <path d={region} fill={T.shade} fillRule="evenodd" />
            <g clipPath={`url(#${id})`}>
              {/* The lit body: the region moved up and left, so a band of shadow stays underneath and on the right. */}
              <path d={ring(b.pts.map((p) => P(p[0] - (b.lift ? 0.8 : 1.6), p[1] - (b.lift ?? (b.flow === "out" ? 1.4 : Math.min(4.5, (y1 - y0) * 0.16))))))} fill={T.base} />
              {/* The far side of the jaw turns away from the light. */}
              {b.flow === "down" && x1 - x0 > 40 && <path d={ring([P(CX + (x1 - CX) * 0.42, y0 - 4), P(x1 + 6, y0 - 4), P(x1 + 6, y1 + 6), P(CX + 4, y1 + 6), P(CX + (x1 - CX) * 0.3, lerp(y0, y1, 0.75))])} fill={T.shade} opacity={0.55} />}
              {/* Light on the near cheek of the beard: a soft, uneven mass (cooler and a touch stronger on dark skin). */}
              {d > 0 && <path d={ring(roughen(along([P(x0 - 6, lerp(y0, y1, 0.08)), P(lerp(x0, CX, 0.55), y0 + 2), P(CX - 8, lerp(y0, y1, 0.35)), P(lerp(x0, CX, 0.45), lerp(y0, y1, 0.62)), P(x0 - 4, lerp(y0, y1, 0.7)), P(x0 - 6, lerp(y0, y1, 0.08))], 5), 1.6, seed + bi + 9, 0.5))} fill={mixHex(T.base, T.light, 0.3 + 0.12 * sep)} opacity={0.45 + 0.1 * sep} />}
              {dark.length > 0 && <path d={dark.join("")} fill={T.deep} opacity={0.55} />}
              {lit.length > 0 && <path d={lit.join("")} fill={T.light} opacity={0.5 + 0.25 * sep} />}
              {mouthLine && <path d={mouthLine} fill={T.deep} opacity={0.6} />}
            </g>
            {ink && <path d={ink} fill={T.edge} opacity={0.85} />}
          </g>
        );
      })}
    </g>
  );
}

