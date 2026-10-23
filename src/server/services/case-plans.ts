import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { LAB_UPLOAD_STATES } from "@/lib/upload-permissions";
import { toClientFile } from "@/server/queries/cases";

// Plan versions. The lab prepares one version at a time (sentAt null) while the case is
// IN_PLANNING or CHANGES_REQUESTED, adds its files through the upload API, then sends it with the
// sendPlan transition (case-workflow.ts). Sent versions and decisions are read-only forever.

export class PlanError extends Error {
  constructor(readonly code: "notFound" | "wrongState" | "invalid") {
    super(code);
  }
}

/** Starts the next plan version, or returns the one already being prepared. Admin only (caller). */
export async function startPlanVersion(adminId: string, caseId: string) {
  return db.$transaction(async (tx) => {
    const c = await tx.case.findFirst({
      where: { id: caseId, status: { in: [...LAB_UPLOAD_STATES] } },
      select: { id: true },
    });
    if (!c) throw new PlanError("wrongState");
    const open = await tx.casePlan.findFirst({
      where: { caseId, sentAt: null },
      select: { id: true, version: true },
    });
    if (open) return open;
    const last = await tx.casePlan.findFirst({
      where: { caseId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const plan = await tx.casePlan.create({
      data: { caseId, version: (last?.version ?? 0) + 1, createdById: adminId },
      select: { id: true, version: true },
    });
    await tx.caseEvent.create({
      data: {
        caseId,
        type: "PLAN_CREATED",
        actorId: adminId,
        metadata: { planVersion: plan.version },
      },
    });
    return plan;
  });
}

/** The note for the dentist on a plan still being prepared. */
export async function savePlanNote(planId: string, note: { da: string; en: string }) {
  const { count } = await db.casePlan.updateMany({
    where: { id: planId, sentAt: null, case: { status: { in: [...LAB_UPLOAD_STATES] } } },
    data: { note: note.da || note.en ? note : Prisma.DbNull },
  });
  if (count !== 1) throw new PlanError("notFound");
}

const planFileSelect = {
  id: true,
  kind: true,
  fileName: true,
  sizeBytes: true,
  mimeType: true,
  uploadStatus: true,
  scanPart: true,
  createdAt: true,
  completedAt: true,
} as const;

/**
 * Plan versions of a case, newest first, for the page. `includeUnsent` only for the admin: the
 * dentist never sees a version that is still being prepared (nor its files).
 */
export async function listPlans(caseId: string, includeUnsent: boolean) {
  const plans = await db.casePlan.findMany({
    where: { caseId, ...(includeUnsent ? {} : { sentAt: { not: null } }) },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      note: true,
      createdAt: true,
      sentAt: true,
      decision: true,
      decidedAt: true,
      decisionComment: true,
      approvalStatement: true,
      decidedBy: { select: { name: true } },
      files: {
        where: { uploadStatus: includeUnsent ? undefined : "COMPLETE" },
        orderBy: { createdAt: "asc" },
        select: planFileSelect,
      },
    },
  });
  return plans.map((p) => ({
    id: p.id,
    version: p.version,
    note: (p.note ?? null) as { da?: string; en?: string } | null,
    createdAt: p.createdAt.toISOString(),
    sentAt: p.sentAt?.toISOString() ?? null,
    decision: p.decision,
    decidedAt: p.decidedAt?.toISOString() ?? null,
    decidedBy: p.decidedBy?.name ?? null,
    decisionComment: p.decisionComment,
    approvalStatement: p.approvalStatement,
    files: p.files.map(toClientFile),
  }));
}
export type PlanView = Awaited<ReturnType<typeof listPlans>>[number];
