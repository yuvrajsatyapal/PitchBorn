"use client";
import Link from "next/link";
import { Crest } from "@/components/art/Crest";
import { Flag } from "@/components/art/Flag";
import { Portrait } from "@/components/art/Portrait";
import { PlayIdentityCard } from "@/components/game/PlayIdentity";
import { IconicShowcase } from "@/components/game/IconicShowcase";
import { Card, LinkButton, PageTitle, Stat, Table } from "@/components/ui";
import { seasonLabel } from "@/engine/calendar";
import { LEGACY_TIERS } from "@/engine/career/legacy";
import { clubName } from "@/engine/data/world";
import { avgRating } from "@/engine/players/generate";
import { name, user } from "@/game/selectors";
import { useGameState } from "@/game/store";

export default function Legacy() {
  const g = useGameState();
  if (!g) return null;
  const p = user(g);
  const legacy = g.user.legacy;
  if (!legacy) {
    return (
      <Card title="Still writing the story">
        <p className="mb-3 text-sm">Your legacy is calculated when you retire.</p>
        <LinkButton href="/play">Back to dashboard</LinkButton>
      </Card>
    );
  }
  const clubs = [...new Set(p.history.filter((h) => h.clubId && h.stats.apps > 0).map((h) => h.clubId as string))];
  const max = Math.max(...LEGACY_TIERS.map((t) => t[0]), legacy.score) || 1;
  return (
    <div className="grid gap-4">
      <PageTitle kicker="End of an era" title="Career Legacy" />
      <section className="pb-card relative overflow-hidden bg-plum p-6 text-white sm:p-10">
        <div className="pointer-events-none absolute -right-12 -top-12 h-52 w-52 rounded-full border-[3px] border-line bg-sun opacity-90" aria-hidden />
        <div className="relative flex flex-wrap items-center gap-6">
          <Portrait look={p.look} size={120} kit="#ffc62b" />
          <div>
            <div className="text-xs font-black uppercase tracking-[0.25em] opacity-80">Pitchborn legacy</div>
            <h2 className="font-display text-4xl leading-none sm:text-6xl">{name(p)}</h2>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <Flag code={p.nationality} /> {p.position} · {seasonLabel(g.user.startSeason)} – {seasonLabel(g.user.retiredSeason ?? g.season)}
            </div>
            {legacy.identity && <div className="mt-2 text-sm font-bold capitalize opacity-90">Remembered as a {legacy.identity.label}</div>}
            <div className="mt-4 flex items-end gap-3">
              <span className="scoreboard rounded-xl border-2 border-line bg-black px-4 py-1 text-5xl text-sun">{Math.round(legacy.score)}</span>
              <span className="font-display text-3xl">{legacy.tier}</span>
            </div>
          </div>
        </div>
      </section>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Appearances" value={p.career.apps} />
        {p.position === "GK" ? (
          <>
            <Stat label="Clean sheets" value={p.career.cleanSheets} tone="pitch" />
            <Stat label="Saves" value={p.career.saves} tone="sky" />
          </>
        ) : (
          <>
            <Stat label="Goals" value={p.career.goals} tone="pitch" />
            <Stat label="Assists" value={p.career.assists} tone="sky" />
          </>
        )}
        <Stat label="Trophies" value={g.user.trophies.length} tone="sun" />
        <Stat label="Caps" value={p.intl.caps} />
        <Stat label="Peak OVR" value={g.user.peakOverall} tone="plum" />
      </div>
      <PlayIdentityCard g={g} p={p} title="How you played" />
      <IconicShowcase g={g} limit={6} final title="Iconic Moments" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="The story">
          <ul className="grid gap-2">
            {legacy.stories.map((s) => (
              <li key={s} className="rounded-xl border-2 border-line bg-sun-2 px-3 py-2 text-sm font-semibold">{s}</li>
            ))}
          </ul>
          <div className="mt-4 text-xs font-black uppercase text-muted">Clubs</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {clubs.map((c) => (
              <span key={c} className="flex items-center gap-1.5 rounded-full border-2 border-line bg-card px-2 py-1 text-sm">
                <Crest clubId={c} size={18} /> {clubName(c, true)}
              </span>
            ))}
          </div>
        </Card>
        <Card title="Legacy breakdown">
          <ul className="grid gap-1.5">
            {legacy.breakdown.map((b) => (
              <li key={b.label} className="text-sm">
                <div className="flex justify-between"><span>{b.label}</span><b>+{b.points}</b></div>
                <div className="h-2 rounded-full bg-paper-2"><div className="h-full rounded-full bg-plum" style={{ width: `${Math.min(100, (b.points / max) * 300)}%` }} /></div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-1 text-[11px] text-muted">
            {[...LEGACY_TIERS].reverse().map(([min, t]) => <span key={t} className={t === legacy.tier ? "font-black text-ink" : ""}>{t} {min}+ ·</span>)}
          </div>
        </Card>
      </div>
      <Card title="Season by season">
        <Table>
          <thead><tr><th>Season</th><th>Club</th><th className="text-right">Age</th><th className="text-right">OVR</th><th className="text-right">Apps</th><th className="text-right">G</th><th className="text-right">A</th><th className="text-right">Avg</th></tr></thead>
          <tbody>
            {p.history.map((h) => (
              <tr key={h.season}>
                <td>{seasonLabel(h.season)}</td>
                <td><span className="flex items-center gap-1.5"><Crest clubId={h.clubId} size={16} /> {clubName(h.clubId, true)}</span></td>
                <td className="text-right">{h.age}</td>
                <td className="text-right">{h.overall}</td>
                <td className="text-right">{h.stats.apps}</td>
                <td className="text-right font-bold">{h.stats.goals}</td>
                <td className="text-right">{h.stats.assists}</td>
                <td className="text-right">{h.stats.apps ? avgRating(h.stats).toFixed(2) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <div className="flex flex-wrap gap-2">
        <Link href="/play/history" className="pb-btn bg-card px-5">Full timeline</Link>
        <LinkButton href="/new" tone="pitch">Start a new career ▸</LinkButton>
      </div>
    </div>
  );
}
