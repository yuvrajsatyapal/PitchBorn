import { describe, expect, it } from "vitest";
import { autopilotStep } from "../src/engine/career/autopilot";
import { overallFor } from "../src/engine/players/attributes";
import { Rng } from "../src/engine/rng";
import { advanceTurn } from "../src/engine/season/advance";
import * as D from "../src/engine/traits/catalogue/derive";
import { reviewDerived, reviewTraits } from "../src/engine/traits/develop";
import { moveScoreDelta, movePressure } from "../src/engine/traits/career";
import { careerProfile, stageOf } from "../src/engine/traits/effects";
import { sanitizeTraits } from "../src/engine/traits/sanitize";
import { cleanStay, marketable, noteApproachDeclined, noteRenewal, reviewStay, stayOf } from "../src/engine/traits/stay";
import { clubTenure } from "../src/engine/traits/tenure";
import { STAGE_XP, type DeriveInput } from "../src/engine/traits/types";
import { decodeState, encodeState } from "../src/persistence/codec";
import { migrateState } from "../src/persistence/migrations";
import type { GameState, Player, StayRecord } from "../src/engine/types";
import { clubLevel } from "../src/engine/world/create";
import { newCareer } from "./helpers";

const ID = "club_oriented";
const norm = (x: unknown) => JSON.parse(JSON.stringify(x));

const record = (o: Partial<StayRecord> = {}): StayRecord => ({ clubId: "c", seasons: 9, minutes: 9 * 2800, renewals: 0, freeStays: 0, declined: 0, wavered: 0, ...o });

function input(over: Partial<DeriveInput> = {}, hidden: Partial<Player["hidden"]> = {}): DeriveInput {
  const s = newCareer({ seed: "oneclub-input", position: "CM" });
  const p = Object.values(s.players).find((x) => !x.isUser && !x.virtual && x.position === "CM")!;
  return {
    hidden: { ...p.hidden, loyalty: 80, ...hidden }, attrs: p.attrs, age: 29, reputation: 40, weakFoot: 55, tenure: 10, position: "CM", secondary: [],
    career: p.career, history: [], injuries: 0, stay: record({ renewals: 4, freeStays: 3 }), ...over,
  };
}

/** A regular at his club with the club's own level, in a world he can be moved around in. */
function setup(seed: string) {
  const s = newCareer({ seed, position: "CM" });
  const p = Object.values(s.players).find((x) => !x.isUser && !x.virtual && x.clubId && x.position === "CM")!;
  p.traits = [];
  delete p.traitProgress;
  p.hidden = { ...p.hidden, loyalty: 82 };
  return { s, p, club: s.clubs[p.clubId as string] };
}

/** Raises a player well above the level his club fields, so a bigger club would plausibly want him. */
function outgrow(p: Player, club: { reputation: number }, by = 6): void {
  const target = clubLevel(club.reputation) + by;
  for (let i = 0; i < 40 && overallFor(p.attrs, p.position) < target; i++) for (const k of Object.keys(p.attrs) as (keyof Player["attrs"])[]) p.attrs[k] = Math.min(99, p.attrs[k] + 1);
}

