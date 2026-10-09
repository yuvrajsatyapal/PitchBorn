"use client";
import { useState } from "react";
import { Crest } from "@/components/art/Crest";
import { Flag } from "@/components/art/Flag";
import { Badge, Card } from "@/components/ui";
import { clubName } from "@/engine/data/world";
import { stintRows, currentManagerView } from "@/engine/managers/view";
import type { FormerManagerContext } from "@/engine/season/preview";
import type { GameState } from "@/engine/types";

const REL_TONE = { Excellent: "pitch", Strong: "pitch", Neutral: "paper", Poor: "coral", "Very poor": "coral" } as const;

/** The club card's manager entry: unchanged for a stranger, with the shared past when there is one. */
export function CurrentManager({ g, clubId }: { g: GameState; clubId: string }) {
  const club = g.clubs[clubId];
  const v = currentManagerView(g, clubId);
  return (
    <div data-testid="current-manager" className="col-span-full">
      <dt className="text-xs text-muted">Manager</dt>
      <dd className="break-words font-semibold leading-snug">
        {club.manager.nationality && <Flag code={club.manager.nationality} className="mr-1.5" />}
        {club.manager.name}
        {club.manager.born ? <span className="whitespace-nowrap font-normal text-muted"> ({g.season - club.manager.born})</span> : null}
      </dd>
      {v?.past && (
        <dd className="mt-1.5 grid gap-2 rounded-xl border-2 border-line/20 bg-paper-2/60 px-3 py-2.5 text-xs sm:max-w-md" data-testid="manager-past">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-bold">{v.reunited ? "Back together" : "Worked together before"}</div>
              <div className="flex items-center gap-1.5 text-ink-2">
                {v.past.clubIds.map((id) => <Crest key={id} clubId={id} size={14} />)}
                <span className="truncate">{v.past.span} · {v.past.clubs}</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span className="text-muted">Then</span>
              <Badge tone={REL_TONE[v.past.relationship]}>{v.past.relationship}</Badge>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded-lg bg-paper px-2 py-1"><div className="text-[10px] uppercase tracking-wide text-muted">Apps</div><div className="text-sm font-black tabular-nums">{v.past.apps}</div></div>
            <div className="rounded-lg bg-paper px-2 py-1"><div className="text-[10px] uppercase tracking-wide text-muted">Goals</div><div className="text-sm font-black tabular-nums">{v.past.goals}</div></div>
          </div>
          {v.past.honoursText && <div className="font-semibold">🏆 {v.past.honoursText}</div>}
        </dd>
      )}
    </div>
  );
}

/** Career History: the managers played under, with the historical relationship; rows open for the detail. */
export function ManagerHistoryCard({ g }: { g: GameState }) {
  const rows = stintRows(g);
  const [open, setOpen] = useState<string | null>(null);
  if (!rows.length) return null;
  return (
    <Card title="Managers" data-testid="manager-history">
      <ul className="grid gap-1.5">
        {[...rows].reverse().map((r) => (
          <li key={r.key} className={`rounded-xl border-2 ${r.major ? "border-line bg-sun-2" : "border-line/20"}`}>
            <button type="button" className="flex w-full flex-wrap items-center gap-2 px-2.5 py-1.5 text-left text-sm" onClick={() => setOpen(open === r.key ? null : r.key)} aria-expanded={open === r.key}>
              <span className="w-16 shrink-0 text-xs text-muted">{r.span}</span>
              <span className="min-w-0 flex-1">
                <b className="break-words">{r.name}</b>
                <span className="flex items-center gap-1 text-xs text-ink-2"><Crest clubId={r.clubId} size={14} /> <span className="truncate">{clubName(r.clubId, true)}</span></span>
              </span>
              <Badge tone={REL_TONE[r.relationship]}>{r.relationship}{r.current ? " now" : ""}</Badge>
              {r.honoursText && <span className="text-xs font-semibold">{r.honoursText}</span>}
              <span aria-hidden>{open === r.key ? "▾" : "▸"}</span>
            </button>
            {open === r.key && (
              <div className="border-t border-line/15 px-2.5 py-2 text-xs text-ink-2">
                <div>{r.apps} appearances ({r.starts} starts){r.goals ? ` · ${r.goals} goals` : ""} under {r.name}.</div>
                {r.reunion && <div>You had worked together before.</div>}
                {r.notes.map((n) => <div key={n}>• {n}</div>)}
                {r.ended && <div className="text-muted">Ended: {r.ended}.</div>}
                {r.current && <div className="text-muted">The relationship shown is today&apos;s; it settles into history when the two part.</div>}
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-muted">Only managers you played under are listed. Tracking began with this version for older careers.</p>
    </Card>
  );
}

/** Match Day: the opposing manager you played under. */
export function FormerManagerPanel({ ctx }: { ctx: FormerManagerContext }) {
  return (
    <div className="mb-3 rounded-xl border-2 border-line bg-plum-2 p-3 text-sm" data-testid="former-manager">
      <div className="text-[11px] font-black uppercase tracking-widest">Former manager</div>
      <div className="font-display text-xl leading-tight break-words">{ctx.name}</div>
      <p className="mt-0.5 text-ink-2">{ctx.together}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
        <span>Relationship then:</span>
        <Badge tone={REL_TONE[ctx.relationship]}>{ctx.relationship}</Badge>
        <span>{ctx.apps} appearances together</span>
        {ctx.honoursText && <span className="font-semibold">{ctx.honoursText}</span>}
      </div>
      <p className="mt-1.5 font-semibold">{ctx.headline}</p>
      {ctx.alsoFormerClub && <p className="text-xs text-ink-2">It is also a former club of yours.</p>}
    </div>
  );
}

export function InfluentialManagerCard({ g }: { g: GameState }) {
  const m = g.user.legacy?.influentialManager;
  if (!m) return null;
  return (
    <Card title="Influential manager" tone="plum" data-testid="influential-manager">
      <div className="font-display text-2xl break-words">{m.name}</div>
      <ul className="mt-2 grid gap-1 text-sm">{m.lines.map((l) => <li key={l}>• {l}</li>)}</ul>
    </Card>
  );
}

export function IconicNumberCard({ g }: { g: GameState }) {
  const n = g.user.legacy?.iconicNumber;
  if (!n) return null;
  return (
    <Card title="Iconic number" tone="sun" data-testid="iconic-number">
      <div className="flex items-center gap-3">
        <span className="scoreboard rounded-xl border-2 border-line bg-[#1b1712] px-4 py-1 text-4xl text-[#ffc62b]">#{n.no}</span>
        <ul className="grid gap-1 text-sm">{n.lines.map((l) => <li key={l}>{l}</li>)}</ul>
      </div>
    </Card>
  );
}
