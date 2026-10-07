import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PodiumStage, sceneView } from "../src/components/game/Ceremony";
import { buildScenes } from "../src/engine/awards/ceremony";
import { PODIUM_AWARDS, PODIUM_TIMING, PODIUM_TIMING_REDUCED, hasPodiumReveal, inContention, podiumPlaces, schedulePodium } from "../src/engine/awards/podium";
import { advanceTurn } from "../src/engine/season/advance";
import type { GameState } from "../src/engine/types";
import { userPlayer } from "../src/engine/world/helpers";
import { newCareer } from "./helpers";

let ready: GameState;
beforeAll(() => {
  const s = newCareer({ seed: "podium" });
  for (let i = 0; i < 44; i++) advanceTurn(s);
  ready = s;
}, 120000);

const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

describe("which awards get a podium", () => {
  it("only the judged individual awards, never statistical or team awards", () => {
    const by = (id: string) => ready.ceremony!.results.find((r) => r.id === id)!;
    for (const id of ["pots", "ypots", "goldenglove", "breakthrough"]) if (by(id)) expect(hasPodiumReveal(by(id))).toBe(true);
    expect(hasPodiumReveal(by("topscorer"))).toBe(false);
    expect(hasPodiumReveal(by("topassist"))).toBe(false);
    expect(PODIUM_AWARDS).not.toContain("topscorer");
    expect(PODIUM_AWARDS).not.toContain("tots");
    expect(hasPodiumReveal({ id: "pots", tier: "statistical" })).toBe(false);
  });
});

describe("the order of the reveal", () => {
  it("announces 3rd, then 2nd, then the winner", () => {
    expect(podiumPlaces(4)).toEqual([3, 2, 1]);
    expect(podiumPlaces(3)).toEqual([3, 2, 1]);
    expect(podiumPlaces(2)).toEqual([2, 1]);
    expect(podiumPlaces(1)).toEqual([1]);
  });

  it("narrows the finalists: 3rd out, then 2nd out, leaving the winner alone", () => {
    expect(inContention(4, 0)).toEqual([0, 1, 2]);
    expect(inContention(4, 1)).toEqual([0, 1]);
    expect(inContention(4, 2)).toEqual([0]);
    expect(inContention(4, 3)).toEqual([]);
    expect(inContention(2, 1)).toEqual([0]);
  });

  it("has a longer pause before the winner than before 2nd, and a gentler path for reduced motion", () => {
    expect(PODIUM_TIMING.afterSecond).toBeGreaterThan(PODIUM_TIMING.afterThird);
    expect(PODIUM_TIMING.afterThird).toBeGreaterThanOrEqual(1500);
    expect(PODIUM_TIMING.afterSecond).toBeLessThanOrEqual(3000);
    expect(PODIUM_TIMING_REDUCED.afterThird).toBeLessThan(PODIUM_TIMING.afterThird);
    expect(PODIUM_TIMING_REDUCED.afterSecond).toBeLessThan(PODIUM_TIMING.afterSecond);
  });
});

describe("the sequence runs by itself", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("3rd → pause → 2nd → longer pause → 1st → done, with no input in between", () => {
    const reveals: number[] = [];
    let done = false;
    schedulePodium(3, PODIUM_TIMING, (n) => reveals.push(n), () => (done = true));
    const { lead, afterThird, afterSecond } = PODIUM_TIMING;
    vi.advanceTimersByTime(lead - 1);
    expect(reveals).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(reveals).toEqual([1]); // 3rd
    vi.advanceTimersByTime(afterThird - 1);
    expect(reveals).toEqual([1]);
    vi.advanceTimersByTime(1);
    expect(reveals).toEqual([1, 2]); // 2nd
    vi.advanceTimersByTime(afterSecond - 1);
    expect(reveals).toEqual([1, 2]);
    expect(done).toBe(false);
    vi.advanceTimersByTime(1);
    expect(reveals).toEqual([1, 2, 3]); // winner
    vi.advanceTimersByTime(0);
    expect(done).toBe(true);
  });

  it("skipping or leaving cancels it: nothing fires afterwards", () => {
    const reveals: number[] = [];
    let done = false;
    const cancel = schedulePodium(3, PODIUM_TIMING, (n) => reveals.push(n), () => (done = true));
    vi.advanceTimersByTime(PODIUM_TIMING.lead + 100);
    expect(reveals).toEqual([1]);
    cancel();
    vi.advanceTimersByTime(60_000);
    expect(reveals).toEqual([1]);
    expect(done).toBe(false);
  });

  it("works with fewer finalists and with reduced motion", () => {
    const two: number[] = [];
    schedulePodium(2, PODIUM_TIMING_REDUCED, (n) => two.push(n), () => undefined);
    vi.advanceTimersByTime(PODIUM_TIMING_REDUCED.lead);
    expect(two).toEqual([1]);
    vi.advanceTimersByTime(PODIUM_TIMING_REDUCED.afterSecond);
    expect(two).toEqual([1, 2]);
    const reduced: number[] = [];
    schedulePodium(3, PODIUM_TIMING_REDUCED, (n) => reduced.push(n), () => undefined);
    vi.advanceTimersByTime(PODIUM_TIMING_REDUCED.afterThird + PODIUM_TIMING_REDUCED.afterSecond + 1);
    expect(reduced).toEqual([1, 2, 3]);
  });

  it("never changes the stored result", () => {
    const before = JSON.stringify(ready.ceremony);
    schedulePodium(3, PODIUM_TIMING, () => undefined, () => undefined);
    vi.advanceTimersByTime(20_000);
    expect(JSON.stringify(ready.ceremony)).toBe(before);
  });
});

