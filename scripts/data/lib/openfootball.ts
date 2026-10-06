/** Parsers for OpenFootball plain-text club lists and football.json results. */

export interface OpenFootballClub {
  name: string;
  founded?: number;
  stadium?: string;
  city?: string;
  aliases: string[];
}

/**
 * Parse an OpenFootball `*.clubs.txt` file. Format (simplified):
 *   Arsenal FC, 1886, @ Emirates Stadium, London (Highbury)   ## comment
 *     | Arsenal | FC Arsenal
 */
export function parseOpenFootballClubs(text: string): OpenFootballClub[] {
  const clubs: OpenFootballClub[] = [];
  let current: OpenFootballClub | null = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/##.*$/, "").replace(/\s#\s.*$/, "").replace(/\s+#.*$/, "");
    if (!line.trim() || line.trim().startsWith("#") || line.trim().startsWith("=")) continue;
    const trimmed = line.trim();
    if (trimmed.startsWith("|")) {
      if (current) {
        current.aliases.push(
          ...trimmed
            .split("|")
            .map((a) => a.trim())
            .filter(Boolean),
        );
      }
      continue;
    }
    if (/^\s/.test(line)) continue; // address lines and other indented metadata
    const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
    if (!parts.length) continue;
    const club: OpenFootballClub = { name: parts[0], aliases: [] };
    for (const part of parts.slice(1)) {
      if (/^\d{4}$/.test(part)) club.founded = Number(part);
      else if (part.startsWith("@")) club.stadium = part.slice(1).trim();
      else if (!club.city) club.city = part.replace(/\s*\(.*\)\s*$/, "").trim();
    }
    clubs.push(club);
    current = club;
  }
  return clubs;
}

export interface FootballJsonMatch {
  round?: string;
  date?: string;
  team1: string;
  team2: string;
  score?: { ft?: [number, number] };
}

export interface ComputedRow {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  points: number;
}

/** Build a final league table from raw match results (3 points for a win). */
export function computeTable(matches: FootballJsonMatch[]): { rows: ComputedRow[]; matches: number; goals: number } {
  const rows = new Map<string, ComputedRow>();
  const row = (team: string) => {
    let r = rows.get(team);
    if (!r) {
      r = { team, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 };
      rows.set(team, r);
    }
    return r;
  };
  let played = 0;
  let goals = 0;
  for (const m of matches) {
    const ft = m.score?.ft;
    if (!ft || ft.length !== 2 || ft.some((g) => typeof g !== "number")) continue;
    const [a, b] = ft;
    const h = row(m.team1);
    const w = row(m.team2);
    played++;
    goals += a + b;
    h.played++; w.played++;
    h.gf += a; h.ga += b; w.gf += b; w.ga += a;
    if (a > b) { h.won++; h.points += 3; w.lost++; }
    else if (a < b) { w.won++; w.points += 3; h.lost++; }
    else { h.drawn++; w.drawn++; h.points++; w.points++; }
  }
  const sorted = [...rows.values()].sort(
    (x, y) => y.points - x.points || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || x.team.localeCompare(y.team),
  );
  return { rows: sorted, matches: played, goals };
}
