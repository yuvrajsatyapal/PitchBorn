/**
 * Small stadium vignette for the career-arc card. Vector, standalone (own ids). The hero showcase uses raster
 * illustrations instead (see ShowcaseArt); this stays because it is a simple scene with no characters.
 * Fixed colours on purpose (like Crest/Kit): the artwork must not invert with the dark theme.
 */
export const INK = "#2b2622";
const CREAM = "#f3e9d2";
const SUN = "#d9ad4a";
const CORAL = "#c86b58";
const TEAL = "#5b9295";
const BLUE = "#5a7ea9";
const GRASS = "#3f7656";
const GRASS_LT = "#4c8561";
const SHADE = "#1c1a26";

const f1 = (n: number) => n.toFixed(1);
const Halftone = ({ d, o = 1 }: { d: string; o?: number }) => <path d={d} fill="url(#pbs-arc-ht)" opacity={o} stroke="none" />;

export function StadiumArt({ className = "" }: { className?: string }) {
  const stripes = Array.from({ length: 7 }, (_, i) => {
    const y0 = 84 + (i * i * 66) / 49 + i * 4;
    const y1 = 84 + ((i + 1) * (i + 1) * 66) / 49 + (i + 1) * 4;
    return { y0, y1 };
  });
  return (
    <svg viewBox="0 0 300 150" className={className} aria-hidden focusable="false" strokeLinejoin="round" strokeLinecap="round" stroke={INK} strokeWidth="1.1">
      <defs>
        <clipPath id="pbs-arc-pitch">
          <path d="M62 89H238L304 150H-4z" />
        </clipPath>
        <clipPath id="pbs-arc-clip">
          <rect width="300" height="150" rx="14" />
        </clipPath>
        <linearGradient id="pbs-arc-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a9c9cf" />
          <stop offset="1" stopColor="#efe0bd" />
        </linearGradient>
        <radialGradient id="pbs-arc-glow">
          <stop offset="0" stopColor="#fff1c4" stopOpacity=".8" />
          <stop offset="1" stopColor="#fff1c4" stopOpacity="0" />
        </radialGradient>
        <pattern id="pbs-arc-crowd" width="10" height="7" patternUnits="userSpaceOnUse">
          <rect width="10" height="7" fill="#3a3546" />
          <circle cx="2" cy="1.9" r="1.2" fill={CORAL} opacity=".5" />
          <circle cx="7" cy="1.9" r="1.2" fill={SUN} opacity=".48" />
          <circle cx="4.5" cy="5.2" r="1.2" fill={CREAM} opacity=".36" />
          <circle cx="9.4" cy="5.2" r="1.2" fill={TEAL} opacity=".42" />
        </pattern>
        <pattern id="pbs-arc-ht" width="3.4" height="3.4" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <circle cx="1.7" cy="1.7" r="0.7" fill={SHADE} opacity=".5" />
        </pattern>
      </defs>
      <g clipPath="url(#pbs-arc-clip)">
        <rect width="300" height="150" fill="url(#pbs-arc-sky)" stroke="none" />
        <circle cx="46" cy="40" r="34" fill="url(#pbs-arc-glow)" stroke="none" />
        <circle cx="46" cy="40" r="10" fill="#f7e6b6" stroke="none" />
        <path d="M-4 66Q50 40 110 58T230 52T304 62V90H-4z" fill="#9db9ab" stroke="none" />
        <path d="M232 26q10-4 20-1 8-3 16 1-10 4-20 3-8 2-16-3z" fill={CREAM} opacity=".6" stroke="none" />
        {/* far stand + roof */}
        <rect x="62" y="46" width="176" height="38" fill="url(#pbs-arc-crowd)" />
        <path d={Array.from({ length: 7 }, (_, i) => `M62 ${52 + i * 5}H238`).join("")} stroke={SHADE} strokeWidth="0.5" opacity=".35" fill="none" />
        <path d={Array.from({ length: 9 }, (_, i) => `M${72 + i * 19} 46V84`).join("")} stroke={SHADE} strokeWidth="0.8" opacity=".5" fill="none" />
        <rect x="62" y="46" width="176" height="8" fill={SHADE} opacity=".25" stroke="none" />
        <path d="M54 40H246L240 48H60z" fill="#4c5560" />
        <path d={Array.from({ length: 14 }, (_, i) => `M${62 + i * 13} 48l6.5-8 6.5 8`).join("")} fill="none" strokeWidth="0.5" opacity=".55" />
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} x={62 + i * 22} y="84" width="22" height="5" fill={[BLUE, CORAL, TEAL, SUN][i % 4]} strokeWidth="0.6" />
        ))}
        {/* side stands in perspective */}
        <path d="M62 46L-4 76V150L62 89z" fill="url(#pbs-arc-crowd)" />
        <path d="M238 46L304 76V150L238 89z" fill="url(#pbs-arc-crowd)" />
        <path
          d={Array.from(
            { length: 6 },
            (_, k) => `M62 ${46 + (k + 1) * 7.2}L-4 ${76 + (k + 1) * 12.3}M238 ${46 + (k + 1) * 7.2}L304 ${76 + (k + 1) * 12.3}`,
          ).join("")}
          stroke={SHADE}
          strokeWidth="0.5"
          opacity=".35"
          fill="none"
        />
        <path d="M-4 76L62 46V89L-4 150z" fill={SHADE} opacity=".15" stroke="none" />
        <path d="M54 40L-4 68V76L62 46zM246 40L304 68V76L238 46z" fill="#4c5560" />
        {/* pitch */}
        <path d="M62 89H238L304 150H-4z" fill={GRASS} />
        <g clipPath="url(#pbs-arc-pitch)">
          {stripes.map((s, i) =>
            i % 2 ? <rect key={i} x="-4" y={f1(s.y0)} width="308" height={f1(s.y1 - s.y0 + 0.5)} fill={GRASS_LT} stroke="none" opacity=".9" /> : null,
          )}
        </g>
        <path d="M62 89H238L304 150H-4z" fill="none" />
        <path d="M118 90L106 104H194L182 90M134 90L128 96H172L166 90" fill="none" stroke={CREAM} strokeWidth="0.9" opacity=".85" />
        <path d="M18 128H282" stroke={CREAM} strokeWidth="0.9" opacity=".7" fill="none" />
        <ellipse cx="150" cy="128" rx="44" ry="9" fill="none" stroke={CREAM} strokeWidth="0.9" opacity=".8" />
        <path d="M62 89L-4 150M238 89L304 150" fill="none" stroke={CREAM} strokeWidth="0.9" opacity=".7" />
        <path d="M-4 150L62 89V92L0 150z" fill={SHADE} opacity=".12" stroke="none" />
        {/* masts + pennant */}
        {[
          [30, 18],
          [270, 18],
        ].map(([mx, my]) => (
          <g key={mx} strokeWidth="0.8">
            <path d={`M${mx - 3} ${my + 58}L${mx - 1.2} ${my + 10}H${mx + 1.2}L${mx + 3} ${my + 58}`} fill="#8e9a9d" />
            <rect x={mx - 10} y={my} width="20" height="11" rx="1.4" fill="#5a676d" />
            {[0, 1, 2, 3].map((i) => (
              <g key={i}>
                <circle cx={mx - 7 + i * 4.7} cy={my + 3.4} r="1.4" fill={CREAM} stroke="none" />
                <circle cx={mx - 7 + i * 4.7} cy={my + 7.6} r="1.4" fill={CREAM} stroke="none" />
              </g>
            ))}
          </g>
        ))}
        <path d="M150 40V22" strokeWidth="1" fill="none" />
        <path d="M150 22l14 4-14 5z" fill={CORAL} strokeWidth="0.9" />
        <Halftone d="M238 89L304 150H250z" o={0.5} />
      </g>
      <rect x="1" y="1" width="298" height="148" rx="13" fill="none" />
    </svg>
  );
}
