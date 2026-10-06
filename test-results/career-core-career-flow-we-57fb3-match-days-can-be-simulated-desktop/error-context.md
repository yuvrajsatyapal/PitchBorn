# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: career.spec.ts >> core career flow >> weeks advance and match days can be simulated
- Location: e2e/career.spec.ts:14:7

# Error details

```
TypeError: Cannot read properties of null (reading 'turn')
```

# Page snapshot

```yaml
- generic [active] [ref=f17e1]:
  - generic [ref=f17e3]:
    - navigation "Game" [ref=f17e4]:
      - link "Pitchborn Pitchborn" [ref=f17e5] [cursor=pointer]:
        - /url: /
        - img "Pitchborn" [ref=f17e6]
        - generic [ref=f17e10]: Pitchborn
      - list [ref=f17e11]:
        - listitem [ref=f17e12]:
          - link "Dashboard" [ref=f17e13] [cursor=pointer]:
            - /url: /play/
            - generic [aria-hidden] [ref=f17e14]: 🏠
            - text: Dashboard
        - listitem [ref=f17e15]:
          - link "Match Day" [ref=f17e16] [cursor=pointer]:
            - /url: /play/match/
            - generic [aria-hidden] [ref=f17e17]: ⚽
            - text: Match Day
        - listitem [ref=f17e18]:
          - link "Schedule" [ref=f17e19] [cursor=pointer]:
            - /url: /play/schedule/
            - generic [aria-hidden] [ref=f17e20]: 📅
            - text: Schedule
        - listitem [ref=f17e21]:
          - link "My Player" [ref=f17e22] [cursor=pointer]:
            - /url: /play/profile/
            - generic [aria-hidden] [ref=f17e23]: 🧍
            - text: My Player
        - listitem [ref=f17e24]:
          - link "Training" [ref=f17e25] [cursor=pointer]:
            - /url: /play/training/
            - generic [aria-hidden] [ref=f17e26]: 🏋️
            - text: Training
        - listitem [ref=f17e27]:
          - link "Club & Squad" [ref=f17e28] [cursor=pointer]:
            - /url: /play/club/
            - generic [aria-hidden] [ref=f17e29]: 🛡️
            - text: Club & Squad
        - listitem [ref=f17e30]:
          - link "Competitions" [ref=f17e31] [cursor=pointer]:
            - /url: /play/league/
            - generic [aria-hidden] [ref=f17e32]: 🏆
            - text: Competitions
        - listitem [ref=f17e33]:
          - link "Career & Contract" [ref=f17e34] [cursor=pointer]:
            - /url: /play/transfers/
            - generic [aria-hidden] [ref=f17e35]: ✍️
            - text: Career & Contract
        - listitem [ref=f17e36]:
          - link "National Team" [ref=f17e37] [cursor=pointer]:
            - /url: /play/national/
            - generic [aria-hidden] [ref=f17e38]: 🌍
            - text: National Team
        - listitem [ref=f17e39]:
          - link "Statistics" [ref=f17e40] [cursor=pointer]:
            - /url: /play/stats/
            - generic [aria-hidden] [ref=f17e41]: 📊
            - text: Statistics
        - listitem [ref=f17e42]:
          - link "Awards" [ref=f17e43] [cursor=pointer]:
            - /url: /play/awards/
            - generic [aria-hidden] [ref=f17e44]: 🥇
            - text: Awards
        - listitem [ref=f17e45]:
          - link "History & Records" [ref=f17e46] [cursor=pointer]:
            - /url: /play/history/
            - generic [aria-hidden] [ref=f17e47]: 📜
            - text: History & Records
        - listitem [ref=f17e48]:
          - link "World News" [ref=f17e49] [cursor=pointer]:
            - /url: /play/world/
            - generic [aria-hidden] [ref=f17e50]: 📰
            - text: World News
        - listitem [ref=f17e51]:
          - link "Settings & Saves" [ref=f17e52] [cursor=pointer]:
            - /url: /play/settings/
            - generic [aria-hidden] [ref=f17e53]: ⚙️
            - text: Settings & Saves
      - link "Data sources & credits" [ref=f17e55] [cursor=pointer]:
        - /url: /credits/
    - generic [ref=f17e56]:
      - banner [ref=f17e57]:
        - generic [ref=f17e58]:
          - generic [ref=f17e59]:
            - img "Southampton emblem" [ref=f17e60]:
              - generic [ref=f17e64]: SOU
            - generic [ref=f17e65]:
              - generic [ref=f17e66]: Southampton
              - generic [ref=f17e67]: 22 Jul 2026 · 2026/27 · W4
          - generic [ref=f17e68]: Season
          - generic [ref=f17e70]:
            - button "Simulate several weeks" [disabled] [ref=f17e71]:
              - generic [ref=f17e72]: »
            - button "⚽ Match day" [ref=f17e73]
      - generic [ref=f17e74]:
        - main [ref=f17e75]:
          - generic [ref=f17e76]:
            - generic [ref=f17e77]:
              - generic [ref=f17e78]:
                - img "Player portrait" [ref=f17e79]
                - generic [ref=f17e89]:
                  - generic [ref=f17e90]:
                    - heading "Test Striker" [level=1] [ref=f17e91]
                    - img "England" [ref=f17e92]
                  - generic [ref=f17e93]:
                    - generic [ref=f17e94]: Striker
                    - generic [ref=f17e95]: Age 20
                    - generic [ref=f17e96]:
                      - img "Southampton emblem" [ref=f17e97]:
                        - generic [ref=f17e101]: SOU
                      - text: Southampton
                  - generic [ref=f17e102]:
                    - generic [ref=f17e103]: Value €1.9M
                    - generic [ref=f17e104]: €4K/wk · until 2029
                    - generic [ref=f17e105]:
                      - text: Potential
                      - generic "2.5 of 5 stars" [ref=f17e106]: ★★½★★
                - generic [ref=f17e107]:
                  - generic [ref=f17e108]: Overall
                  - generic [ref=f17e109]: "59"
              - generic [ref=f17e110]:
                - generic [ref=f17e111]:
                  - generic [ref=f17e112]:
                    - generic [ref=f17e113]: Fitness
                    - generic [ref=f17e114]: "98"
                  - meter "Fitness" [ref=f17e115]
                - generic [ref=f17e117]:
                  - generic [ref=f17e118]:
                    - generic [ref=f17e119]: Morale
                    - generic [ref=f17e120]: "74"
                  - meter "Morale" [ref=f17e121]
                - generic [ref=f17e123]:
                  - generic [ref=f17e124]:
                    - generic [ref=f17e125]: Sharpness
                    - generic [ref=f17e126]: "57"
                  - meter "Sharpness" [ref=f17e127]
                - generic [ref=f17e129]:
                  - generic [ref=f17e130]: Form
                  - meter "Form" [ref=f17e132]
            - generic [ref=f17e134]:
              - generic [ref=f17e135]:
                - generic [ref=f17e136]:
                  - generic [ref=f17e137]: Match day · EFL Championship
                  - generic [ref=f17e138]:
                    - generic [ref=f17e139]:
                      - img "Southampton emblem" [ref=f17e140]:
                        - generic [ref=f17e144]: SOU
                      - generic [ref=f17e145]: Southampton
                    - generic [ref=f17e146]: VS
                    - generic [ref=f17e147]:
                      - img "Queens Park Rangers emblem" [ref=f17e148]:
                        - generic [ref=f17e153]: QPR
                      - generic [ref=f17e154]: QPR
                  - generic [ref=f17e155]:
                    - link "▶ Play live" [ref=f17e156] [cursor=pointer]:
                      - /url: /play/match/
                    - button "Quick sim" [ref=f17e157]
                - generic [ref=f17e158]:
                  - heading "Training-ground bust-up" [level=2] [ref=f17e160]
                  - paragraph [ref=f17e161]: A heated argument with a senior teammate during a small-sided game has the dressing room talking.
                  - generic [ref=f17e162]:
                    - button "Clear the air Teammates respect it" [ref=f17e163]:
                      - generic [ref=f17e164]:
                        - text: Clear the air
                        - generic [ref=f17e165]: Teammates respect it
                    - button "Take it to the manager Manager on side, dressing room less so" [ref=f17e166]:
                      - generic [ref=f17e167]:
                        - text: Take it to the manager
                        - generic [ref=f17e168]: Manager on side, dressing room less so
                    - button "Ignore it" [ref=f17e169]
                - generic [ref=f17e171]:
                  - generic [ref=f17e172]:
                    - heading "This season" [level=2] [ref=f17e173]
                    - link "All stats" [ref=f17e174] [cursor=pointer]:
                      - /url: /play/stats/
                  - generic [ref=f17e175]:
                    - generic [ref=f17e176]:
                      - generic [ref=f17e177]: Apps
                      - generic [ref=f17e178]: "0"
                    - generic [ref=f17e179]:
                      - generic [ref=f17e180]: Goals
                      - generic [ref=f17e181]: "0"
                    - generic [ref=f17e182]:
                      - generic [ref=f17e183]: Assists
                      - generic [ref=f17e184]: "0"
                    - generic [ref=f17e185]:
                      - generic [ref=f17e186]: Avg
                      - generic [ref=f17e187]: –
                    - generic [ref=f17e188]:
                      - generic [ref=f17e189]: MotM
                      - generic [ref=f17e190]: "0"
                    - generic [ref=f17e191]:
                      - generic [ref=f17e192]: Mins
                      - generic [ref=f17e193]: "0"
                  - generic [ref=f17e194]:
                    - generic [ref=f17e195]: Recent ratings
                    - generic [ref=f17e196]: Not enough matches yet
                - generic [ref=f17e197]:
                  - generic [ref=f17e198]:
                    - heading "Training" [level=2] [ref=f17e199]
                    - link "Change" [ref=f17e200] [cursor=pointer]:
                      - /url: /play/training/
                  - generic [ref=f17e201]:
                    - generic [ref=f17e202]: Balanced
                    - generic [ref=f17e203]: Normal
                    - generic [ref=f17e204]: A solid week of work.
              - generic [ref=f17e205]:
                - generic [ref=f17e206]:
                  - generic [ref=f17e207]:
                    - heading "EFL Championship" [level=2] [ref=f17e208]
                    - link "Full table" [ref=f17e209] [cursor=pointer]:
                      - /url: /play/league/
                  - table [ref=f17e210]:
                    - rowgroup [ref=f17e211]:
                      - row [ref=f17e212]:
                        - columnheader "#" [ref=f17e213]
                        - columnheader "Club" [ref=f17e214]
                        - columnheader "P" [ref=f17e215]
                        - columnheader "GD" [ref=f17e216]
                        - columnheader "Pts" [ref=f17e217]
                    - rowgroup [ref=f17e218]:
                      - row [ref=f17e219]:
                        - cell "14" [ref=f17e220]
                        - cell "Preston North End emblem Preston" [ref=f17e221]:
                          - generic [ref=f17e222]:
                            - img "Preston North End emblem" [ref=f17e223]:
                              - generic [ref=f17e227]: PNE
                            - generic [ref=f17e228]: Preston
                        - cell "0" [ref=f17e229]
                        - cell "0" [ref=f17e230]
                        - cell "0" [ref=f17e231]
                      - row [ref=f17e232]:
                        - cell "15" [ref=f17e233]
                        - cell "Queens Park Rangers emblem QPR" [ref=f17e234]:
                          - generic [ref=f17e235]:
                            - img "Queens Park Rangers emblem" [ref=f17e236]:
                              - generic [ref=f17e241]: QPR
                            - generic [ref=f17e242]: QPR
                        - cell "0" [ref=f17e243]
                        - cell "0" [ref=f17e244]
                        - cell "0" [ref=f17e245]
                      - row [ref=f17e246]:
                        - cell "16" [ref=f17e247]
                        - cell "Sheffield United emblem Sheffield United" [ref=f17e248]:
                          - generic [ref=f17e249]:
                            - img "Sheffield United emblem" [ref=f17e250]:
                              - generic [ref=f17e255]: SHU
                            - generic [ref=f17e256]: Sheffield United
                        - cell "0" [ref=f17e257]
                        - cell "0" [ref=f17e258]
                        - cell "0" [ref=f17e259]
                      - row [ref=f17e260]:
                        - cell "17" [ref=f17e261]
                        - cell "Southampton emblem Southampton" [ref=f17e262]:
                          - generic [ref=f17e263]:
                            - img "Southampton emblem" [ref=f17e264]:
                              - generic [ref=f17e268]: SOU
                            - generic [ref=f17e269]: Southampton
                        - cell "0" [ref=f17e270]
                        - cell "0" [ref=f17e271]
                        - cell "0" [ref=f17e272]
                      - row [ref=f17e273]:
                        - cell "18" [ref=f17e274]
                        - cell "Stoke City emblem Stoke City" [ref=f17e275]:
                          - generic [ref=f17e276]:
                            - img "Stoke City emblem" [ref=f17e277]:
                              - generic [ref=f17e281]: STC
                            - generic [ref=f17e282]: Stoke City
                        - cell "0" [ref=f17e283]
                        - cell "0" [ref=f17e284]
                        - cell "0" [ref=f17e285]
                      - row [ref=f17e286]:
                        - cell "19" [ref=f17e287]
                        - cell "Swansea City emblem Swansea City" [ref=f17e288]:
                          - generic [ref=f17e289]:
                            - img "Swansea City emblem" [ref=f17e290]:
                              - generic [ref=f17e294]: SWC
                            - generic [ref=f17e295]: Swansea City
                        - cell "0" [ref=f17e296]
                        - cell "0" [ref=f17e297]
                        - cell "0" [ref=f17e298]
                      - row [ref=f17e299]:
                        - cell "20" [ref=f17e300]
                        - cell "Watford emblem Watford" [ref=f17e301]:
                          - generic [ref=f17e302]:
                            - img "Watford emblem" [ref=f17e303]:
                              - generic [ref=f17e308]: WAT
                            - generic [ref=f17e309]: Watford
                        - cell "0" [ref=f17e310]
                        - cell "0" [ref=f17e311]
                        - cell "0" [ref=f17e312]
                  - generic [ref=f17e313]:
                    - generic [ref=f17e314]: Club form
                    - generic [ref=f17e315]: No games yet
                - complementary "Advertisement" [ref=f17e316]:
                  - generic [ref=f17e320]:
                    - generic [ref=f17e321]: Ad placeholder
                    - generic [ref=f17e322]: dashboard-break · dev/test only
                - generic [ref=f17e323]:
                  - generic [ref=f17e324]:
                    - heading "Fixtures" [level=2] [ref=f17e325]
                    - link "Schedule" [ref=f17e326] [cursor=pointer]:
                      - /url: /play/schedule/
                  - list [ref=f17e327]:
                    - listitem [ref=f17e328]:
                      - generic [ref=f17e329]: 22 Jul
                      - img "Queens Park Rangers emblem" [ref=f17e330]:
                        - generic [ref=f17e335]: QPR
                      - generic [ref=f17e336]:
                        - text: Queens Park Rangers
                        - generic [ref=f17e337]: (H)
                        - generic [ref=f17e338]: · CHA
                      - generic [ref=f17e339]: CHA
                    - listitem [ref=f17e340]:
                      - generic [ref=f17e341]: 29 Jul
                      - img "Burnley emblem" [ref=f17e342]:
                        - generic [ref=f17e346]: BUR
                      - generic [ref=f17e347]:
                        - text: Burnley
                        - generic [ref=f17e348]: (A)
                        - generic [ref=f17e349]: · CHA
                      - generic [ref=f17e350]: CHA
                    - listitem [ref=f17e351]:
                      - generic [ref=f17e352]: 5 Aug
                      - img "Charlton Athletic emblem" [ref=f17e353]:
                        - generic [ref=f17e357]: CHA
                      - generic [ref=f17e358]:
                        - text: Charlton Athletic
                        - generic [ref=f17e359]: (H)
                        - generic [ref=f17e360]: · CHA
                      - generic [ref=f17e361]: CHA
                    - listitem [ref=f17e362]:
                      - generic [ref=f17e363]: 5 Aug
                      - img "Swansea City emblem" [ref=f17e364]:
                        - generic [ref=f17e368]: SWC
                      - generic [ref=f17e369]:
                        - text: Swansea City
                        - generic [ref=f17e370]: (A)
                        - generic [ref=f17e371]: · CHA
                      - generic [ref=f17e372]: CHA
                    - listitem [ref=f17e373]:
                      - generic [ref=f17e374]: 12 Aug
                      - img "Wycombe Wanderers emblem" [ref=f17e375]:
                        - generic [ref=f17e380]: WYW
                      - generic [ref=f17e381]:
                        - text: Wycombe Wanderers
                        - generic [ref=f17e382]: (H)
                        - generic [ref=f17e383]: · Cup Round 1
                      - generic [ref=f17e384]: Cup
                - generic [ref=f17e385]:
                  - generic [ref=f17e386]:
                    - heading "Latest news" [level=2] [ref=f17e387]
                    - link "All news" [ref=f17e388] [cursor=pointer]:
                      - /url: /play/world/
                  - list [ref=f17e389]:
                    - listitem [ref=f17e390]:
                      - generic [ref=f17e391]: Viktor Lund joins Tottenham Hotspur
                      - generic [ref=f17e392]: From Brighton & Hove Albion for €12M.
                    - listitem [ref=f17e393]:
                      - generic [ref=f17e394]: Gerson Martins joins Bayer 04 Leverkusen
                      - generic [ref=f17e395]: From Newcastle United for €18M.
                    - listitem [ref=f17e396]:
                      - generic [ref=f17e397]: Robin Mayer joins Crystal Palace
                      - generic [ref=f17e398]: From Olympique de Marseille for €13M.
                    - listitem [ref=f17e399]:
                      - generic [ref=f17e400]: Marcos Blanco joins ES Troyes AC
                      - generic [ref=f17e401]: From Real Sociedad for €17M.
                    - listitem [ref=f17e402]:
                      - generic [ref=f17e403]: Nicolás García joins RC Celta de Vigo
                      - generic [ref=f17e404]: From Tottenham Hotspur for €35M.
        - complementary "Advertisement" [ref=f17e406]:
          - generic [ref=f17e410]:
            - generic [ref=f17e411]: Ad placeholder
            - generic [ref=f17e412]: rail-right · dev/test only
  - alert [ref=f17e413]
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | import { advanceWeeks, createCareer, fastForward, gameInfo } from "./helpers";
  3  | 
  4  | test.describe("core career flow", () => {
  5  |   test("landing → new career → dashboard", async ({ page }) => {
  6  |     await page.goto("/");
  7  |     await expect(page.getByRole("heading", { name: /One player/ })).toBeVisible();
  8  |     await page.getByRole("link", { name: /Start a career/ }).click();
  9  |     await expect(page).toHaveURL(/\/new\/?$/);
  10 |     await createCareer(page);
  11 |     await expect(page.getByText("Southampton").first()).toBeVisible();
  12 |   });
  13 | 
  14 |   test("weeks advance and match days can be simulated", async ({ page }) => {
  15 |     await createCareer(page);
  16 |     for (let i = 0; i < 20 && ((await gameInfo(page))?.turn ?? 0) < 6; i++) await advanceWeeks(page, 1);
  17 |     const info = await gameInfo(page);
> 18 |     expect(info!.turn).toBeGreaterThanOrEqual(6);
     |                  ^ TypeError: Cannot read properties of null (reading 'turn')
  19 |     await page.goto("/play/schedule/");
  20 |     await expect(page.getByText(/–/).first()).toBeVisible();
  21 |   });
  22 | 
  23 |   test("live match plays to full time and records the result", async ({ page }) => {
  24 |     await createCareer(page);
  25 |     await fastForward(page, 3);
  26 |     await page.goto("/play/match/");
  27 |     const start = page.getByTestId("start-live");
  28 |     if (!(await start.isVisible().catch(() => false))) await fastForward(page, 1);
  29 |     await page.goto("/play/match/");
  30 |     await page.getByTestId("start-live").click();
  31 |     await expect(page.getByTestId("score")).toBeVisible();
  32 |     // Answer any key-moment decisions while skipping ahead.
  33 |     for (let i = 0; i < 10; i++) {
  34 |       const opt = page.getByTestId("decision-option").first();
  35 |       if (await opt.isVisible().catch(() => false)) await opt.click();
  36 |       const skip = page.getByRole("button", { name: /Skip to full time/ });
  37 |       if (await skip.isVisible().catch(() => false)) await skip.click();
  38 |       if (await page.getByTestId("finish-match").isVisible().catch(() => false)) break;
  39 |     }
  40 |     await page.getByTestId("finish-match").click();
  41 |     await expect(page.getByText("Player ratings")).toBeVisible();
  42 |   });
  43 | 
  44 |   test("career persists across reloads", async ({ page }) => {
  45 |     await createCareer(page);
  46 |     await advanceWeeks(page, 2);
  47 |     const before = await gameInfo(page);
  48 |     await page.waitForTimeout(800);
  49 |     await page.reload();
  50 |     await expect(page.getByTestId("overall")).toBeVisible();
  51 |     const after = await gameInfo(page);
  52 |     expect(after).toEqual(before);
  53 |     await page.goto("/saves/");
  54 |     await expect(page.getByText("Test Striker")).toBeVisible();
  55 |   });
  56 | 
  57 |   test("a full season completes and a new one begins", async ({ page }) => {
  58 |     test.setTimeout(240_000);
  59 |     await createCareer(page);
  60 |     await fastForward(page, 52);
  61 |     const info = await gameInfo(page);
  62 |     expect(info!.season).toBe(2027);
  63 |     await page.goto("/play/league/");
  64 |     await page.getByRole("tab", { name: "History" }).click();
  65 |     await expect(page.getByText("2026/27").first()).toBeVisible();
  66 |   });
  67 | 
  68 |   test("retirement shows the legacy screen", async ({ page }) => {
  69 |     await createCareer(page);
  70 |     await page.evaluate(async () => {
  71 |       const st = (window as unknown as { __pitchborn: { getState: () => { retire: () => Promise<void> } } }).__pitchborn;
  72 |       await st.getState().retire();
  73 |     });
  74 |     await page.goto("/play/legacy/");
  75 |     await expect(page.getByText("Pitchborn legacy")).toBeVisible();
  76 |     await expect(page.getByText("Legacy breakdown")).toBeVisible();
  77 |   });
  78 | });
  79 | 
```