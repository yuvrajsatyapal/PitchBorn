import type { Appearance } from "@/engine/types";

const SKIN = ["#f6d7c3", "#e8b896", "#c98e66", "#a8714c", "#7d5034", "#5a3824"];
const HAIR = ["#1d1611", "#4b2e1a", "#8a5a2b", "#c99a4b", "#e3c27d", "#b23a1e"];

/** Original flat-illustration portrait generated from appearance values. */
export function Portrait({ look, size = 64, kit = "#2e8b57", className = "" }: { look: Appearance; size?: number; kit?: string; className?: string }) {
  const skin = SKIN[look.skin] ?? SKIN[0];
  const hair = HAIR[look.hairColor] ?? HAIR[0];
  const hairPaths = [
    "M18 22 Q32 6 46 22 Q46 14 32 11 Q18 14 18 22 Z",
    "M17 24 Q16 9 32 9 Q48 9 47 24 Q44 15 32 15 Q20 15 17 24 Z",
    "M18 21 Q20 10 32 10 Q44 10 46 21 L44 17 L40 19 L36 15 L32 19 L28 15 L24 19 L20 17 Z",
    "",
    "M16 30 Q14 8 32 8 Q50 8 48 30 Q46 18 32 16 Q18 18 16 30 Z",
    "M20 18 Q24 4 32 6 Q40 4 44 18 Q38 12 32 13 Q26 12 20 18 Z",
    "M17 26 Q15 6 32 7 Q49 6 47 26 L45 34 Q45 16 32 15 Q19 16 19 34 Z",
    "M22 14 Q32 2 42 14 Q38 10 32 10 Q26 10 22 14 Z",
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label="Player portrait">
      <rect width="64" height="64" rx="14" fill="var(--sun-2)" />
      <path d="M8 64 Q10 46 32 44 Q54 46 56 64 Z" fill={kit} stroke="#1b1712" strokeWidth="2" />
      <path d="M27 44 L32 50 L37 44" fill="none" stroke="#1b1712" strokeWidth="2" />
      <rect x="27" y="36" width="10" height="9" fill={skin} stroke="#1b1712" strokeWidth="2" />
      <ellipse cx="32" cy="26" rx="14" ry="15.5" fill={skin} stroke="#1b1712" strokeWidth="2" />
      {hairPaths[look.hair] && <path d={hairPaths[look.hair]} fill={hair} stroke="#1b1712" strokeWidth="1.5" strokeLinejoin="round" />}
      <circle cx="26.5" cy="27" r={look.eyes === 2 ? 1.6 : 1.9} fill="#1b1712" />
      <circle cx="37.5" cy="27" r={look.eyes === 2 ? 1.6 : 1.9} fill="#1b1712" />
      <path d="M27 34 Q32 37 37 34" fill="none" stroke="#1b1712" strokeWidth="1.6" strokeLinecap="round" />
      {look.facial === 1 && <path d="M21 31 Q32 46 43 31 Q42 40 32 41 Q22 40 21 31 Z" fill={hair} opacity="0.85" />}
      {look.facial === 2 && <path d="M27 33 Q32 31 37 33 L36 34.5 Q32 33 28 34.5 Z" fill={hair} />}
      {look.facial === 3 && <path d="M28 38 Q32 42 36 38 L35 40.5 Q32 42.5 29 40.5 Z" fill={hair} />}
    </svg>
  );
}
