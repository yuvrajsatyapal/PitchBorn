"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { clubKit } from "@/components/art/clubKit";
import { Crest } from "@/components/art/Crest";
import { PlayerPortrait } from "@/components/art/PlayerPortrait";
import { Badge, Button, Card } from "@/components/ui";
import { seasonLabel } from "@/engine/calendar";
import { buildScenes, type Scene } from "@/engine/awards/ceremony";
import { careerHonours } from "@/engine/awards/honours";
import { PODIUM_TIMING, PODIUM_TIMING_REDUCED, hasPodiumReveal, inContention, podiumPlaces, schedulePodium } from "@/engine/awards/podium";
import { primaryRival } from "@/engine/career/rivalry/engine";
import { clubName } from "@/engine/data/world";
import { POSITION_LABEL } from "@/engine/players/attributes";
import { ageOf } from "@/engine/players/generate";
import type { AwardNominee, AwardResult, GameState, SeasonCeremony, TeamOfSeasonSlot } from "@/engine/types";

const TROPHY: Record<string, string> = { pots: "🏆", topscorer: "👟", topassist: "🎯", goldenglove: "🧤", ypots: "🌱", breakthrough: "🚀" };

const nameOf = (g: GameState, id: string) => (g.players[id] ? `${g.players[id].firstName} ${g.players[id].lastName}` : "Retired player");

function Face({ g, id, size }: { g: GameState; id: string; size: number }) {
  const p = g.players[id];
  if (!p) return null;
  const kit = clubKit(p.clubId, g.season);
  return <PlayerPortrait appearance={p.look} age={ageOf(p, g.season)} size={size} kit={kit} collar={kit.collar} />;
}

function ClubLine({ clubId }: { clubId: string | null }) {
  return (
    <span className="flex min-w-0 max-w-full items-center gap-1.5 text-xs text-ink-2">
      {clubId && <Crest clubId={clubId} size={14} />}
      <span className="truncate">{clubId ? clubName(clubId, true) : "Free agent"}</span>
    </span>
  );
}

function NomineeCard({ g, n, user, winner, rank }: { g: GameState; n: AwardNominee; user: boolean; winner?: boolean; rank?: number }) {
  return (
    <li className={`flex min-w-0 items-center gap-3 rounded-xl border-2 p-2.5 ${winner ? "border-line bg-sun-2" : "border-line bg-card"} ${user ? "ring-2 ring-sun" : ""}`}>
      {rank !== undefined && <span className="scoreboard w-5 shrink-0 text-center text-sm text-muted">{rank}</span>}
      <Face g={g} id={n.playerId} size={52} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5 font-bold">
          <span className="truncate">{nameOf(g, n.playerId)}</span>
          {user && <Badge tone="sun">You</Badge>}
        </span>
        <ClubLine clubId={n.clubId} />
        <span className="block text-xs text-ink-2">{POSITION_LABEL[n.position]} · {n.age} · {n.reason}</span>
      </span>
    </li>
  );
}

const byNameThenId = (g: GameState) => (a: AwardNominee, b: AwardNominee) => nameOf(g, a.playerId).localeCompare(nameOf(g, b.playerId)) || (a.playerId < b.playerId ? -1 : 1);

function Heading({ kicker, title, trophy }: { kicker: string; title: string; trophy?: string }) {
  return (
    <div className="mb-3 text-center">
      <div className="text-[11px] font-black uppercase tracking-widest text-muted">{kicker}</div>
      <h2 className="font-display text-3xl leading-tight sm:text-4xl">
        {trophy && <span aria-hidden className="mr-2">{trophy}</span>}
        {title}
      </h2>
    </div>
  );
}


const PLACE = { 3: { icon: "🥉", label: "3RD" }, 2: { icon: "🥈", label: "2ND" }, 1: { icon: "🏆", label: "1ST" } } as const;

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const q = window.matchMedia(REDUCED_QUERY);
      q.addEventListener("change", notify);
      return () => q.removeEventListener("change", notify);
    },
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}

/**
 * The podium reveal, as a pure picture of "how many places have been announced". The ranking is the stored order of
 * the nominees; this only decides what is on screen.
 */
