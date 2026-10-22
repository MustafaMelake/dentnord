import "server-only";

import { auth } from "@/lib/auth";
import { caseStorageConfigured } from "@/lib/storage";
import { UploadError } from "@/server/services/case-uploads";
import { rateLimit, UPLOAD_LIMITS } from "@/server/services/rate-limit";

// Shared checks for /api/uploads/*. Route Handlers answer with status codes instead of redirecting.
// Order in every route: session (DB-checked) → role/status → per-user rate limit → zod → the service,
// which checks ownership, case status and the file row itself (server/services/case-uploads.ts).

export async function getUploadSession(request: Request) {
  // Same as the DAL: DB-backed, and never writes cookies.
  return auth.api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true, disableRefresh: true },
  });
}

export type UploadUser = { id: string; role: "ADMIN" | "DENTIST" };

/**
 * Who may call an upload route: an APPROVED dentist for uploads ("write"); an approved dentist or the
 * admin for downloads ("read"). Returns the user, or the Response to send back.
 */
export async function requireUploadUser(
  request: Request,
  access: "write" | "read",
  limit: keyof typeof UPLOAD_LIMITS,
): Promise<UploadUser | Response> {
  const session = await getUploadSession(request);
  if (!session) return error(401, "unauthorized");
  const { id, role, dentistStatus } = session.user as {
    id: string;
    role: string;
    dentistStatus: string;
  };
  const isAdmin = role === "ADMIN";
  const isDentist = role === "DENTIST" && dentistStatus === "APPROVED";
  // The admin can read case files but never upload to (or delete from) a dentist's draft.
  if (!(isDentist || (isAdmin && access === "read"))) return error(403, "forbidden");
  if (!caseStorageConfigured()) return error(503, "notConfigured");
  const { allowed } = await rateLimit(`uploads:${limit}:${id}`, UPLOAD_LIMITS[limit]);
  if (!allowed) return error(429, "rateLimited", { "Retry-After": "60" });
  return { id, role: isAdmin ? "ADMIN" : "DENTIST" };
}

const FILE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Path ids are our own CaseFile ids (never R2's upload id); reject anything else before the DB. */
export const isFileId = (value: string) => FILE_ID.test(value);

/** Runs a route body: UploadError → its status; anything else → 500 without details (no file names in logs). */
export async function respond(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof UploadError) return error(e.status, e.code);
    console.error("[uploads]", e instanceof Error ? e.name : "error", httpStatusOf(e) ?? "");
    return error(500, "storage");
  }
}

const httpStatusOf = (e: unknown) =>
  (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;

const NO_STORE = { "Cache-Control": "no-store" };

/** JSON error; the code is repeated in x-amz-error-code, which Uppy's S3 client puts in its error. */
export function error(status: number, code: string, headers: Record<string, string> = {}) {
  return Response.json(
    { error: code },
    { status, headers: { ...NO_STORE, "x-amz-error-code": code, ...headers } },
  );
}

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: NO_STORE });
}

/** S3-style XML for the Uppy S3 client, which parses list/complete responses as S3 would send them. */
export function xml(body: string, status = 200) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`, {
    status,
    headers: { ...NO_STORE, "Content-Type": "application/xml" },
  });
}

export const escapeXml = (s: string) =>
  s.replace(
    /[<>&'"]/g,
    (c) => `&${{ "<": "lt", ">": "gt", "&": "amp", "'": "apos", '"': "quot" }[c]};`,
  );
