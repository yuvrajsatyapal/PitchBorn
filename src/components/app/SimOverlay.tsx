"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { INTERRUPT_LABEL } from "@/engine/season/interrupts";
import { useGame } from "@/game/store";

const DAY_MS = 86_400_000;
/** Cards either side of the highlighted one; the strip clips what is out of view. */
const REACH = 4;
const CARD_W = 72;
const GAP = 8;
const PITCH = CARD_W + GAP;

const dateOf = (day: number) => new Date(day * DAY_MS);
const weekday = (day: number) => dateOf(day).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }).toUpperCase();
const dayOfMonth = (day: number) => dateOf(day).getUTCDate();
const monthLabel = (day: number) => dateOf(day).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).toUpperCase();

/** Full-screen "Simulating…" strip: the days slide under a fixed highlight until the run reaches the day that stopped it. */
export function SimOverlay() {
  const sim = useGame((s) => s.sim);
  const stopSim = useGame((s) => s.stopSim);
  const baseRef = useRef<number | null>(null);

  useEffect(() => {
    if (!sim) baseRef.current = null;
    if (!sim) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && stopSim();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [!!sim, stopSim]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!sim) return null;
  if (baseRef.current === null) baseRef.current = sim.day;
  const base = baseRef.current;
  const days = Array.from({ length: REACH * 2 + 1 }, (_, i) => sim.day - REACH + i);
  const timing = sim.ease ? "cubic-bezier(0.2, 0.7, 0.3, 1)" : "linear";
  const slide = `transform ${sim.stepMs}ms ${timing}`;
  const fade = `color ${sim.stepMs}ms linear, opacity ${sim.stepMs}ms linear`;

  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center bg-ink/60 p-4" role="dialog" aria-modal="true" aria-label="Simulating" data-testid="sim-overlay">
      <div className="pb-card w-full max-w-[460px] p-5 text-ink">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl tracking-wide">SIMULATING…</h2>
          <span className="text-xs font-semibold tracking-widest text-muted" data-testid="sim-month">
            {monthLabel(sim.day)}
          </span>
        </div>
        <div
          className="relative mt-5 h-28 overflow-hidden py-1 [contain:layout_paint]"
          aria-live="off"
          style={{ maskImage: "linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent)", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent)" }}
        >
          <div
            className="absolute left-1/2 top-1 h-[calc(100%-0.5rem)] rounded-2xl border-2 border-line bg-sun shadow-[3px_3px_0_var(--shadow)]"
            style={{ width: CARD_W, marginLeft: -CARD_W / 2 }}
          />
          <div
            className="absolute left-1/2 top-1 h-[calc(100%-0.5rem)] w-0 will-change-transform motion-reduce:!transition-none"
            style={{ transform: `translate3d(${-(sim.day - base) * PITCH}px,0,0)`, transition: slide }}
          >
            {days.map((d) => {
              const current = d === sim.day;
              return (
                <div
                  key={d}
                  data-current={current || undefined}
                  className={`absolute left-0 top-0 grid h-full place-items-center rounded-2xl border-2 motion-reduce:!transition-none ${current ? "border-transparent text-[#1b1712]" : "border-line/20 text-muted"}`}
                  style={{ width: CARD_W, transform: `translate3d(${(d - base) * PITCH - CARD_W / 2}px,0,0)`, transition: fade }}
                >
                  <div className="text-center leading-tight">
                    <div className="text-[11px] font-semibold tracking-widest">{weekday(d)}</div>
                    <div className="scoreboard mt-1 text-3xl font-bold">{dayOfMonth(d)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-5 grid h-11 place-items-center">
          {sim.reason ? (
            <span className="font-display text-lg tracking-widest text-ink" data-testid="sim-reason">
              {INTERRUPT_LABEL[sim.reason].toUpperCase()}
            </span>
          ) : (
            <button
              onClick={stopSim}
              disabled={sim.stopping}
              className="pb-btn bg-card px-6 text-sm tracking-widest text-ink min-h-[40px]"
              data-testid="sim-stop"
            >
              {sim.stopping ? "STOPPING…" : "STOP"}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
