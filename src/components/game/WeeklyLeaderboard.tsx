"use client";
import { useState } from "react";
import { Badge, Button } from "@/components/ui";
import { challengeDef } from "@/engine/career/challenges";
import { decodeShare, rankShares } from "@/engine/career/shareCode";

const KEY = "pitchborn:weekly-codes";

function readCodes(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Paste friends' weekly-challenge codes to compare runs. Codes are stored in this browser only. */
export function WeeklyLeaderboard({ week, mine }: { week?: string; mine?: string | null }) {
  // Only rendered once a save is loaded on the client, so reading storage up front is safe.
  const [codes, setCodes] = useState<string[]>(() => (typeof window === "undefined" ? [] : readCodes()));
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const save = (next: string[]) => {
    setCodes(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next.slice(-200)));
    } catch {
      // Storage blocked: the list lasts for this visit.
    }
  };
  const add = () => {
    const r = decodeShare(text);
    if (!r) return setErr("That code doesn't look right. Check it was copied in full.");
    setErr(null);
    save([...codes, text.trim().toUpperCase()]);
    setText("");
  };
  const copy = async () => {
    if (!mine) return;
    try {
      await navigator.clipboard.writeText(mine);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setErr("Copy failed: select the code and copy it by hand.");
    }
  };
  const board = rankShares([...(mine ? [mine] : []), ...codes]).filter((x) => !week || x.r.week === week);
  return (
    <div className="grid gap-2" data-testid="weekly-leaderboard">
      {mine && (
        <div className="flex flex-wrap items-center gap-2">
          <code className="select-all break-all rounded-lg border-2 border-line bg-card px-2 py-1 text-xs font-bold" data-testid="share-code">{mine}</code>
          <Button size="sm" tone="paper" onClick={copy}>{copied ? "Copied" : "Copy code"}</Button>
        </div>
      )}
      <label className="grid gap-1 text-xs font-bold">
        Add a friend&apos;s code
        <span className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="PB-26W48-…" className="min-w-0 flex-1 rounded-lg border-2 border-line bg-card px-2 py-1.5 font-mono text-xs font-normal" />
          <Button size="sm" onClick={add} disabled={!text.trim()}>Add</Button>
        </span>
      </label>
      {err && <p className="text-xs text-coral">{err}</p>}
      {board.length > 0 && (
        <ol className="grid gap-1 text-sm">
          {board.map(({ code, r }, i) => (
            <li key={code} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-1 ${code === mine ? "bg-sun-2" : "bg-paper-2"}`}>
              <span><b>#{i + 1}</b> {r.name} <span className="text-xs text-muted">· {challengeDef(r.challengeId)?.title} · {r.week}</span></span>
              <span className="flex items-center gap-2">
                <Badge tone={r.status === "won" ? "pitch" : r.status === "failed" ? "coral" : "sun"}>{r.status === "won" ? "Won" : r.status === "failed" ? "Failed" : "Going"}</Badge>
                <b className="num">{r.score}</b>
                {code !== mine && (
                  <button type="button" className="text-xs underline" aria-label={`Remove ${r.name}`} onClick={() => save(codes.filter((c) => c.trim().toUpperCase() !== code))}>
                    remove
                  </button>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
