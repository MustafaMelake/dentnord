import "server-only";

import { notFound } from "next/navigation";

import type { CaseStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { caseDetailSelect, toCaseDetail, type CaseListRow } from "@/server/queries/cases";
import { requireAdmin } from "@/server/queries/session";
import { toBilingual } from "@/lib/validation/admin";

// Admin reads for /admin/cases (read-only for now). Drafts are the dentist's private work in progress:
// the admin never lists or opens them. Each function re-checks the admin session itself.

const notDraft = { status: { not: "DRAFT" as const } };

export async function listAdminCases(filter: {
  status?: CaseStatus;
  dentistId?: string;
  query?: string;
}) {
  await requireAdmin();
  const q = filter.query?.trim().slice(0, 60);
  const rows = await db.case.findMany({
    where: {
      ...(filter.status && filter.status !== "DRAFT" ? { status: filter.status } : notDraft),
      ...(filter.dentistId ? { dentistId: filter.dentistId } : {}),
      ...(q
        ? {
            OR: [
              { caseNumber: { contains: q, mode: "insensitive" } },
              { patientCode: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { submittedAt: "desc" },
    take: 300,
    select: {
      id: true,
      caseNumber: true,
      patientCode: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      submittedAt: true,
      guideType: { select: { name: true } },
      dentist: { select: { name: true, clinicName: true } },
      _count: { select: { implants: true } },
    },
  });
  return rows.map((c): CaseListRow & { dentist: { name: string; clinicName: string | null } } => ({
    id: c.id,
    caseNumber: c.caseNumber,
    patientCode: c.patientCode,
    status: c.status,
    guideTypeName: c.guideType ? toBilingual(c.guideType.name) : null,
    implantCount: c._count.implants,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    submittedAt: c.submittedAt?.toISOString() ?? null,
    dentist: c.dentist,
  }));
}

/** Dentists who have submitted at least one case (for the filter). */
export async function listCaseDentists() {
  await requireAdmin();
  return db.user.findMany({
    where: { cases: { some: notDraft } },
    orderBy: [{ clinicName: "asc" }, { name: "asc" }],
    select: { id: true, name: true, clinicName: true },
  });
}

export async function countCasesByStatus() {
  await requireAdmin();
  const groups = await db.case.groupBy({ by: ["status"], where: notDraft, _count: { _all: true } });
  return Object.fromEntries(groups.map((g) => [g.status, g._count._all])) as Partial<
    Record<CaseStatus, number>
  >;
}

/** Sidebar badge: submitted cases nobody has picked up yet. */
export async function countNewCases() {
  await requireAdmin();
  return db.case.count({ where: { status: "SUBMITTED" } });
}

export async function getAdminCaseDetail(id: string) {
  await requireAdmin();
  const c = await db.case.findFirst({ where: { id, ...notDraft }, select: caseDetailSelect });
  if (!c) notFound();
  return toCaseDetail(c);
}
