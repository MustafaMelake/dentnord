import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { DENTIST_FILE_KINDS } from "@/lib/case-files";
import {
  checkPlanDecision,
  checkTransition,
  parseTransitionInput,
  type Actor,
  type CaseStatusValue,
  type TransitionId,
  type TransitionInput,
} from "@/lib/case-workflow-rules";
import { db } from "@/lib/db";
import { allocateCaseNumber } from "@/server/services/case-number";
import { CaseError, checkDraftComplete, type Tx } from "@/server/services/cases";

// The ONLY code that changes Case.status. Rules (who, from, to, required input) live in
// lib/case-workflow-rules.ts; this module enforces them against the database:
//   1. lock the case row (SELECT … FOR UPDATE), so concurrent requests run one after the other
//   2. scope: a dentist only reaches their own cases; the admin never reaches drafts
//   3. stale check: the caller says which status it saw; anything else → "stale" (refresh)
//   4. role + state from the rule table, then the input the transition requires
//   5. preconditions (files, plans), then the transition's own effects (case number, tracking, …)
//   6. the status update and a CaseEvent (actor, from, to, note) in the same transaction
// Notifications are sent by the caller after the commit (server/actions/case-lifecycle.ts).

export type WorkflowActor = { id: string; role: Actor };

export type WorkflowErrorCode =
  | "notFound"
  | "forbidden"
  | "wrongState"
  | "stale"
  | "invalid"
  | "noNewFiles"
  | "uploadsPending"
  | "noPreparedPlan"
  | "planReportMissing"
  | "notLatestPlan"
  | "planAlreadyDecided"
  | "planNotSent";

export class WorkflowError extends Error {
  constructor(
    readonly code: WorkflowErrorCode,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(code);
  }
}

export type TransitionRequest = {
  caseId: string;
  transition: TransitionId;
  /** The status the user saw when they clicked. */
  expectedStatus: CaseStatusValue;
  input?: unknown;
  /** approvePlan / requestChanges: the plan version decided on. */
  planId?: string;
  /** approvePlan: the exact statement shown to the dentist, and its language. */
  approval?: { statement: string; locale: string };
};

export type TransitionResult = {
  caseId: string;
  caseNumber: string | null;
  dentistId: string;
  transition: TransitionId;
  from: CaseStatusValue;
  to: CaseStatusValue;
  input: TransitionInput;
  plan: { id: string; version: number } | null;
  /** submit only. */
  submitted?: { implantCount: number; guideTypeId: string };
};

type LockedCase = {
  id: string;
  status: CaseStatusValue;
  dentistId: string;
  caseNumber: string | null;
  statusChangedAt: Date | null;
};

async function lockCase(tx: Tx, caseId: string) {
  const rows = await tx.$queryRaw<LockedCase[]>`
    SELECT "id", "status"::text AS "status", "dentistId", "caseNumber", "statusChangedAt"
    FROM "case" WHERE "id" = ${caseId} FOR UPDATE`;
  return rows[0] ?? null;
}

const PENDING_UPLOADS: Prisma.CaseFileWhereInput = {
  uploadStatus: { in: ["PENDING", "UPLOADING"] },
};

