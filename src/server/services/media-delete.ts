import "server-only";

import { db } from "@/lib/db";
import { deleteMedia, mediaStorageStatus } from "@/lib/media-storage";
import { assertMediaUnused, MediaInUseError } from "@/lib/storage-usage";
import { toBilingual } from "@/lib/validation/admin";
import { mediaUsages } from "@/server/queries/admin-storage";
import { AdminActionError, type Actor } from "@/server/services/admin-action";
import { recordAudit } from "@/server/services/audit";

// Deleting an unused site image (/admin/storage). Only the id comes from the client: the R2 key is
// read from the row, and "unused" is checked again here, with the row locked. The R2 object is
// deleted last inside the transaction, so a storage failure rolls the row (and the audit entry) back.
// Portfolio images also have an onDelete: Restrict foreign key; services would be SetNull, which is
// why the check, not the schema, is what protects them.

export async function deleteUnusedMedia({ actor, id }: { actor: Actor; id: string }) {
  if (!mediaStorageStatus().configured) throw new AdminActionError("notConfigured");
  await db.$transaction(
    async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "media_asset" WHERE "id" = ${id} FOR UPDATE`;
      if (locked.length === 0) throw new AdminActionError("notFound");
      try {
        assertMediaUnused((await mediaUsages([id], tx)).get(id));
      } catch (error) {
        if (error instanceof MediaInUseError) throw new AdminActionError("inUse");
        throw error;
      }
      const asset = await tx.mediaAsset.delete({
        where: { id },
        select: { key: true, alt: true, sizeBytes: true },
      });
      await recordAudit(tx, {
        actor,
        action: "CONTENT_DELETED",
        targetType: "media",
        targetId: id,
        label: toBilingual(asset.alt).en,
        extra: { key: asset.key, sizeBytes: asset.sizeBytes },
      });
      try {
        await deleteMedia(asset.key);
      } catch {
        throw new AdminActionError("storage");
      }
    },
    { timeout: 20_000 },
  );
}
