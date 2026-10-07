"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { SidebarAdSlot } from "@/ads/AdSlot";
import { Logo } from "@/components/art/Logo";
import { Crest } from "@/components/art/Crest";
import { Button, LinkButton, Modal } from "@/components/ui";
import { formatTurnDate, isTransferWindow, phaseOf, seasonLabel, weeksToNewYear, weeksToNextMonth, windowName } from "@/engine/calendar";
import { BALANCE } from "@/engine/balance";
import { clubName } from "@/engine/data/world";
import { useGame, useGameState } from "@/game/store";
import { NAV } from "./nav";
import { OfflineBadge } from "./OfflineBadge";

function ContinueButton({ compact = false }: { compact?: boolean }) {
  const game = useGameState();
  const advance = useGame((s) => s.advance);
  const busy = useGame((s) => s.busy);
  const router = useRouter();
  const pathname = usePathname();
  if (!game) return null;
  if (game.user.retired) {
    return (
      <LinkButton href="/play/legacy" tone="plum" size={compact ? "sm" : "md"}>
        View legacy
      </LinkButton>
    );
  }
  const pending = game.pending.length;
  const decisions = game.user.decisions.length;
  if (pending) {
    return (
      <Button tone="coral" size={compact ? "sm" : "md"} onClick={() => router.push("/play/match")} disabled={pathname === "/play/match/"} data-testid="matchday">
        <span aria-hidden>⚽</span>
        <span className="hidden sm:inline">Match day{pending > 1 ? ` (${pending})` : ""}</span>
        <span className="sm:hidden">Match</span>
      </Button>
    );
  }
  return (
    <Button tone="sun" size={compact ? "sm" : "md"} onClick={() => advance(1)} disabled={!!busy} data-testid="continue">
      {busy ? "…" : decisions ? "Continue ⚑" : "Continue ▸"}
    </Button>
  );
}

function SimMenu() {
  const game = useGameState();
  const advance = useGame((s) => s.advance);
  const busy = useGame((s) => s.busy);
  const [open, setOpen] = useState(false);
  if (!game || game.user.retired) return null;
  const C = BALANCE.calendar;
  const toNewYear = weeksToNewYear(game.season, game.turn);
  const afterEnd = game.turn > C.endOfSeasonTurn;
  // Before the season ends, no option runs past it: the summer tournament and transfer window stay ahead of you.
  const toEnd = C.endOfSeasonTurn - game.turn + 1;
  const fits = (weeks: number) => afterEnd || weeks < toEnd;
  const options: { label: string; weeks: number }[] = [];
  const month = weeksToNextMonth(game.season, game.turn);
  if (fits(month)) options.push({ label: "1 month", weeks: month });
  if (toNewYear !== null && game.turn <= C.endOfSeasonTurn && fits(toNewYear)) options.push({ label: "To winter break (1 Jan)", weeks: toNewYear });
  options.push(
    afterEnd
      ? { label: "To next season", weeks: C.turnsPerSeason - game.turn + 1 }
      : { label: "To season end", weeks: toEnd },
  );
  return (
    <>
      <Button tone="paper" size="sm" onClick={() => setOpen(true)} disabled={!!busy} aria-label="Simulate several weeks" title="Simulate ahead">
        <span className="font-black">»</span>
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Simulate ahead">
        <p className="mb-4 text-sm text-ink-2">
          Your matches are quick-simmed with sensible decisions. Simulation only stops early if your career ends; open decisions fall back to their default and offers may lapse.
        </p>
        <div className="grid gap-2">
          {options.map((o) => (
            <Button
              key={o.label}
              tone="sun"
              onClick={async () => {
                setOpen(false);
                await advance(o.weeks);
              }}
            >
              {o.label}
            </Button>
          ))}
        </div>
      </Modal>
    </>
  );
}

function TopBar() {
  const game = useGameState();
  const busy = useGame((s) => s.busy);
  if (!game) return null;
  const u = game.players[game.user.playerId];
  const phase = phaseOf(game.turn);
  const win = windowName(game.turn);
  return (
    <header className="sticky top-0 z-30 border-b-2 border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1800px] items-center gap-3 px-3 py-2 sm:px-5">
        <Link href="/play" className="flex items-center gap-2 lg:hidden" aria-label="Dashboard">
          <Logo size={32} />
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          <Crest clubId={u.clubId} size={34} />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-bold">{clubName(u.clubId, true)}</div>
            <div className="scoreboard truncate text-[11px] text-muted">
              {formatTurnDate(game.season, game.turn)}<span className="hidden min-[420px]:inline"> · {seasonLabel(game.season)}</span> · W{game.turn}
            </div>
          </div>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <span className="rounded-full border-2 border-line bg-card px-2 py-0.5 text-[11px] font-bold uppercase">{phase === "season" ? "Season" : phase === "end" ? "Season finale" : phase === "summer" ? "Summer" : "Pre-season"}</span>
          {win && isTransferWindow(game.turn) && <span className="rounded-full border-2 border-line bg-plum-2 px-2 py-0.5 text-[11px] font-bold">{win === "summer" ? "Summer" : "January"} window</span>}
          <OfflineBadge />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {busy && <span className="hidden text-xs font-semibold text-muted sm:inline">{busy}</span>}
          <SimMenu />
          <ContinueButton compact />
        </div>
      </div>
    </header>
  );
}

