# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ads.spec.ts >> advertising architecture >> no horizontal overflow on key screens
- Location: e2e/ads.spec.ts:36:7

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: locator.click: Test timeout of 120000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /Southampton/ }).first()
    - locator resolved to <button aria-pressed="false" class="flex w-full items-center gap-3 rounded-xl border-2 border-line p-2.5 text-left bg-card hover:bg-paper-2">…</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <h2 class="font-display text-xl leading-none">Choose your first club</h2> from <header class="mb-3 flex items-center justify-between gap-3">…</header> subtree intercepts pointer events
  - retrying click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <div class="truncate font-bold">Burnley</div> from <li>…</li> subtree intercepts pointer events
  - retrying click action
    - waiting 20ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <div class="grid gap-4">…</div> intercepts pointer events
  2 × retrying click action
      - waiting 100ms
      - waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-pressed="true" class="rounded-2xl border-2 border-line p-4 text-left bg-sun-2 shadow-[3px_3px_0_var(--shadow)]">…</button> from <section class="pb-card  p-4 sm:p-5 ">…</section> subtree intercepts pointer events
  57 × retrying click action
       - waiting 500ms
       - waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <div class="truncate font-bold">Burnley</div> from <li>…</li> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms
       - waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <div class="grid gap-4">…</div> intercepts pointer events
     - retrying click action
       - waiting 500ms
       - waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <button aria-pressed="true" class="rounded-2xl border-2 border-line p-4 text-left bg-sun-2 shadow-[3px_3px_0_var(--shadow)]">…</button> from <section class="pb-card  p-4 sm:p-5 ">…</section> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms
       - waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <button aria-pressed="true" class="rounded-2xl border-2 border-line p-4 text-left bg-sun-2 shadow-[3px_3px_0_var(--shadow)]">…</button> from <section class="pb-card  p-4 sm:p-5 ">…</section> subtree intercepts pointer events
  - retrying click action
    - waiting 500ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <div class="truncate font-bold">Burnley</div> from <li>…</li> subtree intercepts pointer events
  - retrying click action
    - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e3]:
    - banner [ref=e4]:
      - link "Pitchborn Pitchborn" [ref=e5] [cursor=pointer]:
        - /url: /
        - img "Pitchborn" [ref=e6]
        - generic [ref=e10]: Pitchborn
      - navigation [ref=e11]:
        - link "My saves" [ref=e12] [cursor=pointer]:
          - /url: /saves/
    - main [ref=e13]:
      - list "Steps" [ref=e14]:
        - listitem [ref=e15]: 1. Identity
        - listitem [ref=e16]: 2. Player
        - listitem [ref=e17]: 3. Path & club
        - listitem [ref=e18]: 4. Confirm
      - generic [ref=e19]:
        - generic [ref=e20]:
          - heading "How does it start?" [level=2] [ref=e22]
          - generic [ref=e23]:
            - button "Academy prospect · age 17 Raw but full of potential. Expect to fight for minutes — loans can help." [ref=e24]:
              - generic [ref=e25]: Academy prospect · age 17
              - generic [ref=e26]: Raw but full of potential. Expect to fight for minutes — loans can help.
            - button "Late starter · age 20 Closer to the first team now, a little less ceiling." [active] [pressed] [ref=e27]:
              - generic [ref=e28]: Late starter · age 20
              - generic [ref=e29]: Closer to the first team now, a little less ceiling.
          - generic [ref=e30]: Difficulty
          - tablist [ref=e31]:
            - tab "Relaxed" [ref=e32]
            - tab "Standard" [selected] [ref=e33]
            - tab "Hardcore" [ref=e34]
        - generic [ref=e35]:
          - heading "Choose your first club" [level=2] [ref=e37]
          - tablist [ref=e38]:
            - tab [selected] [ref=e39]:
              - generic [ref=e40]:
                - img "England" [ref=e41]
                - text: England
            - tab [ref=e42]:
              - generic [ref=e43]:
                - img "Spain" [ref=e44]
                - text: Spain
            - tab [ref=e45]:
              - generic [ref=e46]:
                - img "Germany" [ref=e47]
                - text: Germany
            - tab [ref=e48]:
              - generic [ref=e49]:
                - img "Italy" [ref=e50]
                - text: Italy
            - tab [ref=e51]:
              - generic [ref=e52]:
                - img "France" [ref=e53]
                - text: France
          - tablist [ref=e54]:
            - tab "Premier League" [ref=e55]
            - tab "EFL Championship" [selected] [ref=e56]
            - tab "EFL League One" [ref=e57]
          - list [ref=e58]:
            - listitem [ref=e59]:
              - button "West Ham United emblem West Ham United London Stadium · London Borough of Newham Good chance of" [ref=e60]:
                - img "West Ham United emblem" [ref=e61]:
                  - generic [ref=e66]: WHU
                - generic [ref=e67]:
                  - generic [ref=e68]: West Ham United
                  - generic [ref=e69]: London Stadium · London Borough of Newham
                - generic [ref=e70]: Good chance of
            - listitem [ref=e71]:
              - button "Wolverhampton Wanderers emblem Wolverhampton Wanderers Molineux Stadium · Wolverhampton Good chance of" [ref=e72]:
                - img "Wolverhampton Wanderers emblem" [ref=e73]:
                  - generic [ref=e78]: WOW
                - generic [ref=e79]:
                  - generic [ref=e80]: Wolverhampton Wanderers
                  - generic [ref=e81]: Molineux Stadium · Wolverhampton
                - generic [ref=e82]: Good chance of
            - listitem [ref=e83]:
              - button "Burnley emblem Burnley Turf Moor · Burnley Good chance of" [ref=e84]:
                - img "Burnley emblem" [ref=e85]:
                  - generic [ref=e89]: BUR
                - generic [ref=e90]:
                  - generic [ref=e91]: Burnley
                  - generic [ref=e92]: Turf Moor · Burnley
                - generic [ref=e93]: Good chance of
            - listitem [ref=e94]:
              - button "Southampton emblem Southampton St Mary's Stadium · Southampton Good chance of" [ref=e95]:
                - img "Southampton emblem" [ref=e96]:
                  - generic [ref=e100]: SOU
                - generic [ref=e101]:
                  - generic [ref=e102]: Southampton
                  - generic [ref=e103]: St Mary's Stadium · Southampton
                - generic [ref=e104]: Good chance of
            - listitem [ref=e105]:
              - button "Sheffield United emblem Sheffield United Bramall Lane · Sheffield Good chance of" [ref=e106]:
                - img "Sheffield United emblem" [ref=e107]:
                  - generic [ref=e112]: SHU
                - generic [ref=e113]:
                  - generic [ref=e114]: Sheffield United
                  - generic [ref=e115]: Bramall Lane · Sheffield
                - generic [ref=e116]: Good chance of
            - listitem [ref=e117]:
              - button "Middlesbrough emblem Middlesbrough Riverside Stadium · Middlesbrough Good chance of" [ref=e118]:
                - img "Middlesbrough emblem" [ref=e119]:
                  - generic [ref=e123]: MID
                - generic [ref=e124]:
                  - generic [ref=e125]: Middlesbrough
                  - generic [ref=e126]: Riverside Stadium · Middlesbrough
                - generic [ref=e127]: Good chance of
            - listitem [ref=e128]:
              - button "West Bromwich Albion emblem West Bromwich Albion The Hawthorns · West Bromwich Good chance of" [ref=e129]:
                - img "West Bromwich Albion emblem" [ref=e130]:
                  - generic [ref=e134]: WBA
                - generic [ref=e135]:
                  - generic [ref=e136]: West Bromwich Albion
                  - generic [ref=e137]: The Hawthorns · West Bromwich
                - generic [ref=e138]: Good chance of
            - listitem [ref=e139]:
              - button "Millwall emblem Millwall The Den · London Good chance of" [ref=e140]:
                - img "Millwall emblem" [ref=e141]:
                  - generic [ref=e146]: MIL
                - generic [ref=e147]:
                  - generic [ref=e148]: Millwall
                  - generic [ref=e149]: The Den · London
                - generic [ref=e150]: Good chance of
            - listitem [ref=e151]:
              - button "Norwich City emblem Norwich City Carrow Road · Norwich Good chance of" [ref=e152]:
                - img "Norwich City emblem" [ref=e153]:
                  - generic [ref=e162]: NOC
                - generic [ref=e163]:
                  - generic [ref=e164]: Norwich City
                  - generic [ref=e165]: Carrow Road · Norwich
                - generic [ref=e166]: Good chance of
            - listitem [ref=e167]:
              - button "Blackburn Rovers emblem Blackburn Rovers Ewood Park · Blackburn Good chance of" [ref=e168]:
                - img "Blackburn Rovers emblem" [ref=e169]:
                  - generic [ref=e173]: BLR
                - generic [ref=e174]:
                  - generic [ref=e175]: Blackburn Rovers
                  - generic [ref=e176]: Ewood Park · Blackburn
                - generic [ref=e177]: Good chance of
            - listitem [ref=e178]:
              - button "Bristol City emblem Bristol City Ashton Gate Stadium · Bristol Good chance of" [ref=e179]:
                - img "Bristol City emblem" [ref=e180]:
                  - generic [ref=e189]: BRC
                - generic [ref=e190]:
                  - generic [ref=e191]: Bristol City
                  - generic [ref=e192]: Ashton Gate Stadium · Bristol
                - generic [ref=e193]: Good chance of
            - listitem [ref=e194]:
              - button "Swansea City emblem Swansea City Liberty Stadium · Swansea Good chance of" [ref=e195]:
                - img "Swansea City emblem" [ref=e196]:
                  - generic [ref=e200]: SWC
                - generic [ref=e201]:
                  - generic [ref=e202]: Swansea City
                  - generic [ref=e203]: Liberty Stadium · Swansea
                - generic [ref=e204]: Good chance of
            - listitem [ref=e205]:
              - button "Watford emblem Watford Vicarage Road · Watford Good chance of" [ref=e206]:
                - img "Watford emblem" [ref=e207]:
                  - generic [ref=e212]: WAT
                - generic [ref=e213]:
                  - generic [ref=e214]: Watford
                  - generic [ref=e215]: Vicarage Road · Watford
                - generic [ref=e216]: Good chance of
            - listitem [ref=e217]:
              - button "Portsmouth emblem Portsmouth Fratton Park · Portsmouth Good chance of" [ref=e218]:
                - img "Portsmouth emblem" [ref=e219]:
                  - generic [ref=e224]: POR
                - generic [ref=e225]:
                  - generic [ref=e226]: Portsmouth
                  - generic [ref=e227]: Fratton Park · Portsmouth
                - generic [ref=e228]: Good chance of
            - listitem [ref=e229]:
              - button "Wrexham emblem Wrexham Racecourse Ground · Wrexham Good chance of" [ref=e230]:
                - img "Wrexham emblem" [ref=e231]:
                  - generic [ref=e240]: WRE
                - generic [ref=e241]:
                  - generic [ref=e242]: Wrexham
                  - generic [ref=e243]: Racecourse Ground · Wrexham
                - generic [ref=e244]: Good chance of
            - listitem [ref=e245]:
              - button "Bolton Wanderers emblem Bolton Wanderers Toughsheet Community Stadium · Horwich Good chance of" [ref=e246]:
                - img "Bolton Wanderers emblem" [ref=e247]:
                  - generic [ref=e252]: BOW
                - generic [ref=e253]:
                  - generic [ref=e254]: Bolton Wanderers
                  - generic [ref=e255]: Toughsheet Community Stadium · Horwich
                - generic [ref=e256]: Good chance of
            - listitem [ref=e257]:
              - button "Charlton Athletic emblem Charlton Athletic The Valley · London Good chance of" [ref=e258]:
                - img "Charlton Athletic emblem" [ref=e259]:
                  - generic [ref=e263]: CHA
                - generic [ref=e264]:
                  - generic [ref=e265]: Charlton Athletic
                  - generic [ref=e266]: The Valley · London
                - generic [ref=e267]: Good chance of
            - listitem [ref=e268]:
              - button "Preston North End emblem Preston North End Deepdale · Preston Good chance of" [ref=e269]:
                - img "Preston North End emblem" [ref=e270]:
                  - generic [ref=e274]: PNE
                - generic [ref=e275]:
                  - generic [ref=e276]: Preston North End
                  - generic [ref=e277]: Deepdale · Preston
                - generic [ref=e278]: Good chance of
            - listitem [ref=e279]:
              - button "Derby County emblem Derby County Pride Park Stadium · Derby Good chance of" [ref=e280]:
                - img "Derby County emblem" [ref=e281]:
                  - generic [ref=e285]: DEC
                - generic [ref=e286]:
                  - generic [ref=e287]: Derby County
                  - generic [ref=e288]: Pride Park Stadium · Derby
                - generic [ref=e289]: Good chance of
            - listitem [ref=e290]:
              - button "Queens Park Rangers emblem Queens Park Rangers Kiyan Prince Foundation Stadium · London Good chance of" [ref=e291]:
                - img "Queens Park Rangers emblem" [ref=e292]:
                  - generic [ref=e297]: QPR
                - generic [ref=e298]:
                  - generic [ref=e299]: Queens Park Rangers
                  - generic [ref=e300]: Kiyan Prince Foundation Stadium · London
                - generic [ref=e301]: Good chance of
            - listitem [ref=e302]:
              - button "Stoke City emblem Stoke City Britannia Stadium · Stoke-on-Trent Good chance of" [ref=e303]:
                - img "Stoke City emblem" [ref=e304]:
                  - generic [ref=e308]: STC
                - generic [ref=e309]:
                  - generic [ref=e310]: Stoke City
                  - generic [ref=e311]: Britannia Stadium · Stoke-on-Trent
                - generic [ref=e312]: Good chance of
            - listitem [ref=e313]:
              - button "Cardiff City emblem Cardiff City Cardiff City Stadium · Cardiff Good chance of" [ref=e314]:
                - img "Cardiff City emblem" [ref=e315]:
                  - generic [ref=e319]: CAC
                - generic [ref=e320]:
                  - generic [ref=e321]: Cardiff City
                  - generic [ref=e322]: Cardiff City Stadium · Cardiff
                - generic [ref=e323]: Good chance of
            - listitem [ref=e324]:
              - button "Birmingham City emblem Birmingham City St Andrew's · Birmingham Good chance of" [ref=e325]:
                - img "Birmingham City emblem" [ref=e326]:
                  - generic [ref=e331]: BIC
                - generic [ref=e332]:
                  - generic [ref=e333]: Birmingham City
                  - generic [ref=e334]: St Andrew's · Birmingham
                - generic [ref=e335]: Good chance of
            - listitem [ref=e336]:
              - button "Lincoln City emblem Lincoln City Sincil Bank · Lincoln Good chance of" [ref=e337]:
                - img "Lincoln City emblem" [ref=e338]:
                  - generic [ref=e343]: LIC
                - generic [ref=e344]:
                  - generic [ref=e345]: Lincoln City
                  - generic [ref=e346]: Sincil Bank · Lincoln
                - generic [ref=e347]: Good chance of
      - generic [ref=e348]:
        - button "‹ Back" [ref=e349]
        - button "Next ›" [disabled] [ref=e350]
  - alert [ref=e351]
