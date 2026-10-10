"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/art/Logo";

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const read = () => {
      const t = document.documentElement.dataset.theme;
      setDark(t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches);
    };
    read();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);

  const toggle = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("pb-theme", next);
    } catch {}
    setDark(!dark);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={dark}
      className="grid h-11 w-11 place-items-center rounded-full border-2 border-line bg-card shadow-[2px_2px_0_var(--shadow)] transition-transform hover:-translate-y-px"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {dark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        )}
      </svg>
    </button>
  );
}

const container = (wide?: boolean) => `mx-auto ${wide ? "max-w-7xl" : "max-w-6xl"} px-4`;

export function PublicHeader({ wide = false }: { wide?: boolean }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <header className={`${container(wide)} relative z-30 py-4`}>
      <div ref={menuRef} className="flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2" aria-label="PitchBorn home">
          <Logo size={40} />
          <span className="font-display text-2xl sm:text-3xl">PitchBorn</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 text-sm font-bold md:flex">
          <Link href="/saves" className="mx-1 rounded-full border-2 border-line bg-card px-4 py-2.5 shadow-[2px_2px_0_var(--shadow)] transition-transform hover:-translate-y-px">
            My saves
          </Link>
          <Link href="/credits" className="mx-1 rounded-full px-3.5 py-2.5 hover:bg-paper-2">
            Credits
          </Link>
          <ThemeToggle />
        </nav>

        <div className="flex items-center gap-2 md:hidden">
        <ThemeToggle />
        <button
          type="button"
          className="grid h-11 w-11 place-items-center rounded-xl border-2 border-line bg-card"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="public-menu"
          onClick={() => setOpen((o) => !o)}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
            {open ? <path d="M5 5l12 12M17 5L5 17" /> : <path d="M3 6h16M3 11h16M3 16h16" />}
          </svg>
        </button>
        </div>

        {open && (
          <nav id="public-menu" aria-label="Main" className="pb-card anim-pop absolute inset-x-4 top-full mt-1 flex flex-col gap-1 p-2 text-base font-bold md:hidden">
            {[{ href: "/saves", label: "My saves" }, { href: "/credits", label: "Credits" }].map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 hover:bg-paper-2">
                {l.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}

export function PublicFooter({ wide = false }: { wide?: boolean }) {
  return (
    <footer className={`${container(wide)} mt-16 border-t-2 border-line py-8 text-sm text-ink-2`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>
          <b className="font-display text-base text-ink">PitchBorn</b> — a free football career simulator. Players are fictional; club and league data from open sources.
        </span>
        <span className="flex gap-4">
          <Link href="/credits" className="pb-hit underline">
            Data sources &amp; licences
          </Link>
          <Link href="/privacy" className="pb-hit underline">
            Privacy
          </Link>
        </span>
      </div>
    </footer>
  );
}
