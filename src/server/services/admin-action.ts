import "server-only";

import type { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { requireAdmin, type AuthSession } from "@/server/queries/session";

// The one entry point for admin mutations (used by every Server Action in server/actions/admin/*):
// 1. the admin check runs FIRST (DB-backed), so a non-admin, or a direct POST to the action endpoint,
//    never reaches validation or the database;
// 2. the input is parsed with the same zod schema as the form;
// 3. known failures come back as typed errors for the form (unique conflicts, missing rows).

export type FieldErrors = Record<string, string>;

type ErrorCode = "invalid" | "conflict" | "notFound" | "notAllowed" | "notConfigured";

export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: ErrorCode; fieldErrors?: FieldErrors };

/** Throw from a handler to return a typed error (and optional field errors) to the form. */
export class AdminActionError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly fieldErrors?: FieldErrors,
  ) {
    super(code);
  }
}

export type Actor = { id: string; email: string; session: AuthSession };

export function toFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const path = issue.path.map(String).join(".") || "form";
    out[path] ??= issue.message;
  }
  return out;
}

export async function runAdminAction<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  handler: (data: z.output<S>, actor: Actor) => Promise<T>,
): Promise<ActionResult<T>> {
  const session = await requireAdmin();
  const actor = { id: session.user.id, email: session.user.email, session };

  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "invalid", fieldErrors: toFieldErrors(parsed.error) };

  try {
    return { ok: true, data: await handler(parsed.data, actor) };
  } catch (error) {
    if (error instanceof AdminActionError) {
      return { ok: false, error: error.code, fieldErrors: error.fieldErrors };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") return { ok: false, error: "conflict" };
      // Foreign key: e.g. an image or guide type id that doesn't exist.
      if (error.code === "P2003") return { ok: false, error: "invalid" };
      if (error.code === "P2025") return { ok: false, error: "notFound" };
    }
    throw error;
  }
}
