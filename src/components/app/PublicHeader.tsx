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

const CONNECT_LINKS = [
  {
    label: "GitHub",
    href: "https://github.com/yuvrajsatyapal",
    path: "M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z",
  },
  {
    label: "Email",
    href: "mailto:yuvrajsatyapal21@gmail.com",
    path: "M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1.6 2L12 12.6 19.4 7H4.6ZM20 8.7l-8 6-8-6V17h16V8.7Z",
  },
  {
    label: "Portfolio",
    href: "https://github.com/yuvrajsatyapal",
    path: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.9 9h-3.1a15.7 15.7 0 0 0-1.3-5.5A8 8 0 0 1 18.9 11ZM12 4.1c.8 1 1.6 3 1.8 6.9h-3.6c.2-3.9 1-5.9 1.8-6.9ZM9.5 5.5A15.7 15.7 0 0 0 8.2 11H5.1a8 8 0 0 1 4.4-5.5ZM5.1 13h3.1c.1 2.2.6 4.1 1.3 5.5A8 8 0 0 1 5.1 13Zm6.9 6.9c-.8-1-1.6-3-1.8-6.9h3.6c-.2 3.9-1 5.9-1.8 6.9Zm2.5-1.4c.7-1.4 1.2-3.3 1.3-5.5h3.1a8 8 0 0 1-4.4 5.5Z",
  },
];

export function PublicFooter({ wide = false }: { wide?: boolean }) {
  return (
    <footer
      className={`${container(wide)} mt-10 border-t-2 border-line py-4 text-sm text-ink-2`}
    >
      <div className="flex items-center justify-between gap-x-4">
        <div>
          <div
            className="group flex flex-wrap items-baseline gap-x-3"
            tabIndex={0}
          >
            <b className="font-display text-xl leading-tight text-ink">
              PitchBorn
            </b>
            <p className="hidden w-full text-xs transition-opacity group-hover:block group-focus:block sm:block sm:w-auto sm:text-sm sm:opacity-0 duration-200 group-hover:opacity-100 group-focus:opacity-100">
              A free football career simulator. Players are fictional; club and
              league data from open sources.
            </p>
          </div>
          <p className="mt-2 flex flex-wrap gap-x-4 sm:mt-0">
            <Link href="/credits" className="pb-hit underline">
              Data sources &amp; licences
            </Link>
            <Link href="/privacy" className="pb-hit underline">
              Privacy
            </Link>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
          <span className="text-xs font-bold uppercase tracking-widest text-muted">
            Connect
          </span>
          <div className="flex items-center gap-3">
            {CONNECT_LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                aria-label={l.label}
                target="_blank"
                rel="noopener noreferrer"
                className="pb-hit grid place-items-center text-ink-2 hover:text-ink"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-6 w-6"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d={l.path} />
                </svg>
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
