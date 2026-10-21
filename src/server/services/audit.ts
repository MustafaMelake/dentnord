import "server-only";

import type { AuditAction } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

// Append-only audit trail for admin changes: who, what, when, and a before/after summary of the
// fields that changed (values shortened, so the log stays small and readable).

type Client = Pick<typeof db, "auditLog">;

const MAX_VALUE_LENGTH = 160;

function short(value: unknown): Prisma.InputJsonValue | null {
  if (value === undefined || value === null) return null;
  const json = typeof value === "string" ? value : JSON.stringify(value);
  return json.length > MAX_VALUE_LENGTH ? `${json.slice(0, MAX_VALUE_LENGTH)}…` : json;
}

/** Fields whose value differs between `before` and `after` (shallow, by JSON). */
export function changedFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
) {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const changes: {
    field: string;
    before: Prisma.InputJsonValue | null;
    after: Prisma.InputJsonValue | null;
  }[] = [];
  for (const field of keys) {
    const a = before?.[field];
    const b = after?.[field];
    if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) {
      changes.push({ field, before: short(a), after: short(b) });
    }
  }
  return changes;
}

export async function recordAudit(
  client: Client,
  entry: {
    actor: { id: string; email: string };
    action: AuditAction;
    /** Model name ("service", "testimonial", …) or "setting:<key>" / "media". */
    targetType: string;
    targetId: string;
    /** Human-readable, e.g. "Surgical guide". */
    label?: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    extra?: Record<string, Prisma.InputJsonValue>;
  },
) {
  const changes =
    entry.before !== undefined || entry.after !== undefined
      ? changedFields(entry.before ?? null, entry.after ?? null)
      : [];
  await client.auditLog.create({
    data: {
      action: entry.action,
      actorId: entry.actor.id,
      actorEmail: entry.actor.email,
      targetType: entry.targetType,
      targetId: entry.targetId,
      metadata: {
        ...(entry.label ? { label: entry.label } : {}),
        ...(changes.length ? { changes } : {}),
        ...entry.extra,
      },
    },
  });
}
