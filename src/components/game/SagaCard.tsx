"use client";
import { Crest } from "@/components/art/Crest";
import { Badge, Card } from "@/components/ui";
import { formatTurnDate } from "@/engine/calendar";
import { STAGE_LABEL } from "@/engine/career/saga/engine";
import { isActiveSaga } from "@/engine/career/saga/eligibility";
import { clubName } from "@/engine/data/world";
import { formatMoney } from "@/engine/players/economy";
import type { GameState, SagaOutcome, TransferSaga } from "@/engine/types";
import { useGame } from "@/game/store";

const OUTCOME_LABEL: Record<SagaOutcome, string> = {
  completed: "Completed", rejected: "Rejected", withdrawn: "Withdrawn", "negotiations-failed": "Talks collapsed", "player-declined": "You declined",
  "club-declined": "Club pulled out", "window-closed": "Window closed", "deadline-expired": "Deadline passed",
};

function Timeline({ s, limit }: { s: TransferSaga; limit?: number }) {
  const entries = limit ? s.entries.slice(-limit) : s.entries;
  return (
    <ol className="grid gap-1.5 border-l-2 border-line/40 pl-3 text-sm">
      {entries.map((e, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[17px] top-1.5 h-2 w-2 rounded-full bg-pitch" />
          <span className="mr-2 text-[11px] font-bold uppercase tracking-wide text-muted">{formatTurnDate(e.season, e.turn)}</span>
          <span className="mr-1.5 text-[11px] font-bold text-ink-2">{STAGE_LABEL[e.stage]}</span>
          {e.text}
        </li>
      ))}
      {!entries.length && <li className="text-muted">Nothing yet.</li>}
    </ol>
  );
}

function ActiveSaga({ g, s }: { g: GameState; s: TransferSaga }) {
  const decide = useGame((st) => st.decide);
  const weeks = s.deadlineIndex - g.turnIndex;
  const offers = s.offerIds.map((id) => g.user.offers.find((o) => o.id === id)).filter((o) => o && (o.status === "club-pending" || o.status === "terms" || o.status === "club-rejected"));
  const decision = s.decisionId ? g.user.decisions.find((d) => d.id === s.decisionId) : undefined;
  const clubs = [s.clubId, ...s.rivals];
  const pressure = weeks <= 1 ? "coral" : weeks <= 3 ? "sun" : "paper";
  return (
    <Card tone="sun" title="Transfer saga">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex -space-x-2">
          {clubs.map((c) => (
            <Crest key={c} clubId={c} size={44} />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-xl">{clubName(s.clubId)}{s.rivals.length > 0 && <span className="text-base text-muted"> vs {s.rivals.map((c) => clubName(c, true)).join(", ")}</span>}</div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Badge tone="plum">{STAGE_LABEL[s.stage]}</Badge>
            <Badge tone={pressure}>{weeks <= 0 ? "Final day" : weeks === 1 ? "Closes next week" : `Closes in ${weeks} weeks`}</Badge>
            {s.bids > 0 && <Badge>{s.bids} bid{s.bids === 1 ? "" : "s"}</Badge>}
            {g.user.transferRequest && <Badge tone="coral">Transfer-listed</Badge>}
          </div>
        </div>
      </div>
      {offers.length > 0 && (
        <ul className="mt-3 grid gap-1 text-xs text-ink-2">
          {offers.map((o) =>
            o ? (
              <li key={o.id}>
                <b>{clubName(o.fromClubId, true)}</b>: {o.fee ? `${formatMoney(o.fee)} fee · ` : "free transfer · "}
                {formatMoney(o.terms.wage)}/wk · {o.status === "terms" ? "personal terms open — negotiate below" : o.status === "club-pending" ? "bid awaiting an answer" : "bid rejected"}
              </li>
            ) : null,
          )}
        </ul>
      )}
      <div className="mt-3">
        <Timeline s={s} limit={8} />
      </div>
      {decision && (
        <div className="mt-3 rounded-xl border-2 border-line bg-card p-3" data-testid="saga-decision">
          <div className="font-bold">{decision.title}</div>
          <p className="mb-2 text-sm">{decision.body}</p>
          <div className="flex flex-wrap gap-2">
            {decision.options.map((o) => (
              <button key={o.id} onClick={() => decide(decision.id, o.id)} className="pb-btn bg-card px-3 text-left text-sm">
                <span>
                  {o.label}
                  {o.hint && <span className="block text-[11px] font-normal text-muted">{o.hint}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

/** The active transfer saga (if any) and the most recent finished ones. */
export function SagaCard({ g }: { g: GameState }) {
  const active = g.user.sagas.find(isActiveSaga);
  const past = g.user.sagas.filter((s) => !isActiveSaga(s)).slice(0, 3);
  if (!active && !past.length) return null;
  return (
    <section className="grid gap-3" data-testid="saga-card">
      {active && <ActiveSaga g={g} s={active} />}
      {past.length > 0 && (
        <Card title="Past transfer sagas">
          <ul className="grid gap-3">
            {past.map((s) => (
              <li key={s.id}>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Crest clubId={s.clubId} size={24} />
                  <b>{clubName(s.clubId)}</b>
                  <Badge tone={s.outcome === "completed" ? "pitch" : "paper"}>{OUTCOME_LABEL[s.outcome ?? "withdrawn"]}</Badge>
                  <span className="text-xs text-muted">{formatTurnDate(s.startSeason, s.startTurn)}</span>
                </div>
                <Timeline s={s} limit={3} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}