describe("what One-Club Minded is read from", () => {
  it("time alone never earns it, however long and however loyal", () => {
    expect(D.oneClub(input({ tenure: 14, stay: record({ seasons: 13, minutes: 13 * 3000 }) }, { loyalty: 95 }))).toBe(-1);
    // Contract extensions alone are the club's wish as much as his: still not a choice.
    expect(D.oneClub(input({ tenure: 14, stay: record({ seasons: 13, minutes: 13 * 3000, renewals: 4 }) }, { loyalty: 95 }))).toBe(-1);
    // No record at all (a long stay that left no trace) cannot be read as commitment.
    expect(D.oneClub(input({ tenure: 14, stay: undefined }))).toBe(-1);
  });

  it("a long, regular, loyal career with stays that were a choice earns it", () => {
    const earned = D.oneClub(input());
    expect(earned).toBeGreaterThanOrEqual(0.25);
    // Turning a club down is stronger evidence still.
    const turnedDown = D.oneClub(input({ stay: record({ renewals: 4, freeStays: 3, declined: 2 }) }));
    expect(turnedDown).toBeGreaterThan(earned);
  });

  it("a short stay cannot earn it, whatever else is true", () => {
    const rich = record({ seasons: 5, renewals: 4, freeStays: 3, declined: 3 });
    expect(D.oneClub(input({ tenure: 5, stay: rich }, { loyalty: 99 }))).toBe(-1);
    expect(D.oneClub(input({ tenure: 7, stay: record({ seasons: 6, renewals: 4, freeStays: 3, declined: 3 }) }, { loyalty: 99 }))).toBe(-1);
  });

  it("a fringe player or a mercenary is not the club's man", () => {
    expect(D.oneClub(input({ stay: record({ renewals: 4, freeStays: 3, minutes: 9 * 600 }) }))).toBe(-1);
    expect(D.oneClub(input({}, { loyalty: 30 }))).toBe(-1);
  });

  it("repeated renewals contribute, but only so far", () => {
    const c = (o: Partial<StayRecord>) => D.commitment(record(o));
    expect(c({ renewals: 1 })).toBeGreaterThan(c({ renewals: 0 }));
    expect(c({ renewals: 4 })).toBeGreaterThan(c({ renewals: 2 }));
    expect(c({ renewals: 40 })).toBe(c({ renewals: 4 }));
    // An extension he could have turned into a better club counts for far more than any number of ordinary ones.
    expect(c({ renewals: 1, freeStays: 1 })).toBeGreaterThan(c({ renewals: 4 }));
  });

  it("stay decisions and turned-down approaches contribute; restlessness takes it away", () => {
    const c = (o: Partial<StayRecord>) => D.commitment(record(o));
    expect(c({ freeStays: 1 })).toBeGreaterThan(c({}));
    expect(c({ declined: 1 })).toBeGreaterThan(c({ freeStays: 1 }));
    expect(c({ declined: 30 })).toBe(c({ declined: 3 }));
    expect(c({ renewals: 4, freeStays: 3, wavered: 1 })).toBeLessThan(c({ renewals: 4, freeStays: 3 }));
  });

  it("the user's own standing counts: a stay in a club that has turned on him is not devotion", () => {
    expect(D.oneClub(input({ supporters: 85, standing: { manager: 60, board: 60 } }))).toBeGreaterThanOrEqual(0.25);
    expect(D.oneClub(input({ supporters: 40, standing: { manager: 60, board: 60 } }))).toBe(-1);
    expect(D.oneClub(input({ supporters: 85, standing: { manager: 60, board: 20 } }))).toBe(-1);
  });
});

describe("how the record is kept", () => {
  it("an extension counts as a choice only if he was good enough to go somewhere better", () => {
    const { s, p, club } = setup("oneclub-renew");
    const level = clubLevel(club.reputation);
    for (const k of Object.keys(p.attrs) as (keyof Player["attrs"])[]) p.attrs[k] = Math.max(20, p.attrs[k] - 25);
    expect(overallFor(p.attrs, p.position)).toBeLessThan(level);
    noteRenewal(s, p);
    expect(p.stay?.renewals).toBe(1);
    expect(p.stay?.freeStays).toBe(0);
    outgrow(p, club);
    expect(marketable(s, p, club)).toBe(true);
    noteRenewal(s, p);
    expect(p.stay?.renewals).toBe(2);
    expect(p.stay?.freeStays).toBe(1);
  });

  it("a player nobody wanted gathers years and no commitment", () => {
    const { s, p } = setup("oneclub-unwanted");
    p.hidden = { ...p.hidden, loyalty: 95 };
    p.clubSince = { clubId: p.clubId as string, season: s.season - 12 };
    for (let i = 0; i < 12; i++) {
      p.season = { league: { ...p.career, minutes: 3000 } };
      reviewStay(s, p, 3000);
    }
    expect(p.stay?.seasons).toBe(12);
    expect(D.commitment(p.stay as StayRecord)).toBe(0);
    reviewDerived(s, p, 29, overallFor(p.attrs, p.position));
    expect(p.traits?.some((t) => t.id === ID) ?? false).toBe(false);
  });

  it("only a comparable or bigger club counts as an approach, and once a season", () => {
    const { s, p, club } = setup("oneclub-approach");
    noteApproachDeclined(s, p, club.reputation - 25);
    expect(p.stay?.declined ?? 0).toBe(0);
    noteApproachDeclined(s, p, club.reputation + 10);
    noteApproachDeclined(s, p, club.reputation + 12);
    expect(p.stay?.declined).toBe(1);
    s.season++;
    noteApproachDeclined(s, p, club.reputation);
    expect(p.stay?.declined).toBe(2);
  });

  it("the user's rejected offers and renewals reach the record", () => {
    const s = newCareer({ seed: "oneclub-user", position: "CM" });
    const u = s.players[s.user.playerId];
    noteRenewal(s, u);
    noteApproachDeclined(s, u, s.clubs[u.clubId as string].reputation + 5);
    expect(u.stay).toMatchObject({ clubId: u.clubId, renewals: 1, declined: 1 });
  });

  it("restlessness is remembered and then slowly forgiven", () => {
    const { s, p } = setup("oneclub-waver");
    p.listed = true;
    reviewStay(s, p, 2500);
    expect(p.stay?.wavered).toBe(1);
    p.listed = false;
    reviewStay(s, p, 2500);
    reviewStay(s, p, 2500);
    reviewStay(s, p, 2500);
    expect(p.stay?.wavered).toBe(0);
  });

  it("a move starts a new record, and a first look is credited only with what the history shows", () => {
    const { s, p } = setup("oneclub-move");
    const first = p.clubId as string;
    p.history = [2022, 2023, 2024, 2025].map((y) => ({ season: y, clubId: first, age: 25, overall: 70, stats: { ...p.career, minutes: 2000 } }));
    const rec = stayOf(p, s.season)!;
    expect(rec).toMatchObject({ clubId: first, seasons: 4, minutes: 8000, renewals: 0, freeStays: 0, declined: 0 });
    rec.renewals = 3;
    const other = Object.keys(s.clubs).find((id) => id !== first)!;
    p.clubId = other;
    const next = stayOf(p, s.season)!;
    expect(next).toMatchObject({ clubId: other, seasons: 0, renewals: 0 });
    p.clubId = null;
    expect(stayOf(p, s.season)).toBeUndefined();
    expect(p.stay).toBeUndefined();
  });
});

