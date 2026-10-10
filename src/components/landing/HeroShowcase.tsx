"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { SCENES, SceneSprites } from "./art";

const SLIDE_MS = 4200;
const DESKTOP_QUERY = "(min-width: 1024px)";
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
const HERO_INDEX = 1;

function useMedia(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return matches;
}

/**
 * Illustrated career reel. It is vector art driven by CSS, not video: nothing is downloaded and the timer only runs
 * when the stage is on a desktop-width screen, on screen, in a visible tab, and the visitor hasn't asked for less motion.
 */
export function HeroShowcase({ playerName }: { playerName?: string }) {
  const name = (playerName?.trim().split(/\s+/).slice(-1)[0] ?? "").toUpperCase().slice(0, 12) || "PITCHBORN";
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(HERO_INDEX);
  const [userChoice, setUserChoice] = useState<boolean | null>(null);
  const [inView, setInView] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const desktop = useMedia(DESKTOP_QUERY);
  const reduced = useMedia(REDUCED_QUERY);

  const wantsPlay = userChoice ?? !reduced;
  const running = wantsPlay && desktop && inView && tabVisible;

  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onVis = () => setTabVisible(document.visibilityState === "visible");
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Re-armed whenever `active` changes, so picking a panel restarts the countdown instead of racing the old one.
  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => setActive((i) => (i + 1) % SCENES.length), SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [running, active]);

  const toggle = useCallback(() => setUserChoice(!wantsPlay), [wantsPlay]);

  return (
    <div
      ref={root}
      className="relative hidden aspect-[5/4] w-full grid-cols-[minmax(0,1fr)_minmax(0,27%)] gap-3 rounded-[1.75rem] border-[3px] border-line bg-[#173126] p-3 shadow-[6px_6px_0_var(--shadow)] lg:grid"
      role="group"
      aria-label="Illustrated career moments"
    >
      <SceneSprites name={name} />

      <div className="relative min-h-0 overflow-hidden rounded-[1.2rem] border-2 border-[#1b1712] bg-[#0f2119]">
        {SCENES.map((sc, i) => (
          <svg
            key={sc.key}
            viewBox="0 0 400 300"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden
            focusable="false"
            className={`pb-stage-scene absolute inset-0 h-full w-full ${i === active ? "is-active" : ""}`}
            data-running={running && i === active ? "true" : "false"}
          >
            <use href={`#pbs-${sc.key}`} />
          </svg>
        ))}
        <p className="sr-only">{SCENES[active].caption}</p>
        <button
          type="button"
          onClick={toggle}
          aria-pressed={!wantsPlay}
          aria-label={wantsPlay ? "Pause career animation" : "Play career animation"}
          className="absolute bottom-3 left-3 grid h-11 w-11 place-items-center rounded-full border-2 border-[#1b1712] bg-[#fff5e6] text-[#1b1712] shadow-[2px_2px_0_#1b1712] transition-transform hover:-translate-y-px focus-visible:outline-offset-2"
        >
          {wantsPlay ? (
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <path d="M3 2h3.5v12H3zM9.5 2H13v12H9.5z" fill="currentColor" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <path d="M4 2l10 6-10 6z" fill="currentColor" />
            </svg>
          )}
        </button>
        <span className="absolute bottom-3 right-3 rounded-lg border-2 border-[#1b1712] bg-[#fff5e6] px-2.5 py-1 font-display text-sm uppercase tracking-wide text-[#1b1712]">
          {SCENES[active].label}
        </span>
      </div>

      <ol className="grid min-h-0 grid-rows-5 gap-2.5">
        {SCENES.map((sc, i) => (
          <li key={sc.key} className="min-h-0">
            <button
              type="button"
              onClick={() => setActive(i)}
              aria-label={`${sc.label}: show this career moment`}
              aria-current={i === active ? "true" : undefined}
              className={`group relative block h-full w-full overflow-hidden rounded-xl border-2 bg-[#0f2119] transition-[transform,box-shadow] motion-safe:hover:-translate-y-px ${
                i === active ? "border-[#ffc62b] shadow-[0_0_0_2px_#ffc62b]" : "border-[#1b1712] opacity-90 hover:opacity-100"
              }`}
            >
              <svg viewBox={sc.thumb} preserveAspectRatio="xMidYMid slice" aria-hidden focusable="false" className="absolute inset-0 h-full w-full">
                <use href={`#pbs-${sc.key}`} />
              </svg>
              <span className="absolute left-1.5 top-1.5 -rotate-2 rounded-md border-2 border-[#1b1712] bg-[#fff5e6] px-1.5 py-0.5 font-display text-[11px] uppercase leading-none tracking-wide text-[#1b1712]">
                {sc.label}
              </span>
              {i === active && (
                <span className="absolute inset-x-0 bottom-0 h-1 bg-[#1b1712]/60" aria-hidden>
                  <span key={active} className="pb-progress block h-full origin-left bg-[#ffc62b]" data-running={running ? "true" : "false"} style={{ animationDuration: `${SLIDE_MS}ms` }} />
                </span>
              )}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
