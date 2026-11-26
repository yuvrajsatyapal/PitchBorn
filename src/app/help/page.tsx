"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PublicFooter, PublicHeader } from "@/components/app/PublicHeader";
import { PageTitle, Tabs } from "@/components/ui";
import { HELP_SECTIONS, encyclopedia, searchHelp, type HelpSection } from "@/engine/help/encyclopedia";

export default function HelpPage() {
  const entries = useMemo(() => encyclopedia(), []);
  const [q, setQ] = useState("");
  const [section, setSection] = useState<HelpSection | "All">("All");
  const shown = searchHelp(entries, q, section);
  return (
    <div className="min-h-dvh">
      <PublicHeader />
      <main id="main" className="mx-auto max-w-4xl px-4 pb-16">
        <PageTitle kicker="Encyclopedia" title="How PitchBorn works">
          Attributes, traits, weather and every career system, in a sentence or two each.
        </PageTitle>
        <label className="mb-3 grid gap-1 text-sm font-bold">
          Search
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. stamina, sponsor, false nine, frozen pitch"
            className="rounded-xl border-2 border-line bg-card px-3 py-2.5 text-base font-normal"
            data-testid="help-search"
          />
        </label>
        <Tabs compact value={section} onChange={setSection} items={(["All", ...HELP_SECTIONS] as const).map((s) => ({ id: s, label: s }))} />
        <p className="mt-2 text-xs text-muted" aria-live="polite">
          {shown.length} {shown.length === 1 ? "entry" : "entries"}
        </p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {shown.map((e) => (
            <div key={e.id} className="pb-card-flat p-3" data-testid="help-entry">
              <dt className="flex items-baseline justify-between gap-2">
                <span className="font-display text-lg leading-tight">{e.title}</span>
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-muted">{e.section}</span>
              </dt>
              <dd className="mt-1 text-sm text-ink-2">
                {e.body}
                {e.link && (
                  <>
                    {" "}
                    <Link href={e.link.href} className="font-bold underline">
                      {e.link.label} ›
                    </Link>
                  </>
                )}
              </dd>
            </div>
          ))}
        </dl>
        {!shown.length && <p className="mt-6 text-center text-sm text-ink-2">Nothing matches “{q}”. Try a shorter word.</p>}
      </main>
      <PublicFooter />
    </div>
  );
}
