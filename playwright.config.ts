import { defineConfig, devices } from "@playwright/test";

/**
 * E2E runs against the static production export (what users get), served on
 * port 4173. Build first with `NEXT_PUBLIC_E2E=1 npm run build` (exposes a
 * test handle used to fast-forward seasons) or let `npm run e2e` do it.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:4173", trace: "retain-on-failure" },
  webServer: { command: "npx --yes serve out -l 4173 --no-clipboard", port: 4173, reuseExistingServer: true, timeout: 60_000 },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
