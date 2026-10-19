import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer loads .env automatically.
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // CLI only (migrate, db push, studio). Must be the DIRECT (unpooled) Neon URL: Prisma Migrate
    // breaks behind PgBouncer. The app itself connects with the pooled DATABASE_URL in src/lib/db.ts.
    // Prisma 7 no longer accepts `directUrl` in schema.prisma, so this is where DIRECT_URL goes.
    // Read directly (not via `env()`) so `prisma generate` / `validate` work without a DB.
    url: process.env.DIRECT_URL,
  },
});
