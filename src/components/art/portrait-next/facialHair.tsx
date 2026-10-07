import type { Head } from "../portrait/anatomy";
import { CX, along, clamp, hash01, lerp, q, type Pt } from "../portrait/geometry";
import type { Detail } from "./face";
import type { NextSpec } from "./head";
import { ring, roughen, stroke } from "./ink";
import { mixHex, type SkinTones } from "./palette";

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
