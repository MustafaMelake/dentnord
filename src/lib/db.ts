import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "@/env";
import { PrismaClient } from "@/generated/prisma/client";
import { withVerifiedSsl } from "@/lib/pg-url";

// Driver: node-postgres (`@prisma/adapter-pg`) over TCP to Neon's *pooled* endpoint (PgBouncer).
// Everything here runs on the Node.js runtime (pages, actions, route handlers, and the Next 16 proxy,
// which is Node-only), so a reused TCP pool is the right fit. Neon recommends node-postgres for Node
// hosts such as Vercel Fluid compute. `@neondatabase/serverless` / `@prisma/adapter-neon` only pay off
// on edge runtimes without TCP sockets, which this app doesn't use.
function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: withVerifiedSsl(env.DATABASE_URL) });
  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// Reuse one client across hot reloads in dev.
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;
