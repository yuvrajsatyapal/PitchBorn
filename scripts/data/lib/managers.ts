/** Reduce raw Wikidata head-coach bindings (P286) to one clean manager per team. */
import type { SparqlBinding } from "./wikidata";

export interface RawManager {
  name: string;
  nationality?: string;
  since?: number;
  wikidata: string;
}

const qidOf = (uri: string) => uri.split("/").pop() ?? uri;

/** Citizenship labels (Wikidata, English) → Pitchborn country codes. */
const CITIZENSHIP_ALIASES: Record<string, string> = {
  "kingdom of the netherlands": "NED",
  netherlands: "NED",
  "kingdom of denmark": "DEN",
  "czech republic": "CZE",
  czechia: "CZE",
  turkey: "TUR",
  türkiye: "TUR",
  "ivory coast": "CIV",
  "côte d'ivoire": "CIV",
  ireland: "IRL",
  "republic of ireland": "IRL",
  "united states of america": "USA",
  "united states": "USA",
  "south korea": "KOR",
  "korea, south": "KOR",
};

const UK_HOME_NATIONS = new Set(["ENG", "SCO", "WAL", "NIR"]);

/** Wikidata labels occasionally carry vandalism or placeholder values; keep only plausible person names. */
export function cleanManagerName(title: string | undefined, label: string | undefined): string | undefined {
  const fromTitle = title?.replace(/\s*\([^)]*\)\s*$/, "").trim();
  for (const candidate of [fromTitle, label?.trim()]) {
    if (!candidate) continue;
    if (/^Q\d+$/.test(candidate)) continue;
    if (/\d|vacant|not filled|unknown|caretaker|interim|tbd|\bnone\b/i.test(candidate)) continue;
    if (candidate.length < 4 || candidate.length > 40) continue;
    // Keyboard-mash vandalism ("Paunovićhshsjs"): long consonant runs.
    if (/[bcdfghjklmnpqrstvwxz]{5,}/i.test(candidate.normalize("NFD").replace(/[̀-ͯ]/g, ""))) continue;
    const words = candidate.split(/\s+/);
    if (words.length > 5) continue;
    return candidate;
  }
  return undefined;
}

export function mapCitizenship(labels: string[], teamCountry: string, countryByName: Map<string, string>): string | undefined {
  const codes = labels
    .map((l) => {
      const k = l.toLowerCase();
      if (k === "united kingdom" || k === "united kingdom of great britain and ireland") return UK_HOME_NATIONS.has(teamCountry) ? teamCountry : "ENG";
      return CITIZENSHIP_ALIASES[k] ?? countryByName.get(k);
    })
    .filter((c): c is string => Boolean(c));
  return codes.find((c) => c === teamCountry) ?? codes[0];
}

/**
 * Group bindings by team and pick the current head coach: no end date, the
 * latest start date wins (caretakers are usually appointed after the last
 * permanent coach and replaced when a new one is announced).
 */
export function reduceManagers(
  bindings: SparqlBinding[],
  teamCountry: (teamQid: string, b: SparqlBinding) => string | undefined,
  countryByName: Map<string, string>,
): Map<string, RawManager & { teamCountry: string }> {
  const byTeam = new Map<string, Map<string, { title?: string; label?: string; start?: string; cits: Set<string>; country: string }>>();
  for (const b of bindings) {
    const team = b.team?.value;
    const coach = b.coach?.value;
    if (!team || !coach) continue;
    const tq = qidOf(team);
    const country = teamCountry(tq, b);
    if (!country) continue;
    const coaches = byTeam.get(tq) ?? new Map();
    byTeam.set(tq, coaches);
    const cq = qidOf(coach);
    const entry = coaches.get(cq) ?? { cits: new Set<string>(), country };
    entry.title ??= b.coachTitle?.value;
    entry.label ??= b.coachLabel?.value;
    const start = b.start?.value?.slice(0, 10);
    if (start && (!entry.start || start > entry.start)) entry.start = start;
    if (b.citLabel?.value) entry.cits.add(b.citLabel.value);
    coaches.set(cq, entry);
  }
  const out = new Map<string, RawManager & { teamCountry: string }>();
  for (const [tq, coaches] of byTeam) {
    const ranked = [...coaches.entries()]
      .map(([cq, e]) => ({ cq, e, name: cleanManagerName(e.title, e.label) }))
      .filter((x) => x.name)
      .sort((a, b) => (b.e.start ?? "0000").localeCompare(a.e.start ?? "0000"));
    const best = ranked[0];
    if (!best?.name) continue;
    out.set(tq, {
      name: best.name,
      nationality: mapCitizenship([...best.e.cits], best.e.country, countryByName),
      since: best.e.start ? Number(best.e.start.slice(0, 4)) : undefined,
      wikidata: best.cq,
      teamCountry: best.e.country,
    });
  }
  return out;
}
