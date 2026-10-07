import { SCARS, MARKS } from "@/engine/appearance/options";
import type { FaceSpec, Head } from "./anatomy";
import type { Skin } from "./face";
import { q, CX, FINE, INK, OUT, sw } from "./geometry";

/**
 * Structure lines that deepen with age. The fold from nose to mouth is always faintly there (it is bone and muscle,
 * not age); forehead and frown lines only arrive in the thirties. Never cartoon wrinkles: few, short, soft lines.
 */
export function AgeLines({ f, skin, lines }: { f: FaceSpec; skin: Skin; lines: number }) {
  const n = f.nose;
  const m = f.mouth;
  const fold = (s: 1 | -1) => q(`M${CX + s * (n.w + 3)} ${f.noseY - 7}C${CX + s * (n.w + 9)} ${f.noseY + 2} ${CX + s * (m.w + 8)} ${f.mouthY - 8} ${CX + s * (m.w + 5)} ${f.mouthY + 4 + lines * 4}`);
  const o = 0.22 + lines * 0.45;
  return (
    <g>
      <path d={fold(1)} stroke={skin.deep} opacity={o} {...sw(1.5)} />
      <path d={fold(-1)} stroke={skin.deep} opacity={o * 0.75} {...sw(1.3)} />
      {lines > 0.5 && (
        <path
          d={q(`M${CX - 26} ${f.browY - 24}Q${CX} ${f.browY - 28} ${CX + 26} ${f.browY - 24}M${CX - 20} ${f.browY - 15}Q${CX} ${f.browY - 18.5} ${CX + 20} ${f.browY - 15}`)}
          stroke={skin.deep}
          opacity={(lines - 0.4) * 0.55}
          {...sw(1.3)}
        />
      )}
      {lines > 0.7 && <path d={q(`M${CX - 4} ${f.browY - 4}l-1 9M${CX + 4} ${f.browY - 4}l1 9`)} stroke={skin.deep} opacity={(lines - 0.6) * 0.8} {...sw(1.2)} />}
    </g>
  );
}

export function Details({ f, skin, freckles, scar, mark }: { f: FaceSpec; skin: Skin; freckles: boolean; scar: number; mark: number }) {
  const els: React.ReactNode[] = [];
  if (freckles) {
    const spots: [number, number][] = [[-30, 10], [-24, 15], [-35, 17], [-18, 12], [-27, 22], [-9, 4], [-12, 13], [9, 4], [12, 13], [30, 10], [24, 15], [35, 17], [18, 12], [27, 22], [0, -2], [-4, 8], [4, 8]];
    spots.forEach(([x, y], i) => els.push(<circle key={`fr${i}`} cx={CX + x} cy={f.eyeY + 14 + y} r={0.9 + (i % 3) * 0.3} fill={skin.deep} opacity={0.55} />));
  }
  const name = SCARS[scar];
  if (name === "Cheek scar") els.push(<path key="sc" d={q(`M${CX + 34} ${f.eyeY + 18}l10 14`)} stroke={skin.light} {...sw(2.6)} />, <path key="sc2" d={q(`M${CX + 34} ${f.eyeY + 18}l10 14M${CX + 37} ${f.eyeY + 21}l3 -1.6M${CX + 40} ${f.eyeY + 26}l3 -1.6`)} stroke={skin.deep} opacity={0.7} {...sw(FINE)} />);
  if (name === "Eyebrow scar") els.push(<path key="sc" d={q(`M${CX + 40} ${f.eyeY - f.brow.low - 9}l3 14`)} stroke={skin.light} {...sw(2.6)} />, <path key="sc2" d={q(`M${CX + 40.6} ${f.eyeY - f.brow.low - 7}l2.4 11`)} stroke={skin.deep} opacity={0.55} {...sw(FINE * 0.9)} />);
  if (name === "Chin scar") els.push(<path key="sc" d={q(`M${CX - 14} ${f.chinY - 16}l9 6`)} stroke={skin.light} {...sw(2.6)} />, <path key="sc2" d={q(`M${CX - 14} ${f.chinY - 16}l9 6`)} stroke={skin.deep} opacity={0.6} {...sw(FINE * 0.9)} />);
  const mk = MARKS[mark];
  if (mk === "Beauty mark left") els.push(<circle key="mk" cx={CX - 27} cy={f.mouthY - 9} r={1.8} fill={INK} opacity={0.75} />);
  if (mk === "Beauty mark right") els.push(<circle key="mk" cx={CX + 30} cy={f.noseY - 4} r={1.8} fill={INK} opacity={0.75} />);
  return <g>{els}</g>;
}

/** A footballer's elastic headband across the forehead, over the hair. */
export function Headband({ f, head }: { f: FaceSpec; head: Head }) {
  const y = f.browY - 40;
  const wl = head.half(y, -1) + 2.5;
  const wr = head.half(y, 1) + 2.5;
  const d = q(`M${CX - wl} ${y + 2}Q${CX} ${y - 7} ${CX + wr} ${y + 2}L${CX + wr} ${y + 10}Q${CX} ${y + 1} ${CX - wl} ${y + 10}Z`);
  return (
    <g>
      <path d={d} fill="#f1ead8" stroke={INK} strokeWidth={OUT * 0.75} strokeLinejoin="round" />
      <path d={q(`M${CX + 10} ${y - 2}Q${CX + wr * 0.6} ${y - 1} ${CX + wr} ${y + 3}L${CX + wr} ${y + 10}Q${CX + wr * 0.6} ${y + 5} ${CX + 10} ${y + 5}Z`)} fill="#d9d0bd" />
    </g>
  );
}
