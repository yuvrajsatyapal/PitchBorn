import { staticClub } from "@/engine/data/world";
import { COLLARS, type Collar } from "./portrait-next/kit";

export interface ClubKit {
  primary: string;
  secondary: string;
  collar: Collar;
}

const FALLBACK = { primary: "#2e8b57", secondary: "#f1ead8" };

const hashStr = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/**
 * The shirt a club wears in a given season. Always built from the club's own two colours, and identical for every
 * player at the club that season. Shirt/trim order and collar cut both change every year, like a new jersey.
 */
export function clubKit(clubId: string | null | undefined, season: number): ClubKit {
  const colors = (clubId ? staticClub(clubId)?.colors : undefined) ?? FALLBACK;
  const n = hashStr(clubId ?? "") + season;
  const swap = n % 2 === 1;
  return {
    primary: swap ? colors.secondary : colors.primary,
    secondary: swap ? colors.primary : colors.secondary,
    collar: COLLARS[n % COLLARS.length],
  };
}
