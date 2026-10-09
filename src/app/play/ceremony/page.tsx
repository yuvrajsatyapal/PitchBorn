"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CeremonyControls, CeremonyResults, sceneView } from "@/components/game/Ceremony";
import { Button, Card, Empty, LinkButton, PageTitle } from "@/components/ui";
import { buildScenes } from "@/engine/awards/ceremony";
import { hasPodiumReveal } from "@/engine/awards/podium";
import { seasonLabel } from "@/engine/calendar";
import { useGame, useGameState } from "@/game/store";

export default function CeremonyPage() {
  const g = useGameState();
  const router = useRouter();
  const start = useGame((s) => s.ceremonyStart);
  const step = useGame((s) => s.ceremonyStep);
  const finish = useGame((s) => s.ceremonyFinish);
  const busy = !!useGame((s) => s.busy);
  // The scene whose podium reveal has finished. Presentation only, never saved: after a reload it starts again.
  const [doneStep, setDoneStep] = useState(-1);
  if (!g) return null;
  const c = g.ceremony;
  if (!c) {
    return (
      <div className="grid gap-4">
        <PageTitle kicker="Awards" title="Awards Night" className="-mb-1" />
        <Empty title="Not yet" icon="🏆">Awards Night comes when the season is over and the final table is set.</Empty>
      </div>
    );
  }
  const scenes = buildScenes(c);
  const title = `${seasonLabel(c.season)} Awards Night`;

  if (c.status === "completed") {
    return (
      <div className="grid gap-4">
        <PageTitle kicker={c.leagueName} title={`${title}: results`} className="-mb-1" />
        <CeremonyResults g={g} c={c} />
        <div className="flex flex-wrap justify-center gap-2">
          <LinkButton href="/play" tone="sun">Back to the dashboard</LinkButton>
          <Link href="/play/awards" className="pb-btn bg-card px-5 text-[15px]">Trophies &amp; awards</Link>
        </div>
      </div>
    );
  }

  if (c.status === "ready") {
    return (
      <div className="grid gap-4">
        <PageTitle kicker={c.leagueName} title={title} className="-mb-1" />
        <Card tone="sun" className="mx-auto w-full max-w-xl text-center">
          <div className="text-5xl" aria-hidden>🏆</div>
          <h2 className="mt-2 font-display text-3xl">Awards Night is ready</h2>
          <p className="mt-2 text-sm">The season is final. Watch the awards presented, or go straight to the results — everything counts the same either way.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button tone="pitch" size="lg" onClick={start} disabled={busy} data-testid="watch-ceremony">Watch ceremony</Button>
            <Button tone="paper" size="lg" onClick={async () => { await finish("skipped"); }} disabled={busy} data-testid="skip-ceremony">Skip to results</Button>
          </div>
          <p className="mt-3 text-xs text-muted">If you carry on without choosing, it counts as skipping.</p>
        </Card>
      </div>
    );
  }

  const at = Math.min(c.step, scenes.length - 1);
  const scene = scenes[at];
  const sceneAward = scene.kind === "award" && scene.phase === "winner" ? c.results.find((r) => r.id === scene.id) : undefined;
  const revealing = !!sceneAward && hasPodiumReveal(sceneAward) && doneStep !== at;
  return (
    <div className="grid gap-4" data-testid="ceremony">
      <PageTitle kicker={c.leagueName} title={title} className="-mb-1" />
      <div className="min-h-[22rem]">{sceneView(g, c, scene, () => setDoneStep(at))}</div>
      <CeremonyControls
        c={c}
        step={at}
        total={scenes.length}
        busy={busy}
        revealing={revealing}
        onBack={() => {
          setDoneStep(-1);
          step(at - 1);
        }}
        onNext={async () => {
          if (at >= scenes.length - 1) {
            await finish("watched");
            router.push("/play");
          } else {
            setDoneStep(-1);
            step(at + 1);
          }
        }}
        onSkip={async () => {
          await finish("skipped");
        }}
      />
    </div>
  );
}
