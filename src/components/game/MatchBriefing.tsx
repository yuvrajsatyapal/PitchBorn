"use client";
import { useMemo, useState } from "react";
import { Crest } from "@/components/art/Crest";
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

const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : Math.min(n % 10, 4) % 4] ?? "th"}`;

function TeamSide({ clubId, t }: { clubId: Fixture["home"]; t: TeamLine }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
      <Crest clubId={clubId} size={72} />
      <b className="text-base leading-tight sm:text-lg">{teamLabel(clubId)}</b>
      {t.position !== null && (
        <span className="text-xs font-bold">
          {t.position}
          {["th", "st", "nd", "rd"][t.position % 100 > 10 && t.position % 100 < 14 ? 0 : Math.min(t.position % 10, 4) % 4] ?? "th"}
          {t.points !== null && <span className="font-semibold text-muted"> · {t.points} pts</span>}
        </span>
      )}
      {t.form.length > 0 && <FormDots form={t.form} />}
    </div>
  );
}

/** The matchup: each club's crest, standing and form together, then venue and what the match means. */
export function MatchContextStrip({ g, fixture }: { g: GameState; fixture: Fixture }) {
  const ctx = useMemo(() => matchContext(g, fixture), [g, fixture.id, g.turnIndex]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ctx) return null;
  const venue = ctx.homeAway === "neutral" ? "Neutral" : ctx.homeAway === "home" ? "Home" : "Away";
  return (
    <div className="mb-4" data-testid="match-context">
      <div className="my-4 grid grid-cols-[1fr_auto_1fr] items-start gap-3 sm:gap-6">
        <TeamSide clubId={fixture.home} t={ctx.home} />
        <div className="flex flex-col items-center gap-1 pt-6">
          <span className="scoreboard text-3xl">VS</span>
          <span className="text-[11px] font-black uppercase tracking-wider text-muted">{venue}</span>
        </div>
        <TeamSide clubId={fixture.away} t={ctx.away} />
      </div>
      {(ctx.stadium || ctx.tags.length > 0) && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs">
          {ctx.stadium && <Badge>🏟️ {ctx.stadium}</Badge>}
          {ctx.tags.map((t) => (
            <Badge key={t} tone={ctx.level === "major" ? "sun" : "sky"} className="font-black">
              {IMPORTANCE_LABEL[t]}
            </Badge>
          ))}
        </div>
      )}
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
        <div className="mt-3 grid gap-3 border-t-2 border-line/20 pt-3 sm:grid-cols-2" data-testid="prematch-actions">
          {actions.map((a) => (
            <div key={a.kind} className="flex flex-col items-start gap-1">
              <Button tone="paper" size="sm" className="w-full sm:w-auto" disabled={!a.enabled} onClick={() => preMatch(fixture.id, a.kind)} title={a.hint} data-testid={`prematch-${a.kind}`}>
                {a.label}
              </Button>
              <span className="text-[11px] leading-snug text-muted">{a.enabled ? a.hint : a.why}</span>
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
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { who: "Your side", t: tp.mine, tint: "bg-pitch-2" },
                { who: "Opposition", t: tp.theirs, tint: "bg-coral-2" },
              ].map(({ who, t, tint }) =>
                t ? (
                  <div key={who} className="overflow-hidden rounded-xl border-2 border-line/30">
                    <div className={`flex items-baseline justify-between gap-2 px-3 py-2 text-ink ${tint}`}>
                      <span className="text-xs font-black">{who}</span>
                      <span className="text-right">
                        <span className="scoreboard text-lg">{t.formation}</span>
                        <span className="ml-1.5 text-xs font-semibold text-ink-2">{t.identity.lean}</span>
                      </span>
                    </div>
                    <div className="grid gap-3 p-3">
                      <div className="flex flex-wrap gap-1 text-[11px]">
                        <Badge>{t.identity.pressing}</Badge>
                        <Badge>{t.identity.tempo}</Badge>
                        <Badge>{t.identity.directness}</Badge>
                        <Badge tone="plum">{t.identity.approach}</Badge>
                      </div>
                      <div className="grid gap-1.5">
                        {t.departments.map((d) => (
                          <div key={d.key} className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-2 text-[11px]" title={`${d.label}: ${ordinal(d.rank)} of ${d.of}`}>
                            <span className="font-black uppercase text-muted">{d.label.toLowerCase().startsWith("goal") ? "GK" : d.label.slice(0, 3)}</span>
                            <span className="h-2 overflow-hidden rounded-full border border-line/40 bg-paper-2">
                              <span className={`block h-full rounded-full ${d.rank <= d.of / 3 ? "bg-pitch" : d.rank > (d.of * 2) / 3 ? "bg-coral" : "bg-sun"}`} style={{ width: `${Math.min(100, Math.max(4, d.value))}%` }} />
                            </span>
                            <span className="w-14 text-right">
                              <b className="tabular-nums text-sm">{d.value}</b> <span className="text-muted">{ordinal(d.rank)}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null,
              )}
            </div>
            <ul className="grid gap-1.5 text-xs">
              {tp.strengths.map((s) => <li key={s} className="flex gap-2 rounded-lg bg-pitch-2 px-2.5 py-1.5 text-ink"><span aria-hidden>💪</span>{s}</li>)}
              {tp.weaknesses.map((s) => <li key={s} className="flex gap-2 rounded-lg bg-coral-2 px-2.5 py-1.5 text-ink"><span aria-hidden>⚠️</span>{s}</li>)}
              {tp.fit && (
                <li className="flex gap-2 rounded-lg bg-sun-2 px-2.5 py-1.5 text-ink">
                  <span aria-hidden>🧩</span>
                  <span>Your fit with the manager&apos;s style: <b>{tp.fit.label}</b> ({tp.fit.score}/100). {tp.fit.note}</span>
                </li>
              )}
            </ul>
            {tp.duel && (
              <div className="rounded-xl border-2 border-line/30 p-3" data-testid="duel">
                <div className="text-xs font-black text-muted">Your direct opponent</div>
                <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
                  <div><div className="scoreboard text-2xl">{tp.duel.yours.ovr}</div><div className="text-[11px] text-muted">You · OVR</div></div>
                  <span className="text-xs font-black text-muted">VS</span>
                  <div><div className="scoreboard text-2xl">{tp.duel.theirs.ovr}</div><div className="truncate text-[11px] text-muted">{tp.duel.theirs.name} · {tp.duel.theirs.position}</div></div>
                </div>
                {tp.duel.edges.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="text-muted">Biggest differences (you minus them)</span>
                    {tp.duel.edges.map((e) => <Badge key={e} tone={e.includes("-") ? "coral" : "pitch"}>{e}</Badge>)}
                  </div>
                )}
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

