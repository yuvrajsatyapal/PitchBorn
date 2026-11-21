"use client";
import { useState } from "react";
import { Badge, Bar, Card, PageTitle, Stat, Tabs } from "@/components/ui";
import { seasonLabel } from "@/engine/calendar";
import { ACHIEVEMENTS, achievementScore, type AchievementDef, type AchievementGroup, type AchievementTier } from "@/engine/career/achievements";
import type { AchievementUnlock, GameState } from "@/engine/types";
import { useGameState } from "@/game/store";

const TIER_TONE: Record<AchievementTier, "coral" | "sky" | "sun" | "plum"> = { bronze: "coral", silver: "sky", gold: "sun", platinum: "plum" };
const TIER_LABEL: Record<AchievementTier, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold", platinum: "Platinum" };
type Filter = "all" | AchievementGroup;

function AchievementTile({ g, a, rec }: { g: GameState; a: AchievementDef; rec?: AchievementUnlock }) {
  const locked = !rec;
  const hidden = locked && a.secret;
  const prog = locked && a.progress ? a.progress(g) : null;
  return (
    <li
      className={`flex gap-3 rounded-2xl border-2 p-3 ${locked ? "border-line/25 bg-paper-2/60" : "border-line bg-card shadow-[3px_3px_0_0_var(--color-line)]"}`}
      data-testid={`achievement-${a.id}`}
      data-unlocked={locked ? "false" : "true"}
    >
      <div
        className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl border-2 text-2xl ${locked ? "border-line/25 grayscale opacity-50" : "border-line bg-sun-2"}`}
        aria-hidden
      >
        {hidden ? "❔" : a.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`font-bold leading-tight ${locked ? "text-ink-2" : ""}`}>{hidden ? "Secret achievement" : a.name}</span>
          <Badge tone={TIER_TONE[a.tier]}>{TIER_LABEL[a.tier]}</Badge>
        </div>
        <p className="text-sm text-ink-2">{hidden ? "Keep playing to discover it." : a.description}</p>
        {rec && (
          <p className="mt-1 text-xs text-muted">
            {rec.backfilled ? "Earned before achievements were tracked" : `Unlocked ${seasonLabel(rec.season)}${rec.detail ? ` · ${rec.detail}` : ""}`}
          </p>
        )}
        {prog && prog[1] > 1 && (
          <div className="mt-1.5">
            <Bar value={prog[0]} max={prog[1]} tone={TIER_TONE[a.tier]} height={8} showValue={false} />
            <div className="mt-0.5 text-[11px] font-bold text-muted">
              {prog[0].toLocaleString()} / {prog[1].toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

export default function Achievements() {
  const g = useGameState();
  const [filter, setFilter] = useState<Filter>("all");
  if (!g) return null;
  const have = new Map((g.user.achievements ?? []).map((a) => [a.id, a]));
  const score = achievementScore(g);
  const recent = [...(g.user.achievements ?? [])].filter((a) => !a.backfilled).reverse().slice(0, 3);
  const list = ACHIEVEMENTS.filter((a) => filter === "all" || a.group === filter);
  const sorted = [...list].sort((a, b) => Number(have.has(b.id)) - Number(have.has(a.id)));
  const byTier = (t: AchievementTier) => ACHIEVEMENTS.filter((a) => a.tier === t && have.has(a.id)).length;
  return (
    <div className="grid gap-4">
      <PageTitle kicker="Trophy cabinet" title="Achievements" className="-mb-1" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label="Unlocked" value={`${score.count}/${score.total}`} tone="sun" />
        <Stat label="Points" value={score.points} sub={`of ${score.max}`} />
        <Stat label="Gold" value={byTier("gold")} />
        <Stat label="Platinum" value={byTier("platinum")} tone="plum" />
        <Stat label="Complete" value={`${Math.round((score.count / Math.max(1, score.total)) * 100)}%`} />
      </div>
      {recent.length > 0 && (
        <Card title="Latest unlocks" tone="sun">
          <ul className="grid gap-2 sm:grid-cols-3">
            {recent.map((r) => {
              const a = ACHIEVEMENTS.find((x) => x.id === r.id);
              return a ? <AchievementTile key={r.id} g={g} a={a} rec={r} /> : null;
            })}
          </ul>
        </Card>
      )}
      <Card title="All achievements">
        <Tabs
          value={filter}
          onChange={setFilter}
          className="mb-3"
          items={[
            { id: "all", label: "All" },
            { id: "Matches", label: "⚽ Matches" },
            { id: "Milestones", label: "📈 Milestones" },
            { id: "Honours", label: "🏆 Honours" },
            { id: "Career", label: "🧭 Career" },
            ...(ACHIEVEMENTS.some((a) => a.group === "Coaching") ? [{ id: "Coaching" as const, label: "📋 Coaching" }] : []),
          ]}
        />
        <ul className="grid gap-2 md:grid-cols-2" data-testid="achievement-list">
          {sorted.map((a) => (
            <AchievementTile key={a.id} g={g} a={a} rec={have.get(a.id)} />
          ))}
        </ul>
      </Card>
    </div>
  );
}
