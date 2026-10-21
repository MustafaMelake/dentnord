/**
 * Decides whether `pnpm db:seed` may run, before anything connects to a database.
 * Unit-tested in tests/unit/seed-guard.test.ts.
 *
 * `shell` is the environment as the process started (before .env is loaded); `merged` is after
 * `process.loadEnvFile(".env")`, which never overrides variables the shell already set.
 *
 * 1. A shell-provided DATABASE_URL points somewhere other than .env, so the target branch must be
 *    declared in the shell too (NEON_BRANCH). Otherwise .env's NEON_BRANCH ("dev") would describe the
 *    wrong database and rule 2 couldn't fire.
 * 2. On `production`, SEED_ADMIN_PASSWORD must come from the shell. Falling back to .env would give the
 *    production admin the local dev password.
 */
type Env = Record<string, string | undefined>;

export function seedRefusal(shell: Env, merged: Env): string | null {
  if (shell.DATABASE_URL && !shell.NEON_BRANCH) {
    return (
      "DATABASE_URL is set in the shell but NEON_BRANCH isn't. Set NEON_BRANCH in the same shell " +
      "(e.g. NEON_BRANCH=production) so the seed knows which branch it is writing to."
    );
  }
  if (merged.NEON_BRANCH === "production" && !shell.SEED_ADMIN_PASSWORD) {
    return (
      "Refusing to seed the production branch: SEED_ADMIN_PASSWORD must be set explicitly in the " +
      "shell. It is never taken from .env for production (that would be the dev password)."
    );
  }
  return null;
}
