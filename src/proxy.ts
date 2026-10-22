import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "@/i18n/routing";
import { ADMIN_HINT_COOKIE } from "@/lib/admin-hint";
import { auth } from "@/lib/auth";

// Next 16 `proxy` (formerly middleware), Node.js runtime.
// 1. /admin/**           → requires ADMIN (English only, no locale prefix)
// 2. /{locale}/portal/** → requires an APPROVED dentist
// 3. everything else     → next-intl locale routing
// These are optimistic checks (session cookie cache). Layouts, pages, actions and routes re-check
// against the DB (src/server/queries/session.ts).

const handleI18nRouting = createIntlMiddleware(routing);

const PORTAL_PATH = new RegExp(`^/(${routing.locales.join("|")})/portal(?:/|$)`);

function redirectTo(request: NextRequest, pathname: string, next?: string) {
  const url = new URL(pathname, request.url);
  if (next) url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

/**
 * Cookie-cached session: fast, but role/status can be up to 5 minutes old. When the cache has expired,
 * Better Auth reads the DB and re-issues the cache cookie (and extends the session once a day); those
 * cookies are passed on here, because the DAL (server/queries/session.ts) never writes cookies.
 */
async function cachedSession(request: NextRequest) {
  const { headers, response } = await auth.api.getSession({
    headers: request.headers,
    returnHeaders: true,
  });
  return { session: response, setCookies: headers.getSetCookie() };
}

/**
 * DB-backed session. Used before denying access, so a dentist approved a minute ago isn't bounced
 * by a stale cookie. Returns the refreshed cookie headers so the cache is updated too.
 */
async function freshSession(request: NextRequest) {
  const { headers, response } = await auth.api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true },
    returnHeaders: true,
  });
  return { session: response, setCookies: headers.getSetCookie() };
}

/** Hint cookie for the public "missing content" markers (see lib/admin-hint.ts). */
function withAdminHint(response: NextResponse, isAdmin: boolean) {
  if (isAdmin) {
    response.cookies.set(ADMIN_HINT_COOKIE, "1", {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
    });
  } else {
    response.cookies.delete(ADMIN_HINT_COOKIE);
  }
  return response;
}

function withCookies(response: NextResponse, setCookies: string[]) {
  for (const cookie of setCookies) response.headers.append("set-cookie", cookie);
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const requested = `${pathname}${search}`;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const cached = await cachedSession(request);
    if (cached.session?.user.role === "ADMIN") {
      return withAdminHint(withCookies(NextResponse.next(), cached.setCookies), true);
    }

    // Not an admin according to the (possibly stale) cookie cache: ask the DB before denying, so a
    // freshly promoted admin isn't bounced to the home page for up to 5 minutes.
    const { session, setCookies } = await freshSession(request);
    if (!session) return withCookies(redirectTo(request, "/en/login", requested), setCookies);
    if (session.user.role !== "ADMIN") {
      return withAdminHint(withCookies(redirectTo(request, "/"), setCookies), false);
    }
    return withAdminHint(withCookies(NextResponse.next(), setCookies), true);
  }

  const portal = PORTAL_PATH.exec(pathname);
  if (portal) {
    const locale = portal[1];
    const cached = await cachedSession(request);
    if (!cached.session) {
      return withCookies(redirectTo(request, `/${locale}/login`, requested), cached.setCookies);
    }
    if (
      cached.session.user.role === "DENTIST" &&
      cached.session.user.dentistStatus === "APPROVED"
    ) {
      return withCookies(handleI18nRouting(request), cached.setCookies);
    }

    const { session, setCookies } = await freshSession(request);
    if (!session)
      return withCookies(redirectTo(request, `/${locale}/login`, requested), setCookies);
    if (session.user.role === "ADMIN")
      return withCookies(redirectTo(request, "/admin"), setCookies);
    if (session.user.dentistStatus !== "APPROVED") {
      return withCookies(redirectTo(request, `/${locale}/pending-approval`), setCookies);
    }
    return withCookies(handleI18nRouting(request), setCookies);
  }

  return handleI18nRouting(request);
}

export const config = {
  // Skip API routes, Next internals and files with an extension.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
