import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/env";
import { getR2Client, requireR2Client } from "@/lib/r2";
import { MEDIA_MAX_BYTES, MEDIA_TYPES, type MediaType } from "@/lib/validation/admin";

// Public site images: R2 bucket R2_MEDIA_BUCKET (public read, EU jurisdiction), served from
// R2_MEDIA_PUBLIC_URL. Flow: admin asks for a presigned PUT (type + size are signed, so R2 rejects
// anything else) → browser uploads directly → admin finalises: we HEAD the object, re-check type and
// size, and only then record a MediaAsset. File bytes never pass through Next.js.

const UPLOAD_TTL_SECONDS = 10 * 60;

/** Configured = real R2 credentials + a public https URL for the bucket. */
export function mediaStorageStatus():
  { configured: true; publicUrl: string } | { configured: false } {
  const publicUrl = env.R2_MEDIA_PUBLIC_URL;
  if (!getR2Client() || !publicUrl) return { configured: false };
  const url = new URL(publicUrl);
  if (url.protocol !== "https:" || /placeholder|example/i.test(url.hostname))
    return { configured: false };
  return { configured: true, publicUrl: publicUrl.replace(/\/+$/, "") };
}

export function mediaPublicUrl(key: string) {
  const status = mediaStorageStatus();
  if (!status.configured) throw new Error("Media storage is not configured");
  return `${status.publicUrl}/${key}`;
}

/** media/2026/10/<uuid>.webp */
export function buildMediaKey(contentType: MediaType) {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `media/${now.getUTCFullYear()}/${month}/${crypto.randomUUID()}.${MEDIA_TYPES[contentType]}`;
}

export function presignMediaPut(key: string, contentType: MediaType, sizeBytes: number) {
  return getSignedUrl(
    requireR2Client(),
    new PutObjectCommand({
      Bucket: env.R2_MEDIA_BUCKET,
      Key: key,
      ContentType: contentType,
      ContentLength: sizeBytes,
      CacheControl: "public, max-age=31536000, immutable",
    }),
    { expiresIn: UPLOAD_TTL_SECONDS, signableHeaders: new Set(["content-type", "content-length"]) },
  );
}

/** What R2 actually stored, or null if the object doesn't exist. */
export async function headMedia(key: string) {
  try {
    const res = await requireR2Client().send(
      new HeadObjectCommand({ Bucket: env.R2_MEDIA_BUCKET, Key: key }),
    );
    return { sizeBytes: res.ContentLength ?? 0, contentType: res.ContentType ?? "" };
  } catch {
    return null;
  }
}

export function deleteMedia(key: string) {
  return requireR2Client().send(new DeleteObjectCommand({ Bucket: env.R2_MEDIA_BUCKET, Key: key }));
}

export function isAllowedMedia(contentType: string, sizeBytes: number) {
  return contentType in MEDIA_TYPES && sizeBytes > 0 && sizeBytes <= MEDIA_MAX_BYTES;
}

// ── Upload tokens ─────────────────────────────────────────────────────────────
// Binds "finalise" to an upload we presigned for this admin, with these dimensions, recently.

export type UploadClaims = {
  key: string;
  contentType: MediaType;
  sizeBytes: number;
  width: number;
  height: number;
  userId: string;
  exp: number;
};

const sign = (payload: string) =>
  createHmac("sha256", `${env.BETTER_AUTH_SECRET}:media-upload`)
    .update(payload)
    .digest("base64url");

export function createUploadToken(claims: Omit<UploadClaims, "exp">) {
  const payload = Buffer.from(
    JSON.stringify({ ...claims, exp: Date.now() + UPLOAD_TTL_SECONDS * 1000 }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyUploadToken(token: string, key: string, userId: string): UploadClaims | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as UploadClaims;
  if (claims.key !== key || claims.userId !== userId || claims.exp < Date.now()) return null;
  return claims;
}
