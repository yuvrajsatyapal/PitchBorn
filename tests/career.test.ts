import { describe, expect, it } from "vitest";
import { negotiate } from "../src/engine/career/offers";
import { computeLegacy, legacyTier } from "../src/engine/career/legacy";
import { developPlayer } from "../src/engine/players/development";
import { overallFor } from "../src/engine/players/attributes";
import { marketValue } from "../src/engine/players/economy";
import { generatePlayer } from "../src/engine/players/generate";
import { Rng } from "../src/engine/rng";
import { retireUser } from "../src/engine/season/advance";
import { executeTransfer } from "../src/engine/transfers/market";
import { checkInvariants } from "../src/engine/validate";
import { userPlayer } from "../src/engine/world/helpers";
import { newCareer } from "./helpers";

describe("development", () => {
  it("young high-potential players grow and veterans decline", () => {
    const s = newCareer({ seed: "dev" });
    const rng = Rng.fromSeed("d");
    const kid = generatePlayer(rng, { id: "k", nationality: "ENG", position: "CM", age: 18, season: s.season, overall: 55, potential: 85, clubId: null });
    const vet = generatePlayer(rng, { id: "v", nationality: "ENG", position: "RW", age: 34, season: s.season, overall: 80, potential: 80, clubId: null });
    const k0 = overallFor(kid.attrs, kid.position);
    const v0 = overallFor(vet.attrs, vet.position);
    for (let i = 0; i < 25; i++) {
      developPlayer(s, rng, kid, { club: null, trainingMultiplier: 1 }, 12.5);
      developPlayer(s, rng, vet, { club: null, trainingMultiplier: 1 }, 12.5);
    }
    expect(overallFor(kid.attrs, kid.position)).toBeGreaterThan(k0 + 3);
    expect(overallFor(vet.attrs, vet.position)).toBeLessThan(v0);
    expect(overallFor(kid.attrs, kid.position)).toBeLessThanOrEqual(kid.hidden.potential + 2);
  });
  it("market value peaks for young high-rated players", () => {
    const rng = Rng.fromSeed("v");
    const a = generatePlayer(rng, { id: "a", nationality: "ENG", position: "ST", age: 23, season: 2026, overall: 85, potential: 90, clubId: null });
    const b = generatePlayer(rng, { id: "b", nationality: "ENG", position: "ST", age: 34, season: 2026, overall: 85, potential: 85, clubId: null });
    a.contract = b.contract = { clubId: "x", wage: 1, expires: 2030, signed: 2026, role: "first" };
    expect(marketValue(a, 2026)).toBeGreaterThan(marketValue(b, 2026) * 3);
  });
});

describe("transfers and contracts", () => {
  it("moving a player keeps squads consistent", () => {
    const s = newCareer({ seed: "tr" });
    const clubs = Object.values(s.clubs);
    const from = clubs[0];
    const to = clubs[5];
    const p = s.players[from.squad.find((id) => !s.players[id].isUser)!];
    executeTransfer(s, p, to, 5_000_000, 20_000, 3, "first");
    expect(p.clubId).toBe(to.id);
    expect(to.squad).toContain(p.id);
    expect(from.squad).not.toContain(p.id);
    expect(p.contract?.clubId).toBe(to.id);
    expect(checkInvariants(s).issues).toEqual([]);
  });
  it("negotiation can complete a user transfer", () => {
    const s = newCareer({ seed: "neg" });
    const u = userPlayer(s);
    const buyer = Object.values(s.clubs).find((c) => c.id !== u.clubId)!;
    s.user.offers.push({
      id: "o1", kind: "transfer", fromClubId: buyer.id, toPlayerClubId: u.clubId, fee: 1_000_000,
      terms: { wage: 10_000, years: 3, role: "first", signingBonus: 0, goalBonus: 0 }, maxWage: 12_000, patience: 2, status: "terms",
      createdTurn: 1, expiresTurn: 5, season: s.season, history: [],
    });
    const r1 = negotiate(s, "o1", { type: "counter", wage: 20_000 }, Rng.fromSeed(1));
    expect(r1.completed).toBeFalsy();
    const r2 = negotiate(s, "o1", { type: "accept" }, Rng.fromSeed(1));
    expect(r2.completed).toBe(true);
    expect(u.clubId).toBe(buyer.id);
    expect(u.contract?.clubId).toBe(buyer.id);
    expect(checkInvariants(s).issues).toEqual([]);
  });
});

describe("retirement and legacy", () => {
  it("retiring produces a legacy with stories", () => {
    const s = newCareer({ seed: "ret" });
    retireUser(s, "test");
    expect(s.user.retired).toBe(true);
    expect(s.user.legacy).toBeDefined();
    expect(s.user.legacy!.stories.length).toBeGreaterThan(0);
    expect(computeLegacy(s).tier).toBe(legacyTier(computeLegacy(s).score));
    expect(s.pending).toEqual([]);
  });
});
