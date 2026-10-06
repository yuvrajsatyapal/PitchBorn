"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Crest } from "@/components/art/Crest";
import { Flag } from "@/components/art/Flag";
import { Portrait } from "@/components/art/Portrait";
import { PublicHeader } from "@/components/app/PublicHeader";
import { LoadingScreen } from "@/components/app/GameShell";
import { Badge, Button, Card, Tabs } from "@/components/ui";
import { NAME_POOLS } from "@/engine/data/names";
import { WORLD, country, stadium } from "@/engine/data/world";
import { POSITION_LABEL } from "@/engine/players/attributes";
import { POSITIONS, type Appearance, type Position } from "@/engine/types";
import { playingTimeOutlook } from "@/engine/world/create";
import { useGame } from "@/game/store";

const STEPS = ["Identity", "Player", "Path & club", "Confirm"];
const LEAGUE_COUNTRIES = ["ENG", "ESP", "GER", "ITA", "FRA"];

function pick<T>(xs: T[]): T {
  return xs[Math.floor(Math.random() * xs.length)];
}

export default function NewCareer() {
  const router = useRouter();
  const newCareer = useGame((s) => s.newCareer);
  const busy = useGame((s) => s.busy);
  const [step, setStep] = useState(0);
  const [firstName, setFirst] = useState("");
  const [lastName, setLast] = useState("");
  const [nationality, setNat] = useState("ENG");
  const [birthCountry, setBirth] = useState("ENG");
  const [position, setPos] = useState<Position>("ST");
  const [foot, setFoot] = useState<"L" | "R" | "B">("R");
  const [height, setHeight] = useState(180);
  const [look, setLook] = useState<Appearance>({ skin: 1, hair: 1, hairColor: 1, facial: 0, eyes: 1 });
  const [path, setPath] = useState<"academy" | "late">("academy");
  const [clubCountry, setClubCountry] = useState("ENG");
  const [tier, setTier] = useState(2);
  const [clubId, setClub] = useState<string>("");
  const [difficulty, setDiff] = useState<"relaxed" | "standard" | "hardcore">("standard");
  const [err, setErr] = useState<string | null>(null);

  const countries = useMemo(() => [...WORLD.countries].sort((a, b) => a.name.localeCompare(b.name)), []);
  const clubs = useMemo(
    () => WORLD.clubs.filter((c) => c.countryCode === clubCountry && WORLD.leagues.find((l) => l.id === c.leagueId)?.tier === tier).sort((a, b) => b.prestige - a.prestige),
    [clubCountry, tier],
  );
  const club = WORLD.clubs.find((c) => c.id === clubId);

  const randomName = () => {
    const pool = NAME_POOLS[country(nationality)?.namePool ?? "english"];
    setFirst(pick(pool.first));
    setLast(pick(pool.last));
  };
  const canNext = step === 0 ? firstName.trim().length >= 2 && lastName.trim().length >= 2 : step === 2 ? !!clubId : true;

  const start = async () => {
    setErr(null);
    try {
      await newCareer({ saveName: `${firstName} ${lastName}`, firstName, lastName, nationality, birthCountry, position, foot, height, look, clubId, path, difficulty });
      router.push("/play");
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  if (busy) return <div className="grid min-h-screen place-items-center"><LoadingScreen label={busy} /></div>;

  const playingTimeHint = (prestige: number) => {
    const { outlook, level, start: you } = playingTimeOutlook(prestige, path);
    const map = { good: { t: "Good minutes", tone: "pitch" as const }, fight: { t: "Fight for minutes", tone: "sun" as const }, few: { t: "Few minutes", tone: "coral" as const } };
    return { ...map[outlook], level, you };
  };

  return (
    <div className="min-h-screen pb-16">
      <PublicHeader />
      <main className="mx-auto max-w-4xl px-4">
        <ol className="mb-5 flex flex-wrap gap-2" aria-label="Steps">
          {STEPS.map((s, i) => (
            <li key={s} className={`rounded-full border-2 border-line px-3 py-1 text-sm font-bold ${i === step ? "bg-sun text-[#1b1712]" : i < step ? "bg-pitch-2" : "bg-card text-muted"}`}>
              {i + 1}. {s}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <Card title="Who are you?">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-bold">
                First name
                <input value={firstName} onChange={(e) => setFirst(e.target.value)} maxLength={20} className="rounded-xl border-2 border-line bg-card px-3 py-2.5 text-base font-normal" />
              </label>
              <label className="grid gap-1 text-sm font-bold">
                Last name
                <input value={lastName} onChange={(e) => setLast(e.target.value)} maxLength={24} className="rounded-xl border-2 border-line bg-card px-3 py-2.5 text-base font-normal" />
              </label>
              <label className="grid gap-1 text-sm font-bold">
                Nationality
                <select value={nationality} onChange={(e) => (setNat(e.target.value), setBirth(e.target.value))} className="rounded-xl border-2 border-line bg-card px-3 py-2.5 text-base font-normal">
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-bold">
                Birth country <span className="text-xs font-normal text-muted">(a different birth country gives dual eligibility)</span>
                <select value={birthCountry} onChange={(e) => setBirth(e.target.value)} className="rounded-xl border-2 border-line bg-card px-3 py-2.5 text-base font-normal">
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Button tone="paper" size="sm" onClick={randomName}>
                🎲 Random name
              </Button>
              <span className="flex items-center gap-2 text-sm">
                <Flag code={nationality} /> {country(nationality)?.name}
              </span>
            </div>
          </Card>
        )}

        {step === 1 && (
          <div className="grid gap-4 md:grid-cols-[1fr_260px]">
            <Card title="Your game">
              <div className="mb-2 text-sm font-bold">Position</div>
              <div className="grid grid-cols-5 gap-2">
                {POSITIONS.map((p) => (
                  <button key={p} onClick={() => setPos(p)} aria-pressed={position === p} title={POSITION_LABEL[p]} className={`min-h-[44px] rounded-xl border-2 border-line text-sm font-black ${position === p ? "bg-sun text-[#1b1712] shadow-[2px_2px_0_var(--shadow)]" : "bg-card"}`}>
                    {p}
                  </button>
                ))}
              </div>
              <div className="mt-1 text-sm text-ink-2">{POSITION_LABEL[position]}</div>
              <div className="mt-4 mb-2 text-sm font-bold">Preferred foot</div>
              <Tabs value={foot} onChange={setFoot} items={[{ id: "R", label: "Right" }, { id: "L", label: "Left" }, { id: "B", label: "Both" }]} />
              <label className="mt-4 grid gap-1 text-sm font-bold">
                Height: {height} cm
                <input type="range" min={160} max={202} value={height} onChange={(e) => setHeight(Number(e.target.value))} className="accent-[var(--pitch)]" />
              </label>
              <p className="mt-1 text-xs text-muted">Taller helps heading and strength; shorter helps pace and agility.</p>
            </Card>
            <Card title="Look">
              <div className="mb-3 flex justify-center">
                <Portrait look={look} size={120} />
              </div>
              {(
                [
                  ["skin", "Skin", 6],
                  ["hair", "Hair", 8],
                  ["hairColor", "Hair colour", 6],
                  ["facial", "Facial hair", 4],
                  ["eyes", "Eyes", 3],
                ] as const
              ).map(([k, label, n]) => (
                <div key={k} className="mb-2 flex items-center justify-between gap-2 text-sm font-bold">
                  {label}
                  <span className="flex items-center gap-1">
                    <button className="h-8 w-8 rounded-full border-2 border-line bg-card" aria-label={`Previous ${label}`} onClick={() => setLook({ ...look, [k]: (look[k] + n - 1) % n })}>
                      ‹
                    </button>
                    <span className="w-6 text-center tabular-nums">{look[k] + 1}</span>
                    <button className="h-8 w-8 rounded-full border-2 border-line bg-card" aria-label={`Next ${label}`} onClick={() => setLook({ ...look, [k]: (look[k] + 1) % n })}>
                      ›
                    </button>
                  </span>
                </div>
              ))}
            </Card>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4">
            <Card title="How does it start?">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { id: "academy" as const, t: "Academy prospect · age 17", d: "Raw but full of potential. Expect to fight for minutes — loans can help." },
                  { id: "late" as const, t: "Late starter · age 20", d: "Closer to the first team now, a little less ceiling." },
                ].map((o) => (
                  <button key={o.id} onClick={() => setPath(o.id)} aria-pressed={path === o.id} className={`rounded-2xl border-2 border-line p-4 text-left ${path === o.id ? "bg-sun-2 shadow-[3px_3px_0_var(--shadow)]" : "bg-card"}`}>
                    <div className="font-display text-xl">{o.t}</div>
                    <div className="text-sm text-ink-2">{o.d}</div>
                  </button>
                ))}
              </div>
              <div className="mt-4 text-sm font-bold">Difficulty</div>
              <Tabs value={difficulty} onChange={setDiff} items={[{ id: "relaxed", label: "Easy" }, { id: "standard", label: "Medium" }, { id: "hardcore", label: "Hard" }]} />
            </Card>
            <Card title="Choose your first club">
              <Tabs value={clubCountry} onChange={(c) => (setClubCountry(c), setClub(""))} items={LEAGUE_COUNTRIES.map((c) => ({ id: c, label: <span className="flex items-center gap-1.5"><Flag code={c} />{country(c)?.name}</span> }))} />
              <Tabs
                className="mt-2"
                value={String(tier)}
                onChange={(t) => (setTier(Number(t)), setClub(""))}
                items={WORLD.leagues.filter((l) => l.countryCode === clubCountry).map((l) => ({ id: String(l.tier), label: `${l.name}` }))}
              />
              <ul className="mt-3 grid gap-2 sm:max-h-[420px] sm:grid-cols-2 sm:overflow-y-auto sm:pr-1">
                {clubs.map((c) => {
                  const hint = playingTimeHint(c.prestige);
                  return (
                    <li key={c.id}>
                      <button onClick={() => setClub(c.id)} aria-pressed={clubId === c.id} className={`flex w-full items-center gap-3 rounded-xl border-2 border-line p-2.5 text-left ${clubId === c.id ? "bg-sun-2 shadow-[2px_2px_0_var(--shadow)]" : "bg-card hover:bg-paper-2"}`}>
                        <Crest clubId={c.id} size={36} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-bold">{c.name}</div>
                          <div className="truncate text-xs text-muted">
                            {stadium(c.stadiumId)?.name} · {c.city}
                          </div>
                          <div className="text-[11px] text-ink-2">
                            Squad level {hint.level} · you start ≈{hint.you}
                          </div>
                        </div>
                        <Badge tone={hint.tone} className="shrink-0">{hint.t}</Badge>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>
        )}

        {step === 3 && club && (
          <Card title="Ready?">
            <div className="flex flex-wrap items-center gap-5">
              <Portrait look={look} size={110} kit={club.colors.primary} />
              <div>
                <div className="font-display text-3xl">
                  {firstName} {lastName}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                  <Flag code={nationality} /> {country(nationality)?.name}
                  {birthCountry !== nationality && <> · born in {country(birthCountry)?.name}</>} · {POSITION_LABEL[position]} · {height} cm · {foot === "R" ? "Right" : foot === "L" ? "Left" : "Two"}-footed
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <Crest clubId={club.id} size={28} /> {path === "academy" ? "Academy" : "First-team squad"} at <b>{club.name}</b>
                </div>
                <div className="mt-1 text-xs text-muted">Season 2026/27 · difficulty {{ relaxed: "Easy", standard: "Medium", hardcore: "Hard" }[difficulty]}. Your true potential is hidden — scouts will give you hints.</div>
              </div>
            </div>
            {err && <div className="mt-3 rounded-xl border-2 border-line bg-coral-2 p-2 text-sm">{err}</div>}
          </Card>
        )}

        <div className="sticky bottom-0 z-20 -mx-4 mt-5 flex justify-between border-t-2 border-line/20 bg-paper/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
          <Button tone="paper" onClick={() => (step === 0 ? router.push("/") : setStep(step - 1))}>
            ‹ Back
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext}>
              Next ›
            </Button>
          ) : (
            <Button tone="pitch" size="lg" onClick={start}>
              Begin career ▸
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
