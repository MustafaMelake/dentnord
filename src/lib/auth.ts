import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";

import { env } from "@/env";
import { authOptions } from "@/lib/auth-options";
import { db } from "@/lib/db";
import { registerSchema } from "@/lib/validation/auth";

// Email code is imported lazily: the proxy imports this module and shouldn't bundle react-email.
const notifications = () => import("@/server/services/notifications");

/** Error codes the auth forms translate (messages `auth.errors.*`). */
export const AUTH_ERROR_CODES = {
  accountRejected: "ACCOUNT_REJECTED",
  invalidRegistration: "INVALID_REGISTRATION",
} as const;

const SERVER_OWNED_FIELDS = ["role", "dentistStatus", "termsAcceptedAt", "emailVerified"];

type RegisteredProfile = {
  clinicName?: string | null;
  phone?: string | null;
  country?: string | null;
  preferredLocale?: string | null;
};

export const auth = betterAuth({
  ...authOptions,
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.NEXT_PUBLIC_SITE_URL],
  database: prismaAdapter(db, { provider: "postgresql" }),

  emailAndPassword: {
    ...authOptions.emailAndPassword,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    // Better Auth answers the same way whether or not the email exists (no account enumeration).
    sendResetPassword: async ({ user, url }) => {
      const { sendPasswordResetEmail } = await notifications();
      sendPasswordResetEmail(user as typeof user & { preferredLocale?: string }, url);
    },
  },

  rateLimit: {
    ...authOptions.rateLimit,
    // Stricter than the built-in defaults (3 per 10 s) for the endpoints worth guessing at.
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 5 * 60, max: 5 },
      "/reset-password": { window: 60, max: 10 },
      "/change-password": { window: 60, max: 10 },
    },
  },

  // Profile edits go through a validated Server Action (server/actions/account.ts). Email changes and
  // self-service deletion are not offered.
  disabledPaths: ["/update-user", "/change-email", "/delete-user"],

  hooks: {
    // The browser validates with the same schema; this is the authoritative check, because the
    // sign-up endpoint can be called directly.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return;
      const parsed = registerSchema.safeParse(ctx.body);
      // Server-owned fields in the payload means someone is probing: refuse outright.
      // (create.before below also forces role/status, as a second layer.)
      const body = (ctx.body ?? {}) as Record<string, unknown>;
      const probing = SERVER_OWNED_FIELDS.some((field) => field in body);
      if (!parsed.success || probing) {
        throw new APIError("BAD_REQUEST", {
          code: AUTH_ERROR_CODES.invalidRegistration,
          message: "Invalid registration data",
        });
      }
      // Normalised values (trimmed, lower-cased email). `acceptTerms` is not a column.
      const normalised: Partial<typeof parsed.data> = { ...parsed.data };
      delete normalised.acceptTerms;
      return { context: { body: normalised } };
    }),
  },

  databaseHooks: {
    user: {
      create: {
        // Only reached once the sign-up body passed `registerSchema` (which requires acceptTerms).
        before: async (user) => ({
          data: { ...user, role: "DENTIST", dentistStatus: "PENDING", termsAcceptedAt: new Date() },
        }),
        after: async (user) => {
          const { notifyAdminOfRegistration } = await notifications();
          notifyAdminOfRegistration(user as typeof user & RegisteredProfile);
        },
      },
    },
    session: {
      create: {
        // Rejected dentists can't sign in at all (their sessions are also revoked on rejection).
        before: async (session) => {
          const user = await db.user.findUnique({
            where: { id: session.userId },
            select: { role: true, dentistStatus: true },
          });
          if (user?.role === "DENTIST" && user.dentistStatus === "REJECTED") {
            throw new APIError("FORBIDDEN", {
              code: AUTH_ERROR_CODES.accountRejected,
              message: "This account is not active",
            });
          }
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export type SessionUser = Session["user"];
