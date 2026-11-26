"use client";
import { useState } from "react";
import { PlayerPortrait } from "@/components/art/PlayerPortrait";
import { Badge, Card } from "@/components/ui";
import { allTimeRecords, compareEntries, greatestXI, type HallOfFameEntry } from "@/engine/career/hallOfFame";

function Pick({ entries, value, onChange, label }: { entries: HallOfFameEntry[]; value: string; onChange: (id: string) => void; label: string }) {
  return (
    <label className="grid min-w-0 gap-1 text-xs font-bold">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="min-w-0 rounded-xl border-2 border-line bg-card px-2 py-2 text-sm font-normal">
        {entries.map((e) => <option key={e.saveId} value={e.saveId}>{e.name} · {e.span}</option>)}
      </select>
    </label>
  );
}

/** Two retired careers side by side. */
export function CompareCareers({ entries }: { entries: HallOfFameEntry[] }) {
  const [a, setA] = useState(entries[0]?.saveId ?? "");
  const [b, setB] = useState(entries[1]?.saveId ?? entries[0]?.saveId ?? "");
  const ea = entries.find((e) => e.saveId === a) ?? entries[0];
  const eb = entries.find((e) => e.saveId === b) ?? entries[1] ?? entries[0];
  if (!ea || !eb) return null;
  const rows = compareEntries(ea, eb);
  return (
    <Card title="Compare two careers" data-testid="hof-compare">
      <div className="grid grid-cols-2 gap-3">
        <Pick entries={entries} value={ea.saveId} onChange={setA} label="Career A" />
        <Pick entries={entries} value={eb.saveId} onChange={setB} label="Career B" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-center">
        {[ea, eb].map((e, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="overflow-hidden rounded-2xl border-2 border-line"><PlayerPortrait appearance={e.look} age={e.retiredAge} size={80} kit={e.clubColors} /></div>
            <b className="leading-tight">{e.name}</b>
            <span className="text-xs text-muted">{e.position} · {e.club}</span>
            <Badge tone="plum">{e.legacyTier}</Badge>
          </div>
        ))}
      </div>
      <table className="mt-3 w-full text-sm">
        <caption className="sr-only">Career statistics compared</caption>
        <thead className="sr-only"><tr><th>{ea.name}</th><th>Stat</th><th>{eb.name}</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-line/15">
              <td className={`num py-1 text-left ${r.better === "a" ? "font-black text-pitch" : ""}`}>{r.decimals ? r.a.toFixed(r.decimals) : r.a}</td>
              <th scope="row" className="py-1 text-center text-xs font-bold uppercase tracking-wide text-muted">{r.label}</th>
              <td className={`num py-1 text-right ${r.better === "b" ? "font-black text-pitch" : ""}`}>{r.decimals ? r.b.toFixed(r.decimals) : r.b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function AllTimeRecords({ entries }: { entries: HallOfFameEntry[] }) {
  const recs = allTimeRecords(entries);
  return (
    <Card title="All-time records">
      <dl className="grid gap-2 sm:grid-cols-2">
        {recs.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-2 rounded-lg bg-paper-2 px-3 py-1.5">
            <dt className="text-sm"><span className="text-xs font-bold uppercase tracking-wide text-muted">{r.label}</span><br />{r.name}</dt>
            <dd className="num font-display text-2xl">{r.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

const ROWS: number[][] = [[10, 9, 8], [7, 5, 6], [4, 3, 2, 1], [0]];

/** The best XI from every save, in a 4-3-3. */
export function GreatestXI({ entries }: { entries: HallOfFameEntry[] }) {
  const xi = greatestXI(entries);
  return (
    <Card title="Greatest XI">
      <div className="grid gap-3 rounded-2xl border-2 border-line bg-pitch/90 p-3" role="list" aria-label="Greatest XI, attack to goal">
        {ROWS.map((row, ri) => (
          <div key={ri} className="flex justify-center gap-2">
            {row.map((i) => {
              const s = xi[i];
              return (
                <div key={i} role="listitem" className="flex w-20 flex-col items-center gap-0.5 text-center text-white sm:w-24">
                  {s.entry ? (
                    <div className="overflow-hidden rounded-full border-2 border-line bg-card"><PlayerPortrait appearance={s.entry.look} age={s.entry.retiredAge} size={44} kit={s.entry.clubColors} /></div>
                  ) : (
                    <div className="grid h-11 w-11 place-items-center rounded-full border-2 border-dashed border-white/60 text-xs" aria-hidden>?</div>
                  )}
                  <span className="text-[10px] font-black">{s.slot}{s.entry && !s.natural ? "*" : ""}</span>
                  <span className="w-full truncate text-[11px] font-bold">{s.entry?.name ?? "Vacant"}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted">Highest legacy first. * playing out of position.</p>
    </Card>
  );
}