```

# Test source

```ts
  1  | import { expect, type Page } from "@playwright/test";
  2  | 
  3  | export async function createCareer(page: Page, opts: { club?: string; position?: string } = {}) {
  4  |   await page.goto("/new/");
  5  |   await page.getByLabel("First name").fill("Test");
  6  |   await page.getByLabel("Last name").fill("Striker");
  7  |   await page.getByRole("button", { name: "Next ›" }).click();
  8  |   if (opts.position) await page.getByRole("button", { name: opts.position, exact: true }).click();
  9  |   await page.getByRole("button", { name: "Next ›" }).click();
  10 |   await page.getByRole("button", { name: "Late starter · age 20" }).click();
> 11 |   await page.getByRole("button", { name: new RegExp(opts.club ?? "Southampton") }).first().click();
     |                                                                                            ^ Error: locator.click: Test timeout of 120000ms exceeded.
  12 |   await page.getByRole("button", { name: "Next ›" }).click();
  13 |   await page.getByRole("button", { name: "Begin career ▸" }).click();
  14 |   await expect(page).toHaveURL(/\/play\/?$/);
  15 |   await expect(page.getByTestId("overall")).toBeVisible();
  16 | }
  17 | 
  18 | /** Advance using the visible UI: play/sim match days, otherwise press Continue. */
  19 | export async function advanceWeeks(page: Page, weeks: number) {
  20 |   for (let i = 0; i < weeks; i++) {
  21 |     const matchDay = page.getByRole("button", { name: /Match day/ });
  22 |     if (await matchDay.isVisible().catch(() => false)) {
  23 |       await matchDay.click();
  24 |       await page.getByTestId("sim-match").click();
  25 |       await expect(page.getByTestId("sim-match")).toBeHidden({ timeout: 20_000 }).catch(() => undefined);
  26 |       await page.goto("/play/");
  27 |       continue;
  28 |     }
  29 |     const before = (await gameInfo(page))?.turn;
  30 |     await page.getByTestId("continue").click();
  31 |     await expect.poll(async () => (await gameInfo(page))?.turn, { timeout: 20_000 }).not.toBe(before);
  32 |   }
  33 | }
  34 | 
  35 | type Handle = { getState: () => { game: { season: number; turn: number; pending: { fixtureId: string }[]; user: { retired: boolean } } | null; advance: (n?: number) => Promise<void>; simMatch: (id: string) => Promise<unknown>; retire: () => Promise<void> } };
  36 | 
  37 | /** Fast-forward with the E2E test handle (requires NEXT_PUBLIC_E2E=1 build). */
  38 | export async function fastForward(page: Page, turns: number) {
  39 |   await page.evaluate(async (n) => {
  40 |     const st = (window as unknown as { __pitchborn: Handle }).__pitchborn;
  41 |     for (let i = 0; i < n; i++) {
  42 |       const g = st.getState().game;
  43 |       if (!g || g.user.retired) break;
  44 |       for (const p of [...g.pending]) await st.getState().simMatch(p.fixtureId);
  45 |       await st.getState().advance(1);
  46 |     }
  47 |   }, turns);
  48 | }
  49 | 
  50 | export async function gameInfo(page: Page) {
  51 |   return page.evaluate(() => {
  52 |     const g = (window as unknown as { __pitchborn: Handle }).__pitchborn.getState().game;
  53 |     return g ? { season: g.season, turn: g.turn, retired: g.user.retired } : null;
  54 |   });
  55 | }
  56 | 
```