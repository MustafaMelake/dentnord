import "server-only";

import { env } from "@/env";
import type { ScanPart } from "@/generated/prisma/enums";
import {
  buildCaseFileKey,
  checkCaseUpload,
  type DentistFileKind,
  expectedPartSize,
  guessScanPart,
  partCount,
  sanitizeFileName,
} from "@/lib/case-files";
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
import { toClientFile } from "@/server/queries/cases";

// Case-file uploads (dentist) and downloads (dentist or admin). The browser only PUTs parts to signed
// R2 URLs; everything else happens here. Every function takes the user id from the DB-checked
// session and looks the file up through its case, so a foreign file, a submitted case or a finished
// upload is simply "not found". Keys and R2 upload ids never come from the client.

export class UploadError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

/** A draft can hold this many files (all slots together); plenty for CBCT + scans + photos. */
export const MAX_FILES_PER_CASE = 40;

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

/** Registers a file: checks it, creates the multipart upload in R2 and the CaseFile row (UPLOADING). */
export async function registerUpload(
  dentistId: string,
  input: { caseId: string; kind: string; fileName: string; sizeBytes: number },
) {
  const check = checkCaseUpload(input.kind, input.fileName, input.sizeBytes);
  if (!check.ok) throw new UploadError(400, check.reason);
  const kind = input.kind as DentistFileKind; // checkCaseUpload accepted it

  const draft = await db.case.findFirst({
    where: { id: input.caseId, dentistId, status: "DRAFT" },
    select: { id: true, _count: { select: { files: true } } },
  });
  if (!draft) throw new UploadError(404, "notFound");
  if (draft._count.files >= MAX_FILES_PER_CASE) throw new UploadError(400, "tooManyFiles");

  const fileId = crypto.randomUUID();
  const fileName = sanitizeFileName(input.fileName);
  const key = buildCaseFileKey({ prefix: env.R2_KEY_PREFIX, caseId: draft.id, fileId, fileName });
  const { uploadId } = await createMultipartUpload(key, check.mimeType);
  try {
    const file = await db.caseFile.create({
      data: {
        id: fileId,
        caseId: draft.id,
        kind,
        storageKey: key,
        fileName,
        sizeBytes: BigInt(input.sizeBytes),
        mimeType: check.mimeType,
        uploadStatus: "UPLOADING",
        uploadId,
        scanPart: kind === "INTRAORAL_SCAN" ? guessScanPart(input.fileName) : null,
        uploadedById: dentistId,
      },
      select: fileSelect,
    });
    return { key, file: toClientFile(file) };
  } catch (error) {
    await abortMultipartUpload(key, uploadId).catch(() => undefined);
    throw error;
  }
}

/** One of the dentist's own uploads that is still in progress, in one of their DRAFT cases. */
async function ownUploading(dentistId: string, fileId: string) {
  const file = await db.caseFile.findFirst({
    where: { id: fileId, uploadStatus: "UPLOADING", case: { dentistId, status: "DRAFT" } },
    select: {
      id: true,
      caseId: true,
      kind: true,
      storageKey: true,
      uploadId: true,
      sizeBytes: true,
    },
  });
  if (!file?.uploadId) throw new UploadError(404, "notFound");
  return { ...file, uploadId: file.uploadId, sizeBytes: Number(file.sizeBytes) };
}

/** A signed URL for one part, with the part's exact size signed in (15 minutes). */
export async function signPart(dentistId: string, fileId: string, partNumber: number) {
  const file = await ownUploading(dentistId, fileId);
  const size = expectedPartSize(file.sizeBytes, partNumber);
  if (size === null) throw new UploadError(400, "partNumber");
  return presignUploadPart(file.storageKey, file.uploadId, partNumber, size);
}

/** Parts already in R2 (Uppy resumes from these after a pause, a retry or a lost connection). */
export async function listParts(dentistId: string, fileId: string) {
  const file = await ownUploading(dentistId, fileId);
  return listUploadParts(file.storageKey, file.uploadId);
}

/**
 * Finishes an upload. Uses the parts R2 has (never a client-sent list), checks every part's size,
 * completes, then HEADs the object: COMPLETE only if R2 holds exactly the declared size. A mismatch
 * deletes the object and marks the file FAILED.
 */
export async function completeUpload(dentistId: string, fileId: string) {
  const file = await ownUploading(dentistId, fileId);
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
          actorId: dentistId,
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
        actorId: dentistId,
        metadata: { fileId: file.id, kind: file.kind },
      },
    }),
  ]);
  return { key: file.storageKey, file: toClientFile(updated) };
}

/**
 * Removes a file from one of the dentist's drafts, whatever its state: aborts an unfinished upload,
 * deletes the object, then the row. R2 first, so a failure leaves the row (and a retry possible).
 */
export async function removeUpload(dentistId: string, fileId: string) {
  const file = await db.caseFile.findFirst({
    where: { id: fileId, case: { dentistId, status: "DRAFT" } },
    select: {
      id: true,
      caseId: true,
      kind: true,
      storageKey: true,
      uploadId: true,
      uploadStatus: true,
    },
  });
  if (!file) throw new UploadError(404, "notFound");
  if (file.uploadId) {
    await abortMultipartUpload(file.storageKey, file.uploadId).catch((error: unknown) => {
      if (httpStatus(error) !== 404) throw error; // already completed or aborted
    });
  }
  await deleteObject(file.storageKey); // S3 delete is idempotent: fine if nothing is there
  // Idempotent: Uppy's own abort and the wizard's remove can both arrive; only the first one logs.
  await db.$transaction(async (tx) => {
    const { count } = await tx.caseFile.deleteMany({ where: { id: file.id } });
    if (count === 0) return;
    await tx.caseEvent.create({
      data: {
        caseId: file.caseId,
        type: "FILE_REMOVED",
        actorId: dentistId,
        metadata: { fileId: file.id, kind: file.kind, status: file.uploadStatus },
      },
    });
  });
}

/** Intraoral scans: upper / lower / bite, or null. */
export async function setScanPart(dentistId: string, fileId: string, scanPart: ScanPart | null) {
  const { count } = await db.caseFile.updateMany({
    where: { id: fileId, kind: "INTRAORAL_SCAN", case: { dentistId, status: "DRAFT" } },
    data: { scanPart },
  });
  if (count !== 1) throw new UploadError(404, "notFound");
}

/**
 * A 5-minute download URL for a finished file. Dentists: their own cases (any status). The admin:
 * any submitted case (drafts stay private to the dentist).
 */
export async function downloadUrl(user: { id: string; role: "ADMIN" | "DENTIST" }, fileId: string) {
  const file = await db.caseFile.findFirst({
    where: {
      id: fileId,
      uploadStatus: "COMPLETE",
      case: user.role === "ADMIN" ? { status: { not: "DRAFT" } } : { dentistId: user.id },
    },
    select: { storageKey: true, fileName: true },
  });
  if (!file) throw new UploadError(404, "notFound");
  return presignGetObject(file.storageKey, file.fileName);
}
