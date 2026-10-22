import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    // Neon pooled connection (-pooler host). Used by the app at runtime (src/lib/db.ts).
    DATABASE_URL: z.url(),
    // Neon direct (unpooled) connection. Read only by the Prisma CLI via prisma.config.ts.
    DIRECT_URL: z.url().optional(),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    // Cloudflare R2. Optional: without real values, uploads report
    // "not configured" (src/lib/r2.ts) instead of crashing.
    // The 32-character account ID (not the endpoint URL).
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    // Private bucket for case files (signed URLs only). Formerly R2_BUCKET.
    R2_CASES_BUCKET: z.string().default("dentnord-cases"),
    // Public-read bucket for site images, and the public URL it is served from.
    R2_MEDIA_BUCKET: z.string().default("dentnord-media"),
    R2_MEDIA_PUBLIC_URL: z.url().optional(),
    // Bucket jurisdiction → S3 endpoint. "eu" unless the buckets were created without one.
    R2_JURISDICTION: z.enum(["eu", "fedramp", "default"]).default("eu"),
    // Prefix for case-file keys. E2E runs use "test/" so their objects are easy to find and delete.
    R2_KEY_PREFIX: z
      .string()
      .regex(/^(?:[a-z0-9-]+\/)*$/)
      .default(""),
    // Optional: without a real key, emails are logged to the console instead (src/lib/email.ts).
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().min(1),
    ADMIN_EMAIL: z.email(),
    // Only needed by `pnpm db:seed`.
    SEED_ADMIN_PASSWORD: z.string().min(12).optional(),
  },
  client: {
    NEXT_PUBLIC_SITE_URL: z.url(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
