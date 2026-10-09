"use client";
import { Flag } from "@/components/art/Flag";
import { Badge, Button, Card } from "@/components/ui";
import { country } from "@/engine/data/world";
import { MAX_DEFERRALS, outlookFor } from "@/engine/national/allegiance";
import { canSwitchAllegiance, commitment, eligibleTeams, intlTeam } from "@/engine/national/identity";
import type { GameState } from "@/engine/types";
import { user } from "@/game/selectors";
import { useGame } from "@/game/store";

const COMMIT_TEXT = {
  open: { label: "Open", tone: "sky" as const, text: "No caps yet: you can still choose." },
  provisional: { label: "Provisional", tone: "sun" as const, text: "Friendlies only: you may still switch once." },
  binding: { label: "Binding", tone: "coral" as const, text: "A competitive senior cap makes this permanent." },
};

/** International allegiance: who you represent, who else you could, and any invitation waiting for an answer. */
export function AllegianceCard({ g }: { g: GameState }) {
  const decide = useGame((s) => s.decide);
  const p = user(g);
  const teams = eligibleTeams(p);
  const cur = intlTeam(p);
  const c = commitment(p);
  const can = canSwitchAllegiance(p);
  const inv = g.user.intl?.invitation;
  const pending = g.user.decisions.find((d) => d.intlCode);
  const others = teams.filter((t) => t !== cur);
  const history = (g.user.intl?.history ?? []).slice(-3).reverse();
  if (!others.length && !inv && !history.length) return null;
  return (
    <Card title="International allegiance" tone={inv ? "plum" : undefined} data-testid="allegiance">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="flex items-center gap-1.5 font-bold"><Flag code={cur} /> Representing {country(cur)?.name}</span>
        <Badge tone={COMMIT_TEXT[c].tone}>{COMMIT_TEXT[c].label}</Badge>
        <span className="text-xs text-muted">{COMMIT_TEXT[c].text}</span>
      </div>
      <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
        <div><dt className="text-muted">Citizenship</dt><dd className="font-semibold">{country(p.nationality)?.name}</dd></div>
        <div><dt className="text-muted">Also eligible for</dt><dd className="font-semibold">{others.length ? others.map((t) => country(t)?.name).join(", ") : "No other nation"}</dd></div>
        <div><dt className="text-muted">Caps</dt><dd className="font-semibold">{p.intl.caps}{p.intl.compCaps ? ` (${p.intl.compCaps} competitive)` : ""}</dd></div>
      </dl>
      {others.map((o) => {
        const out = outlookFor(g, o);
        return (
          <p key={o} className="mt-2 text-xs text-ink-2">
            {country(o)?.name} outlook: <b>{out.tier === "strong" ? "you'd be picked" : out.tier === "fringe" ? "a place in the squad" : "a long shot"}</b> (ranked {out.rank + 1} of {out.pool} eligible {out.group === "GK" ? "goalkeepers" : out.group === "DEF" ? "defenders" : out.group === "MID" ? "midfielders" : "forwards"}).
          </p>
        );
      })}
      {others.length > 0 && !can.ok && <p className="mt-2 text-xs text-muted">Switching is closed: {can.reason}</p>}
      {others.length > 0 && can.ok && <p className="mt-2 text-xs text-muted">Another nation can approach you at any time; the game never switches your allegiance for you.</p>}
      {inv && pending && (
        <div className="mt-3 rounded-xl border-2 border-line bg-card p-3" data-testid="allegiance-invite">
          <div className="font-display text-lg">{pending.title}</div>
          <p className="mt-1 whitespace-pre-line text-sm">{pending.body}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {pending.options.map((o) => (
              <div key={o.id} className="flex flex-col items-start">
                <Button size="sm" tone={o.id === "accept" ? "pitch" : o.id === "decline" ? "coral" : "paper"} onClick={() => decide(pending.id, o.id)} data-testid={`intl-${o.id}`}>
                  {o.label}
                </Button>
                {o.hint && <span className="mt-0.5 max-w-[14rem] text-[11px] text-muted">{o.hint}</span>}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted">If you do nothing it lapses and you stay as you are. It can come back up to {MAX_DEFERRALS} times.</p>
        </div>
      )}
      {inv && !pending && (
        <p className="mt-3 text-xs text-ink-2">
          {country(inv.code)?.name} are waiting on your answer: they will ask again in a few weeks ({inv.deferrals} of {MAX_DEFERRALS} deferrals used).
        </p>
      )}
      {history.length > 0 && (
        <ul className="mt-3 grid gap-0.5 text-xs text-ink-2">
          {history.map((h, i) => (
            <li key={i}>• {country(h.code)?.name}: {h.outcome === "accepted" ? "you accepted" : h.outcome === "declined" ? "you declined" : "the invitation lapsed"}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}
