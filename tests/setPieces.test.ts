import { describe, expect, it } from "vitest";
import { askForDuty, canAskForDuty, dutyStatus, holdsDuty, noteSetPieces, takerOrder, takerScore } from "../src/engine/career/setPieces";
import { MatchEngine, type MatchInput, type MatchPlayerInput } from "../src/engine/match/engine";
import { Rng } from "../src/engine/rng";
import { prepareMatch } from "../src/engine/season/matchday";
import type { GameState } from "../src/engine/types";
import { squadOf, userPlayer } from "../src/engine/world/helpers";
import { newCareer } from "./helpers";

function setAll(s: GameState, id: string, v: number) {
  const p = s.players[id];
  for (const k of Object.keys(p.attrs)) (p.attrs as Record<string, number>)[k] = v;
}

describe("set-piece duties", () => {
  it("orders takers by the skills each kick asks for", () => {
    const s = newCareer({ seed: "sp-1" });
    const ids = squadOf(s, userPlayer(s).clubId as string).slice(0, 8).map((p) => ({ id: p.id, attrs: p.attrs }));
    const order = takerOrder(s, userPlayer(s).clubId as string, ids, "penalty");
    for (let i = 1; i < order.length; i++) expect(takerScore(s.players[order[i - 1]].attrs, "penalty")).toBeGreaterThanOrEqual(takerScore(s.players[order[i]].attrs, "penalty"));
  });

  it("grants the duty when the user is close to the best taker, refuses when far behind", () => {
    const s = newCareer({ seed: "sp-2" });
    const me = userPlayer(s);
    setAll(s, me.id, 30);
    expect(askForDuty(s, "penalty").ok).toBe(false);
    expect(canAskForDuty(s, "penalty").reason).toMatch(/said no/);
    const t = newCareer({ seed: "sp-2" });
    const best = Math.max(...squadOf(t, userPlayer(t).clubId as string).map((p) => takerScore(p.attrs, "freekick")));
    const u = userPlayer(t);
    setAll(t, u.id, Math.round(best) - 2);
    t.user.relationships.manager = 60;
    if (dutyStatus(t, "freekick").mine) return; // already the best; nothing to ask
    expect(askForDuty(t, "freekick").ok).toBe(true);
    expect(holdsDuty(t, "freekick")).toBe(true);
    const order = takerOrder(t, u.clubId as string, squadOf(t, u.clubId as string).map((p) => ({ id: p.id, attrs: p.attrs })), "freekick");
    expect(order[0]).toBe(u.id);
  });

  it("drops the penalty duty after two misses in the last three", () => {
    const s = newCareer({ seed: "sp-3" });
    const me = userPlayer(s);
    s.user.setPieces = { granted: { penalty: { season: s.season, clubId: me.clubId as string } }, dropped: {}, refused: {}, pens: 0, pensScored: 0, fks: 0, fksScored: 0, recentPens: [] };
    noteSetPieces(s, { sp: { pens: 1, pensScored: 1, fks: 0, fksScored: 0 } });
    noteSetPieces(s, { sp: { pens: 1, pensScored: 0, fks: 0, fksScored: 0 } });
    expect(holdsDuty(s, "penalty")).toBe(true);
    noteSetPieces(s, { sp: { pens: 1, pensScored: 0, fks: 0, fksScored: 0 } });
    expect(holdsDuty(s, "penalty")).toBe(false);
    expect(s.user.setPieces?.dropped.penalty).toBe(s.season);
    expect(s.user.setPieces?.pens).toBe(3);
    const ids = squadOf(s, me.clubId as string).map((p) => ({ id: p.id, attrs: p.attrs }));
    expect(takerOrder(s, me.clubId as string, ids, "penalty").at(-1)).toBe(me.id);
  });
});

describe("set pieces in the match engine", () => {
  it("the designated taker takes every penalty while on the pitch", () => {
    const s = newCareer({ seed: "sp-4" });
    const fx = Object.values(s.competitions).flatMap((c) => c.fixtures).find((f) => f.home === userPlayer(s).clubId || f.away === userPlayer(s).clubId);
    if (!fx) throw new Error("no fixture");
    let pens = 0;
    for (let i = 0; i < 60; i++) {
      const prep = prepareMatch(s, fx, Rng.fromSeed(`m${i}`), { interactive: false, detail: true });
      const input = (prep.engine as unknown as { input: MatchInput }).input;
      const res = prep.engine.runToEnd();
      for (const side of ["home", "away"] as const) {
        const first = input[side].takers?.penalty[0];
        for (const g of res.goals.filter((x) => x.penalty && x.side === side)) {
          const firstLine = res.lines.find((l) => l.id === first);
          const firstOn = firstLine && (firstLine.minuteOff ?? 120) >= g.minute;
          if (firstOn) expect(g.scorer).toBe(first);
          pens++;
        }
      }
    }
    expect(pens).toBeGreaterThan(0);
  });

  it("asks the user how to take his own penalty and counts it", () => {
    const base = newCareer();
    const attrs = Object.fromEntries(Object.keys(base.players[base.user.playerId].attrs).map((k) => [k, 70])) as MatchPlayerInput["attrs"];
    const mk = (id: string, isUser = false): MatchPlayerInput => ({ id, name: id, slot: id.endsWith("gk") ? "GK" : "ST", attrs, fitness: 100, morale: 70, form: 6.5, sharpness: 80, bigMatch: 50, consistency: 50, isUser });
    const team = (side: string, user: boolean) => ({ id: side, name: side, short: side, color: "#000", mentality: 0, bench: [], starters: [mk(`${side}gk`), ...Array.from({ length: 10 }, (_, i) => mk(`${side}${i}`, user && i === 0))], takers: { penalty: [`${side}0`], freekick: [`${side}0`] } });
    let asked = 0;
    let counted = 0;
    let pensAsked = 0;
    for (let i = 0; i < 80 && asked < 3; i++) {
      const e = new MatchEngine({ home: team("h", true), away: team("a", false), importance: 1, detail: true, interactive: true }, Rng.fromSeed(`pk${i}`));
      let guard = 0;
      while (!e.finished && guard++ < 400) {
        if (e.pending) {
          if (e.pending.kind === "setpiece") {
            asked++;
            if (e.pending.moment === "Penalty") pensAsked++;
            expect(e.pending.options.length).toBe(3);
          }
          e.resolve(e.autoChoice());
        }
        e.step();
      }
      const line = e.result().lines.find((l) => l.id === "h0");
      counted += line?.sp?.pens ?? 0;
    }
    expect(asked).toBeGreaterThan(0);
    expect(counted).toBeGreaterThanOrEqual(pensAsked);
  });
});
