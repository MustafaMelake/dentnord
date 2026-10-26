// Shared by playwright.config.ts (the server's env) and the specs.

/** CRON_SECRET of the E2E server: the specs call /api/cron/* with it. */
export const E2E_CRON_SECRET = "e2e-cron-secret-local-only-0123456789";
