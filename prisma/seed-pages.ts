/**
 * Creates the starter texts of the Services / About / Contact pages where they're missing
 * (prisma/page-starters.ts). Insert-only: existing page rows are never changed. `pnpm db:seed` runs
 * the same step on dev; this script exists so production can get the page texts without the rest
 * of the seed (example catalog, admin user):
 *
 *   DATABASE_URL="<production pooled URL>" NEON_BRANCH=production pnpm db:seed:pages --production
 *
 * Refuses production without both NEON_BRANCH=production and --production, and refuses a
 * DATABASE_URL that differs from .env's while NEON_BRANCH still names the .env branch.
 */
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { withVerifiedSsl } from "../src/lib/pg-url";
import { seedPageTexts } from "./page-starters";

const dotenv = existsSync(".env") ? parseEnv(readFileSync(".env", "utf8")) : {};
if (existsSync(".env")) process.loadEnvFile(".env"); // never overrides variables already set

function refuse(reason: string): never {
  console.error(`✗ ${reason}`);
  process.exit(1);
}

const url = process.env.DATABASE_URL;
const branch = process.env.NEON_BRANCH;
const production = process.argv.includes("--production");
if (!url) refuse("DATABASE_URL is not set");
if (!branch) refuse("NEON_BRANCH is not set: name the target branch");
if (url !== dotenv.DATABASE_URL && branch === dotenv.NEON_BRANCH) {
  refuse(`DATABASE_URL is not .env's, but NEON_BRANCH still says "${branch}": set NEON_BRANCH`);
}
if (branch === "production" && !production) refuse("production: add --production to confirm");
if (branch !== "production" && production) refuse(`--production, but NEON_BRANCH is "${branch}"`);

// The target, without credentials: Neon endpoint id + declared branch.
console.log(`→ page texts: NEON_BRANCH=${branch} at ${new URL(url).hostname.split(".")[0]}`);
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: withVerifiedSsl(url) }) });

async function main() {
  const created = await seedPageTexts(db);
  console.log(
    created.length
      ? `✓ created ${created.join(", ")} (marked as starter text)`
      : "✓ all page texts exist already: nothing changed",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
