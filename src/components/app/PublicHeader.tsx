"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/art/Logo";

const SECTION_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#clubs", label: "Clubs" },
  { href: "/#career", label: "Career" },
];

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
          {SECTION_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-full px-3.5 py-2.5 hover:bg-paper-2">
              {l.label}
            </Link>
          ))}
          <Link href="/saves" className="mx-1 rounded-full border-2 border-line bg-card px-4 py-2.5 shadow-[2px_2px_0_var(--shadow)] transition-transform hover:-translate-y-px">
            My saves
          </Link>
          <Link href="/credits" className="rounded-full px-3.5 py-2.5 hover:bg-paper-2">
            Credits
          </Link>
        </nav>

        <button
          type="button"
          className="grid h-11 w-11 place-items-center rounded-xl border-2 border-line bg-card md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="public-menu"
          onClick={() => setOpen((o) => !o)}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
            {open ? <path d="M5 5l12 12M17 5L5 17" /> : <path d="M3 6h16M3 11h16M3 16h16" />}
          </svg>
        </button>

        {open && (
          <nav id="public-menu" aria-label="Main" className="pb-card anim-pop absolute inset-x-4 top-full mt-1 flex flex-col gap-1 p-2 text-base font-bold md:hidden">
            {[{ href: "/saves", label: "My saves" }, ...SECTION_LINKS, { href: "/credits", label: "Credits" }].map((l) => (
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
