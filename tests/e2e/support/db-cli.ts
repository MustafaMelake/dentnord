// Test-only DB operations, run with `node --import tsx` (see db.ts). Playwright loads tests as
// CommonJS, while the generated Prisma 7 client is ESM, so the client can't be imported there.
// Usage: node --import tsx tests/e2e/support/db-cli.ts '<json {op, args}>'  → prints JSON.
import { existsSync } from "node:fs";

import {
  AbortMultipartUploadCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListMultipartUploadsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";

import { PrismaClient, type Prisma } from "../../../src/generated/prisma/client";
import { withVerifiedSsl } from "../../../src/lib/pg-url";
import { r2Endpoint, type R2Jurisdiction } from "../../../src/lib/r2-endpoint";

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

// R2: E2E runs store case files under this prefix (playwright.config.ts sets R2_KEY_PREFIX), and
// cleanup deletes everything under it. Nothing outside it is ever touched.
const R2_TEST_PREFIX = "test/";
const Bucket = process.env.R2_CASES_BUCKET ?? "";
let s3: S3Client | null = null;
function r2() {
  s3 ??= new S3Client({
    region: "auto",
    endpoint: r2Endpoint(
      process.env.R2_ACCOUNT_ID ?? "",
      (process.env.R2_JURISDICTION ?? "eu") as R2Jurisdiction,
    ),
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    },
  });
  return s3;
}

