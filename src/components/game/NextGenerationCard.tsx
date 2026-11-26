"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Crest } from "@/components/art/Crest";
import { PlayerPortrait } from "@/components/art/PlayerPortrait";
import { Button, Card, Tabs } from "@/components/ui";
import { childLook, parentClub, type ParentRole } from "@/engine/career/generations";
import { WORLD, clubName, leaguesInPlay } from "@/engine/data/world";
import { NAME_POOLS } from "@/engine/data/names";
import { country } from "@/engine/data/world";
import { POSITION_LABEL } from "@/engine/players/attributes";
import { POSITIONS, type GameState, type Position } from "@/engine/types";
import { useGame } from "@/game/store";

/** After retirement: start the child's career in the same world. */
export function NextGenerationCard({ g }: { g: GameState }) {
  const router = useRouter();
  const nextGeneration = useGame((s) => s.nextGeneration);
  const parent = g.players[g.user.playerId];
  const managed = parentClub(g);
  const homeLeagues = leaguesInPlay(g);
  const [first, setFirst] = useState("");
  const [position, setPosition] = useState<Position>(parent?.position ?? "ST");
  const [foot, setFoot] = useState<"L" | "R">(parent?.foot === "L" ? "L" : "R");
  const [path, setPath] = useState<"youth" | "academy">("youth");
  const [role, setRole] = useState<ParentRole>(managed ? "coach" : "agent");
  const defaultClub = managed ?? WORLD.clubs.find((c) => homeLeagues.some((l) => l.id === c.leagueId) && c.countryCode === parent?.nationality)?.id ?? g.user.startClubId;
  const [clubId, setClubId] = useState<string>(defaultClub);
  const [err, setErr] = useState<string | null>(null);
  if (!parent) return null;
  const look = childLook(parent.look, `${g.seed}:child:${(g.generation ?? 1) + 1}`);
  const clubs = WORLD.clubs.filter((c) => homeLeagues.some((l) => l.id === c.leagueId)).sort((a, b) => a.name.localeCompare(b.name));
  const randomName = () => {
    const pool = NAME_POOLS[country(parent.nationality)?.namePool ?? "english"];
    setFirst(pool.first[Math.floor(Math.random() * pool.first.length)]);
  };
  const go = async () => {
    setErr(null);
    const res = await nextGeneration({ firstName: first, position, foot, height: parent.height, role, clubId: role === "coach" && managed ? managed : clubId, path });
    if (!res.ok) setErr(res.reason ?? "Not possible.");
    else router.push("/play");
  };
  return (
    <Card title="👪 The next generation" data-testid="next-generation">
      <div className="flex flex-wrap items-start gap-4">
        <PlayerPortrait appearance={look} age={path === "youth" ? 15 : 17} size={96} kit={WORLD.clubs.find((c) => c.id === clubId)?.colors.primary} />
        <div className="grid min-w-0 flex-1 gap-3 text-sm">
          <p className="text-ink-2">Your child starts a career in this same world, with your surname, your nationality, some of your looks and maybe one of your traits.</p>
          <label className="grid gap-1 font-bold">
            First name
            <span className="flex gap-2">
              <input value={first} onChange={(e) => setFirst(e.target.value)} maxLength={20} className="min-w-0 flex-1 rounded-xl border-2 border-line bg-card px-3 py-2 font-normal" />
              <Button size="sm" tone="paper" type="button" onClick={randomName}>Random</Button>
            </span>
          </label>
          <span className="text-xs text-muted">{first || "…"} {parent.lastName}</span>
          <label className="grid gap-1 font-bold">
            Position
            <select value={position} onChange={(e) => setPosition(e.target.value as Position)} className="rounded-xl border-2 border-line bg-card px-3 py-2 font-normal">
              {POSITIONS.map((p) => <option key={p} value={p}>{POSITION_LABEL[p]}</option>)}
            </select>
          </label>
          <div className="font-bold">Foot</div>
          <Tabs compact value={foot} onChange={setFoot} items={[{ id: "R", label: "Right" }, { id: "L", label: "Left" }]} />
          <div className="font-bold">Start</div>
          <Tabs compact value={path} onChange={setPath} items={[{ id: "youth", label: "Youth academy · 15" }, { id: "academy", label: "Academy prospect · 17" }]} />
          <div className="font-bold">Your role</div>
          <Tabs
            compact
            value={role}
            onChange={setRole}
            items={[{ id: "agent", label: "Their agent" }, ...(managed ? [{ id: "coach" as const, label: `Their manager at ${clubName(managed, true)}` }] : []), { id: "none", label: "Watch from the stands" }]}
          />
          {role !== "coach" && (
            <label className="grid gap-1 font-bold">
              Club
              <select value={clubId} onChange={(e) => setClubId(e.target.value)} className="rounded-xl border-2 border-line bg-card px-3 py-2 font-normal">
                {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}
          <div className="flex items-center gap-2 text-xs"><Crest clubId={role === "coach" && managed ? managed : clubId} size={20} /> {clubName(role === "coach" && managed ? managed : clubId)}</div>
          {err && <div className="rounded-xl border-2 border-line bg-coral-2 p-2">{err}</div>}
          <Button tone="pitch" onClick={go} disabled={first.trim().length < 2}>Start {first || "their"} career ▸</Button>
        </div>
      </div>
    </Card>
  );
}
