/**
 * Decides whether `pnpm db:seed` may run, before anything connects to a database.
 * Unit-tested in tests/unit/seed-guard.test.ts.
 *
 * `env` is the effective environment; `dotenv` is the parsed contents of the .env FILE. Comparing with
 * the file (not "what the shell set") matters: `pnpm db:seed` runs through the Prisma CLI, whose
 * prisma.config.ts loads .env into the environment before the seed process even starts, so a .env value
 * looks exactly like a shell value by the time the seed runs.
 *
 * 1. DATABASE_URL differs from .env's, so the target branch must be declared too: NEON_BRANCH must also
 *    differ from .env's. Otherwise .env's NEON_BRANCH ("dev") would describe a database it isn't.
 * 2. On `production`, SEED_ADMIN_PASSWORD must be set and must not be the .env value: that is the local
 *    dev password and must never become the production admin's.
 */
type Env = Record<string, string | undefined>;

export function seedRefusal(env: Env, dotenv: Env): string | null {
  const urlOverridden = !!env.DATABASE_URL && env.DATABASE_URL !== dotenv.DATABASE_URL;
  const branchDeclared = !!env.NEON_BRANCH && env.NEON_BRANCH !== dotenv.NEON_BRANCH;
  if (urlOverridden && !branchDeclared) {
    return (
      "DATABASE_URL is not the one in .env, but NEON_BRANCH still is. Set NEON_BRANCH in the same " +
      "shell (e.g. NEON_BRANCH=production) so the seed knows which branch it is writing to."
    );
  }
  if (env.NEON_BRANCH === "production") {
    const password = env.SEED_ADMIN_PASSWORD;
    if (!password || password === dotenv.SEED_ADMIN_PASSWORD) {
      return (
        "Refusing to seed the production branch: set SEED_ADMIN_PASSWORD in this shell to the password " +
        "you chose. The value from .env (the dev password) is never used for production."
      );
    }
  }
  return null;
}
