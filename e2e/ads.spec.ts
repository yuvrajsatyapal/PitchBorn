import { expect, test } from "@playwright/test";
import { createCareer } from "./helpers";

test.describe("advertising architecture", () => {
  test("ad slots are labelled, never inside navigation, and never on decision screens", async ({ page }, info) => {
    await createCareer(page);
    const slots = page.locator("[data-ad-slot]");
    const count = await slots.count();
    // Placeholder provider in E2E builds → slots render with labels.
    for (let i = 0; i < count; i++) {
      await expect(slots.nth(i)).toContainText("Ad / Sponsor");
      expect(await slots.nth(i).evaluate((el) => !!el.closest("nav"))).toBe(false);
    }
    if (info.project.name === "desktop") await expect(page.locator('[data-ad-slot="rail-right"]')).toBeVisible();
    else await expect(page.locator('[data-ad-slot="rail-right"]')).toHaveCount(0);
    await page.goto("/play/transfers/");
    await expect(page.locator("[data-ad-slot]")).toHaveCount(0);
    await page.goto("/play/training/");
    await expect(page.locator("[data-ad-slot]")).toHaveCount(0);
  });

  test("the game works when ad requests are blocked", async ({ page, context }) => {
    await context.route(/googlesyndication|doubleclick|adservice/, (r) => r.abort());
    await createCareer(page);
    await page.getByTestId("continue").click();
    await expect(page.getByTestId("overall")).toBeVisible();
  });

  test("ad rail never makes the main column unusably narrow", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop");
    await createCareer(page);
    const width = await page.locator("main#main").evaluate((el) => el.getBoundingClientRect().width);
    expect(width).toBeGreaterThan(700);
  });

  test("no horizontal overflow on key screens", async ({ page }) => {
    await createCareer(page);
    for (const path of ["/play/", "/play/league/", "/play/club/", "/play/profile/", "/play/stats/"]) {
      await page.goto(path);
      await expect(page.locator("main#main")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(1);
    }
  });

  test("ad containers reserve space (no large layout shift)", async ({ page }) => {
    await createCareer(page);
    const cls = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let total = 0;
          new PerformanceObserver((list) => {
            for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) total += e.value;
          }).observe({ type: "layout-shift", buffered: true });
          setTimeout(() => resolve(total), 2500);
        }),
    );
    expect(cls).toBeLessThan(0.15);
  });
});