describe("earning it, holding it, losing it", () => {
  function loyalist(seed: string) {
    const { s, p, club } = setup(seed);
    p.clubSince = { clubId: p.clubId as string, season: s.season - 10 };
    outgrow(p, club);
    p.stay = { clubId: p.clubId as string, seasons: 10, minutes: 10 * 2800, renewals: 4, freeStays: 3, declined: 1, wavered: 0 };
    return { s, p, club };
  }

  it("an NPC with a loyal career earns it at the season review, without any history scan", () => {
    const { s, p } = loyalist("oneclub-npc");
    expect(clubTenure(p, s.season)).toBeGreaterThanOrEqual(8);
    reviewTraits(s, p, Rng.fromSeed("review"), false);
    const t = p.traits?.find((x) => x.id === ID);
    expect(t, "earned").toBeDefined();
    expect(stageOf(t!.xp)).not.toBeNull();
    // He is noticeably less likely to leave.
    expect(careerProfile(p).loyalty).toBeGreaterThan(0.15);
  });

  it("is not duplicated or regenerated by reviewing again", () => {
    const { s, p } = loyalist("oneclub-npc");
    reviewTraits(s, p, Rng.fromSeed("a"), false);
    reviewTraits(s, p, Rng.fromSeed("b"), false);
    expect(p.traits?.filter((t) => t.id === ID)).toHaveLength(1);
  });

  it("a restless season weakens it slowly while he stays", () => {
    const { s, p } = loyalist("oneclub-restless");
    reviewDerived(s, p, 29, 70);
    const xp = p.traits!.find((t) => t.id === ID)!.xp;
    p.stay = { ...(p.stay as StayRecord), wavered: 3 };
    reviewDerived(s, p, 29, 70);
    const after = p.traits!.find((t) => t.id === ID)?.xp ?? 0;
    expect(after).toBeLessThan(xp);
    expect(xp - after).toBeLessThanOrEqual(10.01);
  });

  it("leaving the club lets it fade quickly: the bond was to that badge, and it does not follow him", () => {
    const { s, p } = loyalist("oneclub-leave");
    p.traits = [{ id: ID, xp: STAGE_XP.signature + 4, since: s.season - 2 }];
    const from = p.clubId as string;
    const other = Object.keys(s.clubs).find((id) => id !== from)!;
    p.clubId = other;
    p.clubSince = { clubId: other, season: s.season };
    const years: number[] = [];
    for (let i = 0; i < 8; i++) {
      stayOf(p, s.season);
      reviewDerived(s, p, 30, 70);
      years.push(p.traits!.find((t) => t.id === ID)?.xp ?? 0);
      if (!years[i]) break;
    }
    // Not gone in a day, not carried for a decade.
    expect(years[0]).toBeGreaterThan(STAGE_XP.established);
    expect(years.findIndex((x) => x === 0)).toBeGreaterThanOrEqual(2);
    expect(years.findIndex((x) => x === 0)).toBeLessThanOrEqual(5);
    expect(p.traits?.some((t) => t.id === ID) ?? false).toBe(false);
  });

  it("a loan does not strip it", () => {
    const { s, p } = loyalist("oneclub-loan");
    p.traits = [{ id: ID, xp: 120, since: s.season - 2 }];
    p.loan = { fromClubId: p.clubId as string, untilSeason: s.season + 1 } as Player["loan"];
    const other = Object.keys(s.clubs).find((id) => id !== p.clubId)!;
    p.clubId = other;
    p.clubSince = { clubId: other, season: s.season };
    reviewDerived(s, p, 29, 70);
    expect(p.traits?.find((t) => t.id === ID)?.xp).toBe(120);
  });

  it("is never a hard lock: it weighs heavily on a move, and a club in crisis takes most of it away", () => {
    const { s, p, club } = loyalist("oneclub-lock");
    p.traits = [{ id: ID, xp: 170, since: s.season - 3 }];
    p.hidden = { ...p.hidden, loyalty: 82 };
    const buyer = Object.values(s.clubs).filter((c) => c.id !== club.id).sort((a, b) => Math.abs(a.reputation - club.reputation) - Math.abs(b.reputation - club.reputation))[0];
    club.balance = 5_000_000;
    p.listed = false;
    const settled = moveScoreDelta(s, p, buyer, 1);
    // Heavy: far more than a typical ambition-driven pull could cancel…
    expect(settled).toBeLessThan(-12);
    // …but not absolute: money trouble at the club frees him.
    club.balance = -1_000_000;
    const crisis = moveScoreDelta(s, p, buyer, 1);
    expect(crisis).toBeGreaterThan(settled + 8);
    expect(movePressure(s, p).crisis).toBe(true);
  });
});

