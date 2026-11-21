import { conditionsNote, PITCH_LABEL, WEATHER_ICON, WEATHER_LABEL } from "@/engine/weather/describe";
import type { MatchConditions } from "@/engine/types";

/** The Match Day forecast: weather, temperature, pitch and what it means for the game. */
export function ConditionsForecast({ c, className = "" }: { c: MatchConditions; className?: string }) {
  return (
    <div className={`flex items-start gap-3 rounded-2xl border-2 border-line bg-sky-2 px-3 py-2 ${className}`} data-testid="conditions-forecast">
      <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 border-line bg-card text-xl">{WEATHER_ICON[c.weather]}</span>
      <div className="min-w-0">
        <div className="text-[11px] font-black uppercase tracking-wider text-muted">Forecast</div>
        <div className="flex flex-wrap items-baseline gap-x-2 font-bold leading-tight">
          <span>{WEATHER_LABEL[c.weather]}</span>
          <span className="scoreboard text-sm">{Math.round(c.tempC)}°C</span>
          <span className="text-sm text-ink-2">{PITCH_LABEL[c.pitch]}</span>
        </div>
        <p className="text-xs text-ink-2">{conditionsNote(c)}</p>
      </div>
    </div>
  );
}

/** A compact chip for the scoreboard and the full-time card (both sit on a dark background). */
export function ConditionsChip({ c, className = "" }: { c: MatchConditions; className?: string }) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 truncate rounded-full border border-sun/40 px-2 py-0.5 text-[11px] font-bold text-sun/90 ${className}`}
      title={conditionsNote(c)}
      aria-label={`Conditions: ${WEATHER_LABEL[c.weather]}, ${Math.round(c.tempC)} degrees, ${PITCH_LABEL[c.pitch].toLowerCase()}`}
      data-testid="conditions-chip"
    >
      <span aria-hidden>{WEATHER_ICON[c.weather]}</span>
      <span>{WEATHER_LABEL[c.weather]}</span>
      <span className="scoreboard">{Math.round(c.tempC)}°</span>
      {c.pitch !== "good" && <span className="opacity-80">· {PITCH_LABEL[c.pitch].replace(" pitch", "")}</span>}
    </span>
  );
}
