import { hash01, q } from "../portrait/geometry";
import { shift } from "./palette";
import type { Detail } from "./face";

/**
 * A quiet stadium behind the player, out of focus: a muted vertical gradient, the dark mass of a stand, a pale band
 * of sky or roof, and a few soft floodlight glows. All soft edges come from radial gradients (no blur filters), so
 * it costs almost nothing in long lists. Small sizes keep only the gradient.
 */
export function BackdropNext({ base, uid, seed, d, box }: { base: string; uid: string; seed: number; d: Detail; box: { x: number; y: number; w: number; h: number } }) {
  const { x, y, w, h } = box;
  const r = (i: number) => hash01(seed, i);
  const top = shift(base, 4, -0.06, 0.08);
  const bottom = shift(base, -4, 0.02, -0.12);
  const stand = shift(base, -6, -0.04, -0.16);
  const glow = shift(base, 10, -0.15, 0.3);
  const standY = y + h * (0.42 + r(1) * 0.08);
  // A floodlight bank or two: small soft glows in a loose row near the top, never a single "moon".
  const banks = 1 + Math.floor(r(2) * 2);
  const lights = Array.from({ length: banks * 3 }, (_, i) => {
    const b = Math.floor(i / 3);
    const bx = x + w * (b === 0 ? 0.06 + r(10) * 0.2 : 0.74 + r(11) * 0.2);
    return { cx: bx + (i % 3) * 9 + r(12 + i) * 3, cy: y + h * (0.07 + r(20 + b) * 0.08) + (i % 3) * 1.5, rr: 7 + r(30 + i) * 6 };
  });
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
        {d > 0 && (
          <>
            <radialGradient id={`${uid}gl`}>
              <stop offset="0" stopColor={glow} stopOpacity="0.45" />
              <stop offset="1" stopColor={glow} stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`${uid}st`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={stand} stopOpacity="0" />
              <stop offset="0.4" stopColor={stand} stopOpacity="0.45" />
              <stop offset="1" stopColor={stand} stopOpacity="0.6" />
            </linearGradient>
          </>
        )}
      </defs>
      <rect x={x} y={y} width={w} height={h} fill={`url(#${uid}bg)`} />
      {d > 0 && (
        <>
          {/* The far stand: a long soft-topped mass with the roof line sloping across the frame. */}
          <path d={q(`M${x} ${standY - 10 - r(3) * 14}C${x + w * 0.3} ${standY - 22} ${x + w * 0.7} ${standY - 6} ${x + w} ${standY - 18 + r(4) * 10}L${x + w} ${y + h}L${x} ${y + h}Z`)} fill={`url(#${uid}st)`} />
          {lights.map((l, i) => (
            <circle key={i} cx={l.cx} cy={l.cy} r={l.rr} fill={`url(#${uid}gl)`} />
          ))}
        </>
      )}
    </g>
  );
}