describe("persistence", () => {
  it("round-trips the record and the trait, and loading never invents either", () => {
    const { s, p } = setup("oneclub-save");
    p.stay = { clubId: p.clubId as string, seasons: 9, minutes: 25000, renewals: 3, freeStays: 2, declined: 1, wavered: 0.34, lastDeclined: s.season - 1 };
    p.traits = [{ id: ID, xp: 90, since: 2030 }];
    const back = decodeState(JSON.parse(JSON.stringify(encodeState(s))));
    expect(back.players[p.id].stay).toEqual(p.stay);
    expect(back.players[p.id].traits).toEqual(p.traits);
    const loaded = migrateState(norm(s));
    expect(loaded.players[p.id].stay).toEqual(p.stay);
    expect(loaded.players[p.id].traits).toEqual(p.traits);
    // Nobody else gained it from loading.
    expect(Object.values(loaded.players).filter((x) => x.traits?.some((t) => t.id === ID))).toHaveLength(1);
  });

  it("an old save has no records and gains no One-Club Minded", () => {
    const s = newCareer({ seed: "oneclub-old", position: "CM" });
    for (const p of Object.values(s.players)) {
      p.clubSince = p.clubId ? { clubId: p.clubId, season: s.season - 12 } : undefined;
      if (!p.clubSince) delete p.clubSince;
    }
    const old = norm(s);
    old.schemaVersion = 13;
    for (const p of Object.values(old.players) as Player[]) delete p.stay;
    const m = migrateState(old);
    expect(Object.values(m.players).filter((x) => x.traits?.some((t) => t.id === ID))).toHaveLength(0);
    expect(Object.values(m.players).filter((x) => x.stay)).toHaveLength(0);
  });

  it("drops a record that is invalid or belongs to another club", () => {
    const { s, p } = setup("oneclub-bad");
    p.stay = { clubId: "somewhere-else", seasons: 5, minutes: 1, renewals: 1, freeStays: 0, declined: 0, wavered: 0 };
    sanitizeTraits(s);
    expect(p.stay).toBeUndefined();
    p.stay = { clubId: p.clubId as string, seasons: Number.NaN, minutes: 1, renewals: 1, freeStays: 0, declined: 0, wavered: 0 };
    cleanStay(p);
    expect(p.stay).toBeUndefined();
    p.stay = { clubId: p.clubId as string, seasons: 5, minutes: 9000, renewals: 1, freeStays: 7, declined: 0, wavered: 0 };
    cleanStay(p);
    expect(p.stay?.freeStays).toBe(1);
  });
});

describe("a whole world", () => {
  it("produces some, and few: a lite league world over ten seasons", () => {
    const s: GameState = newCareer({ seed: "oneclub-world", position: "CM" });
    const rng = Rng.fromSeed("oneclub-world");
    const start = s.season;
    while (s.season < start + 10 && !s.user.retired) {
      autopilotStep(s, rng);
      advanceTurn(s);
    }
    const live = Object.values(s.players).filter((p) => !p.virtual && !p.retired && p.clubId);
    const holders = live.filter((p) => stageOf(p.traits?.find((t) => t.id === ID)?.xp ?? 0));
    // Rare…
    expect(holders.length / live.length).toBeLessThan(0.06);
    // …but not absent, and every holder is the real thing.
    expect(holders.length).toBeGreaterThan(0);
    for (const p of holders) {
      expect(clubTenure(p, s.season), p.id).toBeGreaterThanOrEqual(D.ONE_CLUB.tenure);
      expect(p.stay?.seasons ?? 0, p.id).toBeGreaterThanOrEqual(D.ONE_CLUB.seasons);
      expect((p.stay?.freeStays ?? 0) + (p.stay?.declined ?? 0), p.id).toBeGreaterThan(0);
      expect(p.hidden.loyalty, p.id).toBeGreaterThanOrEqual(D.ONE_CLUB.loyalty);
    }
  }, 600_000);
});
