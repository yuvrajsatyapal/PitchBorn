"use client";
import { useState } from "react";
import { FeedPostCard } from "@/components/game/FeedPostCard";
import { Card, Empty, PageTitle, Stat, Tabs } from "@/components/ui";
import { feedNewestFirst } from "@/engine/career/feed";
import type { FeedPost } from "@/engine/types";
import { useGameState } from "@/game/store";

type Filter = "all" | "fans" | "media" | "match";

const matches = (f: Filter, p: FeedPost) =>
  f === "all" || (f === "fans" ? p.kind === "fan" || p.kind === "rival-fan" : f === "media" ? p.kind === "journalist" || p.kind === "pundit" || p.kind === "club" : p.topic === "match");

export default function Feed() {
  const g = useGameState();
  const [filter, setFilter] = useState<Filter>("all");
  if (!g) return null;
  const all = feedNewestFirst(g);
  const posts = all.filter((p) => matches(filter, p));
  const recent = all.filter((p) => p.season === g.season);
  const pos = recent.filter((p) => p.mood === "pos").length;
  const neg = recent.filter((p) => p.mood === "neg").length;
  const mood = recent.length ? Math.round((pos / Math.max(1, pos + neg)) * 100) : null;
  return (
    <div className="grid gap-4">
      <PageTitle kicker="What they're saying" title="Social Feed" className="-mb-1" />
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Posts this season" value={recent.length} />
        <Stat label="Positive" value={mood === null ? "–" : `${mood}%`} tone={mood !== null && mood >= 50 ? "pitch" : "coral"} />
        <Stat label="Most liked" value={all.length ? Math.max(...all.map((p) => p.likes)).toLocaleString() : "–"} tone="sun" />
      </div>
      <Card>
        <Tabs value={filter} onChange={setFilter} className="mb-3" items={[{ id: "all", label: "All" }, { id: "fans", label: "🙋 Fans" }, { id: "media", label: "📰 Media" }, { id: "match", label: "⚽ Matches" }]} />
        {posts.length ? (
          <ul className="grid gap-2">{posts.map((p) => <FeedPostCard key={p.id} post={p} now={g} />)}</ul>
        ) : (
          <Empty title="Nobody's talking yet" icon="📱">
            Play matches, make moves and win things: fans, journalists and pundits will have plenty to say.
          </Empty>
        )}
      </Card>
    </div>
  );
}
