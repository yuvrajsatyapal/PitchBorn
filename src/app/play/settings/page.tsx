"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, Card, PageTitle, Tabs } from "@/components/ui";
import { useGame, useGameState } from "@/game/store";
import { exportSaveBlob, importSaveFile, listBackups, restoreBackup } from "@/persistence/saves";
import { SoundToggle } from "@/components/game/SoundToggle";
import { replayTips } from "@/engine/career/tips";

export default function Settings() {
  const g = useGameState();
  const save = useGame((s) => s.save);
  const load = useGame((s) => s.load);
  const close = useGame((s) => s.close);
  const notify = useGame((s) => s.notify);
  const setDifficulty = useGame((s) => s.setDifficulty);
  const setAutoSave = useGame((s) => s.setAutoSave);
  const setTips = useGame((s) => s.setTips);
  const act = useGame((s) => s.act);
  const lastSavedAt = useGame((s) => s.lastSavedAt);
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState<"system" | "light" | "dark">(() => {
    try {
      return (localStorage.getItem("pb-theme") as "light" | "dark" | null) ?? "system";
    } catch {
      return "system";
    }
  });
  const [backups, setBackups] = useState<{ id: string; createdAt: string; label: string }[]>([]);
  useEffect(() => {
    if (g) listBackups(g.id).then(setBackups).catch(() => setBackups([]));
  }, [g, lastSavedAt]);
  if (!g) return null;
  const applyTheme = (t: "system" | "light" | "dark") => {
    setTheme(t);
    try {
      if (t === "system") {
        localStorage.removeItem("pb-theme");
        delete document.documentElement.dataset.theme;
      } else {
        localStorage.setItem("pb-theme", t);
        document.documentElement.dataset.theme = t;
      }
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="grid gap-4">
      <PageTitle kicker="Preferences" title="Settings & Saves" className="-mb-1" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Save game">
          <p className="mb-3 text-sm text-ink-2">
            Careers are stored in this browser (IndexedDB). Last saved: {lastSavedAt ? new Date(lastSavedAt).toLocaleString() : "—"}.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => save(true)}>💾 Save now</Button>
            <Button
              tone="paper"
              onClick={async () => {
                const { blob, filename } = await exportSaveBlob(g);
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = filename;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 2000);
              }}
            >
              ⬇ Export save
            </Button>
            <Button tone="paper" onClick={() => file.current?.click()}>
              ⬆ Import save
            </Button>
            <Button tone="paper" onClick={() => (close(), router.push("/saves"))}>
              Switch career
            </Button>
          </div>
          <input
            ref={file}
            type="file"
            className="hidden"
            accept=".pbsave,.json"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const s = await importSaveFile(f);
                notify(`Imported ${s.name}.`, "good");
              } catch (err) {
                notify((err as Error).message, "bad");
              }
              e.target.value = "";
            }}
          />
          <label className="mt-4 flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={g.settings.autoSave} onChange={(e) => setAutoSave(e.target.checked)} className="h-5 w-5 accent-[var(--pitch)]" />
            Autosave every week
          </label>
          <div className="mt-3 flex items-center gap-2 text-sm font-semibold">
            <SoundToggle /> <span>Match sound: crowd, whistle and goal stings</span>
          </div>
          {backups.length > 0 && (
            <div className="mt-4">
              <div className="mb-1 text-xs font-black uppercase text-muted">Backups</div>
              <ul className="grid gap-1 text-sm">
                {backups.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2">
                    <span>
                      {b.label} · {new Date(b.createdAt).toLocaleString()}
                    </span>
                    <button
                      className="pb-hit justify-center rounded-full border-2 border-line px-3 text-xs font-bold"
                      onClick={async () => {
                        await restoreBackup(b.id);
                        await load(g.id);
                        notify("Backup restored.", "good");
                      }}
                    >
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
        <Card title="Game">
          <div className="mb-2 text-sm font-bold">Difficulty</div>
          <Tabs value={g.settings.difficulty} onChange={setDifficulty} items={[{ id: "relaxed", label: "Easy" }, { id: "standard", label: "Medium" }, { id: "hardcore", label: "Hard" }]} />
          <p className="mt-1 text-xs text-muted">Affects manager trust and contract generosity. Potential is fixed at career start.</p>
          <label className="mt-4 flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={g.settings.tips !== false} onChange={(e) => setTips(e.target.checked)} className="h-5 w-5 accent-[var(--pitch)]" data-testid="tips-toggle" />
            Show first-season tips
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" tone="paper" onClick={() => act((gm) => replayTips(gm), "Tutorial tips will show again this season.")} data-testid="replay-tutorial">
              Replay tutorial
            </Button>
            <a href="/help" className="inline-flex items-center rounded-full border-2 border-line bg-card px-3 py-1.5 text-sm font-bold">
              Open the encyclopedia
            </a>
          </div>
          <div className="mb-2 mt-4 text-sm font-bold">Theme</div>
          <Tabs value={theme} onChange={applyTheme} items={[{ id: "system", label: "System" }, { id: "light", label: "Light" }, { id: "dark", label: "Dark" }]} />
        </Card>
        <Card title="Privacy">
          <p className="text-sm text-ink-2">PitchBorn is free and shows no ads. Your careers stay in this browser.</p>
          <p className="mt-3 text-xs">
            <a href="/privacy/" className="underline">Privacy notice</a> · <a href="/credits/" className="underline">Data sources & licences</a>
          </p>
        </Card>
        <Card title="About this career">
          <dl className="grid grid-cols-2 gap-1 text-sm">
            <dt className="text-muted">Save id</dt>
            <dd className="truncate">{g.id}</dd>
            <dt className="text-muted">Seed</dt>
            <dd className="truncate">{g.seed}</dd>
            <dt className="text-muted">Dataset</dt>
            <dd>{g.datasetVersion}</dd>
            <dt className="text-muted">Schema</dt>
            <dd>v{g.schemaVersion}</dd>
            <dt className="text-muted">Players simulated</dt>
            <dd>{Object.keys(g.players).length.toLocaleString()}</dd>
          </dl>
        </Card>
      </div>
    </div>
  );
}
