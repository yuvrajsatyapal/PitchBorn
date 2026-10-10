import type { Fixture, TableRow } from "../types";

export function emptyRow(team: string): TableRow {
  return { team, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0, form: [] };
}

export function applyResult(table: TableRow[], f: Fixture): void {
  if (!f.result) return;
  const h = table.find((r) => r.team === f.home);
  const a = table.find((r) => r.team === f.away);
  if (!h || !a) return;
  const { hg, ag } = f.result;
  h.played++; a.played++;
  h.gf += hg; h.ga += ag; a.gf += ag; a.ga += hg;
  if (hg > ag) {
    h.won++; a.lost++; h.points += 3;
    pushForm(h, "W"); pushForm(a, "L");
  } else if (hg < ag) {
    a.won++; h.lost++; a.points += 3;
    pushForm(h, "L"); pushForm(a, "W");
  } else {
    h.drawn++; a.drawn++; h.points++; a.points++;
    pushForm(h, "D"); pushForm(a, "D");
  }
}

function pushForm(r: TableRow, x: "W" | "D" | "L") {
  r.form.push(x);
  if (r.form.length > 5) r.form.shift();
}

/** Sort: points, goal difference, goals for, then name for determinism. */
export function sortTable(table: TableRow[]): TableRow[] {
  return table.sort(
    (x, y) => y.points - x.points || y.gf - y.ga - (x.gf - x.ga) || y.gf - x.gf || x.team.localeCompare(y.team),
  );
}

export function buildTable(teams: string[], fixtures: Fixture[]): TableRow[] {
  const table = teams.map(emptyRow);
  for (const f of fixtures) applyResult(table, f);
  return sortTable(table);
}

export function positionOf(table: TableRow[], team: string): number {
  return table.findIndex((r) => r.team === team) + 1;
}

/** Table position of each team before the latest played round, for movement arrows. Empty until two rounds are played. */
export function previousPositions(teams: string[], fixtures: Fixture[]): Record<string, number> {
  const played = fixtures.filter((f) => f.result);
  const lastRound = played.reduce((m, f) => Math.max(m, f.round), 0);
  if (lastRound < 2) return {};
  const before = buildTable(teams, played.filter((f) => f.round < lastRound));
  return Object.fromEntries(before.map((r, i) => [r.team, i + 1]));
}
