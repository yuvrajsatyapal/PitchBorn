import { INK, MARKS, SCARS } from "@/engine/appearance/options";
import type { AgeLook } from "@/engine/appearance/age";
import type { Appearance } from "@/engine/types";
import { CX, type Contour, type Pt } from "./geometry";
import type { Skin } from "./features";

const f = (n: number) => Math.round(n * 10) / 10;
const sw = (n: number) => ({ strokeWidth: n, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

/** Two-tone face shading: a soft shadow on one side and a light patch on the forehead. */
export function FaceShading({ contour: c, skin }: { contour: Contour; skin: Skin }) {
  const ys = Array.from({ length: 9 }, (_, i) => 84 + ((c.chin - 84) * i) / 8);
  const outer: Pt[] = ys.map((y) => [CX + c.half(y) - 0.4, y]);
  const inner: Pt[] = ys.map((y, i) => [CX + c.half(y) - (7 + 12 * Math.sin((i / 8) * Math.PI) + (i > 6 ? 5 : 0)), y]);
  const d = `M${outer.map((p) => `${f(p[0])} ${f(p[1])}`).join("L")}L${inner
    .slice()
    .reverse()
    .map((p) => `${f(p[0])} ${f(p[1])}`)
    .join("L")}Z`;
  return (
    <g>
      <path d={d} fill={skin.shade} opacity={0.62} />
      <ellipse cx={CX - 16} cy={80} rx={17} ry={6.5} fill={skin.light} opacity={0.38} />
      <path d={`M${CX - 30} 126Q${CX - 24} 134 ${CX - 15} 135`} fill="none" stroke={skin.light} opacity={0.35} {...sw(5)} />
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