function SideNav() {
  const pathname = usePathname() ?? "";
  const game = useGameState();
  const offers = game?.user.offers.filter((o) => o.status === "terms" || o.status === "club-pending").length ?? 0;
  return (
    <nav aria-label="Game" className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r-2 border-line bg-paper-2/60 p-3 lg:flex">
      <Link href="/" className="mb-4 flex items-center gap-2 px-2 pt-1">
        <Logo size={34} />
        <span className="font-display text-2xl">Pitchborn</span>
      </Link>
      <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {NAV.map((n) => {
          const active = n.href === "/play" ? pathname === "/play/" || pathname === "/play" : pathname.startsWith(n.href);
          return (
            <li key={n.href}>
              <Link
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-xl border-2 px-2.5 py-1.5 text-sm font-semibold transition ${active ? "border-line bg-sun shadow-[2px_2px_0_var(--shadow)] text-[#1b1712]" : "border-transparent hover:border-line/30 hover:bg-card"}`}
              >
                <span aria-hidden>{n.icon}</span>
                {n.label}
                {n.href === "/play/transfers" && offers > 0 && <span className="ml-auto rounded-full bg-coral px-1.5 text-[11px] font-black text-[#1b1712]">{offers}</span>}
              </Link>
            </li>
          );
        })}
        {game?.user.retired && (
          <li>
            <Link href="/play/legacy" className="flex items-center gap-2.5 rounded-xl border-2 border-line bg-plum-2 px-2.5 py-1.5 text-sm font-bold">
              🏛️ Legacy
            </Link>
          </li>
        )}
      </ul>
      <div className="mt-2 px-2 text-[11px] text-muted">
        <Link href="/credits" className="underline">
          Data sources & credits
        </Link>
      </div>
    </nav>
  );
}

function BottomNav() {
  const pathname = usePathname() ?? "";
  const [more, setMore] = useState(false);
  const game = useGameState();
  const items = NAV.filter((n) => n.mobile);
  return (
    <>
      <nav aria-label="Game" className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-line bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ul className="grid grid-cols-5">
          {items.map((n) => {
            const active = n.href === "/play" ? pathname === "/play/" || pathname === "/play" : pathname.startsWith(n.href);
            return (
              <li key={n.href}>
                <Link href={n.href} aria-current={active ? "page" : undefined} className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-bold ${active ? "text-ink" : "text-muted"}`}>
                  <span className={`text-lg ${active ? "scale-110" : ""}`} aria-hidden>
                    {n.icon}
                  </span>
                  {n.label.split(" ")[0]}
                </Link>
              </li>
            );
          })}
          <li>
            <button onClick={() => setMore(true)} className="flex min-h-[56px] w-full flex-col items-center justify-center gap-0.5 text-[11px] font-bold text-muted">
              <span className="text-lg" aria-hidden>
                ☰
              </span>
              More
            </button>
          </li>
        </ul>
      </nav>
      <Modal open={more} onClose={() => setMore(false)} title="Menu">
        <ul className="grid grid-cols-2 gap-2">
          {[...NAV.filter((n) => !n.mobile), ...(game?.user.retired ? [{ href: "/play/legacy", label: "Legacy", icon: "🏛️" }] : []), { href: "/credits", label: "Credits", icon: "ℹ️" }].map((n) => (
            <li key={n.href}>
              <Link href={n.href} onClick={() => setMore(false)} className="flex min-h-[48px] items-center gap-2 rounded-xl border-2 border-line bg-card px-3 text-sm font-bold">
                <span aria-hidden>{n.icon}</span>
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}

export function GameShell({ children }: { children: ReactNode }) {
  const game = useGameState();
  const loadActive = useGame((s) => s.loadActive);
  const busy = useGame((s) => s.busy);
  const error = useGame((s) => s.error);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    loadActive().finally(() => setChecked(true));
  }, [loadActive]);

  if (!game) {
    return (
      <div className="grid min-h-screen place-items-center p-6">
        {!checked || busy ? (
          <LoadingScreen label={busy ?? "Loading…"} />
        ) : (
          <div className="pb-card max-w-md p-6 text-center">
            <div className="mb-2 font-display text-3xl">No career loaded</div>
            <p className="mb-4 text-sm text-ink-2">{error ?? "Start a new career or continue one of your saves."}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <LinkButton href="/new">New career</LinkButton>
              <LinkButton href="/saves" tone="paper">
                My saves
              </LinkButton>
            </div>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="flex min-h-screen">
      <SideNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <div className="mx-auto flex w-full max-w-[1800px] flex-1 gap-6 px-3 pb-28 pt-4 sm:px-5 lg:pb-10">
          <main id="main" className="min-w-0 flex-1">
            {error && <div className="pb-card mb-4 bg-coral-2 p-3 text-sm">Something went wrong: {error}</div>}
            {children}
          </main>
          <div className="hidden w-[300px] shrink-0 min-[1440px]:block">
            <SidebarAdSlot />
          </div>
        </div>
      </div>
      <BottomNav />
      {busy && <BusyOverlay label={busy} />}
    </div>
  );
}

function BusyOverlay({ label }: { label: string }) {
  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-40 -translate-x-1/2 lg:bottom-6" role="status" aria-live="polite">
      <div className="pb-card flex items-center gap-2 px-4 py-2 text-sm font-bold">
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-line border-t-transparent" />
        {label}
      </div>
    </div>
  );
}

export function LoadingScreen({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-4" role="status">
      <div className="animate-bounce">
        <Logo size={64} />
      </div>
      <div className="scoreboard text-sm">{label}</div>
      <div className="h-3 w-48 overflow-hidden rounded-full border-2 border-line bg-paper-2">
        <div className="h-full w-1/2 animate-pulse bg-sun" />
      </div>
    </div>
  );
}
