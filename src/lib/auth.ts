import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";

import { env } from "@/env";
import { authOptions } from "@/lib/auth-options";
import { db } from "@/lib/db";
import { safeNextPath } from "@/lib/redirects";
import { siteOrigins } from "@/lib/site-url";
import { registerSchema } from "@/lib/validation/auth";

// Email code is imported lazily: the proxy imports this module and shouldn't bundle react-email.
const notifications = () => import("@/server/services/notifications");

/** Error codes the auth forms translate (messages `auth.errors.*`). */
export const AUTH_ERROR_CODES = {
  accountRejected: "ACCOUNT_REJECTED",
  invalidRegistration: "INVALID_REGISTRATION",
  twoFactorRequired: "TWO_FACTOR_REQUIRED",
} as const;

const SERVER_OWNED_FIELDS = ["role", "dentistStatus", "termsAcceptedAt", "emailVerified"];

type RegisteredProfile = {
  clinicName?: string | null;
  phone?: string | null;
  country?: string | null;
  preferredLocale?: string | null;
};

/**
 * EMAIL_VERIFICATION=on: a new account must confirm its address (link by email, valid 24 h) before
 * it can log in. A login with the right password before that gets EMAIL_NOT_VERIFIED, and the form
 * asks /send-verification-email for a fresh link (sendOnSignIn would need a callbackURL on the
 * sign-in, which Better Auth turns into a redirect on success). Off until Resend sends from the real
 * domain (docs/go-live.md). Off means no verification config at all, so no such email can be sent.
 */
const verifyEmail = env.EMAIL_VERIFICATION === "on";

export const auth = betterAuth({
  ...authOptions,
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  // The site URL and its www / apex twin (dentnord.dk ↔ www.dentnord.dk).
  trustedOrigins: siteOrigins(env.NEXT_PUBLIC_SITE_URL),
  database: prismaAdapter(db, { provider: "postgresql" }),

  ...(verifyEmail
    ? {
        emailVerification: {
          sendOnSignUp: true,
          autoSignInAfterVerification: false,
          expiresIn: 24 * 60 * 60,
          sendVerificationEmail: async ({ user, url }) => {
            const { sendVerificationEmail } = await notifications();
            sendVerificationEmail(user as typeof user & { preferredLocale?: string }, url);
          },
        },
      }
    : {}),

  emailAndPassword: {
    ...authOptions.emailAndPassword,
    requireEmailVerification: verifyEmail,
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
      "/send-verification-email": { window: 5 * 60, max: 3 },
      "/reset-password": { window: 60, max: 10 },
      "/change-password": { window: 60, max: 10 },
    },
  },

  // Profile edits go through a validated Server Action (server/actions/account.ts). Email changes and
  // self-service deletion are not offered.
  disabledPaths: ["/update-user", "/change-email", "/delete-user"],

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // 2FA is mandatory for admins: the endpoint to turn it off is closed to them.
      if (ctx.path === "/two-factor/disable") {
        const session = await getSessionFromCtx(ctx);
        if ((session?.user as { role?: string } | undefined)?.role === "ADMIN") {
          throw new APIError("FORBIDDEN", {
            code: AUTH_ERROR_CODES.twoFactorRequired,
            message: "Two-factor authentication is required for admin accounts",
          });
        }
        return;
      }

      // The browser validates with the same schema; this is the authoritative check, because the
      // sign-up endpoint can be called directly.
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
      // Normalised values (trimmed, lower-cased email). `acceptTerms` is not a column. The
      // verification link's `callbackURL` (email verification on) survives if it is a local path.
      const normalised: Partial<typeof parsed.data> & { callbackURL?: string } = { ...parsed.data };
      delete normalised.acceptTerms;
      const callbackURL = safeNextPath(
        typeof body.callbackURL === "string" ? body.callbackURL : null,
      );
      if (callbackURL) normalised.callbackURL = callbackURL;
      return { context: { body: normalised } };
    }),

    after: createAuthMiddleware(async (ctx) => {
      // Turning 2FA on (the first code confirmed while signed in) replaces the current session. The
      // flag lives on the user, so sessions opened earlier with the password alone would now pass
      // the admin check: sign them out. A code entered while logging in (no session cookie yet) is
      // a normal sign-in and leaves other devices alone.
      if (ctx.path !== "/two-factor/verify-totp") return;
      const fresh = ctx.context.newSession;
      if (!fresh) return;
      const cookie = ctx.context.authCookies.sessionToken.name;
      if (!(await ctx.getSignedCookie(cookie, ctx.context.secret))) return;
      await db.session.deleteMany({
        where: { userId: fresh.user.id, id: { not: fresh.session.id } },
      });
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
