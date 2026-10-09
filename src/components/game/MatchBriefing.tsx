"use client";
import { useMemo, useState } from "react";
import { Badge, Button, FormDots, Tabs } from "@/components/ui";
import { formatTurnDate } from "@/engine/calendar";
import { ShirtNo } from "@/components/game/NumberPicker";
import { FormerManagerPanel } from "@/components/game/ManagerPanels";
import { lineupView } from "@/engine/season/preview";
import { teamLabel } from "@/game/selectors";
import { formerManagerContext, headToHead, IMPORTANCE_LABEL, keyOpponents, matchContext, preMatchActions, tacticalPreview, type TeamLine } from "@/engine/season/preview";
import type { Availability, MatchStatus } from "@/engine/season/selection";
import type { Fixture, GameState } from "@/engine/types";
import { useGame } from "@/game/store";

const STATUS_TEXT: Record<Availability, { label: string; tone: "pitch" | "sky" | "sun" | "coral" | "paper"; line: string }> = {
  starting: { label: "Starting XI", tone: "pitch", line: "The manager has named you in the starting XI." },
  bench: { label: "On the bench", tone: "sky", line: "You're among the substitutes: be ready to come on." },
  "not-selected": { label: "Not in the squad", tone: "sun", line: "You're not in the matchday squad this time." },
  injured: { label: "Injured", tone: "coral", line: "You can't play, but you can follow the match." },
  suspended: { label: "Suspended", tone: "coral", line: "You're serving a suspension for this one." },
  resting: { label: "Resting", tone: "paper", line: "You asked to be rested: you'll sit this one out and recover." },
  "not-called-up": { label: "Not called up", tone: "sun", line: "You're not in this international squad." },
};

function TeamStrip({ t }: { t: TeamLine }) {
  return (
    <div className="flex flex-col items-center gap-0.5 text-center text-[11px]">
      {t.position !== null && (
        <span className="font-bold">
          {t.position}
          {["th", "st", "nd", "rd"][t.position % 100 > 10 && t.position % 100 < 14 ? 0 : Math.min(t.position % 10, 4) % 4] ?? "th"}
          {t.points !== null && <span className="text-muted"> · {t.points} pts</span>}
        </span>
      )}
      {t.form.length > 0 && <FormDots form={t.form} />}
    </div>
  );
}

/** Matchup extras shown inside the main card: where each side stands and what the match means. */
export function MatchContextStrip({ g, fixture }: { g: GameState; fixture: Fixture }) {
  const ctx = useMemo(() => matchContext(g, fixture), [g, fixture.id, g.turnIndex]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ctx) return null;
  return (
    <div className="mb-3" data-testid="match-context">
      <div className="mb-2 grid grid-cols-[1fr_auto_1fr] items-start gap-3">
        <TeamStrip t={ctx.home} />
        <span className="text-[11px] font-black uppercase tracking-wider text-muted">{ctx.homeAway === "neutral" ? "Neutral" : ctx.homeAway === "home" ? "Home" : "Away"}</span>
        <TeamStrip t={ctx.away} />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs">
        {ctx.stadium && <Badge>🏟️ {ctx.stadium}</Badge>}
        {ctx.tags.map((t) => (
          <Badge key={t} tone={ctx.level === "major" ? "sun" : "sky"} className="font-black">
            {IMPORTANCE_LABEL[t]}
          </Badge>
        ))}
        {!ctx.tags.length && <span className="text-muted">An ordinary fixture: no extra stakes.</span>}
      </div>
    </div>
  );
}

/** The opposing manager, when the user played under him. */
export function FormerManagerBlock({ g, fixture }: { g: GameState; fixture: Fixture }) {
  const ctx = formerManagerContext(g, fixture);
  return ctx ? <FormerManagerPanel ctx={ctx} /> : null;
}

