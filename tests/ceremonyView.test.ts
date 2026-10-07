import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { CeremonyResults, PodiumStage, sceneView } from "../src/components/game/Ceremony";
import { buildScenes } from "../src/engine/awards/ceremony";
import type { GameState, PlayerRival } from "../src/engine/types";
import { advanceTurn } from "../src/engine/season/advance";
import { userPlayer } from "../src/engine/world/helpers";
import { newCareer } from "./helpers";

let ready: GameState;
beforeAll(() => {
  const s = newCareer({ seed: "ceremony-view" });
  for (let i = 0; i < 44; i++) advanceTurn(s);
  ready = s;
}, 120000);

const html = (g: GameState, scene: ReturnType<typeof buildScenes>[number]) => renderToStaticMarkup(sceneView(g, g.ceremony!, scene) as never);
/** The judged awards end on the podium's final state; this is that picture. */
const podium = (g: GameState, id: string) => renderToStaticMarkup(createElement(PodiumStage, { g, r: g.ceremony!.results.find((x) => x.id === id)!, revealed: 3, uid: g.user.playerId }));
const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

/** Put the user into the first nominee slot of an award (as winner) or a later slot. */
function place(s: GameState, id: string, slot: number) {
  const me = userPlayer(s);
  const r = s.ceremony!.results.find((x) => x.id === id)!;
  const others = r.nominees.filter((n) => n.playerId !== me.id);
  const mine = { ...others[0], playerId: me.id, clubId: me.clubId, position: me.position };
  const list = [...others];
  list.splice(slot, 0, mine);
  r.nominees = list.slice(0, 4);
  r.winnerId = r.nominees[0].playerId;
}

describe("ceremony presentation", () => {
  it("every scene renders without a missing winner", () => {
    for (const scene of buildScenes(ready.ceremony!)) {
      const t = text(html(ready, scene));
      expect(t.length).toBeGreaterThan(20);
      expect(t).not.toMatch(/undefined|NaN|null/);
    }
  });

  it("nominees are shown before the winner, without saying who won", () => {
    const scenes = buildScenes(ready.ceremony!);
    const i = scenes.findIndex((x) => x.kind === "award" && x.id === "pots" && x.phase === "nominees");
    const nominees = text(html(ready, scenes[i]));
    expect(nominees).toContain("The nominees");
    expect(nominees).not.toContain("And the winner is");
    expect(nominees).not.toContain("1ST");
    const final = text(podium(ready, "pots"));
    expect(final).toContain("AND THE WINNER IS");
    expect(final).toContain(ready.players[ready.ceremony!.results.find((r) => r.id === "pots")!.winnerId].lastName);
    // A statistical award is revealed at once, without a podium.
    const boot = scenes.find((x) => x.kind === "award" && x.id === "topscorer")!;
    expect(text(html(ready, boot))).toContain("And the winner is");
    // No internal numbers leak into the page.
    expect(nominees + final).not.toMatch(/score|index|AwardScore/i);
  });

  it("when the user wins, it says so", () => {
    const s = structuredClone(ready);
    place(s, "pots", 0);
    const t = text(podium(s, "pots"));
    expect(t).toContain("That's you");
    expect(text(renderToStaticMarkup(createElement(CeremonyResults, { g: s, c: s.ceremony! })))).toContain("Player of the Season");
  });

  it("when the user loses a race they were in, it says they were in the running", () => {
    const s = structuredClone(ready);
    place(s, "pots", 2);
    const t = text(podium(s, "pots"));
    expect(t).not.toContain("That's you");
    expect(t).toContain("in the running");
  });

  it("when the rival wins, it says so", () => {
    const s = structuredClone(ready);
    const me = userPlayer(s);
    const r = s.ceremony!.results.find((x) => x.id === "pots")!;
    const other = s.players[r.winnerId];
    const rival: PlayerRival = { playerId: other.id, name: `${other.firstName} ${other.lastName}`, clubId: other.clubId, since: { season: s.season, turn: 5 }, intensity: 60, peak: 60, status: "active", causes: ["final", "duel"], lastContactIndex: s.turnIndex, media: 0, lastNewsIndex: 0, h2h: { meetings: 2, wins: 1, draws: 0, losses: 1, myGoals: 1, theirGoals: 1 }, meetings: [], events: [] };
    s.user.rivalry.rivals.push(rival);
    place(s, "pots", 1);
    void me;
    expect(text(podium(s, "pots"))).toContain("Your rival takes the honour");
    expect(text(html(s, { kind: "yours" }))).toContain("Your rival");
  });

  it("the user not being nominated, and being in the Team of the Season, both read sensibly", () => {
    expect(text(html(ready, { kind: "yours" }))).toMatch(/No individual honours|Nominated|Team of the Season|won/i);
    const s = structuredClone(ready);
    s.ceremony!.team[0] = { ...s.ceremony!.team[0], playerId: userPlayer(s).id };
    expect(text(html(s, { kind: "yours" }))).toContain("Named in the Team of the Season");
    const team = text(html(s, { kind: "team" }));
    expect(team).toContain("Team of the Season");
    expect(team).toContain("You");
  });

  it("a user who wins several awards sees them all", () => {
    const s = structuredClone(ready);
    for (const id of ["pots", "topscorer", "ypots"]) place(s, id, 0);
    const t = text(html(s, { kind: "yours" }));
    expect(t).toContain("Player of the Season");
    expect(t).toContain("Golden Boot");
    expect(t).toContain("Young Player of the Season");
  });
});
