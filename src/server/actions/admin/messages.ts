"use server";

import { z } from "zod";

import { db } from "@/lib/db";
import { AdminActionError, runAdminAction } from "@/server/services/admin-action";
import { recordAudit } from "@/server/services/audit";

// The contact-form inbox (/admin/messages). The audit trail records who read or deleted which
// message, never its text.

const idSchema = z.string().trim().min(1).max(64);
const readSchema = z.object({ id: idSchema, read: z.boolean() });
const deleteSchema = z.object({ id: idSchema });

export async function setContactMessageRead(input: z.input<typeof readSchema>) {
  return runAdminAction(readSchema, input, async ({ id, read }, actor) => {
    await db.$transaction(async (tx) => {
      const before = await tx.contactMessage.findUnique({
        where: { id },
        select: { name: true, readAt: true },
      });
      if (!before) throw new AdminActionError("notFound");
      if (!!before.readAt === read) return;
      await tx.contactMessage.update({ where: { id }, data: { readAt: read ? new Date() : null } });
      await recordAudit(tx, {
        actor,
        action: "CONTENT_UPDATED",
        targetType: "contact_message",
        targetId: id,
        label: before.name,
        before: { read: !!before.readAt },
        after: { read },
      });
    });
  });
}

export async function deleteContactMessage(input: z.input<typeof deleteSchema>) {
  return runAdminAction(deleteSchema, input, async ({ id }, actor) => {
    await db.$transaction(async (tx) => {
      const message = await tx.contactMessage.findUnique({
        where: { id },
        select: { name: true, clinic: true, email: true, createdAt: true },
      });
      if (!message) throw new AdminActionError("notFound");
      await tx.contactMessage.delete({ where: { id } });
      await recordAudit(tx, {
        actor,
        action: "CONTENT_DELETED",
        targetType: "contact_message",
        targetId: id,
        label: message.name,
        extra: {
          clinic: message.clinic,
          email: message.email,
          receivedAt: message.createdAt.toISOString(),
        },
      });
    });
  });
}