/** Your place for this match, the manager's reasons and the actions that fit. */
export function SelectionBlock({ g, fixture, status }: { g: GameState; fixture: Fixture; status: MatchStatus }) {
  const preMatch = useGame((s) => s.preMatch);
  const actions = preMatchActions(g, fixture, status);
  const t = STATUS_TEXT[status.status];
  return (
    <div className="mb-3 rounded-xl border-2 border-line bg-card p-3 text-sm" data-testid="selection-status">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Badge tone={t.tone} className="font-black">{t.label}{status.slot ? ` · ${status.slot}` : ""}</Badge>
        {g.players[g.user.playerId]?.squadNo !== undefined && status.teamId && g.clubs[status.teamId] && <ShirtNo no={g.players[g.user.playerId].squadNo} size="sm" />}
        <span>{t.line}</span>
      </div>
      {status.reasons.length > 0 && (
        <ul className="mt-1.5 grid gap-0.5 text-xs" data-testid="selection-reasons">
          {status.reasons.map((r, i) => (
            <li key={i} className={r.tone === "good" ? "text-pitch" : r.tone === "bad" ? "text-coral" : "text-ink-2"}>
              {r.tone === "good" ? "▲" : r.tone === "bad" ? "▼" : "•"} {r.text}
            </li>
          ))}
        </ul>
      )}
      {actions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2" data-testid="prematch-actions">
          {actions.map((a) => (
            <div key={a.kind} className="flex flex-col items-start">
              <Button tone="paper" size="sm" disabled={!a.enabled} onClick={() => preMatch(fixture.id, a.kind)} title={a.hint} data-testid={`prematch-${a.kind}`}>
                {a.label}
              </Button>
              <span className="mt-0.5 max-w-[16rem] text-[11px] text-muted">{a.enabled ? a.hint : a.why}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LineupSide({ title, side }: { title: string; side: NonNullable<ReturnType<typeof lineupView>>["home"] }) {
  return (
    <div className="rounded-lg border-2 border-line/20 p-2" data-testid="lineup-side">
      <div className="text-[11px] font-black uppercase text-muted">{title} · {side.formation}{side.exact ? "" : " · likely XI"}</div>
      <ul className="mt-1 grid gap-0.5 text-sm">
        {side.starters.map((r) => (
          <li key={r.id} className={`flex items-center gap-2 ${r.isUser ? "rounded-md bg-sun-2 font-bold" : ""}`}>
            <span className="w-8 text-right font-black tabular-nums text-muted">{r.no !== null ? `#${r.no}` : ""}</span>
            <span className="min-w-0 flex-1 truncate">{r.name}</span>
            <span className="text-[11px] text-muted">{r.slot ?? r.position}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 text-[11px] font-black uppercase text-muted">Substitutes</div>
      <ul className="mt-0.5 grid gap-0.5 text-xs">
        {side.bench.map((r) => (
          <li key={r.id} className={`flex items-center gap-2 ${r.isUser ? "rounded-md bg-sun-2 font-bold" : ""}`}>
            <span className="w-8 text-right font-black tabular-nums text-muted">{r.no !== null ? `#${r.no}` : ""}</span>
            <span className="min-w-0 flex-1 truncate">{r.name}</span>
            <span className="text-[11px] text-muted">{r.position}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LineupTab({ g, fixture }: { g: GameState; fixture: Fixture }) {
  const view = useMemo(() => lineupView(g, fixture), [g, fixture.id, g.turnIndex, g.user.preMatch?.requestedStart?.fixtureId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!view) return <p className="text-muted">No line-ups yet.</p>;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <LineupSide title={teamLabel(fixture.home, true)} side={view.home} />
      <LineupSide title={teamLabel(fixture.away, true)} side={view.away} />
    </div>
  );
}

/** Optional expandable preview: tactics, the people you'll face and how the two clubs have fared. */
export function MatchPreviewPanel({ g, fixture }: { g: GameState; fixture: Fixture }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"tactics" | "lineup" | "people" | "history">("tactics");
  return (
    <div className="mt-3 rounded-xl border-2 border-line/30" data-testid="match-preview">
      <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-bold" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>Match preview: tactics, opponents, history</span>
        <span aria-hidden>{open ? "▾" : "▸"}</span>
      </button>
      {open && <PreviewBody g={g} fixture={fixture} tab={tab} setTab={setTab} />}
    </div>
  );
}

function PreviewBody({ g, fixture, tab, setTab }: { g: GameState; fixture: Fixture; tab: "tactics" | "lineup" | "people" | "history"; setTab: (t: "tactics" | "lineup" | "people" | "history") => void }) {
  const tp = useMemo(() => tacticalPreview(g, fixture), [g, fixture.id, g.turnIndex]); // eslint-disable-line react-hooks/exhaustive-deps
  const people = useMemo(() => keyOpponents(g, fixture), [g, fixture.id, g.turnIndex]); // eslint-disable-line react-hooks/exhaustive-deps
  const h2h = useMemo(() => headToHead(g, fixture), [g, fixture.id, g.turnIndex]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="border-t-2 border-line/20 p-3 text-sm">
      <Tabs value={tab} onChange={setTab} className="mb-3" items={[{ id: "tactics", label: "Tactics" }, { id: "lineup", label: "Line-ups" }, { id: "people", label: "Key opponents" }, { id: "history", label: "Head to head" }]} />
      {tab === "tactics" &&
        (tp ? (
          <div className="grid gap-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { who: "Your side", t: tp.mine },
                { who: "Opposition", t: tp.theirs },
              ].map(({ who, t }) =>
                t ? (
                  <div key={who} className="rounded-lg border-2 border-line/20 p-2">
                    <div className="text-[11px] font-black uppercase text-muted">{who}</div>
                    <div className="font-bold">{t.formation} <span className="font-normal text-ink-2">· {t.identity.lean}</span></div>
                    <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                      <Badge>{t.identity.pressing}</Badge>
                      <Badge>{t.identity.tempo}</Badge>
                      <Badge>{t.identity.directness}</Badge>
                      <Badge tone="plum">{t.identity.approach}</Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[11px]">
                      {t.departments.map((d) => (
                        <div key={d.key} title={`${d.label}: ${d.rank}${["th", "st", "nd", "rd"][d.rank % 100 > 10 && d.rank % 100 < 14 ? 0 : Math.min(d.rank % 10, 4) % 4] ?? "th"} of ${d.of}`}>
                          <div className="font-black tabular-nums">{d.value}</div>
                          <div className="text-[10px] uppercase text-muted">{d.label.slice(0, 3)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null,
              )}
            </div>
            <ul className="grid gap-0.5 text-xs">
              {tp.strengths.map((s) => <li key={s}>💪 {s}</li>)}
              {tp.weaknesses.map((s) => <li key={s}>⚠️ {s}</li>)}
              {tp.fit && <li>🧩 Your fit with the manager&apos;s style: <b>{tp.fit.label}</b> ({tp.fit.score}/100). {tp.fit.note}</li>}
            </ul>
            {tp.duel && (
              <div className="rounded-lg border-2 border-line/20 p-2 text-xs" data-testid="duel">
                <b>Your direct opponent:</b> {tp.duel.theirs.name} ({tp.duel.theirs.position}, {tp.duel.theirs.ovr} OVR) against your {tp.duel.yours.ovr}.
                {tp.duel.edges.length > 0 && <span className="text-ink-2"> Biggest differences (you minus them): {tp.duel.edges.join(", ")}.</span>}
              </div>
            )}
            <p className="text-[11px] text-muted">{tp.note}</p>
          </div>
        ) : (
          <p className="text-muted">A tactical preview is available for your club&apos;s matches.</p>
        ))}
      {tab === "lineup" && <LineupTab g={g} fixture={fixture} />}
      {tab === "people" &&
        (people.length ? (
          <ul className="grid gap-1.5 text-sm">
            {people.map((p, i) => (
              <li key={i} className="rounded-lg border-2 border-line/15 px-2 py-1">
                {p.kind === "rival" ? "⚔️" : p.kind === "standout" ? "⭐" : p.kind === "former-club" ? "🏠" : "🤝"} {p.text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">No notable connections with this opponent.</p>
        ))}
      {tab === "history" &&
        (h2h ? (
          <div className="grid gap-2">
            {h2h.meetings.length > 0 && (
              <>
                <div className="text-xs text-muted">
                  Your record against them: {h2h.record.w}W {h2h.record.d}D {h2h.record.l}L
                </div>
                <ul className="grid gap-1 text-xs">
                  {h2h.meetings.map((m, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className={`grid h-5 w-5 place-items-center rounded-md border-2 border-line text-[11px] font-black ${m.result === "W" ? "bg-pitch text-white" : m.result === "D" ? "bg-sun" : "bg-coral"}`}>{m.result}</span>
                      <span className="scoreboard">{m.score[0]}–{m.score[1]}</span>
                      <span className="text-muted">{m.comp} · {formatTurnDate(m.season, m.turn).replace(/ \d{4}$/, "")}</span>
                      <span>rated {m.rating.toFixed(1)}{m.goals ? ` · ${m.goals} ⚽` : ""}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {h2h.memory && (
              <div className="rounded-lg border-2 border-line/20 bg-plum-2 p-2 text-xs">
                <b>{h2h.memory.title}</b>
                <div className="text-ink-2">{h2h.memory.line}</div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted">You haven&apos;t met this opponent in a match you played.</p>
        ))}
    </div>
  );
}

