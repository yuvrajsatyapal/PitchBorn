import type { Head } from "../portrait/anatomy";
import { CX, add, along, clamp, hash01, lerp, q, scale, sub, unit, type Pt } from "../portrait/geometry";
import type { Anchors } from "./anchors";
import type { Detail } from "./face";
import type { NextSpec } from "./head";
import { pieces, ring, roughen, stroke, strokeLine } from "./ink";
import { INK, hairTones, mixHex, type SkinTones } from "./palette";

const P = (x: number, y: number): Pt => [x, y];

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
  const tone = mixHex(color, t.deep, 0.4);
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

// ------------------------------------------------------------------ beards

/** One piece of facial hair: its region (and a hole for the lips), the edge that is inked, and how hair grows on it. */
interface Growth {
  pts: Pt[];
  hole?: Pt[];
  /** The part of the outline that stands off the face (inked); the edge on the skin stays soft. */
  edge?: Pt[];
  /** "down": along the jaw and chin; "out": a moustache, from the centre to the corners. */
  flow: "down" | "out";
}

const smooth01 = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

/** Where facial hair starts: the bottom of the hair's sideburn (the same point every hairline uses). */
const burnY = (f: NextSpec) => f.ear.top + (f.ear.bot - f.ear.top) * 0.4;

/** The head outline on one side between two heights. */
const outline = (head: Head, s: 1 | -1, y0: number, y1: number) => (s > 0 ? head.rightPts : head.leftPts).filter((p) => p[1] >= y0 && p[1] <= y1);

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

