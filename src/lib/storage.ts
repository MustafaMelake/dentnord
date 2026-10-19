import "server-only";

import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/env";

// Cloudflare R2 (S3-compatible), bucket created with EU jurisdiction → `.eu.` endpoint.
// The bucket is private. The browser uploads directly via presigned URLs (files never pass through
// Next.js), and downloads only through short-lived signed GET URLs.
// The bucket needs a CORS rule allowing PUT from NEXT_PUBLIC_SITE_URL and exposing the `ETag` header.

export const SIGNED_URL_TTL_SECONDS = 5 * 60;
export const UPLOAD_PART_URL_TTL_SECONDS = 15 * 60;

export const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
  // Newer SDKs add CRC32 checksums by default, which breaks browser uploads to presigned R2 URLs.
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

const Bucket = env.R2_BUCKET;

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
  return getSignedUrl(s3, new PutObjectCommand({ Bucket, Key: key, ContentType: contentType }), {
    expiresIn: UPLOAD_PART_URL_TTL_SECONDS,
  });
}

// ── Multipart upload (large files, resumable; used by Uppy @uppy/aws-s3) ─────

export async function createMultipartUpload(key: string, contentType: string) {
  const res = await s3.send(
    new CreateMultipartUploadCommand({ Bucket, Key: key, ContentType: contentType }),
  );
  if (!res.UploadId) throw new Error("R2 did not return an UploadId");
  return { key, uploadId: res.UploadId };
}

export function presignUploadPart(key: string, uploadId: string, partNumber: number) {
  return getSignedUrl(
    s3,
    new UploadPartCommand({ Bucket, Key: key, UploadId: uploadId, PartNumber: partNumber }),
    { expiresIn: UPLOAD_PART_URL_TTL_SECONDS },
  );
}

export async function listUploadParts(key: string, uploadId: string) {
  const parts: { PartNumber: number; Size: number; ETag: string }[] = [];
  let marker: string | undefined;
  do {
    const res = await s3.send(
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
  return s3.send(
    new CompleteMultipartUploadCommand({
      Bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: [...parts].sort((a, b) => a.PartNumber - b.PartNumber) },
    }),
  );
}

export function abortMultipartUpload(key: string, uploadId: string) {
  return s3.send(new AbortMultipartUploadCommand({ Bucket, Key: key, UploadId: uploadId }));
}

// ── Download / delete ────────────────────────────────────────────────────────

/** Short-lived download URL. Always authorise the user against the case first. */
export function presignGetObject(key: string, downloadFileName?: string) {
  return getSignedUrl(
    s3,
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
  return s3.send(new DeleteObjectCommand({ Bucket, Key: key }));
}
