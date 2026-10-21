import "server-only";

import { notFound } from "next/navigation";

import type { Prisma } from "@/generated/prisma/client";
import type { DentistStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/queries/session";

// Admin reads for /admin/dentists. Each function re-checks the admin session itself, so it is safe to
// call from any page or action. Dates are returned as ISO strings for client components.

export const DENTIST_TABS = ["PENDING", "APPROVED", "REJECTED"] as const satisfies DentistStatus[];

const listSelect = {
  id: true,
  name: true,
  email: true,
  clinicName: true,
  country: true,
  dentistStatus: true,
  createdAt: true,
  reviewedAt: true,
} satisfies Prisma.UserSelect;

export type DentistRow = {
  id: string;
  name: string;
  email: string;
  clinicName: string | null;
  country: string | null;
  status: DentistStatus;
  createdAt: string;
  reviewedAt: string | null;
};

export async function listDentists({ status, query }: { status: DentistStatus; query?: string }) {
  await requireAdmin();
  const q = query?.trim().slice(0, 100);
  const rows = await db.user.findMany({
    where: {
      role: "DENTIST",
      dentistStatus: status,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { clinicName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: listSelect,
    // Pending: oldest first (review queue). Others: most recently reviewed first.
    orderBy:
      status === "PENDING" ? { createdAt: "asc" } : [{ reviewedAt: "desc" }, { createdAt: "desc" }],
    take: 500,
  });
  return rows.map((r): DentistRow => ({
    id: r.id,
    name: r.name,
    email: r.email,
    clinicName: r.clinicName,
    country: r.country,
    status: r.dentistStatus,
    createdAt: r.createdAt.toISOString(),
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
  }));
}

export async function countDentistsByStatus(): Promise<Record<DentistStatus, number>> {
  await requireAdmin();
  const groups = await db.user.groupBy({
    by: ["dentistStatus"],
    where: { role: "DENTIST" },
    _count: { _all: true },
  });
  const counts = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
  for (const g of groups) counts[g.dentistStatus] = g._count._all;
  return counts;
}

export async function countPendingDentists() {
  await requireAdmin();
  return db.user.count({ where: { role: "DENTIST", dentistStatus: "PENDING" } });
}

export async function getDentistDetail(id: string) {
  await requireAdmin();
  const dentist = await db.user.findFirst({
    where: { id, role: "DENTIST" },
    select: {
      id: true,
      name: true,
      email: true,
      clinicName: true,
      phone: true,
      country: true,
      address: true,
      cvr: true,
      preferredLocale: true,
      dentistStatus: true,
      rejectionReason: true,
      termsAcceptedAt: true,
      reviewedAt: true,
      createdAt: true,
      _count: { select: { cases: true, sessions: true } },
    },
  });
  if (!dentist) notFound();
  const history = await db.auditLog.findMany({
    where: { targetType: "user", targetId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, action: true, actorEmail: true, metadata: true, createdAt: true },
    take: 50,
  });
  return { dentist, history };
}
