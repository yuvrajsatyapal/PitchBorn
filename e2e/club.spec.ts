import { expect, test, type Page } from "@playwright/test";
import { createCareer, fastForward } from "./helpers";

async function openHistory(page: Page) {
  await page.goto("/play/club/");
  const toggle = page.getByRole("button", { name: /History & Honours/ });
  await expect(toggle).toBeVisible();
  await toggle.click();
}

async function noSideScroll(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(1);
}

test.describe("club page history", () => {
  test("a new career shows real history apart from simulated, and no seasons-played claim", async ({ page }) => {
    await createCareer(page);
    await openHistory(page);
    await expect(page.getByText("from real tables")).toBeVisible();
    await expect(page.getByText("The first completed season will appear here.")).toBeVisible();
    await expect(page.getByTestId("club-honours")).toHaveCount(0);
    await expect(page.getByTestId("club-moments")).toHaveCount(0);
    const legacy = page.getByTestId("club-legacy");
    await expect(legacy).toContainText("1 season at club");
    await expect(legacy).toContainText("No senior appearances yet.");
    await noSideScroll(page);
  });

  test("rivalries are listed once, outside the history card, and a played season fills honours and records", async ({ page }) => {
    await createCareer(page);
    await fastForward(page, 52);
    await openHistory(page);
    await expect(page.getByRole("heading", { name: "Rivalries" })).toHaveCount(1);
    await expect(page.getByText("Rivals", { exact: true })).toHaveCount(0);
    await expect(page.getByTestId("club-honours")).toBeVisible();
    await expect(page.getByTestId("club-records")).toContainText("Best finish");
    await expect(page.getByTestId("club-legacy")).toContainText(/seasons? at club/);
    await noSideScroll(page);
  });
});
