// Test-only DB operations, run with `node --import tsx` (see db.ts). Playwright loads tests as
// CommonJS, while the generated Prisma 7 client is ESM, so the client can't be imported there.
// Usage: node --import tsx tests/e2e/support/db-cli.ts '<json {op, args}>'  → prints JSON.
import { existsSync } from "node:fs";

import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";

import { PrismaClient } from "../../../src/generated/prisma/client";
import { withVerifiedSsl } from "../../../src/lib/pg-url";

if (existsSync(".env")) process.loadEnvFile(".env");

// Never touch production data.
if (process.env.NEON_BRANCH === "production") {
  throw new Error(
    "E2E tests must not run against the Neon `production` branch. Point .env at `dev`.",
  );
}
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: withVerifiedSsl(url) }) });

const E2E_EMAIL_PREFIX = "e2e-";

type CreateUserArgs = {
  email: string;
  password: string;
  name: string;
  role: "ADMIN" | "DENTIST";
  status: "PENDING" | "APPROVED" | "REJECTED";
};

const ops = {
  async createUser({ email, password, name, role, status }: CreateUserArgs) {
    if (!email.startsWith(E2E_EMAIL_PREFIX)) throw new Error("test users must use the e2e- prefix");
    const id = crypto.randomUUID();
    await db.user.create({
      data: {
        id,
        email,
        name,
        emailVerified: true,
        role,
        dentistStatus: status,
        clinicName: `${name} Clinic`,
        phone: "+45 12 34 56 78",
        country: "DK",
        address: "Testvej 1, 9000 Aalborg",
        preferredLocale: "en",
        termsAcceptedAt: new Date(),
        accounts: {
          create: {
            id: crypto.randomUUID(),
            accountId: id,
            providerId: "credential",
            password: await hashPassword(password),
          },
        },
      },
    });
    return { id };
  },

  async getUser({ email, id }: { email?: string; id?: string }) {
    return db.user.findFirst({
      where: email ? { email } : { id },
      select: {
        id: true,
        role: true,
        dentistStatus: true,
        termsAcceptedAt: true,
        rejectionReason: true,
        _count: { select: { sessions: true } },
      },
    });
  },

  async getAudit({ targetId }: { targetId: string }) {
    return db.auditLog.findMany({
      where: { targetType: "user", targetId },
      orderBy: { createdAt: "asc" },
      select: { action: true, actorId: true, actorEmail: true, metadata: true },
    });
  },

  /** Deletes every e2e user (sessions/accounts cascade) and the audit entries about them. */
  async cleanup() {
    const users = await db.user.findMany({
      where: { email: { startsWith: E2E_EMAIL_PREFIX } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    if (ids.length > 0) {
      await db.auditLog.deleteMany({
        where: { OR: [{ targetType: "user", targetId: { in: ids } }, { actorId: { in: ids } }] },
      });
      await db.user.deleteMany({ where: { id: { in: ids } } });
    }
    return { removed: ids.length };
  },
};

async function main() {
  const { op, args } = JSON.parse(process.argv[2] ?? "{}") as { op: keyof typeof ops; args: never };
  if (!(op in ops)) throw new Error(`unknown op: ${String(op)}`);
  const result = await ops[op](args ?? ({} as never));
  process.stdout.write(JSON.stringify(result ?? null));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
