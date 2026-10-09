import { expect, type Page } from "@playwright/test";

export async function createCareer(page: Page, opts: { club?: string; position?: string; focus?: string } = {}) {
  await page.goto("/new/");
  await page.getByLabel("First name").fill("Test");
  await page.getByLabel("Last name").fill("Striker");
  await page.getByRole("button", { name: "Next ›" }).click();
  if (opts.position) await page.getByRole("button", { name: opts.position, exact: true }).click();
  await page.getByRole("button", { name: "Next ›" }).click();
  // Desired playstyle: left on "No preference" unless a test asks for one.
  if (opts.focus) await page.getByTestId(`focus-${opts.focus}`).click();
  await page.getByRole("button", { name: "Next ›" }).click();
  await page.getByRole("button", { name: "Late starter · age 20" }).click();
  await page.getByRole("button", { name: new RegExp(opts.club ?? "Southampton") }).first().click();
  await page.getByRole("button", { name: "Next ›" }).click();
  await page.getByRole("button", { name: "Begin career ▸" }).click();
  await expect(page).toHaveURL(/\/play\/?$/);
  await expect(page.getByTestId("overall")).toBeVisible();
}

/** Advance using the visible UI: play/sim match days, otherwise press Continue. */
export async function advanceWeeks(page: Page, weeks: number) {
  for (let i = 0; i < weeks; i++) {
    const matchDay = page.getByTestId("matchday");
    if (await matchDay.isVisible().catch(() => false)) {
      await matchDay.click();
      await page.getByTestId("sim-match").click();
      await expect(page.getByTestId("sim-match")).toBeHidden({ timeout: 20_000 }).catch(() => undefined);
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
      const g = st.getState().game;
      if (!g || g.user.retired) break;
      for (const p of [...g.pending]) await st.getState().simMatch(p.fixtureId);
      await st.getState().advance(1);
    }
  }, turns);
}

export async function gameInfo(page: Page) {
  return page.evaluate(() => {
    const g = (window as unknown as { __pitchborn: Handle }).__pitchborn.getState().game;
    return g ? { season: g.season, turn: g.turn, retired: g.user.retired } : null;
  });
}
