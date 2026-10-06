import { staticClub } from "@/engine/data/world";
import { country } from "@/engine/data/world";
import { hashString, readableOn } from "./hash";
import { officialCrest } from "./officialCrests";

/**
 * Club emblem. Uses the club's official crest when a redistributable copy
 * (with recorded licence/provenance) is bundled from Wikimedia Commons;
 * otherwise a programmatically generated Pitchborn emblem from the club's
 * real colours and initials.
 */
export function Crest({ clubId, size = 40, className = "" }: { clubId: string | null | undefined; size?: number; className?: string }) {
  const club = clubId ? staticClub(clubId) : undefined;
  if (!club) {
    const nation = clubId ? country(clubId) : undefined;
    if (nation) return <span className={`fi fi-${nation.flag} rounded-sm ${className}`} style={{ width: size, height: size * 0.75, display: "inline-block", backgroundSize: "cover", border: "2px solid var(--line)" }} aria-label={nation.name} />;
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden>
        <circle cx="20" cy="20" r="17" fill="var(--paper-2)" stroke="var(--line)" strokeWidth="2" strokeDasharray="4 3" />
      </svg>
    );
  }
  const official = officialCrest(club.id);
  if (official) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- static export, tiny local SVG/PNG
      <img src={official.file} width={size} height={size} alt={`${club.name} crest`} loading="lazy" decoding="async" className={`inline-block object-contain ${className}`} style={{ width: size, height: size }} />
    );
  }
  const h = hashString(club.id);
  const shape = h % 4;
  const pattern = (h >> 3) % 5;
  const p = club.colors.primary;
  const s = club.colors.secondary;
  const id = `c${h.toString(36)}`;
  const outline =
    shape === 0
      ? "M20 2 L36 7 V20 C36 30 28 36 20 39 C12 36 4 30 4 20 V7 Z"
      : shape === 1
        ? "M20 2 A18 18 0 1 1 19.99 2 Z"
        : shape === 2
          ? "M6 4 H34 V22 C34 31 27 36 20 38 C13 36 6 31 6 22 Z"
          : "M20 1 L38 12 V28 L20 39 L2 28 V12 Z";
  const letters = club.abbreviation.length > 3 ? club.abbreviation.slice(0, 3) : club.abbreviation;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} role="img" aria-label={`${club.name} emblem`}>
      <defs>
        <clipPath id={id}>
          <path d={outline} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <rect width="40" height="40" fill={p} />
        {pattern === 1 && [0, 1, 2, 3, 4].map((i) => <rect key={i} x={i * 8 + 4} width="4" height="40" fill={s} />)}
        {pattern === 2 && <rect y="0" width="40" height="14" fill={s} />}
        {pattern === 3 && <path d="M0 40 L40 0 L40 14 L14 40 Z" fill={s} />}
        {pattern === 4 && <rect x="0" y="0" width="20" height="40" fill={s} />}
        {pattern === 0 && <circle cx="20" cy="21" r="12" fill={s} />}
      </g>
      <path d={outline} fill="none" stroke="#1b1712" strokeWidth="2.2" strokeLinejoin="round" />
      <text
        x="20"
        y="25"
        textAnchor="middle"
        fontFamily="var(--font-lilita), sans-serif"
        fontSize={letters.length === 3 ? 11 : 13}
        fill={pattern === 0 ? readableOn(s) : readableOn(p)}
        stroke={pattern === 0 ? undefined : luminanceStroke(p)}
        strokeWidth="0.4"
      >
        {letters}
      </text>
    </svg>
  );
}

function luminanceStroke(hex: string) {
  return readableOn(hex) === "#fffaf0" ? "#1b1712" : undefined;
}
