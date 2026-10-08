import { describe, expect, it } from "vitest";
import { resolveDecision } from "../src/engine/career/events";
import { iconicNumber, retireNumberHonour, ICONIC_MIN_SEASONS, RETIRE_MIN_SEASONS } from "../src/engine/jersey/legacy";
import {
  PRESTIGE_NUMBERS,
  SQUAD_NO_MAX,
  assignNationalNumbers,
  canChangeNumber,
  chooseIntlNumber,
  chooseSquadNumber,
  intlNumberOf,
  isSquadNumberAvailable,
  jerseyOf,
  numberOptions,
  numberOwner,
  offerVacatedNumber,
  preferredNumber,
  repairSquad,
  sanitizeJersey,
  squadMembers,
  suggestNumbers,
} from "../src/engine/jersey/numbers";
import { advanceTurn } from "../src/engine/season/advance";
import { selectNationalSquads } from "../src/engine/national/national";
import { resolveInvitation } from "../src/engine/national/allegiance";
import { lineupView } from "../src/engine/season/preview";
import { computeLegacy } from "../src/engine/career/legacy";
import type { Fixture, GameState } from "../src/engine/types";
import { addToSquad, removeFromSquad, userPlayer } from "../src/engine/world/helpers";
import { decodeState, encodeState } from "../src/persistence/codec";
import { migrateState } from "../src/persistence/migrations";
import { newCareer, strongUser } from "./helpers";

const me = (s: GameState) => userPlayer(s);
const club = (s: GameState) => s.clubs[me(s).clubId as string];
const other = (s: GameState, not: string[] = []) => Object.values(s.clubs).find((c) => c.id !== me(s).clubId && !not.includes(c.id))!;

function move(s: GameState, clubId: string) {
  const p = me(s);
  removeFromSquad(s, p.id);
  addToSquad(s, p.id, clubId);
  p.contract = { ...p.contract!, clubId };
}

const allUnique = (s: GameState) => Object.keys(s.clubs).every((id) => {
  const nums = squadMembers(s, id).map((p) => p.squadNo);
  return nums.every((n) => typeof n === "number" && n >= 1 && n <= SQUAD_NO_MAX) && new Set(nums).size === nums.length;
});

describe("first number and uniqueness", () => {
  it("gives every registered player a valid number, unique within the club", () => {
    const s = newCareer({ seed: "jn-1" });
    expect(allUnique(s)).toBe(true);
    expect(me(s).squadNo).toBeGreaterThanOrEqual(1);
    expect(jerseyOf(s).history).toHaveLength(1);
    expect(jerseyOf(s).history[0]).toMatchObject({ clubId: club(s).id, no: me(s).squadNo });
    expect(jerseyOf(s).choice).toBe(true);
  });

  it("does not hand a prestige shirt to a prospect, and the user is not reserved one", () => {
    const s = newCareer({ seed: "jn-2", path: "academy" });
    const p = me(s);
    if (p.contract?.role === "prospect") expect(PRESTIGE_NUMBERS.includes(p.squadNo as number)).toBe(false);
    // Over many careers a prospect never opens in 7, 9 or 10.
    for (let i = 0; i < 12; i++) {
      const t = newCareer({ seed: `jn-2-${i}`, path: "academy" });
      if (me(t).contract?.role === "prospect") expect(PRESTIGE_NUMBERS.includes(me(t).squadNo as number)).toBe(false);
    }
  });

  it("numbers goalkeepers and strikers in the usual places, for NPCs", () => {
    const s = newCareer({ seed: "jn-3" });
    const c = Object.values(s.clubs)[3];
    const gks = squadMembers(s, c.id).filter((p) => p.position === "GK").sort((a, b) => (a.squadNo as number) - (b.squadNo as number));
    expect(gks[0].squadNo).toBeLessThanOrEqual(31);
    const best = squadMembers(s, c.id).filter((p) => p.position === "ST");
    expect(best.some((p) => [9, 10, 19, 18, 20].includes(p.squadNo as number) || (p.squadNo as number) >= 12)).toBe(true);
  });

  it("keeps numbers unique through transfers, retirements and several seasons, and stable between them", () => {
    const s = newCareer({ seed: "jn-4" });
    const snap = (id: string) => Object.fromEntries(squadMembers(s, id).map((p) => [p.id, p.squadNo]));
    const c = Object.values(s.clubs)[5];
    const before = snap(c.id);
    for (let i = 0; i < 20; i++) advanceTurn(s);
    expect(allUnique(s)).toBe(true);
    const after = snap(c.id);
    const kept = Object.keys(before).filter((id) => after[id] !== undefined && after[id] === before[id]).length;
    expect(kept).toBeGreaterThan(Object.keys(before).filter((id) => after[id] !== undefined).length * 0.9);
    for (let i = 0; i < 130; i++) advanceTurn(s);
    expect(allUnique(s)).toBe(true);
  }, 120_000);

  it("a user's number never collides with another active squad member", () => {
    const s = newCareer({ seed: "jn-5" });
    strongUser(s);
    for (let i = 0; i < 160; i++) advanceTurn(s);
    const p = me(s);
    if (p.clubId) expect(squadMembers(s, p.clubId).filter((x) => x.squadNo === p.squadNo)).toHaveLength(1);
  }, 120_000);
});

