import { expect, test } from "@playwright/test";
import { createCareer } from "./helpers";

test.describe("layout", () => {
  test("the site carries no ad or sponsor sections", async ({ page }) => {
    await createCareer(page);
    for (const path of ["/play/", "/play/league/", "/play/stats/"]) {
      await page.goto(path);
      await expect(page.locator("main#main")).toBeVisible();
      await expect(page.locator('[aria-label="Ad / Sponsor"], [data-ad-section]')).toHaveCount(0);
    }
  });

  test("no horizontal overflow on key screens", async ({ page }) => {
    await createCareer(page);
    for (const path of ["/play/", "/play/league/", "/play/club/", "/play/profile/", "/play/stats/", "/play/transfers/", "/play/lifestyle/"]) {
      await page.goto(path);
      await expect(page.locator("main#main")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(1);
    }
  });
});
