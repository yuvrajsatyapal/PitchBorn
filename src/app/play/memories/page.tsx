"use client";
import { useState } from "react";
import { MemoryCard } from "@/components/game/MemoryCard";
import { Card, Empty, PageTitle, Stat, Tabs } from "@/components/ui";
import { MEMORY_GROUP } from "@/engine/memory/describe";
import { memoriesByImportance } from "@/engine/memory/store";
import { useGameState } from "@/game/store";

type Filter = "all" | "Matches" | "Honours" | "Moves" | "Career";

export default function Memories() {
  const g = useGameState();
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  if (!g) return null;
  const all = memoriesByImportance(g);
  const iconic = all.filter((m) => m.importance >= 75);
  const top = (iconic.length ? iconic : all).slice(0, 5);
  const topIds = new Set(top.map((m) => m.id));
  const rest = all.filter((m) => !topIds.has(m.id) && (filter === "all" || MEMORY_GROUP[m.kind] === filter));
  const toggle = (id: string) => setOpen((o) => (o === id ? null : id));
  return (
    <div className="grid gap-4">
      <PageTitle kicker="Football Memory" title="Iconic Moments" className="-mb-1" />
      {all.length === 0 ? (
        <Empty title="No memories yet" icon="🎞️">
          Debuts, derby winners, trophies, big moves and comebacks are remembered here, scored by how much they mattered. Go and make some.
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Memories" value={all.length} />
            <Stat label="Iconic" value={iconic.length} tone="sun" />
            <Stat label="Biggest" value={all[0].importance} sub="importance /100" />
            <Stat label="Trophies" value={g.user.trophies.length} />
          </div>
          <Card title={iconic.length ? "The defining moments" : "Your best moments so far"} tone="sun">
            <ul className="grid gap-3" data-testid="iconic-list">
              {top.map((m) => <MemoryCard key={m.id} g={g} m={m} big open={open === m.id} onToggle={() => toggle(m.id)} />)}
            </ul>
          </Card>
          <Card title="Everything remembered">
            <Tabs
              value={filter}
              onChange={setFilter}
              className="mb-3"
              items={[{ id: "all", label: "All" }, { id: "Matches", label: "⚽ Matches" }, { id: "Honours", label: "🏆 Honours" }, { id: "Moves", label: "✍️ Moves" }, { id: "Career", label: "🧭 Career" }]}
            />
            {rest.length ? (
              <ul className="grid gap-2">{rest.map((m) => <MemoryCard key={m.id} g={g} m={m} open={open === m.id} onToggle={() => toggle(m.id)} />)}</ul>
            ) : (
              <p className="text-sm text-muted">Nothing more in this category yet.</p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
