"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/server/queries/session";
import { ErasureError, eraseDentist } from "@/server/services/dentist-erasure";
import { ReviewError, reviewDentist, type ReviewDecision } from "@/server/services/dentist-review";
import { notifyAccountApproved, notifyAccountRejected } from "@/server/services/notifications";

// Admin decisions on dentist accounts. Admin UI is English only, so errors are plain codes the
// client maps to English strings (messages `admin.dentists.errors.*`).
// Order in every action: requireAdmin (DB-backed) FIRST, then zod, then the service.

const dentistId = z.string().trim().min(1).max(64);

const reviewSchema = z.object({
  dentistId,
  reason: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((value) => value || undefined),
});

export type ReviewResult =
  { ok: true } | { ok: false; error: "invalid" | "notFound" | "invalidState" };

async function review(decision: ReviewDecision, input: unknown): Promise<ReviewResult> {
  // Admin check first (DB-backed): a non-admin posting the action id never reaches validation.
  const session = await requireAdmin();
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const { dentist } = await reviewDentist({
      actor: { id: session.user.id, email: session.user.email },
      dentistId: parsed.data.dentistId,
      decision,
      reason: decision === "reject" ? parsed.data.reason : undefined,
    });
    if (decision === "reject") notifyAccountRejected(dentist, parsed.data.reason);
    else notifyAccountApproved(dentist);
  } catch (error) {
    if (error instanceof ReviewError) return { ok: false, error: error.code };
    throw error;
  }

  refresh();
  return { ok: true };
}

export async function approveDentist(input: { dentistId: string }) {
  return review("approve", input);
}

export async function rejectDentist(input: { dentistId: string; reason?: string }) {
  return review("reject", input);
}

export async function reactivateDentist(input: { dentistId: string }) {
  return review("reactivate", input);
}

const eraseSchema = z.object({ dentistId, confirmEmail: z.string().trim().min(1).max(320) });

export type EraseResult =
  { ok: true } | { ok: false; error: "invalid" | "notFound" | "confirmMismatch" | "storage" };

/**
 * GDPR erasure: deletes the dentist and all their data (server/services/dentist-erasure.ts). The
 * admin confirms by typing the dentist's email; the service checks it again.
 */
export async function deleteDentist(input: {
  dentistId: string;
  confirmEmail: string;
}): Promise<EraseResult> {
  const session = await requireAdmin();
  const parsed = eraseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    await eraseDentist({
      actor: { id: session.user.id, email: session.user.email },
      dentistId: parsed.data.dentistId,
      confirmEmail: parsed.data.confirmEmail,
    });
  } catch (error) {
    if (error instanceof ErasureError) return { ok: false, error: error.code };
    throw error;
  }
  return { ok: true };
}
