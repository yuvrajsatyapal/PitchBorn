import Link from "next/link";
import { Logo } from "@/components/art/Logo";

export function PublicHeader() {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
      <Link href="/" className="flex items-center gap-2">
        <Logo size={40} />
        <span className="font-display text-3xl">Pitchborn</span>
      </Link>
      <nav className="flex items-center gap-2 text-sm font-bold">
        <Link href="/saves" className="rounded-full border-2 border-line bg-card px-3 py-1.5">
          My saves
        </Link>
        <Link href="/credits" className="hidden rounded-full px-3 py-1.5 hover:bg-paper-2 sm:inline">
          Credits
        </Link>
      </nav>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="mx-auto mt-16 max-w-6xl border-t-2 border-line px-4 py-8 text-sm text-ink-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>
          <b className="font-display text-base text-ink">Pitchborn</b> — a free football career simulator. Players are fictional; club and league data from open sources.
        </span>
        <span className="flex gap-4">
          <Link href="/credits" className="underline">
            Data sources
          </Link>
          <Link href="/privacy" className="underline">
            Privacy
          </Link>
        </span>
      </div>
    </footer>
  );
}
