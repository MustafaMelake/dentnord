import "server-only";

import { env } from "@/env";
import type { CaseFileKind, ScanPart } from "@/generated/prisma/enums";
import {
  buildCaseFileKey,
  expectedPartSize,
  guessScanPart,
  partCount,
  sanitizeFileName,
} from "@/lib/case-files";
import type { Actor, CaseStatusValue } from "@/lib/case-workflow-rules";
import { db } from "@/lib/db";
import {
  abortMultipartUpload,
  completeMultipartUpload,
  createMultipartUpload,
  deleteObject,
  headObject,
  listUploadParts,
  presignGetObject,
  presignUploadPart,
} from "@/lib/storage";
import {
  canDownload,
  canRemove,
  canUpload,
  checkFileType,
  DENTIST_UPLOAD_STATES,
  isViewable,
  type Permission,
  type PlanState,
} from "@/lib/upload-permissions";
import { toClientFile } from "@/server/queries/cases";

// Case-file uploads, removals and downloads, for the dentist (their case files) and the admin (plan
// files). The browser only PUTs parts to signed R2 URLs; everything else happens here. Every call
// takes the user from the DB-checked session and finds the file through its case:
// - scope: a dentist reaches only their own cases; the admin never reaches drafts → else 404
// - state: lib/upload-permissions.ts decides kind × case status × plan state, re-checked on every
//   request (a part can't be signed once the case moved on) → else 403
// Keys and R2 upload ids never come from the client.

export class UploadError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

export type Uploader = { id: string; role: Actor };

/** A case can hold this many files (all kinds together). */
export const MAX_FILES_PER_CASE = 80;

