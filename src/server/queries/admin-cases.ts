import "server-only";

import type { CaseStatus } from "@/generated/prisma/enums";
import { CASE_STATUSES, waitingOn } from "@/lib/case-workflow-rules";
import { db } from "@/lib/db";
import { listSelect, toListRow } from "@/server/queries/cases";
import { requireAdmin } from "@/server/queries/session";

// Admin reads for /admin/cases and the dashboard. Drafts are the dentist's private work in progress:
// the admin never lists or opens them. Each function re-checks the admin session itself.

const notDraft = { status: { not: "DRAFT" as const } };

/** Statuses where the next step is the lab's, or the dentist's (lib/case-workflow-rules.ts). */
export const WAITING_ON_US = CASE_STATUSES.filter((s) => waitingOn(s) === "ADMIN");
export const WAITING_ON_DENTIST = CASE_STATUSES.filter(
  (s) => s !== "DRAFT" && waitingOn(s) === "DENTIST",
);

export type AdminCaseQueue = "us" | "dentist";
export type AdminCaseSort = "submitted" | "surgery";

const adminListSelect = { ...listSelect, dentist: { select: { name: true, clinicName: true } } };

export async function listAdminCases(filter: {
  status?: CaseStatus;
  queue?: AdminCaseQueue;
  dentistId?: string;
  query?: string;
  sort?: AdminCaseSort;
}) {
  await requireAdmin();
  const q = filter.query?.trim().slice(0, 60);
  const statusWhere =
    filter.status && filter.status !== "DRAFT"
      ? { status: filter.status }
      : filter.queue === "us"
        ? { status: { in: WAITING_ON_US } }
        : filter.queue === "dentist"
          ? { status: { in: WAITING_ON_DENTIST } }
          : notDraft;
  const rows = await db.case.findMany({
    where: {
      ...statusWhere,
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
    orderBy:
      filter.sort === "surgery"
        ? [{ surgeryDate: { sort: "asc", nulls: "last" } }, { submittedAt: "desc" }]
        : { submittedAt: "desc" },
    take: 300,
    select: adminListSelect,
  });
  return rows.map((c) => ({ ...toListRow(c), dentist: c.dentist }));
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

/** Dashboard: what waits on the lab (oldest first) and surgeries in the next 14 days. */
export async function getAdminCaseOverview() {
  await requireAdmin();
  // Read the clock only after the session (request data): Cache Components must not prerender it.
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const in14 = new Date(today.getTime() + 14 * 86_400_000);
  const [waiting, upcoming] = await Promise.all([
    db.case.findMany({
      where: { status: { in: WAITING_ON_US } },
      orderBy: { statusChangedAt: "asc" },
      take: 8,
      select: adminListSelect,
    }),
    db.case.findMany({
      where: {
        status: { notIn: ["DRAFT", "DELIVERED", "CANCELLED"] },
        surgeryDate: { gte: today, lte: in14 },
      },
      orderBy: { surgeryDate: "asc" },
      take: 10,
      select: adminListSelect,
    }),
  ]);
  return {
    waiting: waiting.map((c) => ({ ...toListRow(c), dentist: c.dentist })),
    upcoming: upcoming.map((c) => ({ ...toListRow(c), dentist: c.dentist })),
  };
}