describe("availability and choosing", () => {
  it("answers availability from the squad, and ignores the player's own number", () => {
    const s = newCareer({ seed: "jn-6" });
    const p = me(s);
    const owner = squadMembers(s, club(s).id).find((x) => x.id !== p.id)!;
    expect(isSquadNumberAvailable(s, club(s).id, owner.squadNo as number)).toBe(false);
    expect(isSquadNumberAvailable(s, club(s).id, owner.squadNo as number, owner.id)).toBe(true);
    expect(isSquadNumberAvailable(s, club(s).id, 0)).toBe(false);
    expect(isSquadNumberAvailable(s, club(s).id, 100)).toBe(false);
    expect(isSquadNumberAvailable(s, club(s).id, 2.5)).toBe(false);
    expect(numberOwner(s, club(s).id, owner.squadNo as number)?.id).toBe(owner.id);
  });

  it("lets a striker choose any free number, not only the 'right' one", () => {
    const s = newCareer({ seed: "jn-7", position: "ST" });
    const free = [14, 21, 23, 30, 44].find((n) => isSquadNumberAvailable(s, club(s).id, n, me(s).id))!;
    expect(chooseSquadNumber(s, free).ok).toBe(true);
    expect(me(s).squadNo).toBe(free);
  });

  it("rejects an occupied number and says who has it, without changing anything", () => {
    const s = newCareer({ seed: "jn-8" });
    const owner = squadMembers(s, club(s).id).find((x) => x.id !== me(s).id)!;
    const mine = me(s).squadNo;
    const r = chooseSquadNumber(s, owner.squadNo as number);
    expect(r.ok).toBe(false);
    expect(r.message).toContain(owner.lastName);
    expect(me(s).squadNo).toBe(mine);
    expect(chooseSquadNumber(s, 0).ok).toBe(false);
    expect(chooseSquadNumber(s, 150).ok).toBe(false);
  });

  it("rejects a retired number", () => {
    const s = newCareer({ seed: "jn-9" });
    const n = [33, 34, 35].find((x) => isSquadNumberAvailable(s, club(s).id, x, me(s).id))!;
    club(s).retiredNumbers = [{ no: n, playerId: "legend", season: 2020 }];
    expect(isSquadNumberAvailable(s, club(s).id, n)).toBe(false);
    expect(chooseSquadNumber(s, n).message).toMatch(/retired/);
    expect(numberOptions(s).find((o) => o.no === n)?.retired).toBe(true);
  });

  it("limits changes to joining a club or the start of a season, once", () => {
    const s = newCareer({ seed: "jn-10" });
    const [a, b] = [41, 42, 43, 44].filter((x) => isSquadNumberAvailable(s, club(s).id, x, me(s).id));
    expect(canChangeNumber(s).ok).toBe(true); // the free choice at the start
    expect(chooseSquadNumber(s, a).ok).toBe(true);
    // Still preseason, but the free choice has been used and a change was made this season.
    expect(canChangeNumber(s).ok).toBe(false);
    expect(chooseSquadNumber(s, b).ok).toBe(false);
    s.turn = 30;
    s.season++;
    s.turn = 3;
    expect(canChangeNumber(s).ok).toBe(true); // a new season's registration
    s.turn = 30;
    expect(canChangeNumber(s).ok).toBe(false); // mid-season
  });

  it("suggests position-sensible free numbers, with the player's own history first", () => {
    const s = newCareer({ seed: "jn-11", position: "GK" });
    const sug = suggestNumbers(s, club(s).id, me(s));
    expect(sug.every((n) => isSquadNumberAvailable(s, club(s).id, n, me(s).id))).toBe(true);
    expect(sug.length).toBeGreaterThan(5);
    const st = newCareer({ seed: "jn-12", position: "ST" });
    const stSug = suggestNumbers(st, club(st).id, me(st), 40);
    for (const n of [9, 10]) if (isSquadNumberAvailable(st, club(st).id, n, me(st).id) && me(st).contract?.role !== "prospect") expect(stSug.includes(n)).toBe(true);
  });

  it("does not let number affect how anyone plays", () => {
    const s = newCareer({ seed: "jn-13" });
    const p = me(s);
    const attrs = JSON.stringify(p.attrs);
    chooseSquadNumber(s, [9, 10, 14, 30].find((n) => isSquadNumberAvailable(s, club(s).id, n, p.id))!);
    expect(JSON.stringify(p.attrs)).toBe(attrs);
  });
});

