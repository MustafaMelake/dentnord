import { defineConfig, devices } from "@playwright/test";

// E2E tests run against a local *production* build (`next build && next start`) using the database in
// `.env`, which must be the Neon `dev` branch (tests/e2e/support/db.ts refuses `production`).
// Port 3000 because BETTER_AUTH_URL / NEXT_PUBLIC_SITE_URL (trusted origins) point there.
//   pnpm test:e2e                     builds, starts, tests
//   E2E_SKIP_BUILD=1 pnpm test:e2e    reuses the existing .next build
// Test users are created with an `e2e-` email prefix and deleted after each run (global teardown).

const skipBuild = !!process.env.E2E_SKIP_BUILD;

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
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    locale: "en-GB",
    timezoneId: "Europe/Copenhagen",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: skipBuild ? "pnpm start" : "pnpm build && pnpm start",
    url: "http://localhost:3000/en/login",
    timeout: 10 * 60_000,
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
  },
});
