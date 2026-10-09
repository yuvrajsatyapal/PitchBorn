"use client";
import { useState } from "react";
import { Crest } from "@/components/art/Crest";
import { Badge, Button, Card } from "@/components/ui";
import { clubName, country } from "@/engine/data/world";
import { PRESTIGE_NUMBERS, canChangeNumber, intlNumberOf, intlNumberOptions, jerseyRows, numberOptions, numberPromptOpen, preferredNumber } from "@/engine/jersey/numbers";
import type { GameState } from "@/engine/types";
import { user } from "@/game/selectors";
import { useGame } from "@/game/store";

/** A shirt-shaped badge for a number: used wherever a player's number is shown. */
export function ShirtNo({ no, size = "md" }: { no: number | null | undefined; size?: "sm" | "md" | "lg" }) {
  if (no === null || no === undefined) return null;
  const cls = size === "lg" ? "min-w-[3.4rem] px-3 py-1 text-3xl" : size === "sm" ? "min-w-[1.9rem] px-1 text-[11px]" : "min-w-[2.6rem] px-2 py-0.5 text-lg";
  return (
    <span className={`scoreboard inline-block rounded-lg border-2 border-line bg-[#1b1712] text-center tabular-nums text-[#ffc62b] ${cls}`} aria-label={`Squad number ${no}`}>
      #{no}
    </span>
  );
}

type Opt = { no: number; free: boolean; mine: boolean; retired?: boolean; ownerName?: string; suggested?: boolean };

/** The number grid: free numbers can be chosen, taken ones show who wears them, retired ones are marked. */
export function NumberGrid({ options, onPick, label, from = 1, to = 99 }: { options: Opt[]; onPick: (no: number) => void; label: string; from?: number; to?: number }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-1.5" role="group" aria-label={label} data-testid="number-grid">
      {options
        .filter((o) => o.no >= from && o.no <= to)
        .map((o) => (
          <button
            key={o.no}
            type="button"
            disabled={!o.free || o.mine}
            onClick={() => onPick(o.no)}
            title={o.retired ? `#${o.no} is retired` : o.mine ? `#${o.no} is yours` : o.free ? `#${o.no} is free${o.suggested ? " (suggested)" : ""}` : `#${o.no}: ${o.ownerName ?? "taken"}`}
            aria-label={o.mine ? `Number ${o.no}, yours` : o.free ? `Choose number ${o.no}` : `Number ${o.no} is taken${o.ownerName ? ` by ${o.ownerName}` : ""}`}
            className={`min-h-[44px] rounded-lg border-2 px-1 py-1 text-center text-sm font-black tabular-nums ${
              o.mine ? "border-line bg-sun" : o.free ? `border-line bg-card hover:bg-sun-2 ${o.suggested ? "ring-2 ring-pitch" : ""}` : "cursor-not-allowed border-line/25 bg-paper-2 text-muted line-through"
            }`}
          >
            {o.no}
            {!o.free && !o.mine && <span className="block truncate text-[10px] font-normal no-underline">{o.retired ? "retired" : o.ownerName}</span>}
          </button>
        ))}
    </div>
  );
}

/** Pick a club squad number. Only offered at the moments the rules allow. */
export function NumberPickerPanel({ g, onDone }: { g: GameState; onDone?: () => void }) {
  const choose = useGame((s) => s.chooseNumber);
  const rule = canChangeNumber(g);
  const opts = numberOptions(g);
  const pref = preferredNumber(g);
  const sug = opts.filter((o) => o.suggested && o.free && !o.mine).slice(0, 6);
  return (
    <div data-testid="number-picker">
      {sug.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-bold text-muted">Suggested</span>
          {sug.map((o) => (
            <Button key={o.no} tone="paper" size="sm" disabled={!rule.ok} onClick={() => { choose(o.no); onDone?.(); }}>
              #{o.no}{o.no === pref ? " ★" : PRESTIGE_NUMBERS.includes(o.no) ? " ✦" : ""}
            </Button>
          ))}
        </div>
      )}
      {rule.ok ? <NumberGrid options={opts} label="Squad numbers" onPick={(n) => { choose(n); onDone?.(); }} /> : <p className="text-sm text-muted">{rule.reason}</p>}
      <p className="mt-2 text-[11px] text-muted">Numbers are just a shirt: #9 doesn&apos;t finish better than #14. {pref ? `Your most-worn number is #${pref}.` : ""}</p>
    </div>
  );
}

