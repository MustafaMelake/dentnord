import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  runStorageCleanup,
  type CleanupStore,
  type StaleDraft,
  type StaleUpload,
} from "@/lib/storage-cleanup";
import { abortMultipartUpload, caseStorageConfigured } from "@/lib/storage";
import { removeCaseObjects } from "@/server/services/case-storage";

// Prisma + R2 side of the nightly storage cleanup (orchestration and rules: lib/storage-cleanup.ts,
// lib/storage-limits.ts). Called only by /api/cron/storage-cleanup.

const UNFINISHED = ["PENDING", "UPLOADING"] as const;

/**
 * A draft nobody worked on since `since`: no edit (case.updatedAt), no file added, no event by a
 * person. System events (actorId null, e.g. this job expiring an upload) don't count as activity,
 * or expiring a stale draft's upload would keep the draft alive for another 60 days.
 */
const staleDraftWhere = (since: Date): Prisma.CaseWhereInput => ({
  status: "DRAFT",
  updatedAt: { lt: since },
  files: { none: { createdAt: { gte: since } } },
  events: { none: { createdAt: { gte: since }, actorId: { not: null } } },
});

const httpStatus = (error: unknown) =>
  (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;

const store: CleanupStore = {
  staleUploads: (registeredBefore, limit) =>
    db.caseFile.findMany({
      where: { uploadStatus: { in: [...UNFINISHED] }, createdAt: { lt: registeredBefore } },
      orderBy: { createdAt: "asc" },
      take: limit,
      select: {
        id: true,
        caseId: true,
        kind: true,
        storageKey: true,
        uploadId: true,
        sizeBytes: true,
      },
    }),

  async abortUpload(file: StaleUpload) {
    // Without R2 nothing can have been uploaded.
    if (!file.uploadId || !caseStorageConfigured()) return;
    await abortMultipartUpload(file.storageKey, file.uploadId).catch((error: unknown) => {
      if (httpStatus(error) !== 404) throw error; // already completed or aborted
    });
  },

  expireUpload: (file) =>
    db.$transaction(async (tx) => {
      const { count } = await tx.caseFile.updateMany({
        where: { id: file.id, uploadStatus: { in: [...UNFINISHED] } },
        data: { uploadStatus: "FAILED", uploadId: null },
      });
      if (count !== 1) return false;
      await tx.caseEvent.create({
        data: {
          caseId: file.caseId,
          type: "FILE_FAILED",
          actorId: null, // system
          metadata: { fileId: file.id, kind: file.kind, reason: "expired" },
        },
      });
      return true;
    }),

  staleDrafts: (inactiveSince, limit) =>
    db.case.findMany({
      where: staleDraftWhere(inactiveSince),
      orderBy: { updatedAt: "asc" },
      take: limit,
      select: {
        id: true,
        dentistId: true,
        files: {
          select: { storageKey: true, uploadId: true, uploadStatus: true, sizeBytes: true },
        },
      },
    }),

  isStaleDraft: async (draft, inactiveSince) =>
    (await db.case.count({ where: { id: draft.id, ...staleDraftWhere(inactiveSince) } })) === 1,

  removeDraftObjects: (draft: StaleDraft) => removeCaseObjects(draft.id, draft.files),

  deleteDraft: (draft, inactiveSince) =>
    db.$transaction(async (tx) => {
      const { count } = await tx.case.deleteMany({
        where: { id: draft.id, ...staleDraftWhere(inactiveSince) },
      });
      if (count !== 1) return false;
      // The case's own events are gone with it: the audit log keeps the record. No personal data:
      // ids and counts only (dentistId so support can answer "where did my draft go?").
      await tx.auditLog.create({
        data: {
          action: "DRAFT_EXPIRED",
          actorId: null,
          actorEmail: "system",
          targetType: "case",
          targetId: draft.id,
          metadata: {
            dentistId: draft.dentistId,
            files: draft.files.length,
            bytes: draft.files.reduce((sum, f) => sum + f.sizeBytes, BigInt(0)).toString(),
          },
        },
      });
      return true;
    }),
};

export function cleanUpStorage(now = new Date()) {
  return runStorageCleanup(store, now, {
    // Ids only: never file names (they can describe a patient) or user data in logs.
    onError: (error) =>
      console.error("[storage-cleanup]", error instanceof Error ? error.name : "error"),
  });
}
