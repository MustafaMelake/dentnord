"use server";

import { z } from "zod";

import { db } from "@/lib/db";
import { serviceSchema, slugify } from "@/lib/validation/admin";
import { runAdminAction } from "@/server/services/admin-action";
import { recordAudit } from "@/server/services/audit";
import { invalidate, nextSortOrder } from "@/server/services/content-admin";

const input = serviceSchema.extend({ id: z.string().trim().max(64).nullable() });

/** Create (id = null) or update a service. */
export async function saveService(data: z.input<typeof input>) {
  return runAdminAction(
    input,
    data,
    async ({ id, title, summary, description, price, priceNote, imageId, published }, actor) => {
      const fields = {
        title,
        summary,
        description,
        priceAmount: price.priceAmount,
        priceFrom: price.priceFrom,
        priceNote,
        imageId,
        published,
      };
      const savedId = await db.$transaction(async (tx) => {
        if (id) {
          const before = await tx.service.findUniqueOrThrow({ where: { id }, select: auditSelect });
          const after = await tx.service.update({
            where: { id },
            data: fields,
            select: auditSelect,
          });
          await recordAudit(tx, {
            actor,
            action: "CONTENT_UPDATED",
            targetType: "service",
            targetId: id,
            label: title.en || title.da,
            before,
            after,
          });
          return id;
        }
        const created = await tx.service.create({
          data: {
            ...fields,
            slug: await uniqueSlug(tx, title.en || title.da),
            sortOrder: await nextSortOrder("service"),
          },
          select: { ...auditSelect, id: true },
        });
        await recordAudit(tx, {
          actor,
          action: "CONTENT_CREATED",
          targetType: "service",
          targetId: created.id,
          label: title.en || title.da,
          after: created,
        });
        return created.id;
      });
      invalidate("service");
      return { id: savedId };
    },
  );
}

const auditSelect = {
  title: true,
  summary: true,
  description: true,
  priceAmount: true,
  priceFrom: true,
  priceNote: true,
  imageId: true,
  published: true,
} as const;

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

async function uniqueSlug(tx: Tx, title: string) {
  const base = slugify(title) || "service";
  for (let n = 1; ; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    if (!(await tx.service.findUnique({ where: { slug }, select: { id: true } }))) return slug;
  }
}
