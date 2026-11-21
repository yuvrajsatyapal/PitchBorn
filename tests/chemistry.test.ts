import { beforeAll, describe, expect, it } from "vitest";
import { applyChemistry, bondBoost, bondLabel, bondsByStrength, chemistryAfterMatch, chemistryShock, chemistryWeekly, sanitizeChemistry } from "../src/engine/career/chemistry";
import type { MatchPlayerInput, MatchResult, PlayerLine } from "../src/engine/match/engine";
import { advanceTurn } from "../src/engine/season/advance";
import type { GameState, Player } from "../src/engine/types";
import { squadOf, userPlayer } from "../src/engine/world/helpers";
import { newCareer, strongUser } from "./helpers";

function line(id: string, over: Partial<PlayerLine> = {}): PlayerLine {
  return { id, side: "home", slot: "ST", started: true, minuteOn: 0, minuteOff: null, rating: 7, goals: 0, assists: 0, shots: 0, onTarget: 0, keyPasses: 0, tackles: 0, saves: 0, fouls: 0, yellow: 0, red: 0, injured: false, conceded: 0, ...over };
}

function mates(s: GameState): Player[] {
  const me = userPlayer(s);
  return squadOf(s, me.clubId as string).filter((p) => p.id !== me.id && p.position !== me.position);
}

describe("teammate chemistry", () => {
  it("grows from playing together, faster with goal combinations", () => {
    const s = newCareer({ seed: "chem-1" });
    const uid = s.user.playerId;
    const [a, b] = mates(s);
    const res = { goals: [{ minute: 10, side: "home", scorer: uid, assist: a.id }], lines: [line(uid), line(a.id, { slot: a.position }), line(b.id, { slot: b.position })] } as unknown as MatchResult;
    chemistryAfterMatch(s, res, res.lines[0], true, false);
    const ca = s.user.chemistry?.[a.id];
    const cb = s.user.chemistry?.[b.id];
    expect(ca?.games).toBe(1);
    expect(ca?.links).toBe(1);
    expect(ca?.v).toBeGreaterThan(cb?.v ?? 0);
    expect(cb?.v).toBeGreaterThan(0);
  });

  it("forms a partnership with news and a link-up bonus on the pitch", () => {
    const s = newCareer({ seed: "chem-2" });
    const uid = s.user.playerId;
    const [a] = mates(s);
    for (let i = 0; i < 12; i++) {
      const res = { goals: [{ minute: 10, side: "home", scorer: a.id, assist: uid }], lines: [line(uid), line(a.id, { slot: a.position })] } as unknown as MatchResult;
      chemistryAfterMatch(s, res, res.lines[0], true, false);
    }
    const v = s.user.chemistry?.[a.id]?.v ?? 0;
    expect(v).toBeGreaterThanOrEqual(60);
    expect(bondLabel(v)).toMatch(/Partnership|Telepathic/);
    expect(s.news.some((n) => n.title.includes("partnership"))).toBe(true);
    const me = userPlayer(s);
    const inputs = [me, a].map((p) => ({ id: p.id, attrs: p.attrs }) as MatchPlayerInput);
    const before = me.attrs.passing;
    applyChemistry(s, inputs);
    expect(inputs[0].attrs.passing).toBe(before + bondBoost(v));
    expect(me.attrs.passing).toBe(before);
    expect(inputs[1].attrs.vision).toBe(a.attrs.vision + bondBoost(v));
  });

  it("sours after calling out the dressing room, and drops players who leave", () => {
    const s = newCareer({ seed: "chem-3" });
    const [a] = mates(s);
    chemistryShock(s, -40);
    expect(bondsByStrength(s).every((b) => b.bond.v < 0)).toBe(true);
    expect(bondLabel(s.user.chemistry?.[a.id]?.v ?? 0)).toBe("Rivals");
    const me = userPlayer(s);
    s.clubs[me.clubId as string].squad = s.clubs[me.clubId as string].squad.filter((id) => id !== a.id);
    chemistryWeekly(s);
    expect(s.user.chemistry?.[a.id]).toBeUndefined();
  });

  it("sanitizes bad data", () => {
    const s = newCareer({ seed: "chem-4" });
    const [a] = mates(s);
    s.user.chemistry = { nobody: { v: 5, games: 1, links: 0, since: 1 }, [a.id]: { v: 500, games: -2, links: Number.NaN, since: 1 } };
    sanitizeChemistry(s);
    expect(s.user.chemistry.nobody).toBeUndefined();
    expect(s.user.chemistry[a.id]).toMatchObject({ v: 100, games: 0, links: 0 });
  });

  describe("over part of a season", () => {
    let s: GameState;
    beforeAll(() => {
      s = newCareer({ seed: "chem-run" });
      for (let i = 0; i < 20; i++) {
        strongUser(s);
        advanceTurn(s);
      }
    }, 300_000);
    it("builds bonds with the players he plays alongside", () => {
      const list = bondsByStrength(s);
      expect(list.length).toBeGreaterThan(0);
      expect(list[0].bond.v).toBeGreaterThan(0);
      expect(list[0].bond.games).toBeGreaterThan(0);
    });
  });
});
