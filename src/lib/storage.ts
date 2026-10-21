import "server-only";

import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/env";
import { requireR2Client } from "@/lib/r2";

// Case files: private R2 bucket R2_CASES_BUCKET (EU jurisdiction), client in lib/r2.ts.
// The bucket is private. The browser uploads directly via presigned URLs (files never pass through
// Next.js), and downloads only through short-lived signed GET URLs.
// The bucket needs a CORS rule allowing PUT from NEXT_PUBLIC_SITE_URL and exposing the `ETag` header.

export const SIGNED_URL_TTL_SECONDS = 5 * 60;
export const UPLOAD_PART_URL_TTL_SECONDS = 15 * 60;

const Bucket = env.R2_CASES_BUCKET;

/** cases/<caseId>/<kind>/<random>-<sanitised file name> */
export function buildCaseFileKey(caseId: string, kind: string, fileName: string) {
  const safeName = fileName
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .slice(-120);
  return `cases/${caseId}/${kind.toLowerCase()}/${crypto.randomUUID()}-${safeName}`;
}

// ── Single-request upload (small files) ──────────────────────────────────────

export function presignPutObject(key: string, contentType: string) {
  return getSignedUrl(
    requireR2Client(),
    new PutObjectCommand({ Bucket, Key: key, ContentType: contentType }),
    {
      expiresIn: UPLOAD_PART_URL_TTL_SECONDS,
    },
  );
}

// ── Multipart upload (large files, resumable; used by Uppy @uppy/aws-s3) ─────

export async function createMultipartUpload(key: string, contentType: string) {
  const res = await requireR2Client().send(
    new CreateMultipartUploadCommand({ Bucket, Key: key, ContentType: contentType }),
  );
  if (!res.UploadId) throw new Error("R2 did not return an UploadId");
  return { key, uploadId: res.UploadId };
}

export function presignUploadPart(key: string, uploadId: string, partNumber: number) {
  return getSignedUrl(
    requireR2Client(),
    new UploadPartCommand({ Bucket, Key: key, UploadId: uploadId, PartNumber: partNumber }),
    { expiresIn: UPLOAD_PART_URL_TTL_SECONDS },
  );
}

export async function listUploadParts(key: string, uploadId: string) {
  const parts: { PartNumber: number; Size: number; ETag: string }[] = [];
  let marker: string | undefined;
  do {
    const res = await requireR2Client().send(
      new ListPartsCommand({ Bucket, Key: key, UploadId: uploadId, PartNumberMarker: marker }),
    );
    for (const p of res.Parts ?? []) {
      if (p.PartNumber && p.ETag) {
        parts.push({ PartNumber: p.PartNumber, Size: p.Size ?? 0, ETag: p.ETag });
      }
    }
    marker = res.IsTruncated ? res.NextPartNumberMarker : undefined;
  } while (marker);
  return parts;
}

export function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: { PartNumber: number; ETag: string }[],
) {
  return requireR2Client().send(
    new CompleteMultipartUploadCommand({
      Bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: [...parts].sort((a, b) => a.PartNumber - b.PartNumber) },
    }),
  );
}

export function abortMultipartUpload(key: string, uploadId: string) {
  return requireR2Client().send(
    new AbortMultipartUploadCommand({ Bucket, Key: key, UploadId: uploadId }),
  );
}

// ── Download / delete ────────────────────────────────────────────────────────

/** Short-lived download URL. Always authorise the user against the case first. */
export function presignGetObject(key: string, downloadFileName?: string) {
  return getSignedUrl(
    requireR2Client(),
    new GetObjectCommand({
      Bucket,
      Key: key,
      ResponseContentDisposition: downloadFileName
        ? `attachment; filename*=UTF-8''${encodeURIComponent(downloadFileName)}`
        : undefined,
    }),
    { expiresIn: SIGNED_URL_TTL_SECONDS },
  );
}

export function deleteObject(key: string) {
  return requireR2Client().send(new DeleteObjectCommand({ Bucket, Key: key }));
}
