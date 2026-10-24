import "server-only";

import type { Actor } from "@/lib/case-workflow-rules";
import { db } from "@/lib/db";
import { messageBodySchema, withinEditWindow } from "@/lib/validation/messages";
import { rateLimit } from "@/server/services/rate-limit";

// Case messages. Two threads per case:
// - the case thread, between the dentist and Dentnord
// - internal notes, admin only: every query for a dentist hard-codes `internal: false`, and only
//   an ADMIN actor can read or write internal notes. A dentist asking for them gets "not found".
// Scope: a dentist only reaches their own cases; nobody messages on a draft.

export type MessageActor = { id: string; role: Actor };

export class MessageError extends Error {
  constructor(
    readonly code: "notFound" | "invalid" | "rateLimited" | "editWindow" | "forbidden",
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(code);
  }
}

export const MESSAGE_RATE = { max: 10, windowMs: 60_000 };

async function reachableCase(actor: MessageActor, caseId: string) {
  const c = await db.case.findFirst({
    where: {
      id: caseId,
      status: { not: "DRAFT" },
      ...(actor.role === "DENTIST" ? { dentistId: actor.id } : {}),
    },
    select: { id: true },
  });
  if (!c) throw new MessageError("notFound");
  return c;
}

/** Only an admin may touch internal notes; for a dentist they don't exist. */
function threadFilter(actor: MessageActor, internal: boolean) {
  if (internal && actor.role !== "ADMIN") throw new MessageError("notFound");
  return { internal: actor.role === "ADMIN" ? internal : false };
}

const messageSelect = {
  id: true,
  body: true,
  authorRole: true,
  authorId: true,
  internal: true,
  readAt: true,
  editedAt: true,
  createdAt: true,
  author: { select: { name: true, clinicName: true } },
} as const;

export async function listMessages(actor: MessageActor, caseId: string, internal = false) {
  await reachableCase(actor, caseId);
  const rows = await db.caseMessage.findMany({
    where: { caseId, ...threadFilter(actor, internal) },
    orderBy: { createdAt: "asc" },
    take: 500,
    select: messageSelect,
  });
  return rows.map((m) => ({
    id: m.id,
    body: m.body,
    authorRole: m.authorRole,
    mine: m.authorId === actor.id,
    authorName: m.author?.name ?? null,
    readAt: m.readAt?.toISOString() ?? null,
    editedAt: m.editedAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
  }));
}
export type CaseMessageView = Awaited<ReturnType<typeof listMessages>>[number];

export async function sendMessage(
  actor: MessageActor,
  input: { caseId: string; body: unknown; internal?: boolean },
) {
  const internal = input.internal === true;
  const filter = threadFilter(actor, internal);
  const body = messageBodySchema.safeParse(input.body);
  if (!body.success) throw new MessageError("invalid", { body: body.error.issues[0].message });
  await reachableCase(actor, input.caseId);
  const { allowed } = await rateLimit(`messages:${actor.id}`, MESSAGE_RATE);
  if (!allowed) throw new MessageError("rateLimited");
  return db.caseMessage.create({
    data: {
      caseId: input.caseId,
      authorId: actor.id,
      authorRole: actor.role,
      body: body.data,
      internal: filter.internal,
    },
    select: { id: true, internal: true },
  });
}

/** The author's own message, in a case they can reach, within 5 minutes. */
async function ownEditable(actor: MessageActor, messageId: string) {
  const m = await db.caseMessage.findFirst({
    where: {
      id: messageId,
      authorId: actor.id,
      case: {
        status: { not: "DRAFT" },
        ...(actor.role === "DENTIST" ? { dentistId: actor.id } : {}),
      },
      ...(actor.role === "DENTIST" ? { internal: false } : {}),
    },
    select: { id: true, createdAt: true },
  });
  if (!m) throw new MessageError("notFound");
  if (!withinEditWindow(m.createdAt)) throw new MessageError("editWindow");
  return m;
}

export async function editMessage(
  actor: MessageActor,
  input: { messageId: string; body: unknown },
) {
  const body = messageBodySchema.safeParse(input.body);
  if (!body.success) throw new MessageError("invalid", { body: body.error.issues[0].message });
  const m = await ownEditable(actor, input.messageId);
  // Guarded again in the WHERE, so a slow request can't slip past the window.
  const { count } = await db.caseMessage.updateMany({
    where: { id: m.id, createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } },
    data: { body: body.data, editedAt: new Date() },
  });
  if (count !== 1) throw new MessageError("editWindow");
}

export async function deleteMessage(actor: MessageActor, messageId: string) {
  const m = await ownEditable(actor, messageId);
  const { count } = await db.caseMessage.deleteMany({
    where: { id: m.id, createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } },
  });
  if (count !== 1) throw new MessageError("editWindow");
}

/** Opening the case thread marks the other side's messages as read. */
export async function markRead(actor: MessageActor, caseId: string) {
  await reachableCase(actor, caseId);
  await db.caseMessage.updateMany({
    where: { caseId, internal: false, authorRole: { not: actor.role }, readAt: null },
    data: { readAt: new Date() },
  });
}

/** Unread messages from the other side, per case (for list badges) and in total (sidebar). */
export async function unreadCounts(actor: MessageActor) {
  const groups = await db.caseMessage.groupBy({
    by: ["caseId"],
    where: {
      internal: false,
      readAt: null,
      authorRole: actor.role === "ADMIN" ? "DENTIST" : "ADMIN",
      case:
        actor.role === "DENTIST"
          ? { dentistId: actor.id, status: { not: "DRAFT" } }
          : { status: { not: "DRAFT" } },
    },
    _count: { _all: true },
  });
  const perCase = Object.fromEntries(groups.map((g) => [g.caseId, g._count._all]));
  const total = groups.reduce((sum, g) => sum + g._count._all, 0);
  return { perCase, total };
}
