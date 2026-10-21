"use server";

import { updateTag } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  buildMediaKey,
  createUploadToken,
  deleteMedia,
  headMedia,
  isAllowedMedia,
  mediaPublicUrl,
  mediaStorageStatus,
  presignMediaPut,
  verifyUploadToken,
} from "@/lib/media-storage";
import { mediaAltSchema, mediaFinalizeSchema, mediaUploadSchema } from "@/lib/validation/admin";
import { TAGS } from "@/server/cache-tags";
import { listMediaLibrary } from "@/server/queries/admin-content";
import { AdminActionError, runAdminAction } from "@/server/services/admin-action";
import { recordAudit } from "@/server/services/audit";
import { toPublicImage } from "@/server/queries/media";

// Image uploads for the public site (admins only). Type and size are validated here, signed into the
// presigned PUT (R2 refuses a different type or length), and checked again on the stored object.

/** Step 1: a presigned PUT URL for one image. */
export async function createMediaUpload(input: z.input<typeof mediaUploadSchema>) {
  return runAdminAction(mediaUploadSchema, input, async (data, actor) => {
    if (!mediaStorageStatus().configured) throw new AdminActionError("notConfigured");
    const key = buildMediaKey(data.contentType);
    const url = await presignMediaPut(key, data.contentType, data.sizeBytes);
    const token = createUploadToken({
      key,
      contentType: data.contentType,
      sizeBytes: data.sizeBytes,
      width: data.width,
      height: data.height,
      userId: actor.id,
    });
    return { key, url, token, headers: { "Content-Type": data.contentType } };
  });
}

/** Step 2 (after the browser's PUT succeeded): verify the stored object and record the asset. */
export async function finalizeMediaUpload(input: z.input<typeof mediaFinalizeSchema>) {
  return runAdminAction(mediaFinalizeSchema, input, async ({ key, token, alt }, actor) => {
    if (!mediaStorageStatus().configured) throw new AdminActionError("notConfigured");
    const claims = verifyUploadToken(token, key, actor.id);
    if (!claims) throw new AdminActionError("notAllowed");

    const stored = await headMedia(key);
    if (!stored) throw new AdminActionError("notFound");
    if (
      !isAllowedMedia(stored.contentType, stored.sizeBytes) ||
      stored.contentType !== claims.contentType ||
      stored.sizeBytes !== claims.sizeBytes
    ) {
      await deleteMedia(key).catch(() => {});
      throw new AdminActionError("invalid", { file: "imageRejected" });
    }

    const asset = await db.$transaction(async (tx) => {
      const created = await tx.mediaAsset.create({
        data: {
          key,
          url: mediaPublicUrl(key),
          width: claims.width,
          height: claims.height,
          contentType: stored.contentType,
          sizeBytes: stored.sizeBytes,
          alt,
          uploadedById: actor.id,
        },
      });
      await recordAudit(tx, {
        actor,
        action: "MEDIA_UPLOADED",
        targetType: "media",
        targetId: created.id,
        label: alt.en,
        extra: { key, sizeBytes: stored.sizeBytes, contentType: stored.contentType },
      });
      return created;
    });
    return toPublicImage(asset);
  });
}

export async function updateMediaAlt(input: z.input<typeof mediaAltSchema>) {
  return runAdminAction(mediaAltSchema, input, async ({ id, alt }, actor) => {
    const updated = await db.$transaction(async (tx) => {
      const before = await tx.mediaAsset.findUnique({ where: { id }, select: { alt: true } });
      if (!before) throw new AdminActionError("notFound");
      const after = await tx.mediaAsset.update({ where: { id }, data: { alt } });
      await recordAudit(tx, {
        actor,
        action: "CONTENT_UPDATED",
        targetType: "media",
        targetId: id,
        label: alt.en,
        before: { alt: before.alt },
        after: { alt },
      });
      return after;
    });
    // Alt text shows wherever the image is used.
    updateTag(TAGS.media);
    return toPublicImage(updated);
  });
}

/** The picker's library (most recent uploads). */
export async function listMedia() {
  return runAdminAction(z.object({}), {}, async () => ({
    configured: mediaStorageStatus().configured,
    items: await listMediaLibrary(),
  }));
}
