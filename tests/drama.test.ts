import { describe, expect, it } from "vitest";
import { dramaWeekly, eligibleDrama, raceProgress, startDrama } from "../src/engine/career/drama";
import { resolveDecision } from "../src/engine/career/events";
import { ageOf } from "../src/engine/players/generate";
import { newCareer } from "./helpers";

const decision = (s: ReturnType<typeof newCareer>) => s.user.decisions.find((d) => d.handler === "drama")!;

describe("off-pitch drama", () => {
  it("a public stand-off ends with the club improving its offer or digging in", () => {
    const s = newCareer();
    const p = s.players[s.user.playerId];
    p.contract!.expires = s.season;
    s.turn = 20;
    p.reputation = 60;
    expect(eligibleDrama(s, p)).toContain("standoff");
    startDrama(s, "standoff");
    const board = s.user.relationships.board;
    resolveDecision(s, decision(s).id, "public");
    expect(s.user.relationships.board).toBeLessThan(board);
    s.turnIndex += 3;
    dramaWeekly(s);
    expect(s.user.drama?.active).toBeUndefined();
    expect(s.user.drama?.log[0].outcome).toMatch(/blinked|dug in/);
  });

  it("a fall-out can escalate to being frozen out and a transfer request", () => {
    const s = newCareer();
    s.user.relationships.manager = 30;
    startDrama(s, "fallout");
    resolveDecision(s, decision(s).id, "firm");
    s.turnIndex += 4;
    dramaWeekly(s);
    const d = decision(s);
    expect(d.title).toBe("Frozen out");
    resolveDecision(s, d.id, "request");
    expect(s.user.transferRequest).toBe(true);
    expect(s.user.drama?.active).toBeUndefined();
  });

  it("the captaincy race crowns the user or the rival after six weeks", () => {
    const s = newCareer();
    const p = s.players[s.user.playerId];
    p.birthYear = s.season - 27;
    const club = s.clubs[p.clubId!];
    club.captain = undefined;
    const story = startDrama(s, "captaincy");
    expect(story?.rivalId).toBeTruthy();
    resolveDecision(s, decision(s).id, "campaign");
    expect(raceProgress(s)?.weeksLeft).toBe(6);
    p.form = 9;
    s.turnIndex += 6;
    dramaWeekly(s);
    expect(club.captain).toBe(p.id);
    expect(ageOf(p, s.season)).toBe(27);
  });

  it("cliques move bonds with both camps", () => {
    const s = newCareer();
    const p = s.players[s.user.playerId];
    const mates = s.clubs[p.clubId!].squad.filter((id) => id !== p.id);
    s.user.chemistry = Object.fromEntries(mates.slice(0, 8).map((id) => [id, { v: 0, games: 1, links: 0, since: s.season }]));
    const story = startDrama(s, "clique");
    if (!story) return;
    resolveDecision(s, decision(s).id, "side-a");
    const a = story.camps!.a.ids[0];
    const b = story.camps!.b.ids[0];
    expect(s.user.chemistry![a].v).toBeGreaterThan(0);
    expect(s.user.chemistry![b].v).toBeLessThan(0);
  });
});
