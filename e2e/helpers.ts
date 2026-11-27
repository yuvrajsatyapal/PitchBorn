import { expect, type Page } from "@playwright/test";

export async function createCareer(page: Page, opts: { club?: string; position?: string; focus?: string; path?: string; world?: string; first?: string } = {}) {
  await page.goto("/new/");
  await page.getByLabel("First name").fill(opts.first ?? "Test");
  await page.getByLabel("Last name").fill("Striker");
  await page.getByRole("button", { name: "Next ›" }).click();
  if (opts.position) await page.getByRole("button", { name: opts.position, exact: true }).click();
  await page.getByRole("button", { name: "Next ›" }).click();
  // Desired playstyle: left on "No preference" unless a test asks for one.
  if (opts.focus) await page.getByTestId(`focus-${opts.focus}`).click();
  await page.getByRole("button", { name: "Next ›" }).click();
  await page.getByRole("button", { name: opts.path ?? "Late starter · age 20" }).click();
  if (opts.world) await page.getByRole("tab", { name: opts.world, exact: true }).click();
  await page.getByRole("button", { name: new RegExp(opts.club ?? "Southampton") }).first().click();
  await page.getByRole("button", { name: "Next ›" }).click();
  await page.getByRole("button", { name: "Begin career ▸" }).click();
  await expect(page).toHaveURL(/\/play\/?$/);
  await expect(page.getByTestId("overall")).toBeVisible();
}

/** Go to Match Day: the header button, or the page itself when a stop has already taken the player there. */
export async function openMatchDay(page: Page) {
  // A run that stops on a match day may still be navigating there: let the page settle before deciding.
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const onMatch = () => /\/play\/match\/?$/.test(page.url());
  if (!onMatch()) {
    const clicked = await page.getByTestId("matchday").click({ timeout: 5_000 }).then(() => true, () => false);
    if (!clicked && !onMatch()) await page.goto("/play/match/");
  }
  await expect(page).toHaveURL(/\/play\/match\/?$/);
}

/** The visible "Finish match" button (a compact copy sits hidden in the sticky bar on wide screens). */
export const finishMatch = (page: Page) => page.locator('[data-testid="finish-match"]:visible').first();

/** Answers any decision pop-ups (first option), as a player must before the calendar can move on. */
export async function answerDecisions(page: Page) {
  for (let i = 0; i < 6; i++) {
    const popup = page.getByTestId("decision-popup");
    if (!(await popup.isVisible().catch(() => false))) return;
    await popup.getByRole("button").first().click();
    await page.waitForTimeout(150);
  }
}

/** Advance using the visible UI: play/sim match days, otherwise press Continue. */
export async function advanceWeeks(page: Page, weeks: number) {
  for (let i = 0; i < weeks; i++) {
    // Let the last run land (and its autosave finish) before reading the header: it shows Match day or Continue.
    await settled(page);
    await answerDecisions(page);
    const matchDay = page.getByTestId("matchday");
    if (await matchDay.isVisible().catch(() => false)) {
      await openMatchDay(page);
      await page.getByTestId("sim-match").click();
      await expect(page.getByTestId("sim-match")).toBeHidden({ timeout: 20_000 }).catch(() => undefined);
      await settled(page);
      await page.goto("/play/");
      continue;
    }
    const before = (await gameInfo(page))?.turn;
    await page.getByTestId("continue").click();
    await expect.poll(async () => (await gameInfo(page))?.turn, { timeout: 20_000 }).not.toBe(before);
  }
}

type Handle = { getState: () => { game: { season: number; turn: number; pending: { fixtureId: string }[]; user: { retired: boolean } } | null; advance: (n?: number) => Promise<void>; simMatch: (id: string) => Promise<unknown>; retire: () => Promise<void> } };

/** Fast-forward with the E2E test handle (requires NEXT_PUBLIC_E2E=1 build). */
export async function fastForward(page: Page, turns: number) {
  await page.evaluate(async (n) => {
    const st = (window as unknown as { __pitchborn: Handle }).__pitchborn;
    for (let i = 0; i < n; i++) {
      const start = st.getState().game;
      if (!start || start.user.retired) break;
      const key = `${start.season}-${start.turn}`;
      // A week with two of the user's matches is played as two match days, so one step may stop mid-week: go on until the week changes.
      for (let guard = 0; guard < 6; guard++) {
        const g = st.getState().game;
        if (!g || g.user.retired || `${g.season}-${g.turn}` !== key) break;
        for (const p of [...g.pending]) await st.getState().simMatch(p.fixtureId);
        await st.getState().advance(1);
      }
    }
  }, turns);
}

/** Waits until the store is idle: simulations finished and autosaves written. */
export async function settled(page: Page) {
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __pitchborn: { getState: () => { busy: string | null } } }).__pitchborn.getState().busy), { timeout: 30_000 })
    .toBeNull();
}

export async function gameInfo(page: Page) {
  return page.evaluate(() => {
    const g = (window as unknown as { __pitchborn: Handle }).__pitchborn.getState().game;
    return g ? { season: g.season, turn: g.turn, retired: g.user.retired } : null;
  });
}

/** Runs a test hook (dev/E2E builds) on the live game, then repaints, as an engine change from a played week would. */
export async function hook(page: Page, name: string, ...args: unknown[]): Promise<unknown> {
  // The hooks module loads after the page, and a reload reads the save back in: wait for both.
  await expect
    .poll(() => page.evaluate(() => { const w = window as unknown as { __pitchbornTest?: unknown; __pitchborn?: { getState: () => { game: unknown; busy: unknown } } }; return !!w.__pitchbornTest && !!w.__pitchborn?.getState().game && !w.__pitchborn.getState().busy; }))
    .toBe(true);
  return page.evaluate(
    async ([n, a]) => {
      const w = window as unknown as { __pitchbornTest: Record<string, (...x: unknown[]) => unknown>; __pitchborn: { getState: () => { game: unknown; bump: () => void; save: () => Promise<void> } } };
      const st = w.__pitchborn.getState();
      const out = w.__pitchbornTest[n as string](st.game, ...(a as unknown[]));
      st.bump();
      // Saved straight away, so a page load afterwards reads the same career.
      await st.save();
      return out;
    },
    [name, args] as const,
  );
}

/** Reads a value from the live game. */
export function readGame<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate((src) => {
    const g = (window as unknown as { __pitchborn: { getState: () => { game: unknown } } }).__pitchborn.getState().game;
    return new Function("g", `return (${src})(g)`)(g) as T;
  }, fn);
}
