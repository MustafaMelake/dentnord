import "server-only";

import { updateTag } from "next/cache";

import { db } from "@/lib/db";
import { localized } from "@/lib/utils";
import { TAGS } from "@/server/cache-tags";
import { AdminActionError, type Actor } from "@/server/services/admin-action";
import { recordAudit } from "@/server/services/audit";

// List operations shared by every admin content list: reorder, publish/active toggle, and delete
// (or archive, when the row is referenced by cases). Each writes an audit entry in the same
// transaction and invalidates the public cache tag. Call only from admin Server Actions.

export const CONTENT_MODELS = [
  "service",
  "guideType",
  "implantSystem",
  "surgicalKit",
  "testimonial",
  "portfolioCase",
] as const;
export type ContentModel = (typeof CONTENT_MODELS)[number];

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

const TAG: Record<ContentModel, string> = {
  service: TAGS.services,
  guideType: TAGS.guideTypes,
  implantSystem: TAGS.implantSystems,
  surgicalKit: TAGS.surgicalKits,
  testimonial: TAGS.testimonials,
  portfolioCase: TAGS.portfolio,
};

/** Published (services, testimonials, portfolio) or active (catalog). */
export const FLAG: Record<ContentModel, "published" | "active"> = {
  service: "published",
  guideType: "active",
  implantSystem: "active",
  surgicalKit: "active",
  testimonial: "published",
  portfolioCase: "published",
};

export function invalidate(model: ContentModel) {
  updateTag(TAG[model]);
}

/** A readable name for the audit log. */
async function labelOf(tx: Tx, model: ContentModel, id: string): Promise<string | null> {
  switch (model) {
    case "service": {
      const r = await tx.service.findUnique({ where: { id }, select: { title: true } });
      return r ? localized(r.title, "en") : null;
    }
    case "guideType": {
      const r = await tx.guideType.findUnique({ where: { id }, select: { name: true } });
      return r ? localized(r.name, "en") : null;
    }
    case "implantSystem": {
      const r = await tx.implantSystem.findUnique({
        where: { id },
        select: { brand: true, line: true },
      });
      return r ? `${r.brand} ${r.line}` : null;
    }
    case "surgicalKit": {
      const r = await tx.surgicalKit.findUnique({ where: { id }, select: { name: true } });
      return r?.name ?? null;
    }
    case "testimonial": {
      const r = await tx.testimonial.findUnique({ where: { id }, select: { authorName: true } });
      return r ? `Testimonial by ${r.authorName}` : null;
    }
    case "portfolioCase": {
      const r = await tx.portfolioCase.findUnique({ where: { id }, select: { title: true } });
      return r ? localized(r.title, "en") : null;
    }
  }
}

export async function reorderRows(model: ContentModel, ids: string[], actor: Actor) {
  await db.$transaction(async (tx) => {
    for (const [sortOrder, id] of ids.entries()) {
      const where = { id };
      const data = { sortOrder };
      switch (model) {
        case "service":
          await tx.service.update({ where, data });
          break;
        case "guideType":
          await tx.guideType.update({ where, data });
          break;
        case "implantSystem":
          await tx.implantSystem.update({ where, data });
          break;
        case "surgicalKit":
          await tx.surgicalKit.update({ where, data });
          break;
        case "testimonial":
          await tx.testimonial.update({ where, data });
          break;
        case "portfolioCase":
          await tx.portfolioCase.update({ where, data });
          break;
      }
    }
    await recordAudit(tx, {
      actor,
      action: "CONTENT_REORDERED",
      targetType: model,
      targetId: "*",
      extra: { order: ids },
    });
  });
  invalidate(model);
}