export async function runTransition(
  actor: WorkflowActor,
  req: TransitionRequest,
): Promise<TransitionResult> {
  try {
    return await db.$transaction(async (tx) => {
      const c = await lockCase(tx, req.caseId);
      // A foreign case and an admin looking at a draft both look like "no such case".
      if (!c) throw new WorkflowError("notFound");
      if (actor.role === "DENTIST" && c.dentistId !== actor.id) throw new WorkflowError("notFound");
      if (actor.role === "ADMIN" && c.status === "DRAFT") throw new WorkflowError("notFound");

      // Role first: a dentist must learn nothing about admin-only transitions from a stale check.
      const check = checkTransition(req.transition, c.status, actor.role);
      if (!check.ok && check.reason !== "wrongState") throw new WorkflowError("forbidden");
      if (c.status !== req.expectedStatus) throw new WorkflowError("stale");
      if (!check.ok) throw new WorkflowError("wrongState");
      const rule = check.rule;

      const parsed = parseTransitionInput(rule, req.input);
      if (!parsed.ok) throw new WorkflowError("invalid", parsed.errors);
      const input = parsed.data;

      const now = new Date();
      const data: Prisma.CaseUpdateManyMutationInput = { status: rule.to, statusChangedAt: now };
      let plan: TransitionResult["plan"] = null;
      let submitted: TransitionResult["submitted"];

      // ── Preconditions ──
      for (const pre of rule.preconditions) {
        switch (pre) {
          case "validCase":
          case "requiredFiles":
            submitted ??= await checkDraftComplete(tx, c.id);
            break;
          case "noPendingUploads":
            if (await tx.caseFile.count({ where: { caseId: c.id, ...PENDING_UPLOADS } }))
              throw new WorkflowError("uploadsPending");
            break;
          case "newFiles": {
            // At least one finished dentist file added since the case entered NEEDS_FILES.
            const added = await tx.caseFile.count({
              where: {
                caseId: c.id,
                uploadStatus: "COMPLETE",
                kind: { in: [...DENTIST_FILE_KINDS] },
                createdAt: { gt: c.statusChangedAt ?? new Date(0) },
              },
            });
            if (!added) throw new WorkflowError("noNewFiles");
            break;
          }
          case "preparedPlan": {
            const draft = await tx.casePlan.findFirst({
              where: { caseId: c.id, sentAt: null },
              orderBy: { version: "desc" },
              select: { id: true, version: true },
            });
            if (!draft) throw new WorkflowError("noPreparedPlan");
            const report = await tx.caseFile.count({
              where: { planId: draft.id, kind: "PLAN_REPORT", uploadStatus: "COMPLETE" },
            });
            if (!report) throw new WorkflowError("planReportMissing");
            plan = draft;
            break;
          }
          case "latestPlan": {
            const plans = await tx.casePlan.findMany({
              where: { caseId: c.id },
              select: { id: true, version: true, sentAt: true, decision: true },
            });
            const decision = checkPlanDecision(plans, req.planId ?? "");
            if (!decision.ok) {
              throw new WorkflowError(
                decision.reason === "notLatest"
                  ? "notLatestPlan"
                  : decision.reason === "alreadyDecided"
                    ? "planAlreadyDecided"
                    : "planNotSent",
              );
            }
            const p = plans.find((x) => x.id === req.planId)!;
            plan = { id: p.id, version: p.version };
            break;
          }
        }
      }

      // ── Effects of the transition ──
      let note: string | null = null;
      switch (rule.id) {
        case "submit": {
          const caseNumber = await allocateCaseNumber(tx, now);
          Object.assign(data, { caseNumber, submittedAt: now, consentAt: now });
          c.caseNumber = caseNumber;
          break;
        }
        case "requestFiles":
          note = input.message ?? null;
          break;
        case "sendPlan":
          await tx.casePlan.update({ where: { id: plan!.id }, data: { sentAt: now } });
          break;
        case "approvePlan":
        case "requestChanges": {
          const approving = rule.id === "approvePlan";
          if (approving && !req.approval?.statement) throw new WorkflowError("invalid");
          // Guarded: only an undecided, sent plan. The DB trigger refuses any later change.
          const { count } = await tx.casePlan.updateMany({
            where: { id: plan!.id, decision: null, sentAt: { not: null } },
            data: {
              decision: approving ? "APPROVED" : "CHANGES_REQUESTED",
              decidedById: actor.id,
              decidedAt: now,
              decisionComment: approving ? null : (input.comment ?? null),
              approvalStatement: approving ? req.approval!.statement : null,
              approvalLocale: approving ? req.approval!.locale : null,
            },
          });
          if (count !== 1) throw new WorkflowError("planAlreadyDecided");
          note = approving ? null : (input.comment ?? null);
          break;
        }
        case "ship":
          Object.assign(data, {
            shippingCarrier: input.carrier,
            trackingNumber: input.trackingNumber,
            trackingUrl: input.trackingUrl || null,
            shippedAt: now,
          });
          break;
        case "confirmDelivery":
          data.deliveredAt = now;
          break;
        case "cancelByDentist":
        case "cancelByAdmin":
          data.cancelledAt = now;
          note = input.reason || null;
          break;
      }

      // ── The status change itself: guarded by the status we locked and checked ──
      const { count } = await tx.case.updateMany({ where: { id: c.id, status: c.status }, data });
      if (count !== 1) throw new WorkflowError("stale");
      await tx.caseEvent.create({
        data: {
          caseId: c.id,
          type:
            rule.id === "approvePlan"
              ? "PLAN_APPROVED"
              : rule.id === "requestChanges"
                ? "CHANGES_REQUESTED"
                : "STATUS_CHANGED",
          fromStatus: c.status,
          toStatus: rule.to,
          actorId: actor.id,
          note,
          metadata: {
            transition: rule.id,
            ...(plan ? { planVersion: plan.version } : {}),
            ...(rule.id === "ship"
              ? { carrier: input.carrier, trackingNumber: input.trackingNumber }
              : {}),
          },
        },
      });

      return {
        caseId: c.id,
        caseNumber: c.caseNumber,
        dentistId: c.dentistId,
        transition: rule.id,
        from: c.status,
        to: rule.to,
        input,
        plan,
        submitted,
      };
    });
  } catch (error) {
    // Draft validation reports its own field errors.
    if (error instanceof CaseError) throw error;
    // The plan trigger (a decided plan is immutable) surfaces as a check violation.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Prisma.PrismaClientUnknownRequestError
    ) {
      if (/immutable|only receive a decision|can't be decided/.test(error.message)) {
        throw new WorkflowError("planAlreadyDecided");
      }
    }
    throw error;
  }
}