describe("what is on screen at each stage", () => {
  const r = () => ready.ceremony!.results.find((x) => x.id === "pots")!;
  const view = (revealed: number) => renderToStaticMarkup(createElement(PodiumStage, { g: ready, r: r(), revealed, uid: ready.user.playerId }));
  const lastName = (i: number) => ready.players[r().nominees[i].playerId].lastName;

  it("starts with the envelope and every finalist in contention", () => {
    const t = text(view(0));
    expect(t).toContain("The envelope is opened");
    expect(t).not.toContain("1ST");
    expect(view(0)).toContain('data-state="in"');
  });

  it("shows 3rd, then 2nd, then 1st with much more emphasis", () => {
    const third = view(1);
    expect(text(third)).toContain("3RD PLACE");
    expect(text(third)).toContain(lastName(2));
    expect(third).toContain('data-testid="podium-place-3"');
    const second = view(2);
    expect(text(second)).toContain("2ND PLACE");
    expect(second).toContain('data-testid="podium-place-2"');
    expect(text(second)).toContain(lastName(1));
    const winner = view(3);
    expect(winner).toContain('data-testid="podium-place-1"');
    expect(text(winner)).toContain("AND THE WINNER IS");
    expect(text(winner)).toContain(lastName(0));
    // The winner's portrait is the largest and the name the biggest type.
    expect(winner).toContain("text-5xl");
    expect(second).not.toContain("text-5xl");
    expect(third).not.toContain("text-5xl");
  });

  it("dims the finalists as they are announced, leaving the winner last", () => {
    const outCount = (h: string) => (h.match(/data-state="out"/g) ?? []).length;
    // The nominee outside the podium is out from the start; each announcement removes one more.
    const n = Math.min(4, r().nominees.length);
    const base = n - 3 > 0 ? n - 3 : 0;
    expect(outCount(view(0))).toBe(base);
    expect(outCount(view(1))).toBe(base + 1);
    expect(outCount(view(2))).toBe(base + 2);
    expect(outCount(view(3))).toBe(base + 3);
    const before = view(2);
    const inList = before.match(/<li[^>]*data-state="in"[^>]*>/g) ?? [];
    expect(inList).toHaveLength(1);
    expect(before.indexOf(lastName(0)) > -1).toBe(true);
  });

  it("the judged winner scene starts from the beginning, and the statistical one does not use the podium", () => {
    const scenes = buildScenes(ready.ceremony!);
    const pots = scenes.find((s) => s.kind === "award" && s.id === "pots" && s.phase === "winner")!;
    expect(text(renderToStaticMarkup(sceneView(ready, ready.ceremony!, pots) as never))).toContain("The envelope is opened");
    const boot = scenes.find((s) => s.kind === "award" && s.id === "topscorer")!;
    const t = text(renderToStaticMarkup(sceneView(ready, ready.ceremony!, boot) as never));
    expect(t).toContain("And the winner is");
    expect(t).not.toContain("envelope");
  });

  it("marks the user when they are among the finalists", () => {
    const s = structuredClone(ready);
    const me = userPlayer(s);
    const res = s.ceremony!.results.find((x) => x.id === "pots")!;
    res.nominees[1] = { ...res.nominees[1], playerId: me.id, clubId: me.clubId };
    const h = renderToStaticMarkup(createElement(PodiumStage, { g: s, r: res, revealed: 3, uid: me.id }));
    expect(text(h)).toContain("(You)");
    expect(text(h)).toContain("in the running");
  });
});
