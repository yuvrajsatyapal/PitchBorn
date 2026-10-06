import registry from "@/data/crests.json";

export interface OfficialCrest {
  file: string;
  title: string;
  sourcePage: string;
  license: string;
  licenseUrl?: string;
  artist?: string;
  restrictions?: string;
}

/** Set NEXT_PUBLIC_OFFICIAL_CRESTS=off to ship generated emblems only. */
export const OFFICIAL_CRESTS_ENABLED = process.env.NEXT_PUBLIC_OFFICIAL_CRESTS !== "off";

const crests = (registry as { crests: Record<string, OfficialCrest> }).crests;

export function officialCrest(clubId: string): OfficialCrest | undefined {
  return OFFICIAL_CRESTS_ENABLED ? crests[clubId] : undefined;
}

export function allOfficialCrests(): [string, OfficialCrest][] {
  return Object.entries(crests);
}
