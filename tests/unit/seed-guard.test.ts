import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { seedRefusal } from "../../prisma/seed-guard";

// `shell` = what the shell set; `merged` = after .env filled in the rest (shell values win).
const dotenv = {
  DATABASE_URL: "postgres://dev",
  NEON_BRANCH: "dev",
  SEED_ADMIN_PASSWORD: "dev-password-123",
};
const merge = (shell: Record<string, string>) => ({ ...dotenv, ...shell });

describe("seedRefusal", () => {
  it("allows a plain local seed (everything from .env, dev branch)", () => {
    assert.equal(seedRefusal({}, merge({})), null);
  });

  it("refuses production when the password would come from .env", () => {
    const shell = { DATABASE_URL: "postgres://prod", NEON_BRANCH: "production" };
    assert.match(
      seedRefusal(shell, merge(shell)) ?? "",
      /SEED_ADMIN_PASSWORD must be set explicitly/,
    );
  });

  it("refuses production even when .env itself says production", () => {
    const merged = { ...dotenv, NEON_BRANCH: "production" };
    assert.match(seedRefusal({}, merged) ?? "", /production/);
  });

  it("allows production with a password set in the shell", () => {
    const shell = {
      DATABASE_URL: "postgres://prod",
      NEON_BRANCH: "production",
      SEED_ADMIN_PASSWORD: "prod-password-123",
    };
    assert.equal(seedRefusal(shell, merge(shell)), null);
  });

  it("refuses a shell DATABASE_URL without a shell NEON_BRANCH (target unknown)", () => {
    const shell = { DATABASE_URL: "postgres://prod" };
    assert.match(seedRefusal(shell, merge(shell)) ?? "", /NEON_BRANCH/);
    const withPassword = { ...shell, SEED_ADMIN_PASSWORD: "prod-password-123" };
    assert.match(seedRefusal(withPassword, merge(withPassword)) ?? "", /NEON_BRANCH/);
  });
});
