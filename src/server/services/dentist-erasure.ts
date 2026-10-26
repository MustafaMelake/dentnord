import "server-only";

import { db } from "@/lib/db";
import { removeCaseObjects } from "@/server/services/case-storage";

// GDPR erasure (right to be forgotten): an admin permanently deletes a dentist and everything linked
// to them. Order:
// 1. lock them out: account disabled (REJECTED) and every session deleted, so nothing new arrives
// 2. R2: every case's objects and unfinished uploads (lib/storage via case-storage.ts). A failure
//    stops here with all rows intact; the account stays disabled and the admin can run it again
// 3. DB, one transaction: cases (files, sites, events, messages, plans and their email log rows
//    cascade), other emails sent to them, contact-form messages from their address, pending tokens,
//    rate-limit counters, free text in earlier audit entries about them, then the user (sessions,
//    password and 2FA cascade) and one DENTIST_DELETED audit entry with counts only.
// The confirmation (the admin types the dentist's email) is checked here, not only in the dialog.

export class ErasureError extends Error {
  constructor(readonly code: "notFound" | "confirmMismatch" | "storage") {
    super(code);
  }
}

type Actor = { id: string; email: string };

/** What an erasure would delete (the confirmation dialog shows it). */
export async function erasureSummary(dentistId: string) {
  const [cases, files, messages] = await Promise.all([
    db.case.groupBy({ by: ["status"], where: { dentistId }, _count: true }),
    db.caseFile.aggregate({
      where: { case: { dentistId } },
      _count: true,
      _sum: { sizeBytes: true },
    }),
    db.caseMessage.count({ where: { case: { dentistId } } }),
  ]);
  const count = (statuses: string[]) =>
    cases.filter((c) => statuses.includes(c.status)).reduce((sum, c) => sum + c._count, 0);
  return {
    cases: count(cases.map((c) => c.status)),
    drafts: count(["DRAFT"]),
    /** Submitted and not yet delivered or cancelled. */
    open: count(
      cases.map((c) => c.status).filter((s) => !["DRAFT", "DELIVERED", "CANCELLED"].includes(s)),
    ),
    files: files._count,
    bytes: files._sum.sizeBytes ?? BigInt(0),
    messages,
  };
}

export async function eraseDentist({
  actor,
  dentistId,
  confirmEmail,
}: {
  actor: Actor;
  dentistId: string;
  confirmEmail: string;
}) {
  const dentist = await db.user.findFirst({
    where: { id: dentistId, role: "DENTIST" },
    select: { id: true, email: true },
  });
  if (!dentist) throw new ErasureError("notFound");
  if (confirmEmail.trim().toLowerCase() !== dentist.email.toLowerCase()) {
    throw new ErasureError("confirmMismatch");
  }

  // 1. Locked out before anything is deleted: no upload or message can start meanwhile.
  await db.$transaction([
    db.user.update({ where: { id: dentist.id }, data: { dentistStatus: "REJECTED" } }),
    db.session.deleteMany({ where: { userId: dentist.id } }),
  ]);

  // 2. Files first: if R2 fails, every row is still there to retry with.
  const cases = await db.case.findMany({
    where: { dentistId: dentist.id },
    select: {
      id: true,
      files: { select: { storageKey: true, uploadId: true, uploadStatus: true, sizeBytes: true } },
      _count: { select: { messages: true } },
    },
  });
  try {
    for (const c of cases) await removeCaseObjects(c.id, c.files);
  } catch (error) {
    console.error("[erasure] storage", error instanceof Error ? error.name : "error");
    throw new ErasureError("storage");
  }

  // 3. Rows. Counts only in the audit entry: no name, email, clinic or file names.
  const files = cases.flatMap((c) => c.files);
  const summary = {
    cases: cases.length,
    files: files.length,
    bytes: files.reduce((sum, f) => sum + f.sizeBytes, BigInt(0)).toString(),
    messages: cases.reduce((sum, c) => sum + c._count.messages, 0),
  };
  await db.$transaction(
    async (tx) => {
      await tx.case.deleteMany({ where: { dentistId: dentist.id } });
      // Account emails (approved, rejected, password reset) aren't tied to a case.
      await tx.emailLog.deleteMany({
        where: { to: { equals: dentist.email, mode: "insensitive" } },
      });
      await tx.contactMessage.deleteMany({
        where: { email: { equals: dentist.email, mode: "insensitive" } },
      });
      // Password-reset tokens and 2FA login challenges hold the user id.
      await tx.verification.deleteMany({ where: { value: dentist.id } });
      // Our upload/download limiter keys end in the user id.
      await tx.rateLimit.deleteMany({ where: { key: { endsWith: `:${dentist.id}` } } });
      // Earlier audit entries keep who did what and when, without free text that may name them
      // (a rejection reason) or a link to their (now deleted) drafts.
      await tx.$executeRaw`
        UPDATE "audit_log" SET "metadata" = "metadata" - 'reason'
        WHERE "targetType" = 'user' AND "targetId" = ${dentist.id} AND "metadata" ? 'reason'`;
      await tx.$executeRaw`
        UPDATE "audit_log" SET "metadata" = "metadata" - 'dentistId'
        WHERE "action" = 'DRAFT_EXPIRED' AND "metadata"->>'dentistId' = ${dentist.id}`;
      await tx.user.delete({ where: { id: dentist.id } });
      await tx.auditLog.create({
        data: {
          action: "DENTIST_DELETED",
          actorId: actor.id,
          actorEmail: actor.email,
          targetType: "user",
          targetId: dentist.id,
          metadata: summary,
        },
      });
    },
    { timeout: 30_000 },
  );
  return summary;
}