export async function setFlag(model: ContentModel, id: string, value: boolean, actor: Actor) {
  const field = FLAG[model];
  await db.$transaction(async (tx) => {
    const label = await labelOf(tx, model, id);
    if (label === null) throw new AdminActionError("notFound");
    switch (model) {
      case "service":
        await tx.service.update({ where: { id }, data: { published: value } });
        break;
      case "guideType":
        await tx.guideType.update({ where: { id }, data: { active: value } });
        break;
      case "implantSystem":
        await tx.implantSystem.update({ where: { id }, data: { active: value } });
        break;
      case "surgicalKit":
        await tx.surgicalKit.update({ where: { id }, data: { active: value } });
        break;
      case "testimonial": {
        const t = await tx.testimonial.findUniqueOrThrow({
          where: { id },
          select: { consent: true },
        });
        // Never publish without written consent (the DB CHECK constraint would also refuse).
        if (value && !t.consent)
          throw new AdminActionError("notAllowed", { published: "consentRequired" });
        await tx.testimonial.update({ where: { id }, data: { published: value } });
        break;
      }
      case "portfolioCase":
        await tx.portfolioCase.update({
          where: { id },
          data: { published: value, ...(value ? { publishedAt: new Date() } : {}) },
        });
        break;
    }
    await recordAudit(tx, {
      actor,
      action: "CONTENT_UPDATED",
      targetType: model,
      targetId: id,
      label,
      before: { [field]: !value },
      after: { [field]: value },
    });
  });
  invalidate(model);
}

/** Hard delete, unless cases reference the row: then it is archived (deactivated) instead. */
export async function deleteOrArchive(model: ContentModel, id: string, actor: Actor) {
  const outcome = await db.$transaction(async (tx) => {
    const label = await labelOf(tx, model, id);
    if (label === null) throw new AdminActionError("notFound");

    let usage = 0;
    if (model === "guideType") usage = await tx.case.count({ where: { guideTypeId: id } });
    if (model === "implantSystem")
      usage = await tx.caseImplant.count({ where: { implantSystemId: id } });
    if (model === "surgicalKit") usage = await tx.case.count({ where: { surgicalKitId: id } });

    if (usage > 0) {
      if (model === "guideType")
        await tx.guideType.update({ where: { id }, data: { active: false } });
      if (model === "implantSystem")
        await tx.implantSystem.update({ where: { id }, data: { active: false } });
      if (model === "surgicalKit")
        await tx.surgicalKit.update({ where: { id }, data: { active: false } });
      await recordAudit(tx, {
        actor,
        action: "CONTENT_ARCHIVED",
        targetType: model,
        targetId: id,
        label,
        extra: { usedByCases: usage },
      });
      return "archived" as const;
    }

    switch (model) {
      case "service":
        await tx.service.delete({ where: { id } });
        break;
      case "guideType":
        await tx.guideType.delete({ where: { id } });
        break;
      case "implantSystem":
        await tx.implantSystem.delete({ where: { id } });
        break;
      case "surgicalKit":
        await tx.surgicalKit.delete({ where: { id } });
        break;
      case "testimonial":
        await tx.testimonial.delete({ where: { id } });
        break;
      case "portfolioCase":
        await tx.portfolioCase.delete({ where: { id } });
        break;
    }
    await recordAudit(tx, {
      actor,
      action: "CONTENT_DELETED",
      targetType: model,
      targetId: id,
      label,
    });
    return "deleted" as const;
  });
  invalidate(model);
  return outcome;
}

/** Next sortOrder for a new row (appended at the end). */
export async function nextSortOrder(model: ContentModel) {
  const args = { _max: { sortOrder: true } } as const;
  const max =
    model === "service"
      ? await db.service.aggregate(args)
      : model === "guideType"
        ? await db.guideType.aggregate(args)
        : model === "implantSystem"
          ? await db.implantSystem.aggregate(args)
          : model === "surgicalKit"
            ? await db.surgicalKit.aggregate(args)
            : model === "testimonial"
              ? await db.testimonial.aggregate(args)
              : await db.portfolioCase.aggregate(args);
  return (max._max.sortOrder ?? -1) + 1;
}
