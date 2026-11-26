import { describe, expect, it } from "vitest";
import { activeRole, requestRole, roleDef, roleFit, roleOptions, roleSelectionBonus, withRoleFx } from "../src/engine/career/roles";
import { MatchEngine, type MatchPlayerInput, type TeamInput } from "../src/engine/match/engine";
import { FORMATIONS } from "../src/engine/match/lineup";
import { generatePlayer } from "../src/engine/players/generate";
import { Rng } from "../src/engine/rng";
import type { MatchFx } from "../src/engine/traits/types";
import { newCareer } from "./helpers";

const gen = Rng.fromSeed("role-teams");
let n = 0;
function team(name: string, withUser: boolean): TeamInput {
  const mk = (slot: MatchPlayerInput["slot"], user = false): MatchPlayerInput => {
    const p = generatePlayer(gen, { id: user ? "USER" : `r${n++}`, nationality: "ENG", position: slot, age: 26, season: 2026, overall: 72, potential: 72, clubId: null });
    return { id: p.id, name: p.lastName, slot, attrs: p.attrs, fitness: 95, morale: 70, form: 6.6, sharpness: 80, bigMatch: 50, consistency: 55, isUser: user };
  };
  let placed = false;
  const starters = FORMATIONS["4-3-3"].map((slot) => (slot === "ST" && withUser && !placed ? ((placed = true), mk(slot, true)) : mk(slot)));
  return { id: name, name, short: name, starters, bench: (["GK", "CB", "CM", "ST"] as const).map((s) => mk(s)), mentality: 0, color: "#000" };
}

describe("tactical roles", () => {
  it("a false nine creates more and shoots less than a poacher", () => {
    const H = team("H", true);
    const A = team("A", false);
    const run = (roleId: string) => {
      let shots = 0;
      let keyPasses = 0;
      const fx: MatchFx | undefined = withRoleFx(undefined, roleDef(roleId), 0);
      const home = { ...H, starters: H.starters.map((s) => (s.isUser ? { ...s, fx } : s)) };
      for (let i = 0; i < 40; i++) {
        const res = new MatchEngine({ home, away: A, importance: 1, detail: false }, Rng.fromSeed(`role-${i}`)).runToEnd();
        const line = res.lines.find((l) => l.id === "USER")!;
        shots += line.shots;
        keyPasses += line.keyPasses;
      }
      return { shots, keyPasses };
    };
    const nine = run("false-nine");
    const poacher = run("poacher");
    expect(nine.keyPasses).toBeGreaterThan(poacher.keyPasses);
    expect(poacher.shots).toBeGreaterThan(nine.shots);
  });

  it("the manager agrees to roles that suit the player and refuses bad fits from players he doesn't trust", () => {
    const s = newCareer();
    const p = s.players[s.user.playerId];
    const opts = roleOptions(s);
    expect(opts.map((o) => o.def.id)).toContain("false-nine");
    const best = [...opts].sort((a, b) => b.fit + b.style - (a.fit + a.style))[0];
    s.user.relationships.manager = 60;
    expect(requestRole(s, best.def.id).ok).toBe(true);
    expect(activeRole(s)?.id).toBe(best.def.id);
    expect(Math.abs(roleSelectionBonus(s))).toBeLessThanOrEqual(2);
    expect(requestRole(s, "target-man").reason).toMatch(/recently/);
    s.turnIndex += 10;
    s.user.relationships.manager = 20;
    p.attrs.heading = 20;
    p.attrs.jumping = 20;
    p.attrs.strength = 20;
    p.attrs.balance = 20;
    expect(roleFit(p, roleDef("target-man")!)).toBeLessThan(-10);
    expect(requestRole(s, "target-man").ok).toBe(false);
    expect(activeRole(s)?.id).toBe(best.def.id);
    expect(requestRole(s, "anchor").ok).toBe(false);
  });
});
