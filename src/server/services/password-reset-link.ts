import "server-only";

import { auth, RESET_PASSWORD_TOKEN_TTL_SECONDS } from "@/lib/auth";
import { db } from "@/lib/db";
import { resetLinkCapture } from "@/lib/reset-link-capture";
import { rateLimit } from "@/server/services/rate-limit";

// "Create password-reset link" on /admin/dentists/[id]: for when the reset email can't reach the
// dentist. Better Auth's own request-password-reset endpoint issues the token (one-time, 1 hour,
// sessions revoked on use), but the link comes back to the admin instead of being emailed
// (lib/reset-link-capture.ts). The admin sends it by hand; the dentist sets a new password on the
// normal reset page. The link is shown once and never stored or logged; the audit entry records
// only who created one for whom, and when.

export class ResetLinkError extends Error {
  constructor(readonly code: "notFound" | "invalidState" | "rateLimited") {
    super(code);
  }
}

/** Per admin, and per dentist (the key ends with the dentist id, so erasure removes it). */
export const RESET_LINK_LIMITS = {
  admin: { max: 20, windowMs: 60 * 60_000 },
  dentist: { max: 5, windowMs: 60 * 60_000 },
} as const;

export async function createPasswordResetLink({
  actor,
  dentistId,
}: {
  actor: { id: string; email: string };
  dentistId: string;
}) {
  const dentist = await db.user.findUnique({
    where: { id: dentistId },
    select: { id: true, email: true, role: true, dentistStatus: true, preferredLocale: true },
  });
  if (!dentist || dentist.role !== "DENTIST") throw new ResetLinkError("notFound");
  // A disabled account can't log in anyway: re-activate it first.
  if (dentist.dentistStatus === "REJECTED") throw new ResetLinkError("invalidState");

  const [perAdmin, perDentist] = await Promise.all([
    rateLimit(`admin-reset-link:${actor.id}`, RESET_LINK_LIMITS.admin),
    rateLimit(`admin-reset-link:dentist:${dentist.id}`, RESET_LINK_LIMITS.dentist),
  ]);
  if (!perAdmin.allowed || !perDentist.allowed) throw new ResetLinkError("rateLimited");

  const locale = dentist.preferredLocale === "en" ? "en" : "da";
  const captured: { url?: string } = {};
  const issuedAt = Date.now();
  await resetLinkCapture.run(captured, () =>
    auth.api.requestPasswordReset({
      body: { email: dentist.email, redirectTo: `/${locale}/reset-password` },
    }),
  );
  if (!captured.url) throw new Error("Better Auth issued no password-reset link");

  await db.auditLog.create({
    data: {
      action: "PASSWORD_RESET_LINK_CREATED",
      actorId: actor.id,
      actorEmail: actor.email,
      targetType: "user",
      targetId: dentist.id,
      metadata: { validMinutes: RESET_PASSWORD_TOKEN_TTL_SECONDS / 60 },
    },
  });
  return {
    url: captured.url,
    expiresAt: new Date(issuedAt + RESET_PASSWORD_TOKEN_TTL_SECONDS * 1000),
  };
}
