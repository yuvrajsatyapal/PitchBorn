"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button, Card } from "@/components/ui";
import type { TimelineFrame, TimelineRecap as Recap } from "@/engine/career/timeline";

const W = 1080;
const H = 1350;
const C = { paper: "#fff5e6", paper2: "#fbe8cc", ink: "#1b1712", ink2: "#4a4136", sun: "#ffc62b", coral: "#ff6b57", pitch: "#2e8b57" };
const INTRO = 1.6;
const PER = 1.5;
const OUTRO = 2.4;

/** Resolve the page's font stacks once so the canvas uses the same faces as the site. */
function fonts() {
  if (typeof document === "undefined") return { display: "sans-serif", sans: "sans-serif", num: "monospace" };
  const cs = getComputedStyle(document.documentElement);
  const pick = (v: string, fb: string) => cs.getPropertyValue(v).trim() || fb;
  // The next/font variables hold the real family names; the --font-* aliases wrap them in var(), which canvas can't read.
  return { display: `${pick("--font-lilita", "sans-serif")}, sans-serif`, sans: `${pick("--font-outfit", "system-ui")}, sans-serif`, num: `${pick("--font-chakra", "monospace")}, monospace` };
}

export const recapDuration = (r: Recap) => INTRO + r.frames.length * PER + OUTRO;
const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string) {
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.roundRect(x + 10, y + 10, w, h, 36);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 36);
  ctx.fill();
  ctx.stroke();
}

function stat(ctx: CanvasRenderingContext2D, f: ReturnType<typeof fonts>, x: number, y: number, label: string, value: string) {
  ctx.fillStyle = C.ink2;
  ctx.font = `700 30px ${f.sans}`;
  ctx.fillText(label.toUpperCase(), x, y);
  ctx.fillStyle = C.ink;
  ctx.font = `700 96px ${f.num}`;
  ctx.fillText(value, x, y + 96);
}

function seasonFrame(ctx: CanvasRenderingContext2D, f: ReturnType<typeof fonts>, r: Recap, fr: TimelineFrame, i: number, k: number) {
  const n = (v: number) => String(Math.round(v * ease(k * 1.6)));
  ctx.fillStyle = fr.colors.primary;
  ctx.fillRect(0, 0, W, 300);
  ctx.fillStyle = C.paper;
  ctx.font = `120px ${f.display}`;
  ctx.fillText(fr.label, 70, 200);
  ctx.font = `700 40px ${f.sans}`;
  ctx.fillText(`Season ${i + 1} of ${r.frames.length}${fr.current ? " · in progress" : ""}`, 74, 262);
  panel(ctx, 60, 360, W - 120, 840, C.paper);
  ctx.fillStyle = C.ink;
  ctx.font = `76px ${f.display}`;
  ctx.fillText(fr.club, 110, 470, W - 220);
  ctx.font = `700 40px ${f.sans}`;
  ctx.fillStyle = C.ink2;
  ctx.fillText(`Age ${fr.age} · overall ${fr.overall}`, 112, 530);
  stat(ctx, f, 112, 640, "Apps", n(fr.apps));
  stat(ctx, f, 440, 640, r.position === "GK" ? "Assists" : "Goals", r.position === "GK" ? n(fr.assists) : n(fr.goals));
  stat(ctx, f, 760, 640, "Assists", n(fr.assists));
  if (fr.rating !== null) {
    ctx.fillStyle = C.ink2;
    ctx.font = `700 30px ${f.sans}`;
    ctx.fillText("AVERAGE RATING", 112, 860);
    const bar = (W - 340) * ease(k * 1.4) * Math.min(1, Math.max(0, (fr.rating - 5) / 4));
    ctx.fillStyle = C.paper2;
    ctx.fillRect(112, 884, W - 340, 44);
    ctx.fillStyle = fr.rating >= 7 ? C.pitch : fr.rating >= 6.5 ? C.sun : C.coral;
    ctx.fillRect(112, 884, bar, 44);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 4;
    ctx.strokeRect(112, 884, W - 340, 44);
    ctx.fillStyle = C.ink;
    ctx.font = `700 52px ${f.num}`;
    ctx.fillText(fr.rating.toFixed(2), W - 210, 926);
  }
  const honours = [...fr.trophies.map((t) => `🏆 ${t}`), ...fr.awards.map((a) => `⭐ ${a}`)].slice(0, 3);
  ctx.font = `700 40px ${f.sans}`;
  ctx.fillStyle = C.ink;
  honours.forEach((h, j) => {
    if (k * 3 > j * 0.4) ctx.fillText(h, 112, 1010 + j * 56, W - 240);
  });
  if (!honours.length) {
    ctx.fillStyle = C.ink2;
    ctx.fillText("No silverware this time.", 112, 1010);
  }
}