const httpStatus = (error: unknown) =>
  (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;

const fileSelect = {
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

const scopeWhere = (user: Uploader) =>
  user.role === "DENTIST" ? { dentistId: user.id } : { status: { not: "DRAFT" as const } };

const planState = (plan: { sentAt: Date | null } | null): PlanState =>
  !plan ? "none" : plan.sentAt ? "sent" : "unsent";

function deny(p: Permission): asserts p is { ok: true } {
  if (!p.ok) throw new UploadError(403, p.reason);
}

/** Registers a file: checks it, creates the multipart upload in R2 and the CaseFile row (UPLOADING). */
export async function registerUpload(
  user: Uploader,
  input: { caseId: string; kind: string; fileName: string; sizeBytes: number; planId?: string },
) {
  const check = checkFileType(input.kind, input.fileName, input.sizeBytes);
  if (!check.ok) throw new UploadError(400, check.reason);

  const c = await db.case.findFirst({
    where: { id: input.caseId, ...scopeWhere(user) },
    select: { id: true, status: true, _count: { select: { files: true } } },
  });
  if (!c) throw new UploadError(404, "notFound");
  const plan = input.planId
    ? await db.casePlan.findFirst({
        where: { id: input.planId, caseId: c.id },
        select: { id: true, sentAt: true },
      })
    : null;
  if (input.planId && !plan) throw new UploadError(404, "notFound");
  deny(canUpload({ actor: user.role, status: c.status, kind: input.kind, plan: planState(plan) }));
  if (c._count.files >= MAX_FILES_PER_CASE) throw new UploadError(400, "tooManyFiles");

  const kind = input.kind as CaseFileKind; // checkFileType + canUpload accepted it
  const fileId = crypto.randomUUID();
  const fileName = sanitizeFileName(input.fileName);
  const key = buildCaseFileKey({ prefix: env.R2_KEY_PREFIX, caseId: c.id, fileId, fileName });
  const { uploadId } = await createMultipartUpload(key, check.mimeType);
  try {
    const file = await db.caseFile.create({
      data: {
        id: fileId,
        caseId: c.id,
        kind,
        storageKey: key,
        fileName,
        sizeBytes: BigInt(input.sizeBytes),
        mimeType: check.mimeType,
        uploadStatus: "UPLOADING",
        uploadId,
        planId: plan?.id ?? null,
        scanPart: kind === "INTRAORAL_SCAN" ? guessScanPart(input.fileName) : null,
        uploadedById: user.id,
      },
      select: fileSelect,
    });
    return { key, file: toClientFile(file) };
  } catch (error) {
    await abortMultipartUpload(key, uploadId).catch(() => undefined);
    throw error;
  }
}

/** A file the user can reach (scope only), with what the permission checks need. */
async function reachableFile(user: Uploader, fileId: string) {
  const file = await db.caseFile.findFirst({
    where: { id: fileId, case: scopeWhere(user) },
    select: {
      id: true,
      caseId: true,
      kind: true,
      fileName: true,
      storageKey: true,
      uploadId: true,
      uploadStatus: true,
      sizeBytes: true,
      case: { select: { status: true } },
      plan: { select: { sentAt: true } },
    },
  });
  if (!file) throw new UploadError(404, "notFound");
  return {
    ...file,
    status: file.case.status as CaseStatusValue,
    planState: planState(file.plan),
    sizeBytes: Number(file.sizeBytes),
  };
}

/** An upload in progress that the user may still continue (state re-checked on every call). */
async function uploading(user: Uploader, fileId: string) {
  const file = await reachableFile(user, fileId);
  if (file.uploadStatus !== "UPLOADING" || !file.uploadId) throw new UploadError(404, "notFound");
  deny(canUpload({ actor: user.role, status: file.status, kind: file.kind, plan: file.planState }));
  return { ...file, uploadId: file.uploadId };
}

/** A signed URL for one part, with the part's exact size signed in (15 minutes). */
export async function signPart(user: Uploader, fileId: string, partNumber: number) {
  const file = await uploading(user, fileId);
  const size = expectedPartSize(file.sizeBytes, partNumber);
  if (size === null) throw new UploadError(400, "partNumber");
  return presignUploadPart(file.storageKey, file.uploadId, partNumber, size);
}

/** Parts already in R2 (Uppy resumes from these after a pause, a retry or a lost connection). */
export async function listParts(user: Uploader, fileId: string) {
  const file = await uploading(user, fileId);
  return listUploadParts(file.storageKey, file.uploadId);
}

/**
 * Finishes an upload. Uses the parts R2 has (never a client-sent list), checks every part's size,
 * completes, then HEADs the object: COMPLETE only if R2 holds exactly the declared size. A mismatch
 * deletes the object and marks the file FAILED.
 */
export async function completeUpload(user: Uploader, fileId: string) {
  const file = await uploading(user, fileId);
  const parts = await listUploadParts(file.storageKey, file.uploadId);
  const expected = partCount(file.sizeBytes);
  const complete =
    parts.length === expected &&
    parts.every((p) => p.Size === expectedPartSize(file.sizeBytes, p.PartNumber));
  // Missing parts: keep the upload open, so a retry can resume and send them.
  if (!complete) throw new UploadError(409, "partsMissing");

  await completeMultipartUpload(file.storageKey, file.uploadId, parts);
  const head = await headObject(file.storageKey);
  if (!head || head.sizeBytes !== file.sizeBytes) {
    await deleteObject(file.storageKey).catch(() => undefined);
    await db.$transaction([
      db.caseFile.update({
        where: { id: file.id },
        data: { uploadStatus: "FAILED", uploadId: null },
      }),
      db.caseEvent.create({
        data: {
          caseId: file.caseId,
          type: "FILE_FAILED",
          actorId: user.id,
          metadata: { fileId: file.id, kind: file.kind, reason: "sizeMismatch" },
        },
      }),
    ]);
    throw new UploadError(422, "sizeMismatch");
  }

  const [updated] = await db.$transaction([
    db.caseFile.update({
      where: { id: file.id },
      data: {
        uploadStatus: "COMPLETE",
        uploadId: null,
        checksum: head.etag,
        completedAt: new Date(),
      },
      select: fileSelect,
    }),
    db.caseEvent.create({
      data: {
        caseId: file.caseId,
        type: "FILE_ADDED",
        actorId: user.id,
        metadata: { fileId: file.id, kind: file.kind },
      },
    }),
  ]);
  return { key: file.storageKey, file: toClientFile(updated) };
}

/**
 * Removes a file the user may remove (canRemove): aborts an unfinished upload, deletes the object,
 * then the row. R2 first, so a failure leaves the row (and a retry possible).
 */
export async function removeUpload(user: Uploader, fileId: string) {
  const file = await reachableFile(user, fileId);
  deny(
    canRemove({
      actor: user.role,
      status: file.status,
      kind: file.kind,
      plan: file.planState,
      complete: file.uploadStatus === "COMPLETE",
    }),
  );
  if (file.uploadId) {
    await abortMultipartUpload(file.storageKey, file.uploadId).catch((error: unknown) => {
      if (httpStatus(error) !== 404) throw error; // already completed or aborted
    });
  }
  await deleteObject(file.storageKey); // S3 delete is idempotent: fine if nothing is there
  // Idempotent: Uppy's own abort and the UI's remove can both arrive; only the first one logs.
  await db.$transaction(async (tx) => {
    const { count } = await tx.caseFile.deleteMany({ where: { id: file.id } });
    if (count === 0) return;
    await tx.caseEvent.create({
      data: {
        caseId: file.caseId,
        type: "FILE_REMOVED",
        actorId: user.id,
        metadata: { fileId: file.id, kind: file.kind, status: file.uploadStatus },
      },
    });
  });
}

/** Intraoral scans: upper / lower / bite, or null (the dentist, while they may still add files). */
export async function setScanPart(dentistId: string, fileId: string, scanPart: ScanPart | null) {
  const { count } = await db.caseFile.updateMany({
    where: {
      id: fileId,
      kind: "INTRAORAL_SCAN",
      case: { dentistId, status: { in: [...DENTIST_UPLOAD_STATES] } },
    },
    data: { scanPart },
  });
  if (count !== 1) throw new UploadError(404, "notFound");
}

/** A finished file the user may download (canDownload). */
async function downloadable(user: Uploader, fileId: string) {
  const file = await reachableFile(user, fileId);
  if (file.uploadStatus !== "COMPLETE") throw new UploadError(404, "notFound");
  const allowed = canDownload({ actor: user.role, status: file.status, plan: file.planState });
  // A plan still being prepared doesn't exist for the dentist: 404, not 403.
  if (!allowed.ok) throw new UploadError(404, "notFound");
  return file;
}

/** A 5-minute download URL (attachment). */
export async function downloadUrl(user: Uploader, fileId: string) {
  const file = await downloadable(user, fileId);
  return presignGetObject(file.storageKey, file.fileName);
}

/** A 5-minute URL for the 3D viewer to fetch (no attachment header); 3D formats only. */
export async function viewUrl(user: Uploader, fileId: string) {
  const file = await downloadable(user, fileId);
  if (!isViewable(file.fileName)) throw new UploadError(400, "notViewable");
  return { url: await presignGetObject(file.storageKey), sizeBytes: file.sizeBytes };
}
