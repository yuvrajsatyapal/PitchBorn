"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Crest } from "@/components/art/Crest";
import { Flag } from "@/components/art/Flag";
import { PublicFooter, PublicHeader } from "@/components/app/PublicHeader";
import { Badge, Button, Empty, LinkButton, Modal, PageTitle } from "@/components/ui";
import { clubName } from "@/engine/data/world";
import { seasonLabel } from "@/engine/calendar";
import { useGame } from "@/game/store";
import type { SaveMeta } from "@/persistence/db";
import { deleteSave, importSaveFile, listSaves } from "@/persistence/saves";

export default function SavesPage() {
  const [saves, setSaves] = useState<SaveMeta[] | null>(null);
  const [confirm, setConfirm] = useState<SaveMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useGame((s) => s.load);
  const close = useGame((s) => s.close);
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const refresh = () =>
    listSaves()
      .then(setSaves)
      .catch(() => {
        setSaves([]);
        setError("Browser storage is unavailable (private mode?). Saves cannot be listed.");
      });
  useEffect(() => {
    refresh();
  }, []);
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-4xl px-4">
        <PageTitle kicker="Save management" title="Your careers">
          <Button tone="paper" onClick={() => file.current?.click()}>
            Import save
          </Button>
          <LinkButton href="/new">New career</LinkButton>
        </PageTitle>
        <input
          ref={file}
          type="file"
          accept=".pbsave,.json,application/json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              await importSaveFile(f);
              await refresh();
            } catch (err) {
              setError((err as Error).message);
            }
            e.target.value = "";
          }}
        />
        {error && <div className="pb-card mb-4 bg-coral-2 p-3 text-sm">{error}</div>}
        {saves === null ? (
          <div className="text-sm text-muted">Loading saves…</div>
        ) : saves.length === 0 ? (
          <Empty title="No careers yet" icon="🥾">
            Start your first career — it saves automatically in this browser.
          </Empty>
        ) : (
          <ul className="grid gap-3">
            {saves.map((s) => (
              <li key={s.id} className="pb-card flex flex-wrap items-center gap-4 p-4">
                <Crest clubId={s.clubId} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-xl">{s.playerName}</span>
                    <Flag code={s.nationality} />
                    <Badge>{s.position}</Badge>
                    <Badge tone="sun">OVR {s.overall}</Badge>
                    {s.retired && <Badge tone="plum">Retired · {s.legacyTier}</Badge>}
                  </div>
                  <div className="text-sm text-ink-2">
                    {clubName(s.clubId)} · Age {s.age} · {seasonLabel(s.season)} week {s.turn} · saved {new Date(s.updatedAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={async () => {
                      close();
                      if (await load(s.id)) router.push(s.retired ? "/play/legacy" : "/play");
                      else setError("That save could not be loaded.");
                    }}
                  >
                    Play
                  </Button>
                  <Button tone="paper" onClick={() => setConfirm(s)} aria-label={`Delete ${s.playerName}`}>
                    🗑
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Delete career?">
          <p className="mb-4 text-sm">
            This permanently deletes <b>{confirm?.playerName}</b> and its backups from this browser. Export it first if you want to keep a copy.
          </p>
          <div className="flex justify-end gap-2">
            <Button tone="paper" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              tone="coral"
              onClick={async () => {
                if (confirm) await deleteSave(confirm.id);
                setConfirm(null);
                refresh();
              }}
            >
              Delete
            </Button>
          </div>
        </Modal>
      </main>
      <PublicFooter />
    </div>
  );
}
