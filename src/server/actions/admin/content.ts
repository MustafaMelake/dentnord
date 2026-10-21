"use server";

import { z } from "zod";

import { db } from "@/lib/db";
import { portfolioSchema, testimonialSchema } from "@/lib/validation/admin";
import { AdminActionError, runAdminAction } from "@/server/services/admin-action";
import { recordAudit } from "@/server/services/audit";
import { invalidate, nextSortOrder } from "@/server/services/content-admin";

// Testimonials and portfolio cases.

const nullableId = z.string().trim().max(64).nullable();

const testimonialInput = testimonialSchema.and(z.object({ id: nullableId }));

export async function saveTestimonial(data: z.input<typeof testimonialInput>) {
  return runAdminAction(
    testimonialInput,
    data,
    async ({ id, quote, authorName, clinic, consent, published }, actor) => {
      const fields = { quote, authorName, clinic: clinic || null, consent, published };
      const select = {
        quote: true,
        authorName: true,
        clinic: true,
        consent: true,
        published: true,
      } as const;
      const label = `Testimonial by ${authorName}`;
      const result = await db.$transaction(async (tx) => {
        if (id) {
          const before = await tx.testimonial.findUniqueOrThrow({ where: { id }, select });
          const after = await tx.testimonial.update({ where: { id }, data: fields, select });
          await recordAudit(tx, {
            actor,
            action: "CONTENT_UPDATED",
            targetType: "testimonial",
            targetId: id,
            label,
            before,
            after,
          });
          return id;
        }
        const created = await tx.testimonial.create({
          data: { ...fields, sortOrder: await nextSortOrder("testimonial") },
          select: { id: true, ...select },
        });
        await recordAudit(tx, {
          actor,
          action: "CONTENT_CREATED",
          targetType: "testimonial",
          targetId: created.id,
          label,
          after: created,
        });
        return created.id;
      });
      invalidate("testimonial");
      return { id: result };
    },
  );
}

const portfolioInput = portfolioSchema.extend({ id: nullableId });

export async function savePortfolioCase(data: z.input<typeof portfolioInput>) {
  return runAdminAction(portfolioInput, data, async (input, actor) => {
    const { id, slug, title, summary, guideTypeId, implantCount, images, published } = input;
    const label = title.en || title.da;
    const result = await db.$transaction(async (tx) => {
      const clash = await tx.portfolioCase.findFirst({
        where: { slug, ...(id ? { NOT: { id } } : {}) },
        select: { id: true },
      });
      if (clash) throw new AdminActionError("conflict", { slug: "slugTaken" });

      const fields = { slug, title, summary, guideTypeId, implantCount, published };
      const gallery = images.map((img, sortOrder) => ({
        mediaId: img.mediaId,
        caption: img.caption,
        sortOrder,
      }));
      const select = {
        slug: true,
        title: true,
        summary: true,
        guideTypeId: true,
        implantCount: true,
        published: true,
        publishedAt: true,
        images: {
          orderBy: { sortOrder: "asc" as const },
          select: { mediaId: true, caption: true },
        },
      };

      if (id) {
        const before = await tx.portfolioCase.findUniqueOrThrow({ where: { id }, select });
        await tx.portfolioImage.deleteMany({ where: { caseId: id } });
        const after = await tx.portfolioCase.update({
          where: { id },
          data: {
            ...fields,
            publishedAt: published && !before.publishedAt ? new Date() : undefined,
            images: { create: gallery },
          },
          select,
        });
        await recordAudit(tx, {
          actor,
          action: "CONTENT_UPDATED",
          targetType: "portfolioCase",
          targetId: id,
          label,
          before,
          after,
        });
        return id;
      }
      const created = await tx.portfolioCase.create({
        data: {
          ...fields,
          publishedAt: published ? new Date() : null,
          sortOrder: await nextSortOrder("portfolioCase"),
          images: { create: gallery },
        },
        select: { id: true, ...select },
      });
      await recordAudit(tx, {
        actor,
        action: "CONTENT_CREATED",
        targetType: "portfolioCase",
        targetId: created.id,
        label,
        after: created,
      });
      return created.id;
    });
    invalidate("portfolioCase");
    return { id: result };
  });
}
