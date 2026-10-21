import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { seedRefusal } from "../../prisma/seed-guard";

// `dotenv` = the .env file. The effective env is .env plus whatever the shell overrode — and it may
// already contain every .env value (Prisma's CLI preloads .env before running the seed).
const dotenv = {
  DATABASE_URL: "postgres://dev",
  NEON_BRANCH: "dev",
  SEED_ADMIN_PASSWORD: "dev-password-123",
};
const env = (overrides: Record<string, string> = {}) => ({ ...dotenv, ...overrides });

describe("seedRefusal", () => {
  it("allows a plain local seed (everything from .env, dev branch)", () => {
    assert.equal(seedRefusal(env(), dotenv), null);
  });

  it("refuses production when the password is the .env one, even if .env was preloaded", () => {
    const e = env({ DATABASE_URL: "postgres://prod", NEON_BRANCH: "production" });
    assert.match(seedRefusal(e, dotenv) ?? "", /SEED_ADMIN_PASSWORD/);
  });

  it("refuses production when no password is set at all", () => {
    const e = { DATABASE_URL: "postgres://prod", NEON_BRANCH: "production" };
    assert.match(seedRefusal(e, dotenv) ?? "", /SEED_ADMIN_PASSWORD/);
  });

  it("refuses production even when .env itself says production", () => {
    const prodDotenv = { ...dotenv, NEON_BRANCH: "production" };
    assert.match(seedRefusal({ ...prodDotenv }, prodDotenv) ?? "", /production/);
  });

  it("allows production with a different password set in the shell", () => {
    const e = env({
      DATABASE_URL: "postgres://prod",
      NEON_BRANCH: "production",
      SEED_ADMIN_PASSWORD: "chosen-prod-password",
    });
    assert.equal(seedRefusal(e, dotenv), null);
  });

  it("refuses a DATABASE_URL override without a NEON_BRANCH override (target unknown)", () => {
    const e = env({ DATABASE_URL: "postgres://prod", SEED_ADMIN_PASSWORD: "chosen-prod-password" });
    assert.match(seedRefusal(e, dotenv) ?? "", /NEON_BRANCH/);
  });
});