describe("transfers and vacated numbers", () => {
  it("keeps the previous number at a new club when it is free, and takes another when it is not", () => {
    const s = newCareer({ seed: "jn-14" });
    const p = me(s);
    const dest = other(s);
    const owner = squadMembers(s, dest.id)[0];
    const mine = p.squadNo as number;
    // Free: keeps the number.
    for (const x of squadMembers(s, dest.id)) if (x.squadNo === mine) x.squadNo = 98;
    move(s, dest.id);
    expect(p.squadNo).toBe(mine);
    expect(allUnique(s)).toBe(true);
    // Occupied: the transfer still goes through, with another valid number.
    const back = other(s, [dest.id]);
    const holder = squadMembers(s, back.id).find((x) => x.id !== p.id)!;
    p.squadNo = holder.squadNo;
    move(s, back.id);
    expect(p.clubId).toBe(back.id);
    expect(p.squadNo).not.toBe(holder.squadNo);
    expect(isSquadNumberAvailable(s, back.id, p.squadNo as number, p.id)).toBe(true);
    expect(owner).toBeTruthy();
  });

  it("allows a free choice on joining, and the same number at two clubs", () => {
    const s = newCareer({ seed: "jn-15" });
    jerseyOf(s).choice = false;
    move(s, other(s).id);
    expect(jerseyOf(s).choice).toBe(true);
    const n = me(s).squadNo as number;
    move(s, other(s, [me(s).clubId as string]).id);
    for (const x of Object.values(s.clubs)) expect(squadMembers(s, x.id).filter((y) => y.squadNo === n).length).toBeLessThanOrEqual(1);
  });

  it("frees a number when its wearer leaves", () => {
    const s = newCareer({ seed: "jn-16" });
    const owner = squadMembers(s, club(s).id).find((x) => x.id !== me(s).id)!;
    const n = owner.squadNo as number;
    expect(isSquadNumberAvailable(s, club(s).id, n, me(s).id)).toBe(false);
    removeFromSquad(s, owner.id);
    expect(isSquadNumberAvailable(s, club(s).id, n, me(s).id)).toBe(true);
    owner.retired = true;
  });

  it("offers a vacated number the player has a claim on, once, and applies the request", () => {
    const s = newCareer({ seed: "jn-17", position: "ST" });
    strongUser(s);
    me(s).reputation = 80;
    const c = club(s);
    // Free 9 and 10 by moving their wearers on, and make the user a star at a squad number far from them.
    for (const n of [9, 10]) {
      const o = numberOwner(s, c.id, n);
      if (o && o.id !== me(s).id) o.squadNo = 90 + (n % 9);
    }
    me(s).squadNo = 44;
    jerseyOf(s).choice = false;
    offerVacatedNumber(s);
    const d = s.user.decisions.find((x) => x.jerseyNo !== undefined)!;
    expect(d).toBeTruthy();
    expect([9, 10]).toContain(d.jerseyNo);
    offerVacatedNumber(s);
    expect(s.user.decisions.filter((x) => x.jerseyNo !== undefined)).toHaveLength(1); // no spam
    resolveDecision(s, d.id, "request");
    expect(me(s).squadNo).toBe(d.jerseyNo);
    expect(allUnique(s)).toBe(true);
    expect(s.news.some((n) => n.title === "Iconic shirt")).toBe(true);
  });

  it("keeps the number when the offer is declined and does not offer it again that season", () => {
    const s = newCareer({ seed: "jn-18", position: "ST" });
    strongUser(s);
    me(s).reputation = 80;
    for (const n of [9, 10]) {
      const o = numberOwner(s, club(s).id, n);
      if (o && o.id !== me(s).id) o.squadNo = 90 + (n % 9);
    }
    me(s).squadNo = 44;
    offerVacatedNumber(s);
    const d = s.user.decisions.find((x) => x.jerseyNo !== undefined)!;
    resolveDecision(s, d.id, "keep");
    expect(me(s).squadNo).toBe(44);
    offerVacatedNumber(s);
    expect(s.user.decisions.some((x) => x.jerseyNo === d.jerseyNo)).toBe(false);
  });
});

