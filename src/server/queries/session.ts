import "server-only";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/lib/auth";

// Data Access Layer for auth. The proxy does an optimistic (cookie-cached) check; these helpers are the
// authoritative check against the DB and must guard every protected layout, page, action and route.
// With Cache Components, call them only inside a <Suspense> boundary (they read request headers).

export const getSession = cache(async () =>
  auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  }),
);

export async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/en/login?next=/admin");
  if (session.user.role !== "ADMIN") notFound();
  return session;
}

export async function requireApprovedDentist(locale: string) {
  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);
  if (session.user.role !== "DENTIST") redirect("/admin");
  if (session.user.dentistStatus !== "APPROVED") {
    redirect(`/${locale}/pending-approval`);
  }
  return session;
}
