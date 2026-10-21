import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "@/i18n/routing";
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

/** Cookie-cached session: fast, but role/status can be up to 5 minutes old. */
const cachedSession = (request: NextRequest) => auth.api.getSession({ headers: request.headers });

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

function withCookies(response: NextResponse, setCookies: string[]) {
  for (const cookie of setCookies) response.headers.append("set-cookie", cookie);
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const requested = `${pathname}${search}`;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const session = await cachedSession(request);
    if (!session) return redirectTo(request, "/en/login", requested);
    if (session.user.role !== "ADMIN") return redirectTo(request, "/");
    return NextResponse.next();
  }

  const portal = PORTAL_PATH.exec(pathname);
  if (portal) {
    const locale = portal[1];
    const cached = await cachedSession(request);
    if (!cached) return redirectTo(request, `/${locale}/login`, requested);
    if (cached.user.role === "DENTIST" && cached.user.dentistStatus === "APPROVED") {
      return handleI18nRouting(request);
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
