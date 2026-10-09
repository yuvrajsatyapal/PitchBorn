"use client";
import { useState } from "react";
import { formatTurnDate } from "@/engine/calendar";
import { RATING_SCALE, ratingBand, type RatingBand } from "@/engine/stats/analytics";
import { teamLabel } from "@/game/selectors";

export interface ChartMatch {
  key: string;
  season: number;
  turn: number;
  rating: number;
  opponent: string;
  comp?: string;
  minutes?: number;
  goals: number;
  assists: number;
  /** "W 2–1" style, when the score is known. */
  result?: string;
  started?: boolean;
}

const BAND_STYLE: Record<RatingBand, { fill: string; label: string }> = {
  poor: { fill: "bg-coral", label: "Poor" },
  average: { fill: "bg-sun", label: "Average" },
  good: { fill: "bg-pitch/55", label: "Good" },
  excellent: { fill: "bg-pitch", label: "Excellent" },
};

const [LO, HI] = RATING_SCALE;
const pct = (r: number) => Math.max(4, Math.min(100, ((r - LO) / (HI - LO)) * 100));

/**
 * The match-rating chart, one column per rated game on a fixed 4–10 scale (so 6.0 and 8.5 are clearly different),
 * coloured by band. The column details appear on hover, focus or tap in a reserved strip, so nothing jumps.
 */
export function RatingChart({ matches, size = "compact", average, label = "Match ratings" }: { matches: ChartMatch[]; size?: "compact" | "large"; average?: number; label?: string }) {
  const [active, setActive] = useState<number | null>(null);
  const h = size === "large" ? 168 : 96;
  const cur = active !== null ? matches[active] : null;
  if (matches.length < 2) {
    return (
      <div className="rounded-xl border-2 border-dashed border-line/40 p-3 text-xs text-muted" data-testid="rating-chart-empty">
        {matches.length === 0 ? "No rated appearances yet: your ratings will chart here after your first match." : "One rated appearance so far: a trend needs at least two."}
        {matches.length === 1 && (
          <div className="mt-1 text-ink-2">
            Last match: <b className="tabular-nums">{matches[0].rating.toFixed(1)}</b> vs {teamLabel(matches[0].opponent, true)}
          </div>
        )}
      </div>
    );
  }
  return (
    <div data-testid="rating-chart">
      <div className="relative" style={{ height: h }} role="group" aria-label={label}>
        {/* Reference lines: the average display (6.6) and a good one (8). */}
        {[6, 7, 8].map((r) => (
          <div key={r} className="pointer-events-none absolute inset-x-0 flex items-center" style={{ bottom: `${pct(r)}%` }}>
            <span className="w-5 text-[10px] font-bold text-muted">{r}</span>
            <span className={`h-px flex-1 ${r === 7 ? "border-t border-dashed border-muted/70" : "border-t border-dotted border-muted/40"}`} />
          </div>
        ))}
        {average !== undefined && average > 0 && (
          <div className="pointer-events-none absolute inset-x-5 z-10 border-t-2 border-dashed border-ink/70" style={{ bottom: `${pct(average)}%` }} title={`Average ${average.toFixed(2)}`} />
        )}
        <div className="absolute inset-y-0 left-5 right-0 flex items-end gap-1 sm:gap-1.5">
          {matches.map((m, i) => {
            const band = ratingBand(m.rating);
            return (
              <button
                key={m.key}
                type="button"
                className="group relative flex h-full min-w-0 flex-1 items-end focus-visible:outline-offset-1"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                onClick={() => setActive(active === i ? null : i)}
                aria-label={`${teamLabel(m.opponent, true)}, rated ${m.rating.toFixed(1)}${m.goals ? `, ${m.goals} goal${m.goals > 1 ? "s" : ""}` : ""}${m.assists ? `, ${m.assists} assist${m.assists > 1 ? "s" : ""}` : ""}`}
              >
                <span
                  className={`block w-full rounded-t-md border-2 border-line ${BAND_STYLE[band].fill} ${active === i ? "ring-2 ring-sky" : ""}`}
                  style={{ height: `${pct(m.rating)}%` }}
                />
                {(m.goals > 0 || m.assists > 0) && size === "large" && (
                  <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-[11px] leading-none" style={{ bottom: `calc(${pct(m.rating)}% + 2px)` }} aria-hidden>
                    {"⚽".repeat(Math.min(m.goals, 3))}
                    {m.assists > 0 ? "🅰" : ""}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-1 min-h-[2.6rem] rounded-lg border-2 border-line/20 bg-paper-2/60 px-2 py-1 text-xs" aria-live="polite" data-testid="rating-detail">
        {cur ? (
          <>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <b className="tabular-nums">{cur.rating.toFixed(1)}</b>
              <span className="min-w-0 truncate font-semibold">vs {teamLabel(cur.opponent, true)}</span>
              <span className="text-muted">{formatTurnDate(cur.season, cur.turn).replace(/ \d{4}$/, "")}</span>
              {cur.comp && <span className="text-muted">· {cur.comp}</span>}
            </div>
            <div className="text-ink-2">
              {cur.result ? `${cur.result} · ` : ""}
              {cur.minutes !== undefined ? `${cur.minutes}′ · ` : ""}
              {cur.started === false ? "from the bench · " : ""}
              {cur.goals} goal{cur.goals === 1 ? "" : "s"} · {cur.assists} assist{cur.assists === 1 ? "" : "s"}
            </div>
          </>
        ) : (
          <span className="text-muted">Tap or hover a bar for the match. Scale {LO}–{HI}; dashed line = average.</span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted" aria-hidden>
        {(Object.keys(BAND_STYLE) as RatingBand[]).map((b) => (
          <span key={b} className="inline-flex items-center gap-1">
            <span className={`inline-block h-2.5 w-2.5 rounded-sm border border-line ${BAND_STYLE[b].fill}`} />
            {BAND_STYLE[b].label} {b === "poor" ? "<6" : b === "average" ? "6–6.9" : b === "good" ? "7–7.9" : "8+"}
          </span>
        ))}
      </div>
    </div>
  );
}
