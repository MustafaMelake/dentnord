import "server-only";

import { db } from "@/lib/db";

// Fixed-window rate limiting for our own endpoints (upload signing, downloads), stored in the same
// `rate_limit` table as Better Auth's limiter, so it holds across serverless instances. Keys are
// prefixed ("uploads:…") and never collide with Better Auth's. One atomic upsert per call:
// `lastRequest` holds the start of the current window (epoch ms).

export async function rateLimit(key: string, { max, windowMs }: { max: number; windowMs: number }) {
  const now = Date.now();
  const windowStart = BigInt(now - windowMs);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "rate_limit" ("id", "key", "count", "lastRequest")
    VALUES (${crypto.randomUUID()}, ${key}, 1, ${BigInt(now)})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "rate_limit"."lastRequest" < ${windowStart} THEN 1 ELSE "rate_limit"."count" + 1 END,
      "lastRequest" = CASE WHEN "rate_limit"."lastRequest" < ${windowStart} THEN ${BigInt(now)} ELSE "rate_limit"."lastRequest" END
    RETURNING "count"`;
  return { allowed: (rows[0]?.count ?? 1) <= max };
}

/** Per-user limits for /api/uploads/*. A 2 GB file is 128 parts, so part signing gets more room. */
export const UPLOAD_LIMITS = {
  register: { max: 40, windowMs: 60_000 },
  part: { max: 600, windowMs: 60_000 },
  control: { max: 120, windowMs: 60_000 },
  download: { max: 120, windowMs: 60_000 },
} as const;
