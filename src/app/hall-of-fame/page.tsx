"use client";
import { useEffect, useState } from "react";
import { Crest } from "@/components/art/Crest";
import { Flag } from "@/components/art/Flag";
import { PlayerPortrait } from "@/components/art/PlayerPortrait";
import { PublicFooter, PublicHeader } from "@/components/app/PublicHeader";
import { Badge, Button, Empty, LinkButton, Modal, PageTitle } from "@/components/ui";
import { rankHallOfFame, type HallOfFameEntry } from "@/engine/career/hallOfFame";
import { removeFromHallOfFame, syncHallOfFame } from "@/persistence/hallOfFame";

const RANK_TONE = ["sun", "paper", "coral"] as const;

function Inductee({ e, rank, onRemove }: { e: HallOfFameEntry; rank: number; onRemove: () => void }) {
  return (
    <li className="pb-card grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-3 p-3 sm:grid-cols-[auto_auto_minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:p-4" data-testid="hof-entry">
      <div className="flex flex-col items-center gap-2 sm:contents">
        <Badge tone={RANK_TONE[rank - 1] ?? "paper"} className="num text-sm">#{rank}</Badge>
        <div className="overflow-hidden rounded-2xl border-2 border-line">
          <PlayerPortrait appearance={e.look} age={e.retiredAge} size={88} kit={e.clubColors} />
        </div>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-display text-xl leading-tight">{e.name}</span>
          <Flag code={e.nationality} />
          <Badge>{e.position}</Badge>
          <Badge tone="plum">{e.legacyTier}</Badge>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-ink-2">
          <Crest clubId={e.clubId} size={20} />
          <span className="truncate">{e.club}</span>
          <span>· {e.span}</span>
          <span>· peak <span className="num">{e.peak}</span></span>
        </div>
        {e.identity && <div className="mt-0.5 text-xs italic text-ink-2">{e.identity}</div>}
        <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 text-center sm:grid-cols-6">
          {e.stats.map((s) => (
            <div key={s.label}>
              <dt className="text-[10px] font-bold uppercase tracking-wide text-muted">{s.label}</dt>
              <dd className="num font-bold">{s.value}</dd>
            </div>
          ))}
        </dl>
        {(e.honours.length > 0 || e.awards.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {e.honours.map((h) => <Badge key={h} tone="sun">{h}</Badge>)}
            {e.awards.map((a) => <Badge key={a} tone="sky">{a}</Badge>)}
          </div>
        )}
      </div>
      <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:flex-col sm:items-end">
        <div className="text-right">
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted">Legacy</div>
          <div className="font-display num text-3xl leading-none">{e.legacyScore}</div>
        </div>
        <Button size="sm" tone="paper" onClick={onRemove} aria-label={`Remove ${e.name} from the Hall of Fame`}>
          Remove
        </Button>
      </div>
    </li>
  );
}

export default function HallOfFamePage() {
  const [entries, setEntries] = useState<HallOfFameEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<HallOfFameEntry | null>(null);
  const refresh = () =>
    syncHallOfFame()
      .then((e) => setEntries(rankHallOfFame(e)))
      .catch(() => {
        setEntries([]);
        setError("Browser storage is unavailable (private mode?). The Hall of Fame cannot be shown.");
      });
  useEffect(() => {
    refresh();
  }, []);
  return (
    <div className="min-h-dvh">
      <PublicHeader />
      <main className="mx-auto max-w-4xl px-4">
        <PageTitle kicker="Every career, every save" title="Hall of Fame">
          <LinkButton href="/saves" tone="paper">My saves</LinkButton>
        </PageTitle>
        <p className="mb-4 max-w-2xl text-sm text-ink-2">
          Retired careers from this browser, ranked by legacy. A career stays here even if you delete its save.
        </p>
        {error && <div className="pb-card mb-4 bg-coral-2 p-3 text-sm">{error}</div>}
        {entries === null ? (
          <div className="text-sm text-muted">Opening the Hall…</div>
        ) : entries.length === 0 ? (
          <Empty title="No legends yet" icon="🏛️">
            Retire a career and it takes its place here, ranked against every other career you play.
          </Empty>
        ) : (
          <ol className="grid gap-3">
            {entries.map((e, i) => (
              <Inductee key={e.saveId} e={e} rank={i + 1} onRemove={() => setConfirm(e)} />
            ))}
          </ol>
        )}
        <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Remove from the Hall?">
          <p className="mb-4 text-sm">
            <b>{confirm?.name}</b> leaves the Hall of Fame for good. The save itself, if you still have it, is not touched.
          </p>
          <div className="flex justify-end gap-2">
            <Button tone="paper" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              tone="coral"
              onClick={async () => {
                if (confirm) await removeFromHallOfFame(confirm.saveId);
                setConfirm(null);
                refresh();
              }}
            >
              Remove
            </Button>
          </div>
        </Modal>
      </main>
      <PublicFooter />
    </div>
  );
}
