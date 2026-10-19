import type { BetterAuthOptions } from "better-auth";
import { nextCookies } from "better-auth/next-js";

// Everything here shapes the DB schema. Kept free of `server-only`, env and DB imports so the
// Better Auth CLI can load it (`pnpm auth:generate`). Runtime-only options live in `lib/auth.ts`.

export const ROLES = ["ADMIN", "DENTIST"] as const;
export const DENTIST_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

export type Role = (typeof ROLES)[number];
export type DentistStatus = (typeof DENTIST_STATUSES)[number];

export const authOptions = {
  appName: "Dentnord",
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
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
      clinicName: { type: "string", required: false },
      phone: { type: "string", required: false },
      country: { type: "string", required: false },
      address: { type: "string", required: false },
      preferredLocale: { type: "string", required: false, defaultValue: "da" },
    },
  },
  session: {
    // Signed cookie cache lets the proxy check role/status without a DB hit.
    // Role/status changes may take up to `maxAge` to reach the proxy; layouts re-check against the DB.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  plugins: [nextCookies()], // nextCookies must stay last
} satisfies BetterAuthOptions;
