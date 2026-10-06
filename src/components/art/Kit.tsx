import { staticClub } from "@/engine/data/world";
import { hashString, readableOn } from "./hash";

/** Generated shirt from real club colours (no licensed kit artwork). */
export function Kit({ clubId, number, size = 48, away = false }: { clubId: string | null | undefined; number?: number; size?: number; away?: boolean }) {
  const club = clubId ? staticClub(clubId) : undefined;
  const p = club ? (away ? club.colors.secondary : club.colors.primary) : "#cfc5b4";
  const s = club ? (away ? club.colors.primary : club.colors.secondary) : "#8d826f";
  const style = club ? hashString(club.id + (away ? "a" : "h")) % 4 : 0;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <defs>
        <clipPath id={`k${style}${p.slice(1)}${s.slice(1)}`}>
          <path d="M14 6 L20 4 Q24 8 28 4 L34 6 L44 13 L39 21 L35 18 V44 H13 V18 L9 21 L4 13 Z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#k${style}${p.slice(1)}${s.slice(1)})`}>
        <rect width="48" height="48" fill={p} />
        {style === 1 && [0, 1, 2, 3].map((i) => <rect key={i} x={13 + i * 6} width="3" height="48" fill={s} />)}
        {style === 2 && <rect y="18" width="48" height="7" fill={s} />}
        {style === 3 && <rect x="24" width="24" height="48" fill={s} />}
        <rect x="0" y="6" width="13" height="16" fill={s} opacity={style === 0 ? 1 : 0.0} />
        <rect x="35" y="6" width="13" height="16" fill={s} opacity={style === 0 ? 1 : 0.0} />
      </g>
      <path d="M14 6 L20 4 Q24 8 28 4 L34 6 L44 13 L39 21 L35 18 V44 H13 V18 L9 21 L4 13 Z" fill="none" stroke="#1b1712" strokeWidth="2" strokeLinejoin="round" />
      {number !== undefined && (
        <text x="24" y="33" textAnchor="middle" fontFamily="var(--font-lilita), sans-serif" fontSize="13" fill={style === 3 ? "#fffaf0" : readableOn(p)} stroke="#1b1712" strokeWidth="0.5">
          {number}
        </text>
      )}
    </svg>
  );
}
