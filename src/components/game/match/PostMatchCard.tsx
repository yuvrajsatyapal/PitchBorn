"use client";
import { Badge, Card, Rating } from "@/components/ui";
import type { PlayerLine } from "@/engine/match/engine";
import { postMatch, ratingReasons } from "@/engine/match/insight";
import { previewMatchEvidence } from "@/engine/traits/develop";
import { matchImportance } from "@/engine/season/matchday";
import type { Fixture, GameState } from "@/engine/types";

const RESULT_LABEL = { met: "Done", partly: "Partly", missed: "Not this time", none: "" } as const;

/** The user's match at full time, from what his player actually did. */
export function PostMatchCard({ line, uid, g, fixture, mySide, score }: { line: PlayerLine | undefined; uid: string; g: GameState; fixture: Fixture; mySide: "home" | "away" | null; score: [number, number] }) {
  if (!line || line.minuteOn < 0) {
    return (
      <Card title="Your match">
        <p className="text-sm text-ink-2">You were an unused substitute. Stay ready: the manager will remember who is sharp.</p>
      </Card>
    );
  }
  const [h, a] = score;
  const pm = postMatch(line, 90, h === a || !mySide ? null : mySide === "home" ? h > a : a > h);
  const reasons = ratingReasons(line);
  const p = g.players[uid];
  const comp = g.competitions[fixture.compId];
  const evidence = p ? previewMatchEvidence(g, p, line, { importance: matchImportance(g, comp, fixture) }) : [];
  return (
    <Card title="Your match" tone="sun">
      <div className="grid gap-3 text-sm" data-testid="post-match">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {pm.headline.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
            <Badge>{pm.minutes}&apos; played</Badge>
          </div>
          <Rating v={pm.rating} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 text-[11px] font-black uppercase tracking-widest text-muted">What went well</div>
            {pm.wentWell.length ? <ul className="grid gap-0.5">{pm.wentWell.map((t) => <li key={t}>✓ {t}</li>)}</ul> : <p className="text-ink-2">A quiet one: nothing stood out.</p>}
          </div>
          <div>
            <div className="mb-1 text-[11px] font-black uppercase tracking-widest text-muted">Needs improvement</div>
            {pm.improve.length ? <ul className="grid gap-0.5">{pm.improve.map((t) => <li key={t}>• {t}</li>)}</ul> : <p className="text-ink-2">Nothing to flag.</p>}
          </div>
        </div>
        {(reasons.good.length > 0 || reasons.bad.length > 0) && (
          <details className="rounded-xl border-2 border-line bg-card px-3 py-2">
            <summary className="cursor-pointer text-xs font-bold">What moved your rating</summary>
            <div className="mt-2 grid gap-1 text-xs">
              {reasons.good.map((r) => <div key={r.text}><b className="text-pitch">+</b> {r.text}</div>)}
              {reasons.bad.map((r) => <div key={r.text}><b className="text-coral">−</b> {r.text}</div>)}
            </div>
          </details>
        )}
        {pm.instruction && (
          <div className="rounded-xl border-2 border-line bg-card px-3 py-2 text-xs">
            <b>Manager&apos;s instruction: {pm.instruction.title}</b> · {pm.instruction.progress} · <b>{RESULT_LABEL[pm.instruction.result]}</b>
          </div>
        )}
        <blockquote className="border-l-4 border-ink pl-3 font-display text-lg leading-snug" data-testid="manager-quote">&ldquo;{pm.manager}&rdquo;</blockquote>
        {evidence.length > 0 && (
          <div className="text-xs text-ink-2" data-testid="trait-evidence">
            <b className="text-ink">Trait evidence:</b>{" "}
            {evidence.map((e, i) => (
              <span key={e.id}>{i > 0 ? " · " : ""}{e.name} {e.strength === "strong" ? "↑↑" : e.strength === "clear" ? "↑" : "·"}{e.owned ? "" : " (emerging)"}</span>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