/** Draw the recap at time `t` seconds. */
export function drawRecap(ctx: CanvasRenderingContext2D, r: Recap, t: number) {
  const f = fonts();
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";
  if (t < INTRO || !r.frames.length) {
    const k = ease(t / INTRO);
    ctx.fillStyle = C.sun;
    ctx.beginPath();
    ctx.arc(W / 2, 520, 300 * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.textAlign = "center";
    ctx.font = `110px ${f.display}`;
    ctx.fillText(r.name, W / 2, 560, W - 120);
    ctx.font = `700 46px ${f.sans}`;
    ctx.fillText(`A career in ${r.frames.length} season${r.frames.length === 1 ? "" : "s"}`, W / 2, 640);
  } else if (t < INTRO + r.frames.length * PER) {
    const i = Math.floor((t - INTRO) / PER);
    ctx.textAlign = "left";
    seasonFrame(ctx, f, r, r.frames[i], i, ((t - INTRO) % PER) / PER);
  } else {
    const k = ease((t - INTRO - r.frames.length * PER) / 0.8);
    ctx.textAlign = "center";
    ctx.fillStyle = C.ink;
    ctx.font = `100px ${f.display}`;
    ctx.fillText("Career totals", W / 2, 300);
    const rows: [string, number][] = [["Apps", r.totals.apps], ["Goals", r.totals.goals], ["Assists", r.totals.assists], ["Trophies", r.totals.trophies], ["Peak overall", r.totals.peak]];
    rows.forEach(([l, v], j) => {
      ctx.font = `700 40px ${f.sans}`;
      ctx.fillStyle = C.ink2;
      ctx.fillText(l.toUpperCase(), W / 2, 420 + j * 150);
      ctx.font = `700 86px ${f.num}`;
      ctx.fillStyle = C.ink;
      ctx.fillText(String(Math.round(v * k)), W / 2, 500 + j * 150);
    });
  }
  ctx.textAlign = "left";
  ctx.fillStyle = C.ink2;
  ctx.font = `700 32px ${f.sans}`;
  ctx.fillText("PitchBorn", 60, H - 50);
}

/** A still: every season as a row, for sharing as one image. */
export function drawPoster(ctx: CanvasRenderingContext2D, r: Recap) {
  const f = fonts();
  const rows = r.frames.length;
  const rowH = Math.min(110, Math.floor((H - 420) / Math.max(1, rows)));
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.ink;
  ctx.font = `96px ${f.display}`;
  ctx.fillText(r.name, 60, 150, W - 120);
  ctx.font = `700 36px ${f.sans}`;
  ctx.fillStyle = C.ink2;
  ctx.fillText(`${r.totals.apps} apps · ${r.totals.goals} goals · ${r.totals.assists} assists · ${r.totals.trophies} trophies · peak ${r.totals.peak}`, 62, 210, W - 120);
  r.frames.forEach((fr, i) => {
    const y = 260 + i * rowH;
    ctx.fillStyle = fr.colors.primary;
    ctx.fillRect(60, y, 18, rowH - 14);
    ctx.fillStyle = C.ink;
    ctx.font = `700 ${Math.round(rowH * 0.36)}px ${f.num}`;
    ctx.fillText(fr.label, 96, y + rowH * 0.45);
    ctx.font = `700 ${Math.round(rowH * 0.3)}px ${f.sans}`;
    ctx.fillText(fr.club, 330, y + rowH * 0.45, 360);
    ctx.fillStyle = C.ink2;
    ctx.font = `600 ${Math.round(rowH * 0.24)}px ${f.sans}`;
    ctx.fillText(`${fr.apps} apps · ${fr.goals} G · ${fr.assists} A${fr.rating !== null ? ` · ${fr.rating.toFixed(2)}` : ""}${fr.trophies.length ? ` · 🏆${fr.trophies.length}` : ""}`, 330, y + rowH * 0.78, 680);
    ctx.fillText(`OVR ${fr.overall}`, 96, y + rowH * 0.78);
  });
  ctx.fillStyle = C.ink2;
  ctx.font = `700 32px ${f.sans}`;
  ctx.fillText("PitchBorn", 60, H - 50);
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const noop = () => () => {};
const reducedMotionNow = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The animated recap with poster and video export. */
export function TimelineRecapCard({ recap, fileStem, notify }: { recap: Recap; fileStem: string; notify: (t: string, tone?: "good" | "bad") => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [recording, setRecording] = useState(false);
  const reduced = useSyncExternalStore(noop, reducedMotionNow, () => false);
  const canVideo = useSyncExternalStore(noop, () => typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement.prototype.captureStream === "function", () => false);
  const total = recapDuration(recap);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    if (reduced) {
      drawPoster(ctx, recap);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      if (!recording) drawRecap(ctx, recap, ((now - start) / 1000) % total);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [recap, total, reduced, recording]);

  const savePoster = () => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    drawPoster(ctx, recap);
    c.toBlob((b) => (b ? (download(b, `${fileStem}-timeline.png`), notify("Timeline poster saved", "good")) : notify("Could not make the image.", "bad")), "image/png");
  };

  const saveVideo = async () => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !canVideo) return;
    setRecording(true);
    try {
      const type = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const stream = canvas.captureStream(30);
      const rec = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 4_000_000 } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const done = new Promise<void>((res) => (rec.onstop = () => res()));
      rec.start();
      const start = performance.now();
      await new Promise<void>((res) => {
        const tick = (now: number) => {
          const t = (now - start) / 1000;
          drawRecap(ctx, recap, Math.min(t, total - 0.01));
          if (t < total) requestAnimationFrame(tick);
          else res();
        };
        requestAnimationFrame(tick);
      });
      rec.stop();
      await done;
      const blob = new Blob(chunks, { type: rec.mimeType || "video/webm" });
      download(blob, `${fileStem}-timeline.${(rec.mimeType || "").includes("mp4") ? "mp4" : "webm"}`);
      notify("Timeline video saved", "good");
    } catch {
      notify("Video export isn't available in this browser. Save the poster instead.", "bad");
    } finally {
      setRecording(false);
    }
  };

  return (
    <Card title="🎬 Career timeline">
      <p className="mb-3 text-sm text-ink-2">An animated recap of every season, made for social posts. Save it as a short video or a single poster.</p>
      <canvas
        ref={ref}
        width={W}
        height={H}
        className="mx-auto block aspect-[4/5] w-full max-w-sm rounded-2xl border-2 border-line"
        role="img"
        aria-label={`Career timeline of ${recap.name}: ${recap.frames.length} season${recap.frames.length === 1 ? "" : "s"}, ${recap.totals.apps} appearance${recap.totals.apps === 1 ? "" : "s"}, ${recap.totals.goals} goal${recap.totals.goals === 1 ? "" : "s"}, ${recap.totals.trophies} troph${recap.totals.trophies === 1 ? "y" : "ies"}.`}
      />
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <Button tone="sun" onClick={saveVideo} disabled={!canVideo || recording || !recap.frames.length}>
          {recording ? `Recording… (${Math.ceil(total)}s)` : "Save video"}
        </Button>
        <Button tone="paper" onClick={savePoster} disabled={!recap.frames.length}>Save poster</Button>
      </div>
      {!canVideo && <p className="mt-2 text-center text-xs text-muted">This browser can&apos;t record video; the poster still works.</p>}
    </Card>
  );
}
