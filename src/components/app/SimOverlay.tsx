"use client";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { INTERRUPT_LABEL } from "@/engine/season/interrupts";
import { useGame } from "@/game/store";

const DAY_MS = 86_400_000;
/** Cards either side of the highlighted one; the strip clips what is out of view. */
const REACH = 4;
const CARD_W = 72;
const GAP = 8;

const dateOf = (day: number) => new Date(day * DAY_MS);
const weekday = (day: number) => dateOf(day).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }).toUpperCase();
const dayOfMonth = (day: number) => dateOf(day).getUTCDate();
const monthLabel = (day: number) => dateOf(day).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).toUpperCase();

/** Full-screen "Simulating…" strip: the days slide under a fixed highlight until the run reaches the day that stopped it. */
export function SimOverlay() {
  const sim = useGame((s) => s.sim);
  const stopSim = useGame((s) => s.stopSim);

  useEffect(() => {
    if (!sim) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && stopSim();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [!!sim, stopSim]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!sim) return null;
  const days = Array.from({ length: REACH * 2 + 1 }, (_, i) => sim.day - REACH + i);
  const timing = sim.ease ? "cubic-bezier(0.2, 0.7, 0.3, 1)" : "linear";
  const transition = `transform ${sim.stepMs}ms ${timing}, background-color ${sim.stepMs}ms linear, color ${sim.stepMs}ms linear`;

  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center bg-ink/50 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="Simulating" data-testid="sim-overlay">
      <div className="pb-card w-full max-w-[460px] p-5 text-ink">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl tracking-wide">SIMULATING…</h2>
          <span className="text-xs font-semibold tracking-widest text-muted" data-testid="sim-month">
            {monthLabel(sim.day)}
          </span>
        </div>
        <div className="relative mt-5 h-28 overflow-hidden py-1" aria-live="off">
          {days.map((d) => {
            const offset = d - sim.day;
            const current = offset === 0;
            return (
              <div
                key={d}
                data-current={current || undefined}
                className={`absolute left-1/2 top-1 grid h-[calc(100%-0.5rem)] place-items-center rounded-2xl motion-reduce:!transition-none ${current ? "border-2 border-line bg-sun text-[#1b1712] shadow-[3px_3px_0_var(--shadow)]" : "border-2 border-line/20 bg-paper-2 text-muted"}`}
                style={{ width: CARD_W, marginLeft: -CARD_W / 2, transform: `translateX(${offset * (CARD_W + GAP)}px)`, transition }}
              >
                <div className="text-center leading-tight">
                  <div className="text-[11px] font-semibold tracking-widest">{weekday(d)}</div>
                  <div className="scoreboard mt-1 text-3xl font-bold">{dayOfMonth(d)}</div>
                </div>
              </div>
            );
          })}
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