describe("history and preference", () => {
  it("records compact tenures: a new record only when the club or number changes", () => {
    const s = newCareer({ seed: "jh-1" });
    const first = me(s).squadNo as number;
    for (let i = 0; i < 60; i++) advanceTurn(s);
    expect(jerseyOf(s).history.filter((t) => t.no === first && t.clubId === club(s).id)).toHaveLength(1);
    const n = Array.from({ length: 60 }, (_, i) => 30 + i).find((x) => x !== me(s).squadNo && isSquadNumberAvailable(s, club(s).id, x, me(s).id))!;
    jerseyOf(s).choice = true;
    chooseSquadNumber(s, n);
    const h = jerseyOf(s).history;
    expect(h.at(-1)).toMatchObject({ no: n, clubId: club(s).id });
    expect(h.at(-2)?.to).toBeTruthy();
    expect(h.filter((t) => !t.to)).toHaveLength(1);
    jerseyOf(s).choice = true;
    chooseSquadNumber(s, n);
    expect(jerseyOf(s).history).toHaveLength(h.length);
  }, 60_000);

  it("derives a preferred number from long use, and suggests it first when free", () => {
    const s = newCareer({ seed: "jh-2" });
    jerseyOf(s).history = [{ clubId: "a", no: 17, from: { season: 2020, turn: 1 }, to: { season: 2026, turn: 5 } }, { clubId: "b", no: 8, from: { season: 2026, turn: 5 } }];
    s.season = 2026;
    expect(preferredNumber(s)).toBe(17);
    const dest = other(s);
    const holder = numberOwner(s, dest.id, 17);
    if (holder) holder.squadNo = 97;
    removeFromSquad(s, me(s).id);
    addToSquad(s, me(s).id, dest.id);
    expect(me(s).squadNo).toBe(17);
    // When it is occupied, nobody is forced out.
    const t = newCareer({ seed: "jh-3" });
    jerseyOf(t).history = [{ clubId: "a", no: 17, from: { season: 2020, turn: 1 }, to: { season: 2026, turn: 5 } }];
    t.season = 2026;
    const d2 = other(t);
    const w = squadMembers(t, d2.id)[0];
    w.squadNo = 17;
    removeFromSquad(t, me(t).id);
    addToSquad(t, me(t).id, d2.id);
    expect(w.squadNo).toBe(17);
    expect(me(t).squadNo).not.toBe(17);
  });

  it("returns to a former number at a former club with a restrained headline", () => {
    const s = newCareer({ seed: "jh-4" });
    const home = club(s).id;
    const n = me(s).squadNo as number;
    jerseyOf(s).history = [{ clubId: home, no: n, from: { season: 2020, turn: 1 }, to: { season: 2026, turn: 1 } }];
    s.season = 2026;
    removeFromSquad(s, me(s).id);
    me(s).squadNo = n;
    const dest = other(s);
    move(s, dest.id);
    move(s, s.clubs[home].id);
    expect(s.news.some((x) => x.title === "Returning number")).toBe(true);
    expect(s.user.memories.filter((m) => m.kind === "shirt-number").length).toBeLessThanOrEqual(1);
  });
});

