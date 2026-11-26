"use client";
import { Badge, Card } from "@/components/ui";
import { challengeView } from "@/engine/career/challenges";
import { shareCodeFor } from "@/engine/career/shareCode";
import { WeeklyLeaderboard } from "@/components/game/WeeklyLeaderboard";
import type { GameState } from "@/engine/types";

/** Dashboard and profile: the challenge this career is chasing, and how it stands. */
export function ChallengeCard({ g }: { g: GameState }) {
  const v = challengeView(g);
  if (!v) return null;
  const tone = v.state.status === "won" ? "pitch" : v.state.status === "failed" ? "coral" : "sun";
  return (
    <Card title={`${v.def.icon} Challenge: ${v.def.title}`} action={<Badge tone={tone}>{v.state.status === "active" ? "In progress" : v.state.status === "won" ? "Complete" : "Failed"}</Badge>} data-testid="challenge-card">
      <p className="text-sm">{v.def.blurb}</p>
      <p className="mt-1 text-xs text-ink-2">
        {v.state.status === "active" ? `${v.progress} · deadline ${v.deadline}` : v.state.note}
        {v.state.weekly && ` · weekly challenge ${v.state.weekly}`}
      </p>
      {v.state.weekly && (
        <div className="mt-3">
          <WeeklyLeaderboard week={v.state.weekly} mine={shareCodeFor(g)} />
        </div>
      )}
    </Card>
  );
}
