import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireApprovedDentist } from "@/server/queries/session";

// The dentist's own data. Every portal read and write goes through here: the dentist id always comes
// from the DB-checked session, never from the client, so a dentist can only ever see their own rows.
// Case pages reuse `ownCaseWhere` / `getOwnCase` (a case that isn't theirs is a plain 404).

/** The signed-in, approved dentist and the where-clause that scopes queries to them. */
export async function getDentistScope(locale: string) {
  const session = await requireApprovedDentist(locale);
  const dentistId = session.user.id;
  return { session, dentistId };
}

/** Where-clause for "cases owned by this dentist", optionally narrowed to one case. */
export function ownCaseWhere(dentistId: string, caseId?: string): Prisma.CaseWhereInput {
  return caseId ? { id: caseId, dentistId } : { dentistId };
}

/** Cached per request: the shell renders the account box twice (sidebar and mobile sheet). */
export const getOwnProfile = cache(async (locale: string) => {
  const { dentistId } = await getDentistScope(locale);
  const profile = await db.user.findUnique({
    where: { id: dentistId },
    select: {
      name: true,
      email: true,
      clinicName: true,
      phone: true,
      country: true,
      address: true,
      cvr: true,
      preferredLocale: true,
    },
  });
  if (!profile) notFound();
  return profile;
});

export async function countOwnCases(locale: string) {
  const { dentistId } = await getDentistScope(locale);
  return db.case.count({ where: ownCaseWhere(dentistId) });
}

/** One of the dentist's own cases, or a 404 (never reveals that someone else's case exists). */
export async function getOwnCase<S extends Prisma.CaseSelect>(
  locale: string,
  caseId: string,
  select: S,
) {
  const { dentistId } = await getDentistScope(locale);
  const found = await db.case.findFirst({ where: ownCaseWhere(dentistId, caseId), select });
  if (!found) notFound();
  return found;
}