describe("national-team numbers", () => {
  function called(seed: string) {
    const s = newCareer({ seed, nationality: "FRA", birthCountry: "MAR" });
    strongUser(s);
    me(s).reputation = 95;
    me(s).form = 9;
    selectNationalSquads(s);
    return s;
  }

  it("gives called-up players squad numbers separate from their club number", () => {
    const s = called("nn-1");
    const nt = s.nationalTeams.FRA;
    expect(nt.squad).toContain(me(s).id);
    const mine = nt.numbers![me(s).id];
    expect(mine).toBeGreaterThanOrEqual(1);
    expect(new Set(Object.values(nt.numbers!)).size).toBe(Object.keys(nt.numbers!).length);
    expect(Object.keys(nt.numbers!).every((id) => nt.squad.includes(id))).toBe(true);
    expect(intlNumberOf(s)).toEqual({ code: "FRA", no: mine });
    expect(jerseyOf(s).intl.at(-1)).toMatchObject({ code: "FRA", no: mine });
    // Changing the club number does not touch the international one, and the reverse.
    const free = [31, 32, 33, 34].find((x) => isSquadNumberAvailable(s, club(s).id, x, me(s).id))!;
    jerseyOf(s).choice = true;
    chooseSquadNumber(s, free);
    expect(nt.numbers![me(s).id]).toBe(mine);
  });

  it("keeps a number while the player stays in the squad, and lets them choose a free one", () => {
    const s = called("nn-2");
    const nt = s.nationalTeams.FRA;
    const before = nt.numbers![me(s).id];
    selectNationalSquads(s);
    expect(nt.numbers![me(s).id]).toBe(before);
    const taken = Object.values(nt.numbers!).find((n) => n !== before)!;
    expect(chooseIntlNumber(s, taken).ok).toBe(false);
    const free = Array.from({ length: 60 }, (_, i) => i + 1).find((n) => !Object.values(nt.numbers!).includes(n))!;
    const res = chooseIntlNumber(s, free);
    expect(res.message).toBeTruthy();
    expect(res.ok).toBe(true);
    expect(nt.numbers![me(s).id]).toBe(free);
  });

  it("prefers the player's preferred number when it is free internationally", () => {
    const s = newCareer({ seed: "nn-3", nationality: "FRA", birthCountry: "MAR" });
    strongUser(s);
    me(s).reputation = 95;
    jerseyOf(s).history = [{ clubId: "a", no: 14, from: { season: 2018, turn: 1 }, to: { season: 2026, turn: 1 } }, ...jerseyOf(s).history];
    s.nationalTeams.FRA.numbers = undefined;
    selectNationalSquads(s);
    expect(s.nationalTeams.FRA.numbers![me(s).id]).toBe(14);
  });

  it("owes nothing to the old nation after an allegiance switch, and is numbered only when actually picked", () => {
    const s = called("nn-4");
    s.user.intl = { history: [], cooldownUntil: 0, invitation: { code: "MAR", createdIndex: 0, expiresIndex: 99, deferrals: 0, reasons: [], ovr: 80 } };
    resolveInvitation(s, "accept");
    expect(s.nationalTeams.FRA.numbers?.[me(s).id]).toBeUndefined();
    expect(s.nationalTeams.MAR.numbers?.[me(s).id]).toBeUndefined(); // saying yes is not a squad place
    expect(intlNumberOf(s)).toBeUndefined();
    selectNationalSquads(s);
    if (s.nationalTeams.MAR.squad.includes(me(s).id)) expect(s.nationalTeams.MAR.numbers![me(s).id]).toBeGreaterThanOrEqual(1);
    expect(s.nationalTeams.FRA.squad).not.toContain(me(s).id);
  });

  it("drops the number when the player leaves the squad", () => {
    const s = called("nn-5");
    me(s).injury = { type: "x", severity: "severe", weeksLeft: 30, totalWeeks: 30, area: "x" };
    selectNationalSquads(s);
    expect(s.nationalTeams.FRA.numbers?.[me(s).id]).toBeUndefined();
    expect(intlNumberOf(s)).toBeUndefined();
    assignNationalNumbers(s, s.nationalTeams.FRA);
    expect(Object.keys(s.nationalTeams.FRA.numbers!).every((id) => s.nationalTeams.FRA.squad.includes(id))).toBe(true);
  });
});

