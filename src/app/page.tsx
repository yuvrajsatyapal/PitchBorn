"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PublicFooter, PublicHeader } from "@/components/app/PublicHeader";
import { CareerArc } from "@/components/landing/CareerArc";
import { ClubTicker } from "@/components/landing/ClubTicker";
import { FeatureCards } from "@/components/landing/FeatureCards";
import { HeroShowcase } from "@/components/landing/HeroShowcase";
import { LinkButton } from "@/components/ui";
import { WORLD } from "@/engine/data/world";
import { listSaves } from "@/persistence/saves";
import type { SaveMeta } from "@/persistence/db";

const KIT_CLUB_ID = WORLD.clubs.filter((c) => c.prestige > 70)[3]?.id;

export default function Landing() {
  const [latest, setLatest] = useState<SaveMeta | null>(null);
  useEffect(() => {
    listSaves()
      .then((s) => setLatest(s[0] ?? null))
      .catch(() => setLatest(null));
  }, []);
  return (
    <div className="min-h-dvh">
      <PublicHeader wide />
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4">
        <section aria-labelledby="hero-title" className="grid items-center gap-6 py-2 sm:py-6 lg:grid-cols-[minmax(0,45fr)_minmax(0,55fr)] lg:gap-10 xl:gap-12">
          <div>
            <span className="inline-block -rotate-2 rounded-lg border-2 border-line bg-card px-2.5 py-1 text-xs font-black uppercase tracking-widest shadow-[3px_3px_0_var(--shadow)]">
              Free · No account · Plays offline
            </span>
            <h1 id="hero-title" className="mt-5 font-display text-[2.9rem] leading-[0.95] sm:text-7xl lg:text-[4.4rem] xl:text-[5.4rem]">
              Your Career.
              <br />
              Your Choices.
              <br />
              <span className="text-pitch">Your Legacy.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-2 sm:text-lg">
              From a 17-year-old academy hopeful to a retired legend. Train, play, negotiate, move clubs, win trophies, pull on your country&apos;s shirt — then
              watch the body slow down. Every career writes its own story across {WORLD.clubs.length} clubs in {WORLD.leagues.length} leagues.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <LinkButton href="/new" size="lg" className="w-full sm:w-auto">
                Start a career ▸
              </LinkButton>
              {latest && (
                <LinkButton href="/saves" size="lg" tone="paper" className="w-full sm:w-auto">
                  Continue {latest.playerName.split(" ")[1] ?? latest.playerName}
                </LinkButton>
              )}
            </div>
          </div>
          <HeroShowcase />
        </section>

        <ClubTicker />
        <FeatureCards />
        <CareerArc kitClubId={KIT_CLUB_ID} />

        <p className="mt-2 text-center text-sm text-ink-2">
          Club, stadium and league facts come from open data (Wikidata, OpenFootball). All players are fictional; all ratings are PitchBorn&apos;s own.{" "}
          <Link href="/credits" className="underline">
            Sources &amp; licences
          </Link>
        </p>
      </main>
      <PublicFooter wide />
    </div>
  );
}
