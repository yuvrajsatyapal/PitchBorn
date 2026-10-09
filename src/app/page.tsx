"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Crest } from "@/components/art/Crest";
import { Kit } from "@/components/art/Kit";
import { PlayerPortrait } from "@/components/art/PlayerPortrait";
import { generateAppearance } from "@/engine/appearance/generate";
import { PublicFooter, PublicHeader } from "@/components/app/PublicHeader";
import { LinkButton } from "@/components/ui";
import { WORLD } from "@/engine/data/world";
import { listSaves } from "@/persistence/saves";
import type { SaveMeta } from "@/persistence/db";

const SAMPLE_LOOK = generateAppearance("pitchborn-home");
const STEPS = ["Academy", "Debut", "Breakthrough", "Transfer", "Champion", "International", "Prime", "Decline", "Legacy"];

export default function Landing() {
  const [latest, setLatest] = useState<SaveMeta | null>(null);
  useEffect(() => {
    listSaves()
      .then((s) => setLatest(s[0] ?? null))
      .catch(() => setLatest(null));
  }, []);
  const ticker = WORLD.clubs.filter((c) => c.prestige > 70).slice(0, 40);
  return (
    <div className="min-h-dvh">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4">
        <section className="pb-card relative mt-2 overflow-hidden bg-sun-2 px-5 py-10 sm:px-10 sm:py-16">
          <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full border-[3px] border-line bg-pitch opacity-90" aria-hidden />
          <div className="pointer-events-none absolute -right-2 top-20 hidden h-24 w-24 rotate-12 rounded-2xl border-[3px] border-line bg-coral sm:block" aria-hidden />
          <div className="relative max-w-2xl">
            <span className="inline-block -rotate-2 rounded-lg border-2 border-line bg-card px-2.5 py-1 text-xs font-black uppercase tracking-widest shadow-[3px_3px_0_var(--shadow)]">
              Free · No account · Plays offline
            </span>
            <h1 className="mt-5 font-display text-5xl leading-[0.95] sm:text-7xl">
              One player.
              <br />
              One whole <span className="text-pitch">football life.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-2">
              From a 17-year-old academy hopeful to a retired legend. Train, play, negotiate, move clubs, win trophies, pull on your country&apos;s shirt — then
              watch the body slow down. Every career writes its own story across {WORLD.clubs.length} real clubs in {WORLD.leagues.length} leagues.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <LinkButton href="/new" size="lg">
                Start a career ▸
              </LinkButton>
              {latest && (
                <LinkButton href={`/saves`} size="lg" tone="paper">
                  Continue {latest.playerName.split(" ")[1] ?? latest.playerName}
                </LinkButton>
              )}
            </div>
          </div>
        </section>

        <div className="my-6 overflow-hidden rounded-full border-2 border-line bg-ink py-2 text-paper" aria-hidden>
          <div className="anim-ticker flex w-max gap-8 whitespace-nowrap px-4">
            {[...ticker, ...ticker].map((c, i) => (
              <span key={i} className="flex items-center gap-2 text-sm font-bold">
                <Crest clubId={c.id} size={22} /> {c.name}
              </span>
            ))}
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            { t: "A living football world", d: "Five real football pyramids, cups, continental nights and summer tournaments. Thousands of players age, develop, transfer and retire around you.", tone: "bg-pitch-2" },
            { t: "A match engine with decisions", d: "Every match is simulated phase by phase. When the ball falls to you, you choose: shoot, take a touch, or square it.", tone: "bg-sky-2" },
            { t: "Choices that shape a career", d: "Loans, bids, contract talks, agents, managers, fans. Stay loyal, chase trophies or follow the money — and live with it.", tone: "bg-plum-2" },
          ].map((f) => (
            <div key={f.t} className={`pb-card p-5 ${f.tone}`}>
              <h2 className="font-display text-2xl">{f.t}</h2>
              <p className="mt-2 text-sm text-ink-2">{f.d}</p>
            </div>
          ))}
        </section>

        <section className="pb-card mt-6 p-5 sm:p-8">
          <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
            <div className="flex gap-2">
              <PlayerPortrait appearance={SAMPLE_LOOK} size={84} kit="#c8102e" />
              <Kit clubId={ticker[3]?.id} number={9} size={72} />
            </div>
            <div className="flex-1">
              <h2 className="font-display text-3xl">The arc of a career</h2>
              <ol className="mt-3 flex flex-wrap gap-2">
                {STEPS.map((s, i) => (
                  <li key={s} className="flex items-center gap-2 text-sm font-bold">
                    <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-line bg-sun text-xs text-[#1b1712]">{i + 1}</span>
                    {s}
                    {i < STEPS.length - 1 && <span aria-hidden>→</span>}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <p className="mt-6 text-center text-sm text-ink-2">
          Club, stadium and league facts come from open data (Wikidata, OpenFootball). All players are fictional; all ratings are Pitchborn&apos;s own.{" "}
          <Link href="/credits" className="underline">
            Sources & licences
          </Link>
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}