describe("persistence and sanitising", () => {
  it("round-trips numbers, history and national numbers", () => {
    const s = newCareer({ seed: "jp-1" });
    for (let i = 0; i < 10; i++) advanceTurn(s);
    const back = migrateState(JSON.parse(JSON.stringify(decodeState(encodeState(s)))));
    expect(back.user.jersey).toEqual(JSON.parse(JSON.stringify(s.user.jersey)));
    expect(allUnique(back)).toBe(true);
    expect(back.players[back.user.playerId].squadNo).toBe(me(s).squadNo);
  });

  it("gives an old save valid unique numbers and a history that starts today", () => {
    const raw = JSON.parse(JSON.stringify(newCareer({ seed: "jp-2" })));
    raw.schemaVersion = 10;
    delete raw.user.jersey;
    for (const p of Object.values(raw.players) as { squadNo?: number }[]) delete p.squadNo;
    for (const c of Object.values(raw.clubs) as { retiredNumbers?: unknown }[]) delete c.retiredNumbers;
    raw.turn = 22;
    const m = migrateState(raw);
    expect(allUnique(m)).toBe(true);
    expect(m.user.jersey!.history).toHaveLength(1);
    expect(m.user.jersey!.history[0].from).toEqual({ season: m.season, turn: 22 });
    expect(m.user.jersey!.intl).toEqual([]); // nothing invented
  });

  it("resolves duplicate and malformed numbers deterministically", () => {
    const s = newCareer({ seed: "jp-3" });
    const members = squadMembers(s, club(s).id);
    members[1].squadNo = members[2].squadNo;
    members[3].squadNo = 0;
    members[4].squadNo = 250;
    members[5].squadNo = Number.NaN;
    const a = JSON.parse(JSON.stringify(s));
    repairSquad(s, club(s).id);
    expect(allUnique(s)).toBe(true);
    const nums1 = squadMembers(s, club(s).id).map((p) => [p.id, p.squadNo]);
    const t = migrateState(JSON.parse(JSON.stringify(Object.assign(a, { schemaVersion: 10 }))));
    const nums2 = squadMembers(t, club(t).id).map((p) => [p.id, p.squadNo]);
    expect(nums2).toEqual(nums1);
    // The user's own number is never the one displaced.
    members[0].squadNo = me(s).squadNo;
    repairSquad(s, club(s).id);
    expect(squadMembers(s, club(s).id).filter((p) => p.squadNo === me(s).squadNo)).toHaveLength(1);
    expect(me(s).squadNo).toBeTruthy();
  });

  it("cleans malformed history, missing players and duplicate national numbers", () => {
    const s = newCareer({ seed: "jp-4" });
    selectNationalSquads(s);
    const nt = Object.values(s.nationalTeams).find((n) => n.squad.length >= 5)!;
    nt.numbers = { ...(nt.numbers ?? {}), ghost: 5 };
    nt.numbers[nt.squad[0]] = 7;
    nt.numbers[nt.squad[1]] = 7;
    jerseyOf(s).history.push({ clubId: "x", no: 999, from: { season: 2030, turn: 1 } } as never, { clubId: 3, no: 5 } as never);
    jerseyOf(s).history.push({ clubId: "y", no: 12, from: { season: 2026, turn: 1 } });
    sanitizeJersey(s);
    expect(nt.numbers!.ghost).toBeUndefined();
    expect(new Set(Object.values(nt.numbers!)).size).toBe(Object.keys(nt.numbers!).length);
    expect(jerseyOf(s).history.every((t) => typeof t.clubId === "string" && t.no >= 1 && t.no <= 99)).toBe(true);
    const open = jerseyOf(s).history.filter((t) => !t.to);
    expect(open.length).toBeLessThanOrEqual(1);
  });
});

