import "server-only";

import { db } from "@/lib/db";
import { requireAdmin } from "@/server/queries/session";

// The contact-form inbox (/admin/messages). Uncached: read state changes with every click.

export type InboxMessage = {
  id: string;
  name: string;
  clinic: string;
  email: string;
  phone: string | null;
  message: string;
  locale: string;
  read: boolean;
  createdAt: string;
};

export async function listContactMessages(): Promise<InboxMessage[]> {
  await requireAdmin();
  const rows = await db.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
  return rows.map(({ readAt, createdAt, ...m }) => ({
    ...m,
    read: readAt !== null,
    createdAt: createdAt.toISOString(),
  }));
}

export async function countUnreadContactMessages() {
  await requireAdmin();
  return db.contactMessage.count({ where: { readAt: null } });
}
