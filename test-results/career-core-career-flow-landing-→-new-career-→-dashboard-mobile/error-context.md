# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: career.spec.ts >> core career flow >> landing → new career → dashboard
- Location: e2e/career.spec.ts:5:7

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
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <div class="grid gap-4">…</div> intercepts pointer events
  - retrying click action
    - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=f1e1]:
  - generic [ref=f1e3]:
    - banner [ref=f1e4]:
      - link "Pitchborn Pitchborn" [ref=f1e5] [cursor=pointer]:
        - /url: /
        - img "Pitchborn" [ref=f1e6]
        - generic [ref=f1e10]: Pitchborn
      - navigation [ref=f1e11]:
        - link "My saves" [ref=f1e12] [cursor=pointer]:
          - /url: /saves/
    - main [ref=f1e13]:
      - list "Steps" [ref=f1e14]:
        - listitem [ref=f1e15]: 1. Identity
        - listitem [ref=f1e16]: 2. Player
        - listitem [ref=f1e17]: 3. Path & club
        - listitem [ref=f1e18]: 4. Confirm
      - generic [ref=f1e19]:
        - generic [ref=f1e20]:
          - heading "How does it start?" [level=2] [ref=f1e22]
          - generic [ref=f1e23]:
            - button "Academy prospect · age 17 Raw but full of potential. Expect to fight for minutes — loans can help." [ref=f1e24]:
              - generic [ref=f1e25]: Academy prospect · age 17
              - generic [ref=f1e26]: Raw but full of potential. Expect to fight for minutes — loans can help.
            - button "Late starter · age 20 Closer to the first team now, a little less ceiling." [active] [pressed] [ref=f1e27]:
              - generic [ref=f1e28]: Late starter · age 20
              - generic [ref=f1e29]: Closer to the first team now, a little less ceiling.
          - generic [ref=f1e30]: Difficulty
          - tablist [ref=f1e31]:
            - tab "Relaxed" [ref=f1e32]
            - tab "Standard" [selected] [ref=f1e33]
            - tab "Hardcore" [ref=f1e34]
        - generic [ref=f1e35]:
          - heading "Choose your first club" [level=2] [ref=f1e37]
          - tablist [ref=f1e38]:
            - tab [selected] [ref=f1e39]:
              - generic [ref=f1e40]:
                - img "England" [ref=f1e41]
                - text: England
            - tab [ref=f1e42]:
              - generic [ref=f1e43]:
                - img "Spain" [ref=f1e44]
                - text: Spain
            - tab [ref=f1e45]:
              - generic [ref=f1e46]:
                - img "Germany" [ref=f1e47]
                - text: Germany
            - tab [ref=f1e48]:
              - generic [ref=f1e49]:
                - img "Italy" [ref=f1e50]
                - text: Italy
            - tab [ref=f1e51]:
              - generic [ref=f1e52]:
                - img "France" [ref=f1e53]
                - text: France
          - tablist [ref=f1e54]:
            - tab "Premier League" [ref=f1e55]
            - tab "EFL Championship" [selected] [ref=f1e56]
            - tab "EFL League One" [ref=f1e57]
          - list [ref=f1e58]:
            - listitem [ref=f1e59]:
              - button "West Ham United emblem West Ham United London Stadium · London Borough of Newham Good chance of" [ref=f1e60]:
                - img "West Ham United emblem" [ref=f1e61]:
                  - generic [ref=f1e66]: WHU
                - generic [ref=f1e67]:
                  - generic [ref=f1e68]: West Ham United
                  - generic [ref=f1e69]: London Stadium · London Borough of Newham
                - generic [ref=f1e70]: Good chance of
            - listitem [ref=f1e71]:
              - button "Wolverhampton Wanderers emblem Wolverhampton Wanderers Molineux Stadium · Wolverhampton Good chance of" [ref=f1e72]:
                - img "Wolverhampton Wanderers emblem" [ref=f1e73]:
                  - generic [ref=f1e78]: WOW
                - generic [ref=f1e79]:
                  - generic [ref=f1e80]: Wolverhampton Wanderers
                  - generic [ref=f1e81]: Molineux Stadium · Wolverhampton
                - generic [ref=f1e82]: Good chance of
            - listitem [ref=f1e83]:
              - button "Burnley emblem Burnley Turf Moor · Burnley Good chance of" [ref=f1e84]:
                - img "Burnley emblem" [ref=f1e85]:
                  - generic [ref=f1e89]: BUR
                - generic [ref=f1e90]:
                  - generic [ref=f1e91]: Burnley
                  - generic [ref=f1e92]: Turf Moor · Burnley
                - generic [ref=f1e93]: Good chance of
            - listitem [ref=f1e94]:
              - button "Southampton emblem Southampton St Mary's Stadium · Southampton Good chance of" [ref=f1e95]:
                - img "Southampton emblem" [ref=f1e96]:
                  - generic [ref=f1e100]: SOU
                - generic [ref=f1e101]:
                  - generic [ref=f1e102]: Southampton
                  - generic [ref=f1e103]: St Mary's Stadium · Southampton
                - generic [ref=f1e104]: Good chance of
            - listitem [ref=f1e105]:
              - button "Sheffield United emblem Sheffield United Bramall Lane · Sheffield Good chance of" [ref=f1e106]:
                - img "Sheffield United emblem" [ref=f1e107]:
                  - generic [ref=f1e112]: SHU
                - generic [ref=f1e113]:
                  - generic [ref=f1e114]: Sheffield United
                  - generic [ref=f1e115]: Bramall Lane · Sheffield
                - generic [ref=f1e116]: Good chance of
            - listitem [ref=f1e117]:
              - button "Middlesbrough emblem Middlesbrough Riverside Stadium · Middlesbrough Good chance of" [ref=f1e118]:
                - img "Middlesbrough emblem" [ref=f1e119]:
                  - generic [ref=f1e123]: MID
                - generic [ref=f1e124]:
                  - generic [ref=f1e125]: Middlesbrough
                  - generic [ref=f1e126]: Riverside Stadium · Middlesbrough
                - generic [ref=f1e127]: Good chance of
            - listitem [ref=f1e128]:
              - button "West Bromwich Albion emblem West Bromwich Albion The Hawthorns · West Bromwich Good chance of" [ref=f1e129]:
                - img "West Bromwich Albion emblem" [ref=f1e130]:
                  - generic [ref=f1e134]: WBA
                - generic [ref=f1e135]:
                  - generic [ref=f1e136]: West Bromwich Albion
                  - generic [ref=f1e137]: The Hawthorns · West Bromwich
                - generic [ref=f1e138]: Good chance of
            - listitem [ref=f1e139]:
              - button "Millwall emblem Millwall The Den · London Good chance of" [ref=f1e140]:
                - img "Millwall emblem" [ref=f1e141]:
                  - generic [ref=f1e146]: MIL
                - generic [ref=f1e147]:
                  - generic [ref=f1e148]: Millwall
                  - generic [ref=f1e149]: The Den · London
                - generic [ref=f1e150]: Good chance of
            - listitem [ref=f1e151]:
              - button "Norwich City emblem Norwich City Carrow Road · Norwich Good chance of" [ref=f1e152]:
                - img "Norwich City emblem" [ref=f1e153]:
                  - generic [ref=f1e162]: NOC
                - generic [ref=f1e163]:
                  - generic [ref=f1e164]: Norwich City
                  - generic [ref=f1e165]: Carrow Road · Norwich
                - generic [ref=f1e166]: Good chance of
            - listitem [ref=f1e167]:
              - button "Blackburn Rovers emblem Blackburn Rovers Ewood Park · Blackburn Good chance of" [ref=f1e168]:
                - img "Blackburn Rovers emblem" [ref=f1e169]:
                  - generic [ref=f1e173]: BLR
                - generic [ref=f1e174]:
                  - generic [ref=f1e175]: Blackburn Rovers
                  - generic [ref=f1e176]: Ewood Park · Blackburn
                - generic [ref=f1e177]: Good chance of
            - listitem [ref=f1e178]:
              - button "Bristol City emblem Bristol City Ashton Gate Stadium · Bristol Good chance of" [ref=f1e179]:
                - img "Bristol City emblem" [ref=f1e180]:
                  - generic [ref=f1e189]: BRC
                - generic [ref=f1e190]:
                  - generic [ref=f1e191]: Bristol City
                  - generic [ref=f1e192]: Ashton Gate Stadium · Bristol
                - generic [ref=f1e193]: Good chance of
            - listitem [ref=f1e194]:
              - button "Swansea City emblem Swansea City Liberty Stadium · Swansea Good chance of" [ref=f1e195]:
                - img "Swansea City emblem" [ref=f1e196]:
                  - generic [ref=f1e200]: SWC
                - generic [ref=f1e201]:
                  - generic [ref=f1e202]: Swansea City
                  - generic [ref=f1e203]: Liberty Stadium · Swansea
                - generic [ref=f1e204]: Good chance of
            - listitem [ref=f1e205]:
              - button "Watford emblem Watford Vicarage Road · Watford Good chance of" [ref=f1e206]:
                - img "Watford emblem" [ref=f1e207]:
                  - generic [ref=f1e212]: WAT
                - generic [ref=f1e213]:
                  - generic [ref=f1e214]: Watford
                  - generic [ref=f1e215]: Vicarage Road · Watford
                - generic [ref=f1e216]: Good chance of
            - listitem [ref=f1e217]:
              - button "Portsmouth emblem Portsmouth Fratton Park · Portsmouth Good chance of" [ref=f1e218]:
                - img "Portsmouth emblem" [ref=f1e219]:
                  - generic [ref=f1e224]: POR
                - generic [ref=f1e225]:
                  - generic [ref=f1e226]: Portsmouth
                  - generic [ref=f1e227]: Fratton Park · Portsmouth
                - generic [ref=f1e228]: Good chance of
            - listitem [ref=f1e229]:
              - button "Wrexham emblem Wrexham Racecourse Ground · Wrexham Good chance of" [ref=f1e230]:
                - img "Wrexham emblem" [ref=f1e231]:
                  - generic [ref=f1e240]: WRE
                - generic [ref=f1e241]:
                  - generic [ref=f1e242]: Wrexham
                  - generic [ref=f1e243]: Racecourse Ground · Wrexham
                - generic [ref=f1e244]: Good chance of
            - listitem [ref=f1e245]:
              - button "Bolton Wanderers emblem Bolton Wanderers Toughsheet Community Stadium · Horwich Good chance of" [ref=f1e246]:
                - img "Bolton Wanderers emblem" [ref=f1e247]:
                  - generic [ref=f1e252]: BOW
                - generic [ref=f1e253]:
                  - generic [ref=f1e254]: Bolton Wanderers
                  - generic [ref=f1e255]: Toughsheet Community Stadium · Horwich
                - generic [ref=f1e256]: Good chance of
            - listitem [ref=f1e257]:
              - button "Charlton Athletic emblem Charlton Athletic The Valley · London Good chance of" [ref=f1e258]:
                - img "Charlton Athletic emblem" [ref=f1e259]:
                  - generic [ref=f1e263]: CHA
                - generic [ref=f1e264]:
                  - generic [ref=f1e265]: Charlton Athletic
                  - generic [ref=f1e266]: The Valley · London
                - generic [ref=f1e267]: Good chance of
            - listitem [ref=f1e268]:
              - button "Preston North End emblem Preston North End Deepdale · Preston Good chance of" [ref=f1e269]:
                - img "Preston North End emblem" [ref=f1e270]:
                  - generic [ref=f1e274]: PNE
                - generic [ref=f1e275]:
                  - generic [ref=f1e276]: Preston North End
                  - generic [ref=f1e277]: Deepdale · Preston
                - generic [ref=f1e278]: Good chance of
            - listitem [ref=f1e279]:
              - button "Derby County emblem Derby County Pride Park Stadium · Derby Good chance of" [ref=f1e280]:
                - img "Derby County emblem" [ref=f1e281]:
                  - generic [ref=f1e285]: DEC
                - generic [ref=f1e286]:
                  - generic [ref=f1e287]: Derby County
                  - generic [ref=f1e288]: Pride Park Stadium · Derby
                - generic [ref=f1e289]: Good chance of
            - listitem [ref=f1e290]:
              - button "Queens Park Rangers emblem Queens Park Rangers Kiyan Prince Foundation Stadium · London Good chance of" [ref=f1e291]:
                - img "Queens Park Rangers emblem" [ref=f1e292]:
                  - generic [ref=f1e297]: QPR
                - generic [ref=f1e298]:
                  - generic [ref=f1e299]: Queens Park Rangers
                  - generic [ref=f1e300]: Kiyan Prince Foundation Stadium · London
                - generic [ref=f1e301]: Good chance of
            - listitem [ref=f1e302]:
              - button "Stoke City emblem Stoke City Britannia Stadium · Stoke-on-Trent Good chance of" [ref=f1e303]:
                - img "Stoke City emblem" [ref=f1e304]:
                  - generic [ref=f1e308]: STC
                - generic [ref=f1e309]:
                  - generic [ref=f1e310]: Stoke City
                  - generic [ref=f1e311]: Britannia Stadium · Stoke-on-Trent
                - generic [ref=f1e312]: Good chance of
            - listitem [ref=f1e313]:
              - button "Cardiff City emblem Cardiff City Cardiff City Stadium · Cardiff Good chance of" [ref=f1e314]:
                - img "Cardiff City emblem" [ref=f1e315]:
                  - generic [ref=f1e319]: CAC
                - generic [ref=f1e320]:
                  - generic [ref=f1e321]: Cardiff City
                  - generic [ref=f1e322]: Cardiff City Stadium · Cardiff
                - generic [ref=f1e323]: Good chance of
            - listitem [ref=f1e324]:
              - button "Birmingham City emblem Birmingham City St Andrew's · Birmingham Good chance of" [ref=f1e325]:
                - img "Birmingham City emblem" [ref=f1e326]:
                  - generic [ref=f1e331]: BIC
                - generic [ref=f1e332]:
                  - generic [ref=f1e333]: Birmingham City
                  - generic [ref=f1e334]: St Andrew's · Birmingham
                - generic [ref=f1e335]: Good chance of
            - listitem [ref=f1e336]:
              - button "Lincoln City emblem Lincoln City Sincil Bank · Lincoln Good chance of" [ref=f1e337]:
                - img "Lincoln City emblem" [ref=f1e338]:
                  - generic [ref=f1e343]: LIC
                - generic [ref=f1e344]:
                  - generic [ref=f1e345]: Lincoln City
                  - generic [ref=f1e346]: Sincil Bank · Lincoln
                - generic [ref=f1e347]: Good chance of
      - generic [ref=f1e348]:
        - button "‹ Back" [ref=f1e349]
        - button "Next ›" [disabled] [ref=f1e350]
  - alert [ref=f1e351]
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
  21 |     const matchDay = page.getByRole("button", { name: /Match/ }).first();
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