/** The lips, with only a hair's width of skin round them. */
function mouthGap(f: NextSpec): Pt[] {
  const m = f.mouth;
  const cy = f.mouthY + (m.lo - m.up) / 2;
  const rx = m.w + 0.8;
  const ry = (m.up + m.lo) / 2 + 0.7;
  return Array.from({ length: 16 }, (_, i) => {
    const t = (i / 16) * Math.PI * 2;
    return P(CX + Math.cos(t) * rx, cy + Math.sin(t) * ry);
  });
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


function chinPatch(f: NextSpec, w: number, drop: number, fromLip = true): Growth {
  const y0 = f.mouthY + f.mouth.lo + 2.4;
  const pts = along([P(CX - w * 0.55, y0 + 0.5), P(CX - w * 0.2, fromLip ? y0 - 0.6 : y0 + 2), P(CX + w * 0.2, fromLip ? y0 - 0.6 : y0 + 2), P(CX + w * 0.55, y0 + 0.5), P(CX + w, f.chinY - 8), P(CX + w * 0.6, f.chinY + drop * 0.7), P(CX, f.chinY + drop), P(CX - w * 0.6, f.chinY + drop * 0.7), P(CX - w, f.chinY - 8)], 4);
  return { pts, edge: pts.filter((p) => p[1] > f.chinY - 12), flow: "down" };
}

/** Sideburns and chops: a band down each side of the face from the hair's sideburn. */
function sideBand(f: NextSpec, head: Head, s: 1 | -1, y1: number, width: (t: number) => number): Growth {
  const out = outline(head, s, burnY(f), y1).map((p) => P(p[0] + s * 1.2, p[1]));
  const inn = out.map((p, i) => P(p[0] - s * width(i / Math.max(1, out.length - 1)), p[1]));
  return { pts: [...out, ...inn.reverse()], edge: out, flow: "down" };
}

function strap(f: NextSpec, head: Head, w: number): Growth {
  const y0 = burnY(f) + 6;
  const outer = [...outline(head, 1, y0, f.chinY + 1).map((p) => P(p[0] + 1.2, p[1])), ...outline(head, -1, y0, f.chinY + 1).reverse().map((p) => P(p[0] - 1.2, p[1]))];
  const c = P(CX, f.eyeY + 10);
  const inner = outer.map((p) => sub(p, scale(unit(sub(p, c)), w)));
  return { pts: [...outer, ...inner.reverse()], edge: outer, flow: "down" };
}

/** Facial hair styles (FACIAL_HAIR order) as growth regions fitted to this face. 1-2 are stubble, drawn as tone. */
export function growthFor(f: NextSpec, head: Head, a: Anchors, style: number): Growth[] {
  const m = f.mouth;
  switch (style) {
    case 3:
      return [moustache(f, a, 4.2, 0.6)];
    case 4:
      return [moustache(f, a, 2.6)];
    case 5:
      return [chinPatch(f, m.w * 0.62, 4)];
    case 6: {
      const ringPts = along([P(CX - m.w - 3, f.mouthY + 1.5), P(CX - m.w - 6, f.mouthY + m.lo + 4), P(CX - f.chinW * 0.95, f.chinY - 6), P(CX, f.chinY + 4), P(CX + f.chinW * 0.95, f.chinY - 6), P(CX + m.w + 6, f.mouthY + m.lo + 4), P(CX + m.w + 3, f.mouthY + 1.5)], 4);
      return [{ pts: ringPts, hole: mouthGap(f), edge: ringPts.filter((p) => p[1] > f.mouthY + m.lo + 6), flow: "down" }, moustache(f, a, 5, 1.5)];
    }
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
      return [chinPatch(f, f.chinW + 9, 10, false)];
    case 13:
      return [sideBand(f, head, 1, f.noseY, () => 8), sideBand(f, head, -1, f.noseY, () => 8)];
    case 14:
      return [sideBand(f, head, 1, f.mouthY + 6, (t) => 8 + t * 14), sideBand(f, head, -1, f.mouthY + 6, (t) => 8 + t * 14)];
    case 15:
      return [strap(f, head, 7)];
    default:
      return [];
  }
}

/**
 * Beards and moustaches drawn by value, like the hair: a soft wash where growth starts on the cheek (never a ruled
 * edge), the mass in the beard colour turning to shadow underneath and on the far side, a lit area on the upper
 * left, and at larger sizes a few strokes in the direction of growth. Ink only where the beard stands off the face.
 */
export function BeardNext({ f, head, a, t, style, color, youth, d, uid }: { f: NextSpec; head: Head; a: Anchors; t: SkinTones; style: number; color: string; youth: number; d: Detail; uid: string }) {
  const list = growthFor(f, head, a, style);
  if (!list.length) return null;
  const T = hairTones(color);
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
          const n = d === 2 ? 22 : 9;
          for (let k = 0, tries = 0; k < n && tries < n * 6; tries++) {
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
            {d > 0 && <path d={ring(roughen(b.pts.map((p) => add(p, scale(unit(sub(p, P(CX, f.mouthY))), -1.6))), 1.2, seed + bi)) + (b.hole ? ring(b.hole) : "")} fill={mixHex(color, t.deep, 0.35)} fillRule="evenodd" opacity={0.3} />}
            <path d={region} fill={T.shade} fillRule="evenodd" />
            <g clipPath={`url(#${id})`}>
              {/* The lit body: the region moved up and left, so a band of shadow stays underneath and on the right. */}
              <path d={ring(b.pts.map((p) => P(p[0] - 1.6, p[1] - (b.flow === "out" ? 1.4 : Math.min(4.5, (y1 - y0) * 0.16)))))} fill={T.base} />
              {/* The far side of the jaw turns away from the light. */}
              {b.flow === "down" && x1 - x0 > 40 && <path d={ring([P(CX + (x1 - CX) * 0.42, y0 - 4), P(x1 + 6, y0 - 4), P(x1 + 6, y1 + 6), P(CX + 4, y1 + 6), P(CX + (x1 - CX) * 0.3, lerp(y0, y1, 0.75))])} fill={T.shade} opacity={0.55} />}
              {d > 0 && <path d={ring([P(x0 - 4, y0 - 4), P(CX - 2, y0 - 4), P(CX - 10, lerp(y0, y1, 0.55)), P(x0 - 4, lerp(y0, y1, 0.75))])} fill={mixHex(T.base, T.light, 0.3)} opacity={0.55} />}
              {dark.length > 0 && <path d={dark.join("")} fill={T.deep} opacity={0.55} />}
              {lit.length > 0 && <path d={lit.join("")} fill={T.light} opacity={0.5} />}
              {mouthLine && <path d={mouthLine} fill={T.deep} opacity={0.6} />}
            </g>
            {ink && <path d={ink} fill={INK} opacity={0.85} />}
          </g>
        );
      })}
    </g>
  );
}

function inside(shape: readonly Pt[], p: Pt): boolean {
  let c = false;
  for (let i = 0, j = shape.length - 1; i < shape.length; j = i++) {
    const A = shape[i];
    const B = shape[j];
    if (A[1] > p[1] !== B[1] > p[1] && p[0] < ((B[0] - A[0]) * (p[1] - A[1])) / (B[1] - A[1]) + A[0]) c = !c;
  }
  return c;
}
