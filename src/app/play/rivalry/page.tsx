"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Crest } from "@/components/art/Crest";
import { PlayerPortrait } from "@/components/art/PlayerPortrait";
import { MemoryCard } from "@/components/game/MemoryCard";
import { IntensityBar, rivalHref } from "@/components/game/RivalCards";
import { Badge, Card, Empty, PageTitle, Stat } from "@/components/ui";
import { formatTurnDate } from "@/engine/calendar";
import { causeSummary, headToHeadLine, intensityLabel, primaryRival, raceStanding, rivalsByIntensity, storyline } from "@/engine/career/rivalry/engine";
import { clubName, countryName } from "@/engine/data/world";
import { POSITION_LABEL } from "@/engine/players/attributes";
import { ageOf } from "@/engine/players/generate";
import type { RivalEvent } from "@/engine/types";
import { useGameState } from "@/game/store";

const EVENT_ICON: Record<RivalEvent["kind"], string> = {
  formed: "⚔️", meeting: "🤝", race: "🥾", award: "🥇", transfer: "✈️", intl: "🌍", incident: "🟥", media: "📰", record: "📈", cooled: "❄️", ended: "🏁",
};

function Detail() {
  const g = useGameState();
  const params = useSearchParams();
  if (!g) return null;
  const all = rivalsByIntensity(g);
  if (!all.length) {
    return (
      <div className="grid gap-4">
        <PageTitle kicker="Career" title="Rivalries" className="-mb-1" />
        <Empty title="No rivals yet" icon="⚔️">
          Rivalries are not handed out. They grow from finals, derbies, a Golden Boot race, an award decided by a whisker, or a fight for the same shirt.
        </Empty>
      </div>
    );
  }
  const id = params.get("id");
  const rv = all.find((r) => r.playerId === id) ?? primaryRival(g) ?? all[0];
  const p = g.players[rv.playerId];
  const race = raceStanding(g, rv);
  const h = rv.h2h;
  const memorable = [...rv.meetings].sort((a, b) => b.weight - a.weight).slice(0, 5);
  const battles = rv.events.filter((e) => ["award", "race", "record"].includes(e.kind)).reverse();
  const moves = rv.events.filter((e) => ["transfer", "incident", "intl"].includes(e.kind)).reverse();
  const memories = g.user.memories.filter((m) => m.kind === "rivalry" && m.data?.rival === rv.playerId).sort((a, b) => b.importance - a.importance);
  return (
    <div className="grid gap-4">
      <PageTitle kicker="Career rival" title={rv.name} className="-mb-1" />
      {all.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {all.map((r) => (
            <Link key={r.playerId} href={rivalHref(r.playerId)} className={`pb-btn px-3 py-1 text-sm ${r.playerId === rv.playerId ? "bg-sun" : "bg-card"}`}>
              {r.name}
            </Link>
          ))}
        </div>
      )}
      <Card tone="coral">
        <div className="flex flex-wrap items-center gap-4">
          {p && <PlayerPortrait appearance={p.look} age={ageOf(p, g.season)} size={110} />}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="coral">{intensityLabel(rv.intensity)}</Badge>
              <Badge>{rv.status === "active" ? "Active" : rv.status === "dormant" ? "Dormant" : "Over"}</Badge>
              {primaryRival(g)?.playerId === rv.playerId && <Badge tone="sun">Main rival</Badge>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              {rv.clubId && <Crest clubId={rv.clubId} size={22} />}
              <b>{rv.clubId ? clubName(rv.clubId) : "No club"}</b>
              {p && <span className="text-ink-2">· {POSITION_LABEL[p.position]} · {ageOf(p, g.season)} · {countryName(p.nationality)}</span>}
            </div>
            <div className="mt-2 max-w-md"><IntensityBar value={rv.intensity} /></div>
            <p className="mt-2 text-sm font-semibold">{storyline(g, rv)}</p>
            <p className="text-xs text-ink-2">{causeSummary(rv)} Since {formatTurnDate(rv.since.season, rv.since.turn)}.</p>
          </div>
        </div>
      </Card>

      <Card title="Head to head">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Stat label="Meetings" value={h.meetings} />
          <Stat label="Your wins" value={h.wins} tone="pitch" />
          <Stat label="Draws" value={h.draws} />
          <Stat label="Their wins" value={h.losses} tone="coral" />
          <Stat label="Goals (you–them)" value={`${h.myGoals}–${h.theirGoals}`} />
        </div>
        <p className="mt-2 text-xs text-muted">{headToHeadLine(rv)}</p>
        {race && race.rank <= 5 && (
          <p className="mt-2 text-sm font-semibold">This season&apos;s scoring table: you {race.mine} (#{race.rank}), {rv.name.split(" ").slice(-1)[0]} {race.theirs} (#{race.theirRank}).</p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Memorable matches">
          {memorable.length ? (
            <ul className="grid gap-2 text-sm">
              {memorable.map((m) => (
                <li key={m.fixtureId} className="rounded-xl border-2 border-line bg-card p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <b>{m.score[0]}–{m.score[1]}</b>
                    <Badge tone={m.result === "win" ? "pitch" : m.result === "loss" ? "coral" : "paper"}>{m.result === "win" ? "Win" : m.result === "loss" ? "Loss" : "Draw"}</Badge>
                    <span className="text-xs text-ink-2">{m.compName}{m.stage ? ` · ${m.stage}` : ""} · {formatTurnDate(m.season, m.turn)}</span>
                  </div>
                  <div className="text-xs text-ink-2">You {m.myGoals} goal{m.myGoals === 1 ? "" : "s"}, {rv.name.split(" ").slice(-1)[0]} {m.theirGoals}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No meetings on record yet.</p>
          )}
        </Card>
        <Card title="Awards, races and records">
          {battles.length ? (
            <ul className="grid gap-1.5 text-sm">
              {battles.map((e, i) => (
                <li key={i}>
                  <span className="mr-1">{EVENT_ICON[e.kind]}</span>
                  {e.text} <span className="text-xs text-muted">{formatTurnDate(e.season, e.turn)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing decided between you yet.</p>
          )}
          {moves.length > 0 && (
            <>
              <div className="mb-1 mt-3 text-xs font-black uppercase tracking-wider text-muted">Transfers and incidents</div>
              <ul className="grid gap-1.5 text-sm">
                {moves.map((e, i) => (
                  <li key={i}>
                    <span className="mr-1">{EVENT_ICON[e.kind]}</span>
                    {e.text} <span className="text-xs text-muted">{formatTurnDate(e.season, e.turn)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      {memories.length > 0 && (
        <Card title="Rivalry memories">
          <div className="grid gap-2">
            {memories.map((m) => (
              <MemoryCard key={m.id} g={g} m={m} />
            ))}
          </div>
        </Card>
      )}

      <Card title="Timeline">
        <ol className="grid gap-1.5 border-l-2 border-line/40 pl-3 text-sm">
          {[...rv.events].reverse().map((e, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[17px] top-1.5 h-2 w-2 rounded-full bg-coral" />
              <span className="mr-2 text-[11px] font-bold uppercase tracking-wide text-muted">{formatTurnDate(e.season, e.turn)}</span>
              {EVENT_ICON[e.kind]} {e.text}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

export default function RivalryPage() {
  return (
    <Suspense fallback={null}>
      <Detail />
    </Suspense>
  );
}