describe("Match Day and career display", () => {
  it("shows real numbers on both team sheets", () => {
    const s = newCareer({ seed: "ju-1" });
    strongUser(s);
    for (let i = 0; i < 6 && !s.pending.length; i++) advanceTurn(s);
    const pm = s.pending[0];
    const comp = s.competitions[pm.compId];
    const f = comp.fixtures.find((x) => x.id === pm.fixtureId) as Fixture;
    const view = lineupView(s, f)!;
    const mine = f.home === club(s).id ? view.home : view.away;
    expect(mine.exact).toBe(true);
    expect(mine.starters.length).toBe(11);
    for (const row of [...mine.starters, ...mine.bench]) expect(row.no).toBe(s.players[row.id].squadNo);
    const u = mine.starters.find((r) => r.isUser);
    if (u) expect(u.no).toBe(me(s).squadNo);
    expect(new Set([...mine.starters, ...mine.bench].map((r) => r.no)).size).toBe(mine.starters.length + mine.bench.length);
  });

  it("derives an iconic number only from long use and real success", () => {
    const s = newCareer({ seed: "ju-2" });
    jerseyOf(s).history = [{ clubId: club(s).id, no: 17, from: { season: 2020, turn: 1 }, to: { season: 2022, turn: 20 } }];
    s.season = 2023;
    expect(iconicNumber(s)).toBeUndefined();
    jerseyOf(s).history = [{ clubId: club(s).id, no: 17, from: { season: 2018, turn: 1 }, to: { season: 2026, turn: 20 } }];
    s.season = 2027;
    me(s).career.apps = 40;
    me(s).reputation = 40;
    expect(iconicNumber(s)).toBeUndefined(); // seasons, but no success to speak of
    me(s).career.apps = 300;
    const ic = iconicNumber(s)!;
    expect(ic.no).toBe(17);
    expect(ic.seasons).toBeGreaterThanOrEqual(ICONIC_MIN_SEASONS);
    s.user.retired = true;
    expect(computeLegacy(s).iconicNumber?.no).toBe(17);
  });

  it("retires a number only for an exceptional career at one club", () => {
    const s = newCareer({ seed: "ju-3" });
    const c = club(s);
    const prev = numberOwner(s, c.id, 9);
    if (prev && prev.id !== me(s).id) prev.squadNo = 77;
    me(s).squadNo = 9;
    jerseyOf(s).history = [{ clubId: c.id, no: 9, from: { season: 2010, turn: 1 } }];
    s.season = 2026;
    expect(retireNumberHonour(s)).toBeUndefined();
    me(s).history = Array.from({ length: 10 }, (_, i) => ({ season: 2016 + i, clubId: c.id, age: 25, overall: 85, stats: { ...me(s).career, apps: 38 } }));
    s.user.trophies = Array.from({ length: 3 }, (_, i) => ({ season: 2018 + i, compId: "x", name: "T", kind: "league" as const, clubId: c.id }));
    s.user.awards = [{ season: 2020, id: "pots", name: "x", scope: "x", playerId: me(s).id }, { season: 2021, id: "golden-pitch", name: "y", scope: "x", playerId: me(s).id }];
    s.user.relationships.supporters = 60;
    expect(retireNumberHonour(s)).toBeUndefined(); // supporters not behind him
    s.user.relationships.supporters = 90;
    expect(RETIRE_MIN_SEASONS).toBe(8);
    const done = retireNumberHonour(s)!;
    expect(done).toEqual({ no: 9, clubId: c.id });
    expect(c.retiredNumbers).toHaveLength(1);
    expect(retireNumberHonour(s)).toBeUndefined(); // once
    const nobody = squadMembers(s, c.id).filter((p) => p.id !== me(s).id);
    for (const p of nobody) expect(p.squadNo).not.toBe(9);
    expect(isSquadNumberAvailable(s, c.id, 9, me(s).id)).toBe(false);
  });
});
