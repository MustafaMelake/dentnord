import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "@/i18n/routing";
import { auth } from "@/lib/auth";

// Next 16 `proxy` (formerly middleware), Node.js runtime.
// 1. /admin/**           → requires ADMIN (English only, no locale prefix)
// 2. /{locale}/portal/** → requires an APPROVED dentist
// 3. everything else     → next-intl locale routing
// These are optimistic checks (session cookie cache). Layouts re-check against the DB
// (src/server/queries/session.ts).

const handleI18nRouting = createIntlMiddleware(routing);

const PORTAL_PATH = new RegExp(`^/(${routing.locales.join("|")})/portal(?:/|$)`);

function redirectTo(request: NextRequest, pathname: string, next?: string) {
  const url = new URL(pathname, request.url);
  if (next) url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return redirectTo(request, "/en/login", pathname);
    if (session.user.role !== "ADMIN") return redirectTo(request, "/");
    return NextResponse.next();
  }

  const portal = PORTAL_PATH.exec(pathname);
  if (portal) {
    const locale = portal[1];
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return redirectTo(request, `/${locale}/login`, pathname);
    if (session.user.role === "ADMIN") return redirectTo(request, "/admin");
    if (session.user.dentistStatus !== "APPROVED") {
      return redirectTo(request, `/${locale}/pending-approval`);
    }
  }

  return handleI18nRouting(request);
}

export const config = {
  // Skip API routes, Next internals and files with an extension.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