async function r2Keys(prefix: string) {
  if (!prefix.startsWith(R2_TEST_PREFIX)) throw new Error("E2E only reads under test/");
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const res = await r2().send(
      new ListObjectsV2Command({ Bucket, Prefix: prefix, ContinuationToken: token }),
    );
    keys.push(...(res.Contents ?? []).flatMap((o) => (o.Key ? [o.Key] : [])));
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

/** Deletes every object and aborts every unfinished multipart upload under test/. */
async function r2Cleanup() {
  if (!process.env.R2_ACCOUNT_ID || !Bucket) return { objects: 0, uploads: 0 };
  let uploads = 0;
  for (;;) {
    const res = await r2().send(
      new ListMultipartUploadsCommand({ Bucket, Prefix: R2_TEST_PREFIX }),
    );
    const open = res.Uploads ?? [];
    for (const u of open) {
      if (!u.Key?.startsWith(R2_TEST_PREFIX)) continue;
      await r2().send(
        new AbortMultipartUploadCommand({ Bucket, Key: u.Key, UploadId: u.UploadId }),
      );
      uploads++;
    }
    if (!res.IsTruncated || open.length === 0) break;
  }
  const keys = await r2Keys(R2_TEST_PREFIX);
  for (let i = 0; i < keys.length; i += 1000) {
    await r2().send(
      new DeleteObjectsCommand({
        Bucket,
        Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })) },
      }),
    );
  }
  return { objects: keys.length, uploads };
}

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

  /** A published test service (slug "e2e-…"), appended to the list. */
  async createService({ slug, title }: { slug: string; title: string }) {
    if (!slug.startsWith(E2E_EMAIL_PREFIX))
      throw new Error("test services must use the e2e- prefix");
    const max = await db.service.aggregate({ _max: { sortOrder: true } });
    const s = await db.service.create({
      data: {
        slug,
        title: { da: title, en: title },
        published: true,
        sortOrder: (max._max.sortOrder ?? 0) + 1,
      },
      select: { id: true },
    });
    return { id: s.id };
  },

  async getService({ id }: { id: string }) {
    return db.service.findUnique({ where: { id }, select: { title: true, published: true } });
  },

  async getSetting({ key }: { key: string }) {
    const row = await db.siteSetting.findUnique({ where: { key }, select: { value: true } });
    return row?.value ?? null;
  },

  /** Puts a page-text setting back after a test edited it (only "page.*" keys). */
  async setSetting({ key, value }: { key: string; value: Prisma.InputJsonValue | null }) {
    if (!key.startsWith("page.")) throw new Error("E2E only restores page.* settings");
    if (value === null) await db.siteSetting.deleteMany({ where: { key } });
    else await db.siteSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
    return { ok: true };
  },

  async contactMessages({ email }: { email: string }) {
    const rows = await db.contactMessage.findMany({
      where: { email },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        clinic: true,
        phone: true,
        message: true,
        locale: true,
        readAt: true,
      },
    });
    return rows.map(({ readAt, ...m }) => ({ ...m, read: readAt !== null }));
  },

  async getTestimonials({ authorPrefix }: { authorPrefix: string }) {
    return db.testimonial.findMany({
      where: { authorName: { startsWith: authorPrefix } },
      select: { id: true, authorName: true, consent: true, published: true },
    });
  },

  /** Deletes every e2e user (sessions/accounts cascade), e2e content, and the audit entries about them. */
  /** Case files of a case (status, size, key) and the R2 objects under its test prefix. */
  async caseFiles({ caseId }: { caseId: string }) {
    const files = await db.caseFile.findMany({
      where: { caseId },
      select: {
        id: true,
        kind: true,
        uploadStatus: true,
        sizeBytes: true,
        storageKey: true,
        scanPart: true,
      },
    });
    return files.map((f) => ({ ...f, sizeBytes: Number(f.sizeBytes) }));
  },

  async r2Objects({ caseId }: { caseId: string }) {
    const keys = await r2Keys(`${R2_TEST_PREFIX}cases/${caseId}/`);
    return Promise.all(
      keys.map(async (Key) => ({
        key: Key,
        size: (await r2().send(new HeadObjectCommand({ Bucket, Key }))).ContentLength ?? 0,
      })),
    );
  },

  async getCase({ caseId }: { caseId: string }) {
    return db.case.findUnique({
      where: { id: caseId },
      select: { status: true, caseNumber: true, events: { select: { type: true } } },
    });
  },

  /** Emails logged for a case (kind + recipient), oldest first. */
  async emailLog({ caseId }: { caseId: string }) {
    return db.emailLog.findMany({
      where: { caseId },
      orderBy: { createdAt: "asc" },
      select: { kind: true, to: true },
    });
  },

  /** Plan versions of a case with their decision and files. */
  async casePlans({ caseId }: { caseId: string }) {
    const plans = await db.casePlan.findMany({
      where: { caseId },
      orderBy: { version: "asc" },
      select: {
        id: true,
        version: true,
        sentAt: true,
        decision: true,
        decisionComment: true,
        approvalStatement: true,
        approvalLocale: true,
        files: { select: { id: true, kind: true, uploadStatus: true } },
      },
    });
    return plans.map((p) => ({ ...p, sent: p.sentAt !== null, sentAt: undefined }));
  },

  /** The status trail: [from, to] of every status change, oldest first. */
  async caseTrail({ caseId }: { caseId: string }) {
    const events = await db.caseEvent.findMany({
      where: { caseId, toStatus: { not: null }, type: { not: "CREATED" } },
      orderBy: { createdAt: "asc" },
      select: { fromStatus: true, toStatus: true, type: true, note: true },
    });
    return events;
  },

  /** Messages on a case: thread, author role, body. */
  async caseMessages({ caseId }: { caseId: string }) {
    return db.caseMessage.findMany({
      where: { caseId },
      orderBy: { createdAt: "asc" },
      select: { internal: true, authorRole: true, body: true, readAt: true },
    });
  },

  /** A SUBMITTED case for an e2e dentist, without files (for tests that don't need the wizard). */
  async createSubmittedCase({ email }: { email: string }) {
    if (!email.startsWith(E2E_EMAIL_PREFIX)) throw new Error("test users must use the e2e- prefix");
    const user = await db.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
    const guideType = await db.guideType.findFirst({
      where: { active: true },
      select: { id: true },
    });
    const now = new Date();
    const c = await db.case.create({
      data: {
        dentistId: user.id,
        status: "SUBMITTED",
        caseNumber: `E2E-${Date.now()}`,
        patientCode: "E2E-QUICK",
        guideTypeId: guideType?.id,
        submittedAt: now,
        consentAt: now,
        statusChangedAt: now,
        implants: { create: [{ fdiTooth: 36 }] },
        events: {
          create: [
            {
              type: "STATUS_CHANGED",
              fromStatus: "DRAFT",
              toStatus: "SUBMITTED",
              actorId: user.id,
            },
          ],
        },
      },
      select: { id: true },
    });
    return c;
  },

  /** An empty DRAFT case for an e2e user (API-level upload tests). */
  async createDraft({ email }: { email: string }) {
    if (!email.startsWith(E2E_EMAIL_PREFIX)) throw new Error("test users must use the e2e- prefix");
    const user = await db.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
    return db.case.create({ data: { dentistId: user.id }, select: { id: true } });
  },

  async r2Cleanup() {
    return r2Cleanup();
  },

  async cleanup() {
    await r2Cleanup();
    const users = await db.user.findMany({
      where: { email: { startsWith: E2E_EMAIL_PREFIX } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    const services = await db.service.findMany({
      where: { slug: { startsWith: E2E_EMAIL_PREFIX } },
      select: { id: true },
    });
    const testimonials = await db.testimonial.findMany({
      where: { authorName: { startsWith: "E2E " } },
      select: { id: true },
    });
    const messages = await db.contactMessage.findMany({
      where: { email: { startsWith: E2E_EMAIL_PREFIX } },
      select: { id: true },
    });
    const contentIds = [...services, ...testimonials, ...messages].map((r) => r.id);
    await db.auditLog.deleteMany({
      where: {
        OR: [
          { targetType: "user", targetId: { in: ids } },
          { actorId: { in: ids } },
          { targetId: { in: contentIds } },
        ],
      },
    });
    await db.service.deleteMany({ where: { id: { in: services.map((s) => s.id) } } });
    await db.testimonial.deleteMany({ where: { id: { in: testimonials.map((t) => t.id) } } });
    await db.contactMessage.deleteMany({ where: { id: { in: messages.map((m) => m.id) } } });
    if (ids.length > 0) {
      // Cases restrict deleting their dentist; files, sites and events cascade with the case.
      await db.case.deleteMany({ where: { dentistId: { in: ids } } });
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
