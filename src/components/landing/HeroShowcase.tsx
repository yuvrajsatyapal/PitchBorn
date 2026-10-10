"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ShowcaseArt } from "./ShowcaseArt";
import { STAGES } from "./stages";

const SLIDE_MS = 3500;
const FADE_MS = 900;
// The showcase needs room beside the headline; below this width it is not mounted at all (no images, timers or observers).
const SHOW_QUERY = "(min-width: 1024px)";
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

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

/** Wrapper keeps the footprint (no layout shift on hydration) and is display:none below lg; the reel mounts only when it is shown. */
export function HeroShowcase() {
  const show = useMedia(SHOW_QUERY);
  return <div className="hidden w-full lg:block">{show ? <Reel /> : <div className="aspect-[7/6]" aria-hidden />}</div>;
}

function Reel() {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  // The scene we just left keeps its push-in running while it fades, so it never snaps back mid-dissolve.
  const [leaving, setLeaving] = useState<number[]>([]);
  const [userChoice, setUserChoice] = useState<boolean | null>(null);
  const [inView, setInView] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const reduced = useMedia(REDUCED_QUERY);

  const wantsPlay = userChoice ?? !reduced;
  const running = wantsPlay && inView && tabVisible;

  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onVis = () => setTabVisible(document.visibilityState === "visible");
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const go = useCallback((next: number) => {
    const prev = activeRef.current;
    if (prev === next) return;
    activeRef.current = next;
    setActive(next);
    setLeaving((l) => [...l.filter((i) => i !== next && i !== prev), prev]);
    window.setTimeout(() => setLeaving((l) => l.filter((i) => i !== prev)), FADE_MS + 100);
  }, []);

  // Re-armed whenever `active` changes, so picking a stage restarts the countdown instead of racing the old one.
  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => go((active + 1) % STAGES.length), SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [running, active, go]);

  // Pointer parallax writes CSS variables straight to the element: no re-render per mouse move.
  const frame = useRef(0);
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = stage.current;
    if (!el || reduced || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width - 0.5) * 2;
    const py = ((e.clientY - r.top) / r.height - 0.5) * 2;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.setProperty("--px", px.toFixed(3));
      el.style.setProperty("--py", py.toFixed(3));
    });
  };
  const onPointerLeave = () => {
    cancelAnimationFrame(frame.current);
    stage.current?.style.setProperty("--px", "0");
    stage.current?.style.setProperty("--py", "0");
  };
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const toggle = useCallback(() => setUserChoice(!wantsPlay), [wantsPlay]);
  const current = STAGES[active];

  return (
    <div
      ref={root}
      className="relative w-full rounded-[1.75rem] border-[3px] border-line bg-[#173126] p-2.5 shadow-[6px_6px_0_var(--shadow)]"
      role="group"
      aria-roledescription="carousel"
      aria-label="Career stages"
    >
      <div
        ref={stage}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        className="relative aspect-[7/5] overflow-hidden rounded-[1.2rem] border-2 border-[#1b1712] bg-[#0b1a13] [--px:0] [--py:0]"
      >
        {STAGES.map((s, i) => {
          const live = i === active || leaving.includes(i);
          return (
            <div
              key={s.key}
              aria-hidden
              className={`pb-scene absolute inset-0 ${i === active ? "is-active" : ""} ${live ? "is-live" : ""}`}
              data-running={running && live ? "true" : "false"}
              style={{ "--glow": s.glow, "--origin": s.origin } as React.CSSProperties}
            >
              <div className="pb-parallax absolute inset-0">
                <div className="pb-push absolute inset-0">
                  <ShowcaseArt stage={s.key} variant="main" eager={i === 0} className="h-full w-full object-cover" style={{ objectPosition: s.position }} />
                </div>
              </div>
              <span className="pb-glow" />
            </div>
          );
        })}
        <span className="pb-vignette" aria-hidden />
        <span className="pb-grain" aria-hidden />
        <p className="sr-only" aria-live="polite">
          {current.label}: {current.caption}
        </p>
        <button
          type="button"
          onClick={toggle}
          aria-pressed={!wantsPlay}
          aria-label={wantsPlay ? "Pause career animation" : "Play career animation"}
          className="absolute bottom-3 left-3 grid h-10 w-10 place-items-center rounded-full border-2 border-[#1b1712] bg-[#fff5e6] text-[#1b1712] shadow-[2px_2px_0_#1b1712] transition-transform hover:-translate-y-px focus-visible:outline-offset-2"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
            {wantsPlay ? <path d="M3 2h3.5v12H3zM9.5 2H13v12H9.5z" fill="currentColor" /> : <path d="M4 2l10 6-10 6z" fill="currentColor" />}
          </svg>
        </button>
      </div>

      <ol className="mt-2.5 grid grid-cols-5 gap-2">
        {STAGES.map((s, i) => (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => go(i)}
              aria-label={`${s.label}: show this career moment`}
              aria-current={i === active ? "true" : undefined}
              className={`relative block aspect-[16/10] w-full overflow-hidden rounded-lg border-2 bg-[#0b1a13] transition-[transform,box-shadow,opacity] motion-safe:hover:-translate-y-px ${
                i === active ? "border-[#e8b93f] shadow-[0_0_0_2px_#e8b93f]" : "border-[#1b1712] opacity-75 hover:opacity-100"
              }`}
            >
              <ShowcaseArt stage={s.key} variant="thumb" className="h-full w-full object-cover" style={{ objectPosition: s.position }} />
              <span className="pb-grain" aria-hidden />
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0b1a13]/90 to-transparent px-1.5 pb-1 pt-4 text-left font-display text-[11px] uppercase leading-none tracking-wide text-[#fff5e6] xl:text-xs"
              >
                {s.label}
              </span>
              {i === active && (
                <span className="absolute inset-x-0 bottom-0 h-1 bg-[#1b1712]/60" aria-hidden>
                  <span
                    key={active}
                    className="pb-progress block h-full origin-left bg-[#e8b93f]"
                    data-running={running ? "true" : "false"}
                    style={{ animationDuration: `${SLIDE_MS}ms` }}
                  />
                </span>
              )}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
