import type { BetterAuthOptions } from "better-auth";
import { nextCookies } from "better-auth/next-js";

// Everything here shapes the DB schema. Kept free of `server-only`, env and DB imports so the
// Better Auth CLI can load it (`pnpm auth:generate`). Runtime-only options live in `lib/auth.ts`.

export const ROLES = ["ADMIN", "DENTIST"] as const;
export const DENTIST_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

export type Role = (typeof ROLES)[number];
export type DentistStatus = (typeof DENTIST_STATUSES)[number];

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export const authOptions = {
  appName: "Dentnord",
  emailAndPassword: {
    enabled: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
    // TODO: enable email verification once Resend is configured.
    requireEmailVerification: false,
  },
  user: {
    additionalFields: {
      // `input: false` — users can never set these themselves (e.g. at sign-up).
      role: {
        type: [...ROLES],
        required: false,
        defaultValue: "DENTIST",
        input: false,
      },
      dentistStatus: {
        type: [...DENTIST_STATUSES],
        required: false,
        defaultValue: "PENDING",
        input: false,
      },
      // Set by the server (databaseHooks in lib/auth.ts) once the sign-up body passed validation.
      termsAcceptedAt: { type: "date", required: false, input: false },
      // Profile fields. Sign-up input is validated against `registerSchema` (lib/validation/auth.ts)
      // in a `hooks.before`; later edits go through a Server Action (/update-user is disabled).
      clinicName: { type: "string", required: false },
      phone: { type: "string", required: false },
      country: { type: "string", required: false },
      address: { type: "string", required: false },
      cvr: { type: "string", required: false },
      preferredLocale: { type: "string", required: false, defaultValue: "da" },
    },
  },
  session: {
    // Signed cookie cache lets the proxy check role/status without a DB hit.
    // Role/status changes may take up to `maxAge` to reach the cache; the proxy re-checks against the
    // DB before denying, and layouts/pages/actions always check against the DB.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  rateLimit: {
    // Shared across serverless instances (an in-memory store would be per instance).
    // Enabled in production only (Better Auth's default). Built-in rules: sign-in / sign-up /
    // change-password 3 per 10 s, password reset requests 3 per 60 s, per IP and path.
    storage: "database",
    modelName: "rateLimit",
  },
  plugins: [nextCookies()], // nextCookies must stay last
} satisfies BetterAuthOptions;
