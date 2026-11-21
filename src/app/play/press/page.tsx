"use client";
import { Crest } from "@/components/art/Crest";
import { Badge, Button, Card, Empty, LinkButton, PageTitle } from "@/components/ui";
import { seasonLabel } from "@/engine/calendar";
import { TONE_LABEL } from "@/engine/career/press";
import { clubName } from "@/engine/data/world";
import type { PressTone } from "@/engine/types";
import { useGame, useGameState } from "@/game/store";

const TONE_COLOR: Record<PressTone, "pitch" | "sun" | "coral" | "sky"> = { humble: "pitch", confident: "sun", fiery: "coral", deflect: "sky" };

export default function PressRoom() {
  const g = useGameState();
  const answer = useGame((s) => s.answerPress);
  const skip = useGame((s) => s.skipPress);
  if (!g) return null;
  const conf = g.user.press;
  const log = [...(g.user.pressLog ?? [])].reverse();

  return (
    <div className="grid gap-4">
      <PageTitle kicker={conf ? `${conf.kind === "pre" ? "Pre-match" : "Post-match"} · ${conf.compName}` : "Media"} title="Press Room" className="-mb-1" />
      {conf ? (
        <Card
          tone={conf.done ? "pitch" : "sun"}
          title={
            <span className="flex items-center gap-2">
              🎙️ {conf.kind === "pre" ? "Before" : "After"} the game · <Crest clubId={conf.opponentId} size={24} /> {clubName(conf.opponentId)}
            </span>
          }
        >
          <ol className="grid gap-4">
            {conf.questions.map((q, i) => {
              const chosen = conf.answers[q.id];
              const open = !chosen && conf.questions.slice(0, i).every((x) => conf.answers[x.id]);
              const picked = q.answers.find((a) => a.id === chosen);
              return (
                <li key={q.id} className={`rounded-2xl border-2 border-line bg-card p-3 ${!chosen && !open ? "opacity-50" : ""}`} data-testid={`press-q-${q.id}`}>
                  <div className="text-[11px] font-black uppercase tracking-wider text-muted">
                    {q.reporter} · {q.outlet}
                  </div>
                  <p className="mb-2 font-bold">“{q.text}”</p>
                  {picked ? (
                    <div className="grid gap-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge tone={TONE_COLOR[picked.tone]}>{TONE_LABEL[picked.tone]}</Badge>
                        <span className="italic">“{picked.label}”</span>
                      </div>
                      <p className="text-xs text-ink-2">{picked.reaction}</p>
                    </div>
                  ) : open ? (
                    <div className="grid gap-2">
                      {q.answers.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          className="pb-hit rounded-xl border-2 border-line bg-paper-2 px-3 py-2 text-left text-sm hover:bg-sun-2"
                          onClick={() => answer(q.id, a.id)}
                          data-testid={`press-answer-${a.id}`}
                        >
                          <span className="flex flex-wrap items-center gap-2">
                            <Badge tone={TONE_COLOR[a.tone]}>{TONE_LABEL[a.tone]}</Badge>
                            <span className="font-semibold">{a.label}</span>
                          </span>
                          <span className="mt-0.5 block text-xs text-muted">{a.hint}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted">Waiting for your turn…</p>
                  )}
                </li>
              );
            })}
          </ol>
          {conf.done ? (
            <div className="mt-4 rounded-xl border-2 border-line bg-sun-2 p-3">
              <div className="text-[11px] font-black uppercase tracking-wider text-muted">Tomorrow&apos;s back page</div>
              <div className="font-display text-xl leading-tight">{conf.headline}</div>
              <div className="mt-2">
                <LinkButton href="/play" size="sm" tone="paper">Back to dashboard</LinkButton>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button size="sm" tone="paper" onClick={skip}>Skip the press</Button>
              <span className="text-xs text-muted">Skipping has no effect, but dodge them often and the board notices.</span>
            </div>
          )}
        </Card>
      ) : (
        <Empty title="No reporters waiting" icon="🎙️">
          Big games, standout displays and bad days bring the press. Derbies and finals get a pre-match conference too.
        </Empty>
      )}
      {log.length > 0 && (
        <Card title="Past headlines">
          <ul className="grid gap-2">
            {log.map((e) => (
              <li key={`${e.fixtureId}-${e.kind}`} className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-line/20 px-3 py-2 text-sm">
                <Badge tone={TONE_COLOR[e.tone]}>{TONE_LABEL[e.tone]}</Badge>
                <span className="font-semibold">{e.headline}</span>
                <span className="text-xs text-muted">{seasonLabel(e.season)} · vs {clubName(e.opponentId, true)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
