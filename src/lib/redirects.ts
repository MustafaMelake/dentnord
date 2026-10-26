import type { DentistStatus, Role } from "@/lib/auth-options";

// Where to send a user after login. Pure functions (no server/client imports), unit-tested in
// tests/unit/redirects.test.ts.

const ORIGIN = "http://dentnord.invalid";

/**
 * Returns `next` only if it is a same-origin path ("/da/portal/cases?x=1"), else null.
 * Rejects absolute URLs, protocol-relative ("//evil.com"), backslash tricks ("/\\evil.com") and
 * control characters.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || next.length > 2048) return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return null;
  try {
    const url = new URL(next, ORIGIN);
    if (url.origin !== ORIGIN) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

type LoginTarget = {
  role?: Role | string | null;
  dentistStatus?: DentistStatus | string | null;
  twoFactorEnabled?: boolean | null;
};

const isAdminPath = (path: string) => path === "/admin" || path.startsWith("/admin/");
const isPortalPath = (path: string, locale: string) =>
  path === `/${locale}/portal` || path.startsWith(`/${locale}/portal/`);

/** An admin may use /admin only with two-factor authentication on (else: the setup page). */
export function isVerifiedAdmin(user: LoginTarget | null | undefined) {
  return user?.role === "ADMIN" && user.twoFactorEnabled === true;
}

/** The 2FA setup page, returning to `next` (a same-origin path) when done. */
export function twoFactorSetupPath(locale: string, next?: string | null) {
  const safe = safeNextPath(next);
  return safe ? `/${locale}/two-factor?next=${encodeURIComponent(safe)}` : `/${locale}/two-factor`;
}

/**
 * The page to open after a successful login:
 * - ADMIN → `next` if it points into /admin, else /admin; first the 2FA setup page if 2FA is off
 * - APPROVED dentist → `next` if it points into their portal, else the dashboard
 * - PENDING (or anything else) → the pending-approval page
 * REJECTED users never get here: Better Auth refuses to create their session.
 */
export function postLoginPath(user: LoginTarget, locale: string, next?: string | null): string {
  const safe = safeNextPath(next);
  if (user.role === "ADMIN") {
    const target = safe && isAdminPath(safe) ? safe : "/admin";
    return isVerifiedAdmin(user) ? target : twoFactorSetupPath(locale, target);
  }
  if (user.dentistStatus === "APPROVED") {
    return safe && isPortalPath(safe, locale) ? safe : `/${locale}/portal/dashboard`;
  }
  return `/${locale}/pending-approval`;
}
