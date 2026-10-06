import { expect, test } from "@playwright/test";
import { advanceWeeks, createCareer, fastForward, gameInfo } from "./helpers";

test.describe("core career flow", () => {
  test("landing → new career → dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /One player/ })).toBeVisible();
    await page.getByRole("link", { name: /Start a career/ }).click();
    await expect(page).toHaveURL(/\/new\/?$/);
    await createCareer(page);
    await expect(page.getByText("Southampton").first()).toBeVisible();
  });

  test("weeks advance and match days can be simulated", async ({ page }) => {
    await createCareer(page);
    for (let i = 0; i < 8 && !(await page.getByTestId("matchday").isVisible().catch(() => false)); i++) {
      const before = (await gameInfo(page))?.turn;
      await page.getByTestId("continue").click();
      await expect.poll(async () => (await gameInfo(page))?.turn, { timeout: 20_000 }).not.toBe(before);
    }
    expect((await gameInfo(page))!.turn).toBeGreaterThanOrEqual(4);
    await page.getByTestId("matchday").click();
    await expect(page).toHaveURL(/\/play\/match\/?$/);
    await page.getByTestId("sim-match").click();
    await expect(page.getByText("Full time").first()).toBeVisible();
    await page.goto("/play/schedule/");
    await expect(page.getByText(/\d–\d/).first()).toBeVisible();
  });

  test("live match plays to full time and records the result", async ({ page }) => {
    await createCareer(page);
    await fastForward(page, 3);
    await page.goto("/play/match/");
    const start = page.getByTestId("start-live");
    if (!(await start.isVisible().catch(() => false))) await fastForward(page, 1);
    await page.goto("/play/match/");
    await page.getByTestId("start-live").click();
    await expect(page.getByTestId("score")).toBeVisible();
    // Answer any key-moment decisions while skipping ahead.
    for (let i = 0; i < 10; i++) {
      const opt = page.getByTestId("decision-option").first();
      if (await opt.isVisible().catch(() => false)) await opt.click();
      const skip = page.getByRole("button", { name: /Skip to full time/ });
      if (await skip.isVisible().catch(() => false)) await skip.click();
      if (await page.getByTestId("finish-match").isVisible().catch(() => false)) break;
    }
    await page.getByTestId("finish-match").click();
    await expect(page.getByText("Player ratings")).toBeVisible();
  });

  test("career persists across reloads", async ({ page }) => {
    await createCareer(page);
    await advanceWeeks(page, 2);
    const before = await gameInfo(page);
    await page.waitForTimeout(800);
    await page.reload();
    await expect(page.getByTestId("overall")).toBeVisible();
    const after = await gameInfo(page);
    expect(after).toEqual(before);
    await page.goto("/saves/");
    await expect(page.getByText("Test Striker")).toBeVisible();
  });

  test("a full season completes and a new one begins", async ({ page }) => {
    test.setTimeout(240_000);
    await createCareer(page);
    await fastForward(page, 52);
    const info = await gameInfo(page);
    expect(info!.season).toBe(2027);
    await page.goto("/play/league/");
    await page.getByRole("tab", { name: "History" }).click();
    await expect(page.getByText("2026/27").first()).toBeVisible();
  });

  test("retirement shows the legacy screen", async ({ page }) => {
    await createCareer(page);
    await page.evaluate(async () => {
      const st = (window as unknown as { __pitchborn: { getState: () => { retire: () => Promise<void> } } }).__pitchborn;
      await st.getState().retire();
    });
    await page.goto("/play/legacy/");
    await expect(page.getByText("Pitchborn legacy")).toBeVisible();
    await expect(page.getByText("Legacy breakdown")).toBeVisible();
  });
});
