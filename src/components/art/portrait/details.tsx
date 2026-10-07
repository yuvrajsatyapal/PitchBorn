import { INK, MARKS, SCARS } from "@/engine/appearance/options";
import type { AgeLook } from "@/engine/appearance/age";
import type { Appearance } from "@/engine/types";
import { CX, type Contour, type Pt } from "./geometry";
import type { Skin } from "./features";

const f = (n: number) => Math.round(n * 10) / 10;
const sw = (n: number) => ({ strokeWidth: n, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

/**
 * Face modelling in three tones: base, shadow and highlight. Light comes from the upper left, so the right side of the
 * face, under the cheekbones, the jaw and the brow ridge carry the shadow; a halftone screen sits in the deepest areas.
 */
export function FaceShading({ contour: c, skin, uid, halftone, age }: { contour: Contour; skin: Skin; uid: string; halftone: boolean; age: number }) {
  const ys = Array.from({ length: 9 }, (_, i) => 84 + ((c.chin - 84) * i) / 8);
  const outer: Pt[] = ys.map((y) => [CX + c.half(y) - 0.4, y]);
  const width = (i: number) => 7 + 12 * Math.sin((i / 8) * Math.PI) + (i > 6 ? 5 : 0);
  const inner: Pt[] = ys.map((y, i) => [CX + c.half(y) - width(i), y]);
  const band = (a: Pt[], b: Pt[]) => `M${a.map((p) => `${f(p[0])} ${f(p[1])}`).join("L")}L${b.slice().reverse().map((p) => `${f(p[0])} ${f(p[1])}`).join("L")}Z`;
  const d = band(outer, inner);
  // The inner half of the shadow band is the screened part.
  const mid: Pt[] = inner.map((p, i) => [(p[0] + outer[i][0]) / 2, p[1]]);
  const jawY = c.chin - 26;
  // Slightly stronger jaw definition once past the teens.
  const jaw = 0.55 + 0.25 * Math.min(1, Math.max(0, (age - 18) / 12));
  return (
    <g>
      <path d={d} fill={skin.shade} opacity={0.6} />
      {halftone && (
        <>
          <defs>
            <pattern id={`${uid}ht`} width="3.4" height="3.4" patternUnits="userSpaceOnUse" patternTransform="rotate(32)">
              <circle cx="1.7" cy="1.7" r="0.78" fill={skin.deep} />
            </pattern>
          </defs>
          <path d={band(mid, inner)} fill={`url(#${uid}ht)`} opacity={0.55} />
        </>
      )}
      {/* brow ridge and temple */}
      <path d={`M${CX + 8} 92Q${CX + 30} 88 ${CX + c.half(96) - 2} 100L${CX + c.half(104) - 8} 106Q${CX + 26} 100 ${CX + 8} 99Z`} fill={skin.shade} opacity={0.3} />
      {/* cheekbones: soft planes rather than lines. Shadow beneath on the shaded side, light on top */}
      <ellipse cx={CX + 26} cy={134} rx={13} ry={7} transform={`rotate(-28 ${CX + 26} 134)`} fill={skin.shade} opacity={0.3} />
      <ellipse cx={CX - 26} cy={134} rx={12} ry={6} transform={`rotate(28 ${CX - 26} 134)`} fill={skin.shade} opacity={0.12} />
      <ellipse cx={CX - 27} cy={121} rx={11} ry={4.6} transform={`rotate(14 ${CX - 27} 121)`} fill={skin.light} opacity={0.4} />
      <ellipse cx={CX + 26} cy={120} rx={9} ry={3.6} transform={`rotate(-14 ${CX + 26} 120)`} fill={skin.light} opacity={0.15} />
      {/* jaw line and under-jaw shade */}
      <path d={`M${CX - c.half(jawY) + 3} ${jawY}Q${CX - 12} ${c.chin - 3} ${CX} ${c.chin - 3}Q${CX + 12} ${c.chin - 3} ${CX + c.half(jawY) - 3} ${jawY}`} fill="none" stroke={skin.shade} opacity={0.5 * jaw} {...sw(4.5)} />
      <ellipse cx={CX - 16} cy={80} rx={17} ry={6.5} fill={skin.light} opacity={0.4} />
      <ellipse cx={CX - 3} cy={c.chin - 12} rx={9} ry={4.5} fill={skin.light} opacity={0.22} />
      {c.cleft && <path d={`M${CX - 0.5} ${c.chin - 14}l1 8`} stroke={skin.deep} opacity={0.6} {...sw(1.5)} />}
    </g>
  );
}

export function AgeLines({ age, skin, contour: c }: { age: AgeLook; skin: Skin; contour: Contour }) {
  if (age.lines < 0.2) return null;
  const o = 0.5 * age.lines;
  const forehead = age.lines > 0.55;
  return (
    <g stroke={skin.deep} fill="none" opacity={o} {...sw(1.2)}>
      {forehead && <path d={`M${CX - 22} 76Q${CX} 73 ${CX + 22} 76M${CX - 18} 82Q${CX} 79.5 ${CX + 18} 82`} />}
      <path d={`M${CX - 38} 120Q${CX - 31} 123 ${CX - 30} 128M${CX + 38} 120Q${CX + 31} 123 ${CX + 30} 128`} />
      <path d={`M${CX - 18} 142Q${CX - 22} 150 ${CX - 20} ${c.chin - 20}M${CX + 18} 142Q${CX + 22} 150 ${CX + 20} ${c.chin - 20}`} />
    </g>
  );
}

export function Details({ a, skin }: { a: Appearance; skin: Skin }) {
  const els: React.ReactNode[] = [];
  if (a.freckles) {
    const dots: [number, number][] = [[-26, 126], [-20, 130], [-31, 131], [-14, 127], [-24, 135], [26, 126], [20, 130], [31, 131], [14, 127], [24, 135], [-6, 120], [6, 121], [0, 124], [-10, 123], [10, 124]];
    dots.forEach(([x, y], i) => els.push(<circle key={`fr${i}`} cx={CX + x} cy={y} r={0.95 + (i % 3) * 0.2} fill={skin.deep} opacity={0.62} />));
  }
  const scar = SCARS[a.scar];
  if (scar === "Cheek scar") els.push(<path key="sc" d={`M${CX + 28} 120l9 11M${CX + 31} 119l-1 3M${CX + 33} 123l-1 3M${CX + 35} 127l-1 3`} stroke={skin.deep} opacity={0.85} {...sw(1.5)} fill="none" />);
  if (scar === "Eyebrow scar") els.push(<path key="sc" d={`M${CX + 33} 87l4 12`} stroke={skin.shade} opacity={0.95} {...sw(2)} fill="none" />);
  if (scar === "Chin scar") els.push(<path key="sc" d={`M${CX - 12} 166l8 6`} stroke={skin.deep} opacity={0.8} {...sw(1.6)} fill="none" />);
  const mark = MARKS[a.mark];
  if (mark === "Beauty mark left") els.push(<circle key="mk" cx={CX - 22} cy={147} r={1.5} fill={INK} opacity={0.8} />);
  if (mark === "Beauty mark right") els.push(<circle key="mk" cx={CX + 24} cy={142} r={1.5} fill={INK} opacity={0.8} />);
  return <g>{els}</g>;
}
