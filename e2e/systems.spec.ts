import { expect, test, type Page } from "@playwright/test";
import { advanceWeeks, answerDecisions, createCareer, fastForward, hook, readGame, settled } from "./helpers";

/** The open decision pop-up and its buttons. */
const popup = (page: Page) => page.getByTestId("decision-popup");

async function continueOnce(page: Page) {
  await settled(page);
  await answerDecisions(page);
  await page.getByTestId("continue").click();
  await settled(page);
}

test.describe("the newer career systems, played through the UI", () => {
  test("a youth start: age 15 on a scholarship, then the first professional contract at 17", async ({ page }) => {
    test.setTimeout(480_000);
    await createCareer(page, { path: "Youth academy · age 15", world: "Big five", first: "Young" });
    await expect(page.getByText("Age 15").first()).toBeVisible();
    expect(await readGame<string>(page, "(g) => g.user.youth.stage")).toBe("academy");
    await advanceWeeks(page, 2);
    await page.goto("/play/");
    await hook(page, "youthTurns16");
    // Play the season out (other pop-ups are answered as they come); the decision arrives at its end.
    await expect
      .poll(async () => {
        if (await popup(page).filter({ hasText: "Your first professional contract" }).isVisible().catch(() => false)) return true;
        await answerDecisions(page);
        await fastForward(page, 4);
        return false;
      }, { timeout: 420_000, intervals: [0] })
      .toBe(true);
    await expect(popup(page)).toContainText("Your first professional contract");
    await popup(page).getByRole("button", { name: /Sign pro with|Sign for|Leave and find/ }).first().click();
    await expect(popup(page)).toBeHidden();
    expect(await readGame<string>(page, "(g) => g.user.youth.stage")).toBe("pro");
    await continueOnce(page);
    const signed = await readGame<boolean>(page, "(g) => { const p = g.players[g.user.playerId]; return !p.contract || p.contract.signed >= g.user.youth.proDecisionSeason; }");
    expect(signed).toBe(true);
  });

  test("injury choices: rush back, or surgery for a serious one", async ({ page }) => {
    test.setTimeout(120_000);
    await createCareer(page, { world: "Big five" });
    await hook(page, "injure", "moderate");
    await expect(popup(page)).toContainText("how do you want to handle it?");
    for (const label of ["Rush back", "Follow the medical plan", "Rest fully", "Specialist clinic"]) await expect(popup(page).getByRole("button", { name: new RegExp(label) })).toBeVisible();
    await popup(page).getByRole("button", { name: /Rush back/ }).click();
    expect(await readGame<number>(page, "(g) => g.players[g.user.playerId].injury.weeksLeft")).toBeLessThan(4);
    expect(await readGame<boolean>(page, "(g) => g.user.recovery.rushedUntil > g.turnIndex")).toBe(true);
    await page.goto("/play/profile/");
    await expect(page.getByText(/Body report/i).first()).toBeVisible();

    await page.goto("/play/");
    await hook(page, "injure", "serious");
    await expect(popup(page)).toContainText("how do you want to handle it?");
    await expect(popup(page).getByRole("button", { name: /Conservative treatment/ })).toBeVisible();
    await popup(page).getByRole("button", { name: /^Surgery/ }).click();
    expect(await readGame<string>(page, "(g) => g.user.recovery.current.choice")).toBe("surgery");
  });

  test("off-pitch drama: a row with the manager plays out over the next weeks", async ({ page }) => {
    test.setTimeout(150_000);
    await createCareer(page, { world: "Big five" });
    expect(await hook(page, "drama", "fallout")).toBe(true);
    await expect(popup(page)).toContainText("A row with the manager");
    await popup(page).getByRole("button", { name: /Stand your ground/ }).click();
    // Phones keep the Club page in the More menu: save the choice, then open the page directly.
    await page.evaluate(() => (window as unknown as { __pitchborn: { getState: () => { save: () => Promise<void> } } }).__pitchborn.getState().save());
    await page.goto("/play/club/");
    await expect(page.getByText("Falling out with the manager").first()).toBeVisible();
    // The next beat: frozen out (a second decision) or the air cleared.
    for (let i = 0; i < 5; i++) {
      if (await popup(page).isVisible().catch(() => false)) break;
      if (!(await readGame<boolean>(page, "(g) => !!g.user.drama.active"))) break;
      await fastForward(page, 1);
    }
    if (await popup(page).isVisible().catch(() => false)) {
      await expect(popup(page).filter({ hasText: "Frozen out" })).toBeVisible();
      await popup(page).getByRole("button", { name: /Bide your time/ }).click();
    }
    await expect.poll(() => readGame<number>(page, "(g) => g.user.drama.log.length")).toBe(1);
  });

  test("bidding war and deadline day show on the Transfers page and can be answered", async ({ page }) => {
    test.setTimeout(120_000);
    await createCareer(page, { world: "Big five" });
    const res = (await hook(page, "transferDrama")) as { war: boolean; deadline: boolean };
    expect(res.war).toBe(true);
    await page.goto("/play/transfers/");
    await expect(page.getByText("⚔️ Bidding war").first()).toBeVisible();
    if (res.deadline) await expect(page.getByText(/Deadline day: answer this week/).first()).toBeVisible();
    await expect(page.getByTestId("leak-interest")).toBeVisible();
    await answerDecisions(page);
    await continueOnce(page);
    expect(await readGame<boolean>(page, "(g) => g.user.achievements.some((a) => a.id === 'wanted-man')")).toBe(true);
  });

  test("the career timeline saves a poster and a video", async ({ page }) => {
    test.setTimeout(120_000);
    await createCareer(page, { world: "Big five" });
    await page.goto("/play/card/");
    const poster = page.waitForEvent("download");
    await page.getByRole("button", { name: "Save poster" }).click();
    expect((await poster).suggestedFilename()).toMatch(/-timeline\.png$/);
    const video = page.getByRole("button", { name: "Save video" });
    if (await video.isEnabled()) {
      const dl = page.waitForEvent("download", { timeout: 60_000 });
      await video.click();
      await expect(page.getByRole("button", { name: /Recording/ })).toBeVisible();
      const file = await dl;
      expect(file.suggestedFilename()).toMatch(/-timeline\.(webm|mp4)$/);
      const path = await file.path();
      const { statSync } = await import("node:fs");
      expect(statSync(path).size).toBeGreaterThan(10_000);
    }
  });

  test("after retiring, the child takes over the save as the next generation", async ({ page }) => {
    test.setTimeout(120_000);
    await createCareer(page, { world: "Big five" });
    const surname = await readGame<string>(page, "(g) => g.players[g.user.playerId].lastName");
    await page.evaluate(() => (window as unknown as { __pitchborn: { getState: () => { retire: () => Promise<void> } } }).__pitchborn.getState().retire());
    expect(await readGame<boolean>(page, "(g) => g.user.retired")).toBe(true);
    await page.goto("/play/legacy/");
    const card = page.getByTestId("next-generation");
    await expect(card).toBeVisible();
    await card.getByRole("textbox").first().fill("Junior");
    await card.getByRole("button", { name: /Start Junior career/ }).click();
    await expect(page).toHaveURL(/\/play\/?$/);
    await expect(page.getByText(`Junior ${surname}`).first()).toBeVisible();
    expect(await readGame<number>(page, "(g) => g.generation")).toBe(2);
    await continueOnce(page);
    expect(await readGame<boolean>(page, "(g) => g.user.achievements.some((a) => a.id === 'second-generation')")).toBe(true);
  });
});
