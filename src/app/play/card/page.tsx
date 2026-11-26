"use client";
import { useRef, useState, useSyncExternalStore } from "react";
import { CareerCard, cardToPng } from "@/components/game/CareerCard";
import { Button, Card, PageTitle } from "@/components/ui";
import { careerCaption, careerCardData } from "@/engine/career/card";
import { user } from "@/game/selectors";
import { TimelineRecapCard } from "@/components/game/TimelineRecap";
import { timelineRecap } from "@/engine/career/timeline";
import { useGame, useGameState } from "@/game/store";

const noop = () => () => {};

export default function CareerCardPage() {
  const g = useGameState();
  const notify = useGame((s) => s.notify);
  const ref = useRef<SVGSVGElement>(null);
  const [busy, setBusy] = useState(false);
  // Browser-only facts: empty while prerendering, read once on the client.
  const origin = useSyncExternalStore(noop, () => window.location.host, () => "");
  const canShare = useSyncExternalStore(noop, () => typeof navigator.share === "function", () => false);
  if (!g) return null;
  const p = user(g);
  const d = careerCardData(g);
  const caption = careerCaption(d, origin ? window.location.origin : undefined);
  const fileName = `${d.name.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()}-pitchborn.png`;

  const render = async () => {
    if (!ref.current) throw new Error("The card is not ready yet.");
    return cardToPng(ref.current);
  };
  const download = async () => {
    setBusy(true);
    try {
      const blob = await render();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify("Career card saved", "good");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not save the card.", "bad");
    } finally {
      setBusy(false);
    }
  };
  const share = async () => {
    setBusy(true);
    try {
      const blob = await render();
      const file = new File([blob], fileName, { type: "image/png" });
      const data: ShareData = { title: `${d.name} · PitchBorn`, text: caption };
      if (navigator.canShare?.({ files: [file] })) data.files = [file];
      await navigator.share(data);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) notify("Sharing isn't available here. Try Download instead.", "bad");
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      notify("Caption copied", "good");
    } catch {
      notify("Couldn't copy the caption.", "bad");
    }
  };

  return (
    <div className="grid gap-4">
      <PageTitle kicker="Show it off" title="Career Card" className="-mb-1" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="pb-card overflow-hidden bg-card p-3 sm:p-4">
          <CareerCard ref={ref} d={d} look={p.look} footer={origin || undefined} className="h-auto w-full" />
        </div>
        <div className="grid content-start gap-4">
          <Card title="Share your career">
            <p className="mb-3 text-sm text-ink-2">A picture of your player, numbers and honours, sized for social posts. It updates as your career goes on.</p>
            <div className="grid gap-2">
              {canShare && (
                <Button tone="pitch" onClick={share} disabled={busy} data-testid="share-card">
                  📤 Share
                </Button>
              )}
              <Button tone="sun" onClick={download} disabled={busy} data-testid="download-card">
                ⬇️ Download PNG
              </Button>
              <Button tone="paper" onClick={copy}>
                📋 Copy caption
              </Button>
            </div>
          </Card>
          <Card title="Caption">
            <pre className="whitespace-pre-wrap break-words font-sans text-sm text-ink-2">{caption}</pre>
          </Card>
        </div>
      </div>
      <TimelineRecapCard recap={timelineRecap(g)} fileStem={fileName.replace(/-pitchborn\.png$/, "")} notify={notify} />
    </div>
  );
}
