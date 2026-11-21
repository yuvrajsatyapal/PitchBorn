"use client";
import { Crest } from "@/components/art/Crest";
import { Badge, Bar, Button, Card, Empty, LinkButton, PageTitle, Stat, Table, Tabs } from "@/components/ui";
import { seasonLabel } from "@/engine/calendar";
import { canStartCoaching, coachClub, PREP_FOCUS, ROLE_LABEL, XP_FOR, YOUTH_FOCUS } from "@/engine/career/coaching";
import { leagueCompId } from "@/engine/competitions/setup";
import { clubName, staticLeague } from "@/engine/data/world";
import { FORMATIONS } from "@/engine/match/lineup";
import type { FormationId, PrepFocus, YouthFocus } from "@/engine/types";
import { useGame, useGameState } from "@/game/store";

const STYLE_LABELS = {
  pressing: ["Sit off", "Press high"],
  tempo: ["Patient", "High tempo"],
  directness: ["Short passing", "Direct"],
} as const;

export default function CoachPage() {
  const g = useGameState();
  const start = useGame((s) => s.startCoaching);
  const accept = useGame((s) => s.acceptCoachOffer);
  const decline = useGame((s) => s.declineCoachOffer);
  const resign = useGame((s) => s.resignCoach);
  const setTactics = useGame((s) => s.setTactics);
  const setYouthFocus = useGame((s) => s.setYouthFocus);
  const setPrepFocus = useGame((s) => s.setPrepFocus);
  if (!g) return null;
  const c = g.user.coach;

  if (!g.user.retired) {
    return (
      <div className="grid gap-4">
        <PageTitle kicker="After the boots" title="Coaching" className="-mb-1" />
        <Empty title="Still a player" icon="📋">
          When you retire, the same save carries on in the dugout: youth coach, then assistant, then manager.
        </Empty>
      </div>
    );
  }
  if (!c) {
    return (
      <div className="grid gap-4">
        <PageTitle kicker="After the boots" title="Coaching" className="-mb-1" />
        <Card tone="pitch" title="📋 Start a coaching career">
          <p className="mb-3 text-sm">
            Your playing days are over, but football isn&apos;t. Start as a youth coach at the club you&apos;re most tied to, earn your badges, step up to assistant and then manager. The world carries on from where you left it, and your legacy gives you a head start.
          </p>
          {canStartCoaching(g) && (
            <Button tone="pitch" onClick={start} data-testid="start-coaching">
              Start coaching career ▸
            </Button>
          )}
        </Card>
      </div>
    );
  }

  const club = coachClub(g);
  const stint = c.stints.find((s) => !s.to);
  const table = club ? g.competitions[leagueCompId(club.leagueId, g.season)]?.table : undefined;
  const pos = club && table ? table.findIndex((r) => r.team === club.id) + 1 : 0;
  const nextRole = c.role === "youth" ? "assistant" : c.role === "assistant" ? "manager" : null;
  const nextXp = nextRole ? XP_FOR[nextRole] : null;
  const graduates = c.stints.reduce((n, s) => n + s.graduates, 0);
  const totals = c.stints.reduce((t, s) => ({ g: t.g + s.games, w: t.w + s.won, d: t.d + s.drawn, l: t.l + s.lost }), { g: 0, w: 0, d: 0, l: 0 });

  return (
    <div className="grid gap-4">
      <PageTitle kicker={c.role ? `${ROLE_LABEL[c.role]}${club ? ` · ${clubName(club.id)}` : ""}` : "Out of work"} title="Coaching" className="-mb-1">
        {club && (
          <Button size="sm" tone="paper" onClick={resign}>
            Resign
          </Button>
        )}
      </PageTitle>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label="Coaching rating" value={c.rating} tone="pitch" />
        <Stat label="Reputation" value={c.reputation} tone="sun" />
        <Stat label="Games" value={totals.g} sub={totals.g ? `${totals.w}W ${totals.d}D ${totals.l}L` : undefined} />
        <Stat label="Trophies" value={c.trophies.length} tone="plum" />
        <Stat label="Graduates" value={graduates} sub="academy debuts" />
      </div>

      {c.offers.length > 0 && (
        <Card tone="sky" title={`📨 Job offers (${c.offers.length})`}>
          <ul className="grid gap-2">
            {c.offers.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-line bg-card p-3">
                <Crest clubId={o.clubId} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="font-bold">
                    {ROLE_LABEL[o.role]} · {clubName(o.clubId)}
                  </div>
                  <div className="text-xs text-ink-2">
                    {staticLeague(g.clubs[o.clubId]?.leagueId ?? "")?.name} · {o.note} · answer within {Math.max(1, o.expiresIndex - g.turnIndex)} week{o.expiresIndex - g.turnIndex === 1 ? "" : "s"}
                  </div>
                </div>
                <Button size="sm" tone="pitch" onClick={() => accept(o.id)} data-testid="accept-coach-offer">
                  Accept
                </Button>
                <Button size="sm" tone="paper" onClick={() => decline(o.id)}>
                  Decline
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!club && (
        <Card title="Between jobs">
          <p className="text-sm text-ink-2">Clubs are watching. Keep pressing Continue: offers come to coaches with a reputation like yours.</p>
        </Card>
      )}

      {club && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={<span className="flex items-center gap-2"><Crest clubId={club.id} size={28} /> {clubName(club.id)}</span>}>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between"><span className="text-muted">League</span><span className="font-bold">{staticLeague(club.leagueId)?.name}</span></div>
              {pos > 0 && <div className="flex justify-between"><span className="text-muted">Position</span><span className="font-bold">{pos} of {table?.length} (board expects {club.expectation ?? "–"})</span></div>}
              <div className="flex justify-between"><span className="text-muted">Manager</span><span className="font-bold">{club.manager.name}</span></div>
              {stint && <div className="flex justify-between"><span className="text-muted">This job</span><span className="font-bold">since {seasonLabel(stint.from.season)} · {stint.won}W {stint.drawn}D {stint.lost}L</span></div>}
            </div>
            {c.role === "manager" && (
              <div className="mt-4">
                <Bar value={c.confidence} label="Board confidence" tone={c.confidence < 30 ? "coral" : c.confidence < 55 ? "sun" : "pitch"} />
                {c.confidence < 30 && <p className="mt-1 text-xs font-bold text-coral">The board is losing patience.</p>}
              </div>
            )}
            {nextRole && nextXp && (
              <div className="mt-4">
                <Bar value={Math.min(c.xp, nextXp)} max={nextXp} label={`Experience towards ${ROLE_LABEL[nextRole].toLowerCase()}`} tone="sky" showValue={false} />
                <p className="mt-1 text-xs text-muted">{c.xp >= nextXp ? "Ready: step-up offers come at the end of the season." : "Builds every week, faster with results and academy debuts."}</p>
              </div>
            )}
          </Card>

          {c.role === "youth" && (
            <Card title="🎓 Academy focus">
              <p className="mb-3 text-sm text-ink-2">What you work on with the club&apos;s under-21s each week.</p>
              <Tabs value={c.youthFocus} onChange={(v) => setYouthFocus(v as YouthFocus)} items={(Object.keys(YOUTH_FOCUS) as YouthFocus[]).map((k) => ({ id: k, label: YOUTH_FOCUS[k].label }))} />
              <p className="mt-2 text-xs text-muted">{YOUTH_FOCUS[c.youthFocus].note}</p>
              <p className="mt-3 text-sm">Academy players waiting for a debut: <b>{c.watch.length}</b> · graduates this job: <b>{stint?.graduates ?? 0}</b></p>
            </Card>
          )}

          {(c.role === "assistant" || c.role === "manager") && (
            <Card title="🧠 Match preparation">
              <p className="mb-3 text-sm text-ink-2">The work on the training ground before every game. It sharpens the first team on match day.</p>
              <Tabs value={c.prepFocus} onChange={(v) => setPrepFocus(v as PrepFocus)} items={(Object.keys(PREP_FOCUS) as PrepFocus[]).map((k) => ({ id: k, label: PREP_FOCUS[k].label }))} />
              <p className="mt-2 text-xs text-muted">{PREP_FOCUS[c.prepFocus].note}</p>
            </Card>
          )}

          {c.role === "manager" && (
            <Card title="📐 Tactics" className="lg:col-span-2">
              <div className="mb-2 text-sm font-bold">Formation</div>
              <div className="mb-4 flex flex-wrap gap-2">
                {(Object.keys(FORMATIONS) as FormationId[]).map((f) => (
                  <Button key={f} size="sm" tone={club.formation === f ? "pitch" : "paper"} onClick={() => setTactics({ formation: f })} aria-pressed={club.formation === f}>
                    {f}
                  </Button>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {(Object.keys(STYLE_LABELS) as (keyof typeof STYLE_LABELS)[]).map((k) => (
                  <label key={k} className="grid gap-1 text-sm">
                    <span className="font-bold capitalize">{k}</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(club.style[k] * 100)}
                      onChange={(e) => setTactics({ style: { [k]: Number(e.target.value) / 100 } })}
                      className="accent-[var(--pitch)]"
                      aria-label={k}
                    />
                    <span className="flex justify-between text-[11px] text-muted"><span>{STYLE_LABELS[k][0]}</span><span>{STYLE_LABELS[k][1]}</span></span>
                  </label>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted">The best eleven for your shape is picked automatically each match. Your coaching rating ({c.rating}) {c.rating >= 66 ? "lifts" : c.rating <= 52 ? "costs" : "barely moves"} the team&apos;s decision-making on match day.</p>
            </Card>
          )}
        </div>
      )}

      <Card title="Coaching career">
        {c.stints.length ? (
          <Table>
            <thead>
              <tr><th>Club</th><th>Role</th><th>From</th><th>To</th><th className="text-right">G</th><th className="text-right">W-D-L</th><th className="text-right">Grads</th><th>Honours</th></tr>
            </thead>
            <tbody>
              {[...c.stints].reverse().map((s, i) => (
                <tr key={`${s.clubId}-${s.from.season}-${s.from.turn}-${i}`}>
                  <td><span className="flex items-center gap-1.5"><Crest clubId={s.clubId} size={16} /> {clubName(s.clubId, true)}</span></td>
                  <td>{ROLE_LABEL[s.role]}</td>
                  <td>{seasonLabel(s.from.season)}</td>
                  <td>{s.to ? `${seasonLabel(s.to.season)}${s.reason ? ` · ${s.reason}` : ""}` : "now"}</td>
                  <td className="text-right">{s.games}</td>
                  <td className="text-right">{s.won}-{s.drawn}-{s.lost}</td>
                  <td className="text-right">{s.graduates}</td>
                  <td>{s.trophies.length ? s.trophies.join(", ") : "–"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="text-sm text-ink-2">No jobs yet.</p>
        )}
        {c.trophies.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {c.trophies.map((t, i) => (
              <Badge key={`${t.season}-${t.name}-${i}`} tone="sun">🏆 {t.name} {seasonLabel(t.season)}</Badge>
            ))}
          </div>
        )}
      </Card>
      <div className="flex flex-wrap gap-2">
        <LinkButton href="/play/legacy" tone="plum">Playing legacy</LinkButton>
        <LinkButton href="/play/league" tone="paper">Competitions</LinkButton>
      </div>
    </div>
  );
}
