import type { Metadata } from "next";
import { PublicFooter, PublicHeader } from "@/components/app/PublicHeader";
import { InlineAdSlot } from "@/ads/AdSlot";
import { WORLD } from "@/engine/data/world";
import assets from "@/data/assets.json";

export const metadata: Metadata = { title: "Data sources & credits" };

export default function Credits() {
  return (
    <div className="min-h-dvh">
      <PublicHeader />
      <main className="mx-auto max-w-4xl px-4">
        <h1 className="mb-2 font-display text-4xl">Data sources & credits</h1>
        <p className="mb-6 text-ink-2">
          Pitchborn uses open football facts so the world feels real, and creates everything else itself. All players are fictional. All ratings, potentials,
          market values and development curves are Pitchborn&apos;s own — nothing is copied from commercial games or proprietary databases.
        </p>
        <section className="pb-card mb-5 p-5">
          <h2 className="mb-3 font-display text-2xl">Football data</h2>
          <p className="mb-3 text-sm text-ink-2">
            Dataset {WORLD.version} · snapshot fetched {new Date(WORLD.generatedAt).toLocaleDateString()} · {WORLD.clubs.length} clubs, {WORLD.stadiums.length} stadiums, {WORLD.leagues.length} leagues,{" "}
            {WORLD.history.length} historical seasons.
          </p>
          <ul className="grid gap-3">
            {WORLD.sources.map((s) => (
              <li key={s.id} className="rounded-xl border-2 border-line p-3 text-sm">
                <a href={s.url} className="font-bold underline" rel="noopener noreferrer" target="_blank">{s.name}</a> — {s.license}
                <div className="text-ink-2">{s.usage}</div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Club and league names are used factually to identify real organisations; Pitchborn is not affiliated with or endorsed by any club, league or federation. League
            membership reflects the best available open data for the 2026/27 season; lower divisions marked as abstractions are simplified to one table.
          </p>
        </section>
        <section className="pb-card mb-5 p-5">
          <h2 className="mb-3 font-display text-2xl">Visual assets</h2>
          <h3 className="font-bold">Original Pitchborn assets</h3>
          <ul className="mb-3 list-disc pl-5 text-sm">
            {assets.original.map((a) => <li key={a.id}><b>{a.name}</b> — {a.description}</li>)}
          </ul>
          <h3 className="font-bold">Third-party (licensed)</h3>
          <ul className="mb-3 list-disc pl-5 text-sm">
            {assets.thirdParty.map((a) => (
              <li key={a.id}>
                <a href={a.url} className="font-semibold underline" target="_blank" rel="noopener noreferrer">{a.name}</a> by {a.author} — {a.license}. {a.usage}
              </li>
            ))}
          </ul>
          <h3 className="font-bold">Deliberately not bundled</h3>
          <ul className="list-disc pl-5 text-sm">
            {assets.notBundled.map((a) => <li key={a.id}><b>{a.name}</b> — {a.reason}</li>)}
          </ul>
        </section>
        <InlineAdSlot placementId="footer" />
      </main>
      <PublicFooter />
    </div>
  );
}
