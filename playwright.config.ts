import { defineConfig, devices } from "@playwright/test";

// E2E tests run against a local *production* build (`next build && next start`) using the database in
// `.env`, which must be the Neon `dev` branch (tests/e2e/support/db.ts refuses `production`).
// The server gets BETTER_AUTH_URL / NEXT_PUBLIC_SITE_URL = http://localhost:3000 (Better Auth's trusted
// origin), whatever .env says: shell variables win over .env in Next.js. NEXT_PUBLIC_* is baked in at
// build time, so E2E_SKIP_BUILD only works on a build made by this config.
//   pnpm test:e2e                     builds, starts, tests
//   E2E_SKIP_BUILD=1 pnpm test:e2e    reuses the existing .next build
// Test users are created with an `e2e-` email prefix and deleted after each run (global teardown).

const skipBuild = !!process.env.E2E_SKIP_BUILD;
const BASE_URL = "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  // Tests share one database and the admin's pending list: keep them sequential.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  globalTeardown: "./tests/e2e/support/global-teardown.ts",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    locale: "en-GB",
    timezoneId: "Europe/Copenhagen",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: skipBuild ? "pnpm start" : "pnpm build && pnpm start",
    url: `${BASE_URL}/en/login`,
    env: { BETTER_AUTH_URL: BASE_URL, NEXT_PUBLIC_SITE_URL: BASE_URL },
    timeout: 10 * 60_000,
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
  },
});
