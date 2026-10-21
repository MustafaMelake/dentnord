import "server-only";

import type { AuditAction, DentistStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

// Admin decisions on dentist accounts. One transaction per decision: the status change (guarded
// against concurrent edits), session revocation, and the audit entry land together or not at all.

export type ReviewDecision = "approve" | "reject" | "reactivate";

const RULES: Record<
  ReviewDecision,
  { from: DentistStatus[]; to: DentistStatus; action: AuditAction }
> = {
  approve: { from: ["PENDING"], to: "APPROVED", action: "DENTIST_APPROVED" },
  // Rejecting an approved dentist disables the account.
  reject: { from: ["PENDING", "APPROVED"], to: "REJECTED", action: "DENTIST_REJECTED" },
  reactivate: { from: ["REJECTED"], to: "APPROVED", action: "DENTIST_REACTIVATED" },
};

export function canReview(decision: ReviewDecision, status: DentistStatus) {
  return RULES[decision].from.includes(status);
}

export class ReviewError extends Error {
  constructor(readonly code: "notFound" | "invalidState") {
    super(code);
  }
}

export async function reviewDentist({
  actor,
  dentistId,
  decision,
  reason,
}: {
  actor: { id: string; email: string };
  dentistId: string;
  decision: ReviewDecision;
  reason?: string | null;
}) {
  const rule = RULES[decision];
  return db.$transaction(async (tx) => {
    const dentist = await tx.user.findUnique({
      where: { id: dentistId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        dentistStatus: true,
        preferredLocale: true,
      },
    });
    if (!dentist || dentist.role !== "DENTIST") throw new ReviewError("notFound");
    if (!rule.from.includes(dentist.dentistStatus)) throw new ReviewError("invalidState");

    // Conditional update: if someone else changed the status meanwhile, nothing matches.
    const { count } = await tx.user.updateMany({
      where: { id: dentist.id, dentistStatus: dentist.dentistStatus },
      data: {
        dentistStatus: rule.to,
        reviewedAt: new Date(),
        rejectionReason: decision === "reject" ? reason || null : null,
      },
    });
    if (count !== 1) throw new ReviewError("invalidState");

    // Signs the dentist out everywhere, immediately. Every protected page/action checks the DB.
    const revoked =
      decision === "reject"
        ? (await tx.session.deleteMany({ where: { userId: dentist.id } })).count
        : 0;

    await tx.auditLog.create({
      data: {
        action: rule.action,
        actorId: actor.id,
        actorEmail: actor.email,
        targetType: "user",
        targetId: dentist.id,
        metadata: {
          from: dentist.dentistStatus,
          to: rule.to,
          ...(reason ? { reason } : {}),
          ...(decision === "reject" ? { sessionsRevoked: revoked } : {}),
        },
      },
    });

    return { dentist, from: dentist.dentistStatus, to: rule.to };
  });
}
