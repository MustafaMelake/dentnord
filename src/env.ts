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
    R2_ACCOUNT_ID: z.string().min(1),
    R2_ACCESS_KEY_ID: z.string().min(1),
    R2_SECRET_ACCESS_KEY: z.string().min(1),
    R2_BUCKET: z.string().min(1),
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
