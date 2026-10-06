/** Reduce raw Wikidata SPARQL bindings into one candidate record per club. */

export interface SparqlBinding {
  [k: string]: { value: string } | undefined;
}

export interface WikidataClub {
  qid: string;
  label: string;
  leagueId: string;
  membershipStart?: string;
  venue?: { qid: string; name: string; capacity?: number; lat?: number; lon?: number; start?: string; end?: string };
  founded?: number;
  colors: { label?: string; hex?: string }[];
  shortNames: string[];
  city?: string;
  dissolved: boolean;
}

const qidOf = (uri: string) => uri.split("/").pop() ?? uri;

function parsePoint(wkt: string | undefined): { lat: number; lon: number } | undefined {
  const m = wkt?.match(/Point\(([-\d.]+) ([-\d.]+)\)/);
  return m ? { lon: Number(m[1]), lat: Number(m[2]) } : undefined;
}

export function reduceWikidata(leagueId: string, bindings: SparqlBinding[]): WikidataClub[] {
  const clubs = new Map<string, WikidataClub>();
  const venues = new Map<string, NonNullable<WikidataClub["venue"]>[]>();
  for (const b of bindings) {
    const clubUri = b.club?.value;
    if (!clubUri) continue;
    const qid = qidOf(clubUri);
    let c = clubs.get(qid);
    if (!c) {
      c = {
        qid,
        label: b.clubLabel?.value ?? qid,
        leagueId,
        colors: [],
        shortNames: [],
        dissolved: false,
      };
      clubs.set(qid, c);
    }
    const start = b.start?.value?.slice(0, 10);
    if (start && (!c.membershipStart || start > c.membershipStart)) c.membershipStart = start;
    if (b.inception?.value) {
      const y = Number(b.inception.value.slice(0, 4));
      if (y > 1800 && (!c.founded || y < c.founded)) c.founded = y;
    }
    if (b.dissolved?.value) c.dissolved = true;
    if (b.colorLabel?.value || b.hex?.value) {
      const col = { label: b.colorLabel?.value, hex: b.hex?.value };
      if (!c.colors.some((x) => x.label === col.label)) c.colors.push(col);
    }
    if (b.short?.value && !c.shortNames.includes(b.short.value)) c.shortNames.push(b.short.value);
    if (b.cityLabel?.value && !c.city && !/^Q\d+$/.test(b.cityLabel.value)) c.city = b.cityLabel.value;
    if (b.venue?.value) {
      const vq = qidOf(b.venue.value);
      const list = venues.get(qid) ?? [];
      let v = list.find((x) => x.qid === vq);
      if (!v) {
        v = { qid: vq, name: b.venueLabel?.value ?? vq };
        list.push(v);
        venues.set(qid, list);
      }
      const cap = b.cap?.value ? Math.round(Number(b.cap.value)) : undefined;
      if (cap && (!v.capacity || cap > v.capacity)) v.capacity = cap;
      const pt = parsePoint(b.coord?.value);
      if (pt) Object.assign(v, pt);
      if (b.venueStart?.value) v.start = b.venueStart.value.slice(0, 10);
      if (b.venueEnd?.value) v.end = b.venueEnd.value.slice(0, 10);
    }
  }
  for (const [qid, list] of venues) {
    const c = clubs.get(qid);
    if (!c) continue;
    // Current venue: no end date, latest start, must have a real label.
    const current = list
      .filter((v) => !v.end && !/^Q\d+$/.test(v.name))
      .sort((a, b) => (b.start ?? "0000").localeCompare(a.start ?? "0000") || (b.capacity ?? 0) - (a.capacity ?? 0));
    c.venue = current[0] ?? list.find((v) => !/^Q\d+$/.test(v.name));
  }
  return [...clubs.values()];
}