/** Dashboard prompt while a free choice of number is waiting (a new club, a first number). */
export function JerseyChoiceCard({ g }: { g: GameState }) {
  const [open, setOpen] = useState(false);
  const p = user(g);
  if (!numberPromptOpen(g) || !p.clubId || g.user.retired || p.squadNo === undefined) return null;
  return (
    <Card tone="sky" title="Choose your squad number" data-testid="jersey-choice">
      <div className="flex flex-wrap items-center gap-3">
        <ShirtNo no={p.squadNo} size="lg" />
        <p className="min-w-0 flex-1 text-sm">You&apos;ve been assigned #{p.squadNo} at {clubName(p.clubId, true)}. You can take another free number now.</p>
        <Button size="sm" tone="paper" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "Hide numbers" : "Choose a number"}</Button>
      </div>
      {open && <div className="mt-3"><NumberPickerPanel g={g} onDone={() => setOpen(false)} /></div>}
    </Card>
  );
}

/** Profile card: current number, the picker when allowed, and a compact jersey history. */
export function JerseyCard({ g }: { g: GameState }) {
  const [open, setOpen] = useState(false);
  const p = user(g);
  const rows = jerseyRows(g);
  const rule = canChangeNumber(g);
  const intl = intlNumberOf(g);
  return (
    <Card title="Squad number" data-testid="jersey-card">
      <div className="flex flex-wrap items-center gap-3">
        {p.squadNo !== undefined && p.clubId ? <ShirtNo no={p.squadNo} size="lg" /> : <span className="text-sm text-muted">No club number while unattached.</span>}
        {p.clubId && <span className="text-sm text-ink-2">at {clubName(p.clubId)}</span>}
        {intl && (
          <span className="flex items-center gap-1.5 text-sm">
            <Badge>{country(intl.code)?.name ?? intl.code}</Badge> <ShirtNo no={intl.no} size="sm" />
          </span>
        )}
        {p.clubId && <Button size="sm" tone="paper" onClick={() => setOpen(!open)} disabled={!rule.ok} aria-expanded={open}>{rule.ok ? (open ? "Hide numbers" : "Change number") : "Change number"}</Button>}
      </div>
      {!rule.ok && p.clubId && <p className="mt-1 text-[11px] text-muted">{rule.reason}</p>}
      {open && rule.ok && <div className="mt-3"><NumberPickerPanel g={g} onDone={() => setOpen(false)} /></div>}
      <JerseyHistory rows={rows} />
    </Card>
  );
}

export function JerseyHistory({ rows }: { rows: ReturnType<typeof jerseyRows> }) {
  if (!rows.length) return <p className="mt-3 text-sm text-muted">Your number history begins with your first club.</p>;
  return (
    <ul className="mt-3 grid gap-1.5" data-testid="jersey-history">
      {[...rows].reverse().map((r, i) => (
        <li key={`${r.clubId}-${i}`} className="flex flex-wrap items-center gap-2 rounded-lg border-2 border-line/20 px-2.5 py-1.5 text-sm">
          <Crest clubId={r.clubId} size={18} />
          <span className="min-w-0 flex-1 truncate font-semibold">{clubName(r.clubId, true)}</span>
          <span className="text-xs text-muted">{r.span}</span>
          <span className="font-black tabular-nums">{r.numbers.map((n) => `#${n.no}`).join(" → ")}</span>
        </li>
      ))}
    </ul>
  );
}

/** Career History: the compact jersey history. */
export function JerseyHistoryCard({ g }: { g: GameState }) {
  const rows = jerseyRows(g);
  if (!rows.length) return null;
  return (
    <Card title="Jersey history">
      <JerseyHistory rows={rows} />
    </Card>
  );
}

/** National team: the number worn for the country, with a picker among the numbers still free. */
export function IntlNumberCard({ g }: { g: GameState }) {
  const choose = useGame((s) => s.chooseIntlNumber);
  const [open, setOpen] = useState(false);
  const cur = intlNumberOf(g);
  if (!cur) return null;
  const opts = intlNumberOptions(g);
  return (
    <Card title="International number" data-testid="intl-number">
      <div className="flex flex-wrap items-center gap-3">
        <ShirtNo no={cur.no} size="lg" />
        <p className="min-w-0 flex-1 text-sm text-ink-2">Your number for {country(cur.code)?.name}. It is separate from your club number.</p>
        <Button size="sm" tone="paper" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "Hide" : "Change"}</Button>
      </div>
      {open && <div className="mt-3"><NumberGrid options={opts} label="National squad numbers" to={40} onPick={(n) => { choose(n); setOpen(false); }} /></div>}
    </Card>
  );
}
