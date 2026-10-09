"use client";
import { useId, useState } from "react";
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
export function RatingChart({ matches, size = "compact", average, label = "Match ratings", variant = "bars" }: { matches: ChartMatch[]; size?: "compact" | "large"; average?: number; label?: string; variant?: "bars" | "line" }) {
  const [active, setActive] = useState<number | null>(null);
  const h = size === "large" ? 168 : variant === "line" ? 128 : 96;
  // The line chart always has a match in the detail strip: the latest until you point at another.
  const shown = active ?? (variant === "line" ? matches.length - 1 : null);
  const cur = shown !== null ? matches[shown] ?? null : null;
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
  if (variant === "line") return <LineChart matches={matches} size={size} average={average} label={label} h={h} active={active} setActive={setActive} cur={cur} shown={shown} />;
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


/** Monotone cubic through the points (no overshoot past a real rating), as an SVG path in percentage units. */
function smoothPath(pts: [number, number][]): string {
  const n = pts.length;
  const dx = pts.slice(1).map((p, i) => p[0] - pts[i][0]);
  const sl = pts.slice(1).map((p, i) => (p[1] - pts[i][1]) / dx[i]);
  const m = pts.map((_, i) => (i === 0 ? sl[0] : i === n - 1 ? sl[n - 2] : sl[i - 1] * sl[i] <= 0 ? 0 : (sl[i - 1] + sl[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (sl[i] === 0) m[i] = m[i + 1] = 0;
    else {
      const a = m[i] / sl[i];
      const b = m[i + 1] / sl[i];
      const k = a * a + b * b;
      if (k > 9) {
        const t = 3 / Math.sqrt(k);
        m[i] = t * a * sl[i];
        m[i + 1] = t * b * sl[i];
      }
    }
  }
  let d = `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const w = dx[i] / 3;
    d += ` C${(pts[i][0] + w).toFixed(2)} ${(pts[i][1] + m[i] * w).toFixed(2)} ${(pts[i + 1][0] - w).toFixed(2)} ${(pts[i + 1][1] - m[i + 1] * w).toFixed(2)} ${pts[i + 1][0].toFixed(2)} ${pts[i + 1][1].toFixed(2)}`;
  }
  return d;
}

const DOT_FILL: Record<RatingBand, string> = { poor: "bg-coral", average: "bg-sun", good: "bg-pitch/70", excellent: "bg-pitch" };

/** A rating trend as a smooth line over a tight, data-fitted scale, with a dot per game coloured by its band. */
function LineChart({ matches, size, average, label, h, active, setActive, cur, shown }: {
  matches: ChartMatch[]; size: "compact" | "large"; average?: number; label: string; h: number;
  active: number | null; setActive: (i: number | null) => void; cur: ChartMatch | null; shown: number | null;
}) {
  const gid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const n = matches.length;
  const ratings = matches.map((m) => m.rating);
  const lo = Math.max(LO, Math.min(6, Math.floor(Math.min(...ratings) - 0.4)));
  const hi = Math.min(HI, Math.max(8, Math.ceil(Math.max(...ratings) + 0.4)));
  const y = (r: number) => 100 - Math.max(0, Math.min(100, ((r - lo) / (hi - lo)) * 100));
  const xs = (i: number) => ((i + 0.5) / n) * 100;
  const pts = matches.map((m, i) => [xs(i), y(m.rating)] as [number, number]);
  const line = smoothPath(pts);
  const area = `${line} L${pts[n - 1][0].toFixed(2)} 100 L${pts[0][0].toFixed(2)} 100 Z`;
  const ticks = Array.from({ length: hi - Math.ceil(lo) + 1 }, (_, i) => Math.ceil(lo) + i);
  const best = Math.max(...ratings);
  const latest = matches[n - 1];
  const prev = matches[n - 2];
  const delta = latest.rating - prev.rating;
  return (
    <div data-testid="rating-chart">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
        <span>Latest <b className="tabular-nums text-ink">{latest.rating.toFixed(1)}</b>{" "}
          <span className={delta > 0.05 ? "font-bold text-pitch" : delta < -0.05 ? "font-bold text-coral" : "text-muted"}>{delta > 0.05 ? "▲" : delta < -0.05 ? "▼" : "▬"} {Math.abs(delta).toFixed(1)}</span>
        </span>
        <span>Best <b className="tabular-nums text-ink">{best.toFixed(1)}</b></span>
        {average !== undefined && average > 0 && <span>Average <b className="tabular-nums text-ink">{average.toFixed(2)}</b></span>}
      </div>
      <div className="relative" style={{ height: h }} role="group" aria-label={label}>
        <div className="absolute inset-y-0 left-6 right-1">
          {ticks.map((r) => (
            <div key={r} className="pointer-events-none absolute inset-x-0" style={{ top: `${y(r)}%` }}>
              <span className="absolute -left-6 w-5 -translate-y-1/2 text-right text-[10px] font-bold text-muted">{r}</span>
              <span className={`block w-full ${r === 7 ? "border-t border-dashed border-muted/70" : "border-t border-dotted border-muted/30"}`} />
            </div>
          ))}
          <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id={`${gid}a`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--sky)" stopOpacity="0.38" />
                <stop offset="1" stopColor="var(--sky)" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <path d={area} fill={`url(#${gid}a)`} />
            <path d={line} fill="none" stroke="var(--line)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity="0.35" />
            <path d={line} fill="none" stroke="var(--sky)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {average !== undefined && average > 0 && average >= lo && average <= hi && (
            <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-ink/60" style={{ top: `${y(average)}%` }} title={`Average ${average.toFixed(2)}`} />
          )}
          {shown !== null && (
            <div className="pointer-events-none absolute inset-y-0 w-px bg-ink/25" style={{ left: `${xs(shown)}%` }} />
          )}
          {matches.map((m, i) => {
            const band = ratingBand(m.rating);
            const on = shown === i;
            return (
              <button
                key={m.key}
                type="button"
                className="group absolute inset-y-0 focus-visible:outline-offset-[-2px]"
                style={{ left: `${(i / n) * 100}%`, width: `${100 / n}%` }}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                onClick={() => setActive(active === i ? null : i)}
                aria-label={`${teamLabel(m.opponent, true)}, rated ${m.rating.toFixed(1)}${m.goals ? `, ${m.goals} goal${m.goals > 1 ? "s" : ""}` : ""}${m.assists ? `, ${m.assists} assist${m.assists > 1 ? "s" : ""}` : ""}`}
              >
                <span
                  className={`absolute left-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-line transition-[width,height] ${DOT_FILL[band]} ${on ? "h-[18px] w-[18px] ring-2 ring-sky" : "h-3 w-3 group-hover:h-4 group-hover:w-4"}`}
                  style={{ top: `${y(m.rating)}%` }}
                />
                {(m.goals > 0 || m.assists > 0) && size === "large" && (
                  <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-[11px] leading-none" style={{ top: `calc(${y(m.rating)}% - 26px)` }} aria-hidden>
                    {"⚽".repeat(Math.min(m.goals, 3))}
                    {m.assists > 0 ? "🅰" : ""}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-2 min-h-[2.6rem] rounded-lg border-2 border-line/20 bg-paper-2/60 px-2 py-1 text-xs" aria-live="polite" data-testid="rating-detail">
        {cur && (
          <>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <b className="tabular-nums">{cur.rating.toFixed(1)}</b>
              <span className="min-w-0 truncate font-semibold">vs {teamLabel(cur.opponent, true)}</span>
              <span className="text-muted">{formatTurnDate(cur.season, cur.turn).replace(/ \d{4}$/, "")}</span>
              {cur.comp && <span className="text-muted">· {cur.comp}</span>}
              {shown === n - 1 && active === null && <span className="rounded-full bg-sky/20 px-1.5 text-[10px] font-bold uppercase text-sky">Latest</span>}
            </div>
            <div className="text-ink-2">
              {cur.result ? `${cur.result} · ` : ""}
              {cur.minutes !== undefined ? `${cur.minutes}′ · ` : ""}
              {cur.started === false ? "from the bench · " : ""}
              {cur.goals} goal{cur.goals === 1 ? "" : "s"} · {cur.assists} assist{cur.assists === 1 ? "" : "s"}
            </div>
          </>
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted" aria-hidden>
        {(Object.keys(BAND_STYLE) as RatingBand[]).map((b) => (
          <span key={b} className="inline-flex items-center gap-1">
            <span className={`inline-block h-2.5 w-2.5 rounded-full border border-line ${BAND_STYLE[b].fill}`} />
            {BAND_STYLE[b].label} {b === "poor" ? "<6" : b === "average" ? "6–6.9" : b === "good" ? "7–7.9" : "8+"}
          </span>
        ))}
        <span className="inline-flex items-center gap-1"><span className="inline-block w-4 border-t-2 border-dashed border-ink/60" />Average</span>
      </div>
    </div>
  );
}