export function PodiumStage({ g, r, revealed, uid }: { g: GameState; r: AwardResult; revealed: number; uid: string }) {
  const places = podiumPlaces(r.nominees.length);
  const latest = revealed > 0 ? places[revealed - 1] : null;
  const remaining = new Set(inContention(r.nominees.length, revealed));
  const finished = revealed >= places.length;
  const shown = r.nominees.slice(0, 4);
  const alphabetical = shown.map((n, i) => ({ n, i })).sort((a, b) => byNameThenId(g)(a.n, b.n));
  const kicker = `${r.scope} · ${r.tier === "major" ? "Major award" : "Special award"}`;
  return (
    <div data-testid="podium" data-revealed={revealed}>
      <Heading kicker={kicker} title={r.name} trophy={TROPHY[r.id]} />
      <div className="mx-auto min-h-[16rem] max-w-2xl" aria-live="polite">
        {latest === null && <p className="py-10 text-center text-sm font-semibold text-ink-2" data-testid="podium-wait">The envelope is opened…</p>}
        {latest !== null && latest !== 1 && (
          <div key={latest} className="anim-pop" data-testid={`podium-place-${latest}`}>
            <Card tone="paper" className="text-center">
              <div className="text-xs font-black uppercase tracking-widest text-muted">{PLACE[latest as 2 | 3].icon} {PLACE[latest as 2 | 3].label} PLACE</div>
              <div className="my-2 flex justify-center"><Face g={g} id={r.nominees[latest - 1].playerId} size={latest === 2 ? 96 : 76} /></div>
              <div className={`font-display leading-tight ${latest === 2 ? "text-2xl" : "text-xl"}`}>{nameOf(g, r.nominees[latest - 1].playerId)}</div>
              <div className="flex justify-center"><ClubLine clubId={r.nominees[latest - 1].clubId} /></div>
              <p className="mt-1 text-xs text-ink-2">{r.nominees[latest - 1].reason}</p>
            </Card>
          </div>
        )}
        {latest === 1 && (
          <div key="winner" className="anim-pop" data-testid="podium-place-1">
            <Card tone={r.nominees[0].playerId === uid ? "sun" : "paper"} className="border-4 text-center shadow-[6px_6px_0_var(--shadow)]">
              <div className="text-sm font-black uppercase tracking-widest">🏆 1ST — AND THE WINNER IS…</div>
              <div className="my-3 flex justify-center"><Face g={g} id={r.nominees[0].playerId} size={160} /></div>
              <div className="break-words font-display text-4xl uppercase leading-tight sm:text-5xl">{nameOf(g, r.nominees[0].playerId)}</div>
              <div className="mt-1 flex justify-center"><ClubLine clubId={r.nominees[0].clubId} /></div>
              <p className="mt-2 text-sm font-semibold">{r.nominees[0].reason}</p>
              {r.nominees[0].playerId === uid && <p className="mt-3 font-bold" data-testid="you-won">That&apos;s you — {r.name}!</p>}
              {r.nominees[0].playerId !== uid && r.nominees.some((n) => n.playerId === uid) && <p className="mt-3 text-sm font-semibold">You were in the running, but not this year.</p>}
              {r.nominees[0].playerId !== uid && primaryRival(g)?.playerId === r.nominees[0].playerId && <p className="mt-1 text-sm font-semibold">Your rival takes the honour.</p>}
            </Card>
          </div>
        )}
      </div>
      <p className="mx-auto mb-2 mt-4 max-w-2xl text-center text-[11px] font-black uppercase tracking-widest text-muted">{finished ? "The podium" : "Still in contention"}</p>
      <ul className="mx-auto grid max-w-2xl gap-2" data-testid="finalists">
        {alphabetical.map(({ n, i }) => {
          const placeIdx = i < 3 ? places.findIndex((p) => p === i + 1) : -1;
          const out = !remaining.has(i);
          const label = i >= 3 ? "Nominee" : placeIdx >= 0 && placeIdx < revealed ? `${PLACE[(i + 1) as 1 | 2 | 3].icon} ${PLACE[(i + 1) as 1 | 2 | 3].label}` : null;
          return (
            <li key={n.playerId} data-state={out ? "out" : "in"} className={`flex min-w-0 items-center gap-3 rounded-xl border-2 border-line p-2 transition-all duration-500 ${out ? "scale-[0.98] bg-paper-2 opacity-40" : "bg-card"} ${n.playerId === uid ? "ring-2 ring-sun" : ""}`}>
              <Face g={g} id={n.playerId} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{nameOf(g, n.playerId)}{n.playerId === uid ? " (You)" : ""}</span>
                <ClubLine clubId={n.clubId} />
              </span>
              {label && <Badge tone={i === 0 ? "sun" : "paper"}>{label}</Badge>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Runs the 3rd → 2nd → 1st sequence once, automatically. Restarts from 3rd if the scene is shown again. */
function PodiumScene({ g, r, uid, onDone }: { g: GameState; r: AwardResult; uid: string; onDone?: () => void }) {
  const [revealed, setRevealed] = useState(0);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    const places = podiumPlaces(r.nominees.length).length;
    return schedulePodium(places, reduced ? PODIUM_TIMING_REDUCED : PODIUM_TIMING, setRevealed, () => onDone?.());
    // The reveal is presentation only. The scene is keyed, so it starts from the beginning every time it is shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.id, r.leagueId, reduced]);
  return <PodiumStage g={g} r={r} revealed={revealed} uid={uid} />;
}

function AwardScene({ g, r, phase, uid, onPodiumDone }: { g: GameState; r: AwardResult; phase: "nominees" | "winner"; uid: string; onPodiumDone?: () => void }) {
  const kicker = `${r.scope} · ${r.tier === "statistical" ? "Statistical award" : r.tier === "special" ? "Special award" : "Major award"}`;
  if (phase === "nominees") {
    const list = [...r.nominees].sort(byNameThenId(g));
    return (
      <div key={`${r.id}-n`} className="anim-slide">
        <Heading kicker={kicker} title={r.name} trophy={TROPHY[r.id]} />
        <p className="mb-3 text-center text-sm text-ink-2">The nominees{hasPodiumReveal(r) ? " — the top three will be announced in turn" : ""}</p>
        <ul className="mx-auto grid max-w-2xl gap-2">
          {list.map((n) => <NomineeCard key={n.playerId} g={g} n={n} user={n.playerId === uid} />)}
        </ul>
      </div>
    );
  }
  if (hasPodiumReveal(r)) return <PodiumScene key={`${r.id}-p`} g={g} r={r} uid={uid} onDone={onPodiumDone} />;
  const w = r.nominees[0];
  const youWon = w.playerId === uid;
  const youNominated = r.nominees.some((n) => n.playerId === uid);
  const rival = primaryRival(g);
  const rivalHere = rival && r.nominees.some((n) => n.playerId === rival.playerId);
  return (
    <div key={`${r.id}-w`} className="anim-pop">
      <Heading kicker={kicker} title={r.name} trophy={TROPHY[r.id]} />
      <Card tone={youWon ? "sun" : "paper"} className="mx-auto max-w-2xl text-center">
        <div className="text-xs font-black uppercase tracking-widest text-muted">And the winner is…</div>
        <div className="my-3 flex justify-center"><Face g={g} id={w.playerId} size={140} /></div>
        <div className="font-display text-3xl leading-tight">{nameOf(g, w.playerId)}</div>
        <div className="mt-1 flex justify-center"><ClubLine clubId={w.clubId} /></div>
        <p className="mt-2 text-sm">{w.reason}</p>
        {r.tiebreak && <p className="mt-1 text-xs text-muted">Decided on the tie-break: {r.tiebreak}.</p>}
        {youWon && <p className="mt-3 font-bold" data-testid="you-won">That&apos;s you — {r.name}!</p>}
        {!youWon && youNominated && <p className="mt-3 text-sm font-semibold">You were in the running, but not this year.</p>}
        {!youWon && rivalHere && rival && rival.playerId === w.playerId && <p className="mt-1 text-sm font-semibold">Your rival takes the honour.</p>}
      </Card>
      {r.nominees.length > 1 && (
        <ul className="mx-auto mt-3 grid max-w-2xl gap-2">
          {r.nominees.slice(1).map((n, i) => <NomineeCard key={n.playerId} g={g} n={n} user={n.playerId === uid} rank={i + 2} />)}
        </ul>
      )}
    </div>
  );
}

/** Rows from the front: the XI laid out the way it would line up. */
const ROWS: string[][] = [["LW", "ST", "RW"], ["DM", "CM", "AM"], ["LB", "CB1", "CB2", "RB"], ["GK"]];

function TeamCard({ g, t, user }: { g: GameState; t: TeamOfSeasonSlot; user: boolean }) {
  return (
    <li className={`flex min-w-0 flex-col items-center gap-1 overflow-hidden rounded-xl border-2 border-line bg-card p-1.5 text-center sm:p-2 ${user ? "bg-sun-2 ring-2 ring-sun" : ""}`}>
      <Face g={g} id={t.playerId} size={44} />
      <span className="w-full truncate text-xs font-bold sm:text-sm">{nameOf(g, t.playerId)}</span>
      <span className="flex w-full min-w-0 justify-center"><ClubLine clubId={t.clubId} /></span>
      <span className="w-full truncate text-[11px] font-black uppercase tracking-wide text-muted sm:text-[11px]">{POSITION_LABEL[t.position]}</span>
      {user && <Badge tone="sun">You</Badge>}
    </li>
  );
}

function TeamScene({ g, c, uid }: { g: GameState; c: SeasonCeremony; uid: string }) {
  return (
    <div key="team" className="anim-slide">
      <Heading kicker={`${c.leagueName} · ${c.formation}`} title="Team of the Season" trophy="⭐" />
      <div className="mx-auto grid max-w-3xl gap-2">
        {ROWS.map((row, i) => {
          const slots = row.map((s) => c.team.find((t) => t.slot === s)).filter((t): t is TeamOfSeasonSlot => !!t);
          if (!slots.length) return null;
          return (
            <ul key={i} className="mx-auto grid w-full gap-2" style={{ gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))`, maxWidth: slots.length === 1 ? "11rem" : undefined }}>
              {slots.map((t) => <TeamCard key={t.slot} g={g} t={t} user={t.playerId === uid} />)}
            </ul>
          );
        })}
      </div>
    </div>
  );
}

/** What the night meant for the user. */
export function YourNight({ g, c }: { g: GameState; c: SeasonCeremony }) {
  const uid = g.user.playerId;
  const won = c.results.filter((r) => r.winnerId === uid);
  const noms = c.results.filter((r) => r.winnerId !== uid && r.nominees.some((n) => n.playerId === uid));
  const inTeam = c.team.find((t) => t.playerId === uid);
  const rival = primaryRival(g);
  const rivalWon = rival ? c.results.filter((r) => r.winnerId === rival.playerId) : [];
  const nothing = !won.length && !noms.length && !inTeam;
  return (
    <div key="yours" className="anim-slide">
      <Heading kicker={`${seasonLabel(c.season)} · ${c.leagueName}`} title="Your night" trophy="🎖️" />
      <Card className="mx-auto max-w-2xl" tone={won.length ? "sun" : undefined}>
        {won.length > 0 && (
          <ul className="grid gap-1.5">
            {won.map((r) => (
              <li key={r.id} className="flex items-center gap-2 font-bold"><span aria-hidden>{TROPHY[r.id] ?? "🏆"}</span> {r.name} <span className="text-xs font-normal text-ink-2">{r.nominees[0].reason}</span></li>
            ))}
          </ul>
        )}
        {inTeam && <p className="mt-2 text-sm font-semibold">⭐ Named in the Team of the Season as your side&apos;s {inTeam.label.toLowerCase()}.</p>}
        {noms.length > 0 && (
          <p className="mt-2 text-sm">
            Nominated for {noms.map((r) => r.name).join(", ")} — {noms.length === 1 ? "this one" : "these"} went to {[...new Set(noms.map((r) => nameOf(g, r.winnerId)))].join(" and ")}.
          </p>
        )}
        {nothing && <p className="text-sm">No individual honours this time. The season still counts: it is all in your career history, and the next one starts from here.</p>}
        {rival && rivalWon.length > 0 && <p className="mt-2 text-sm font-semibold">⚔️ Your rival {rival.name} won {rivalWon.map((r) => r.name).join(" and ")}.</p>}
      </Card>
    </div>
  );
}

/** Season story: the year in numbers and the honours so far. */
export function SeasonStory({ g, c }: { g: GameState; c: SeasonCeremony }) {
  const me = g.players[g.user.playerId];
  const last = me.history.find((h) => h.season === c.season);
  const honours = careerHonours(g);
  const rival = primaryRival(g);
  return (
    <div key="story" className="anim-slide">
      <Heading kicker="The season in review" title="Your story so far" />
      <Card className="mx-auto max-w-2xl">
        {last && last.stats.apps > 0 ? (
          <p className="text-sm">
            <b>{seasonLabel(c.season)}</b>: {last.stats.apps} apps, {last.stats.goals} goals, {last.stats.assists} assists, average rating {(last.stats.ratingSum / Math.max(1, last.stats.apps)).toFixed(2)}.
          </p>
        ) : (
          <p className="text-sm">A quiet season in the first team: the work you did out of the spotlight counts too.</p>
        )}
        {honours.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {honours.map((h) => <Badge key={h.id} tone="plum">{h.count}× {h.name}</Badge>)}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">Your first honours are still to come.</p>
        )}
        {rival && <p className="mt-3 text-sm">⚔️ The rivalry with <b>{rival.name}</b> carries on into next season.</p>}
        <p className="mt-3 text-xs text-muted">Awards recognise performance: they build your reputation, not your ability. Clubs notice.</p>
      </Card>
    </div>
  );
}

export function sceneView(g: GameState, c: SeasonCeremony, scene: Scene, onPodiumDone?: () => void) {
  const uid = g.user.playerId;
  switch (scene.kind) {
    case "opening":
      return (
        <div key="opening" className="anim-pop mx-auto max-w-xl py-6 text-center">
          <div className="text-5xl" aria-hidden>🏆</div>
          <div className="mt-2 text-[11px] font-black uppercase tracking-widest text-muted">{seasonLabel(c.season)} · {c.leagueName}</div>
          <h2 className="font-display text-5xl leading-none">Awards Night</h2>
          <p className="mt-3 text-sm text-ink-2">The season is over, the table is final and the numbers are in. Here are the players who made it.</p>
        </div>
      );
    case "award": {
      const r = c.results.find((x) => x.id === scene.id);
      return r ? <AwardScene g={g} r={r} phase={scene.phase} uid={uid} onPodiumDone={onPodiumDone} /> : null;
    }
    case "team":
      return <TeamScene g={g} c={c} uid={uid} />;
    case "yours":
      return <YourNight g={g} c={c} />;
    case "story":
      return <SeasonStory g={g} c={c} />;
  }
}

/** The full results, for after the ceremony (or after skipping it). */
export function CeremonyResults({ g, c }: { g: GameState; c: SeasonCeremony }) {
  const uid = g.user.playerId;
  return (
    <div className="grid gap-5">
      {c.results.map((r) => (
        <section key={r.id}>
          <h3 className="mb-2 font-display text-xl"><span aria-hidden className="mr-1.5">{TROPHY[r.id]}</span>{r.name}</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {r.nominees.map((n, i) => <NomineeCard key={n.playerId} g={g} n={n} user={n.playerId === uid} winner={i === 0} rank={i + 1} />)}
          </ul>
        </section>
      ))}
      {c.team.length > 0 && <TeamScene g={g} c={c} uid={uid} />}
      <YourNight g={g} c={c} />
      <SeasonStory g={g} c={c} />
    </div>
  );
}

export function CeremonyControls({ c, step, total, onNext, onBack, onSkip, busy, revealing = false }: { c: SeasonCeremony; step: number; total: number; onNext: () => void; onBack: () => void; onSkip: () => void; busy: boolean; revealing?: boolean }) {
  const last = step >= total - 1;
  const scenes = buildScenes(c);
  const next = scenes[step + 1];
  const here = scenes[step];
  const reveal = here?.kind === "award" && here.phase === "nominees" && next?.kind === "award" && next.phase === "winner";
  const nextAward = next?.kind === "award" ? c.results.find((r) => r.id === next.id) : undefined;
  const podium = reveal && !!nextAward && hasPodiumReveal(nextAward);
  return (
    <div className="mx-auto mt-5 flex w-full max-w-2xl flex-wrap items-center justify-between gap-2">
      <Button tone="paper" size="sm" className="min-h-[44px]" onClick={onBack} disabled={step === 0 || busy}>‹ Back</Button>
      <span className="text-xs text-muted" aria-live="polite">{step + 1} / {total}</span>
      <div className="flex gap-2">
        <Button tone="paper" size="sm" className="min-h-[44px]" onClick={onSkip} disabled={busy}>Skip ceremony</Button>
        <Button tone="sun" size="sm" className="min-h-[44px]" onClick={onNext} disabled={busy || revealing} data-testid="ceremony-next">{revealing ? "Revealing…" : last ? "Finish" : podium ? "Start reveal ▸" : reveal ? "Reveal winner ▸" : "Next ▸"}</Button>
      </div>
    </div>
  );
}
