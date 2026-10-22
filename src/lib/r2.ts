import "server-only";

import { S3Client } from "@aws-sdk/client-s3";

import { env } from "@/env";
import { r2Endpoint } from "@/lib/r2-endpoint";

// Shared Cloudflare R2 client (S3-compatible). The endpoint follows R2_JURISDICTION (default "eu":
// EU-jurisdiction buckets are only reachable at <account>.eu.r2.cloudflarestorage.com).
// R2 credentials have fixed shapes; anything else (empty, "placeholder", …) counts as not configured,
// and callers degrade gracefully instead of failing at import time.

const R2_ACCOUNT_ID = /^[0-9a-f]{32}$/i;
const R2_ACCESS_KEY_ID = /^[0-9a-f]{32}$/i;
const R2_SECRET = /^[0-9a-f]{64}$/i;

export function r2Credentials() {
  const { R2_ACCOUNT_ID: account, R2_ACCESS_KEY_ID: keyId, R2_SECRET_ACCESS_KEY: secret } = env;
  if (!account || !R2_ACCOUNT_ID.test(account)) return null;
  if (!keyId || !R2_ACCESS_KEY_ID.test(keyId)) return null;
  if (!secret || !R2_SECRET.test(secret)) return null;
  return { account, keyId, secret };
}

let client: S3Client | null = null;

/** The R2 client, or null when the credentials are missing or placeholders. */
export function getR2Client() {
  if (client) return client;
  const creds = r2Credentials();
  if (!creds) return null;
  client = new S3Client({
    region: "auto",
    endpoint: r2Endpoint(creds.account, env.R2_JURISDICTION),
    credentials: { accessKeyId: creds.keyId, secretAccessKey: creds.secret },
    // Newer SDKs add CRC32 checksums by default, which breaks browser uploads to presigned R2 URLs.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client;
}

export function requireR2Client() {
  const c = getR2Client();
  if (!c)
    throw new Error(
      "R2 is not configured (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY)",
    );
  return c;
}
