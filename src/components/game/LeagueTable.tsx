import { Crest } from "@/components/art/Crest";
import { FormDots, Table } from "@/components/ui";
import type { TableRow } from "@/engine/types";
import { teamLabel } from "@/game/selectors";

export function LeagueTable({ rows, highlight, promo = 0, releg = 0, continental = 0, showForm = true }: { rows: TableRow[]; highlight?: string | null; promo?: number; releg?: number; continental?: number; showForm?: boolean }) {
  return (
    <Table>
      <thead>
        <tr>
          <th>#</th>
          <th>Club</th>
          <th className="text-right">P</th>
          <th className="hidden text-right sm:table-cell">W</th>
          <th className="hidden text-right sm:table-cell">D</th>
          <th className="hidden text-right sm:table-cell">L</th>
          <th className="hidden text-right md:table-cell">GF</th>
          <th className="hidden text-right md:table-cell">GA</th>
          <th className="text-right">GD</th>
          <th className="text-right">Pts</th>
          {showForm && <th className="hidden lg:table-cell">Form</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const pos = i + 1;
          const zone = pos <= continental ? "border-l-4 border-l-sky" : pos <= promo ? "border-l-4 border-l-pitch" : pos > rows.length - releg ? "border-l-4 border-l-coral" : "";
          return (
            <tr key={r.team} className={`${r.team === highlight ? "bg-sun-2 font-bold" : ""}`}>
              <td className={zone}>{pos}</td>
              <td>
                <span className="flex items-center gap-2">
                  <Crest clubId={r.team} size={20} /> {teamLabel(r.team)}
                </span>
              </td>
              <td className="text-right tabular-nums">{r.played}</td>
              <td className="hidden text-right tabular-nums sm:table-cell">{r.won}</td>
              <td className="hidden text-right tabular-nums sm:table-cell">{r.drawn}</td>
              <td className="hidden text-right tabular-nums sm:table-cell">{r.lost}</td>
              <td className="hidden text-right tabular-nums md:table-cell">{r.gf}</td>
              <td className="hidden text-right tabular-nums md:table-cell">{r.ga}</td>
              <td className="text-right tabular-nums">{r.gf - r.ga > 0 ? "+" : ""}{r.gf - r.ga}</td>
              <td className="text-right font-black tabular-nums">{r.points}</td>
              {showForm && <td className="hidden lg:table-cell">{r.form.length ? <FormDots form={r.form} /> : null}</td>}
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
