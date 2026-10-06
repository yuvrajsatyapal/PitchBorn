import { expect, test } from "@playwright/test";
import { createCareer } from "./helpers";

test("core gameplay keeps working offline after first load", async ({ page, context }, info) => {
  test.skip(info.project.name !== "desktop");
  await createCareer(page);
  await page.waitForTimeout(1500); // allow SW install
  await context.setOffline(true);
  await page.getByTestId("continue").or(page.getByTestId("matchday")).first().click();
  await page.goto("/play/").catch(() => undefined);
  await expect(page.getByTestId("overall")).toBeVisible();
  await context.setOffline(false);
});
