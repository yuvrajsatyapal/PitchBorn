"use client";
import { Crest } from "@/components/art/Crest";
import { Badge, Bar, Button, Card } from "@/components/ui";
import { clubName, staticLeague } from "@/engine/data/world";
import { loanAdvice } from "@/engine/career/loanAdvice";
import type { GameState } from "@/engine/types";
import { useGame } from "@/game/store";

/** "You're not playing: go on loan", with clubs where the player would get games. */
export function LoanAdviceCard({ g, compact = false }: { g: GameState; compact?: boolean }) {
  const requestLoan = useGame((s) => s.requestLoan);
  const setWantsLoan = useGame((s) => s.setWantsLoan);
  const advice = loanAdvice(g);
  if (!advice) return null;
  const searching = g.user.wantsLoan;
  const target = g.user.loanTarget;
  const when = advice.windowOpen ? "The window is open now." : advice.weeksToWindow ? `The next window opens in ${advice.weeksToWindow} week${advice.weeksToWindow === 1 ? "" : "s"}.` : "";
  return (
    <Card tone={advice.level === "urge" ? "sun" : "sky"} title="🧭 Agent's advice: go on loan">
      <ul className="mb-2 grid gap-1 text-sm">
        {advice.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      {advice.possible > 0 && (
        <div className="mb-3">
          <Bar value={Math.round(advice.share * 100)} max={100} tone={advice.share < 0.2 ? "coral" : "sun"} label="Share of club minutes" />
        </div>
      )}
      <p className="mb-3 text-sm text-ink-2">
        Regular football speeds up development. {when} {searching ? (target ? `Your agent is pushing for ${clubName(target)}.` : "Your agent is already looking.") : ""}
      </p>
      {!compact && advice.destinations.length > 0 && (
        <ul className="mb-3 grid gap-2">
          {advice.destinations.map((d) => (
            <li key={d.clubId} className={`flex flex-wrap items-center gap-2 rounded-xl border-2 p-2 ${target === d.clubId ? "border-line bg-card" : "border-line/30"}`}>
              <Crest clubId={d.clubId} size={28} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 font-bold">
                  {clubName(d.clubId)}
                  <Badge tone={d.outlook === "starter" ? "pitch" : "paper"}>{d.outlook === "starter" ? "Likely starter" : "Rotation"}</Badge>
                </div>
                <div className="text-xs text-ink-2">{staticLeague(d.leagueId)?.name ?? d.leagueId} · {d.reason}</div>
              </div>
              <Button size="sm" tone={target === d.clubId ? "pitch" : "paper"} onClick={() => requestLoan(d.clubId)} disabled={target === d.clubId}>
                {target === d.clubId ? "Targeted" : "Target"}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        {searching ? (
          <Button size="sm" tone="paper" onClick={() => setWantsLoan(false)}>Cancel loan search</Button>
        ) : (
          <Button size="sm" tone="pitch" onClick={() => requestLoan()} data-testid="loan-request">Ask agent for a loan</Button>
        )}
      </div>
    </Card>
  );
}
