"use server";

import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { looksLikeExample } from "@/lib/content-fields";
import { db } from "@/lib/db";
import {
  guideTypeSchema,
  implantSystemSchema,
  slugify,
  surgicalKitSchema,
} from "@/lib/validation/admin";
import { AdminActionError, runAdminAction } from "@/server/services/admin-action";
import { recordAudit } from "@/server/services/audit";
import { invalidate, nextSortOrder } from "@/server/services/content-admin";

// Guide types, implant systems and surgical kits. Seeded rows carry an "EXAMPLE" note in fields the
// form doesn't edit (description/notes); saving a row from the admin counts as verifying it, so that
// note is cleared.

const id = z.string().trim().max(64).nullable();
const guideTypeInput = guideTypeSchema.extend({ id });
const implantSystemInput = implantSystemSchema.extend({ id });
const surgicalKitInput = surgicalKitSchema.extend({ id });

/** For plain (non-JSON) columns: null clears a seeded EXAMPLE note, undefined leaves the value. */
const clearExample = (value: unknown) => (looksLikeExample(value) ? null : undefined);

export async function saveGuideType(data: z.input<typeof guideTypeInput>) {
  return runAdminAction(guideTypeInput, data, async ({ id, name, description, active }, actor) => {
    const label = name.en || name.da;
    const result = await db.$transaction(async (tx) => {
      const select = { name: true, description: true, active: true } as const;
      if (id) {
        const before = await tx.guideType.findUniqueOrThrow({ where: { id }, select });
        const after = await tx.guideType.update({
          where: { id },
          data: { name, description, active },
          select,
        });
        await recordAudit(tx, {
          actor,
          action: "CONTENT_UPDATED",
          targetType: "guideType",
          targetId: id,
          label,
          before,
          after,
        });
        return id;
      }
      const slug = await uniqueGuideTypeSlug(tx, label);
      const created = await tx.guideType.create({
        data: { name, description, active, slug, sortOrder: await nextSortOrder("guideType") },
        select: { id: true, ...select },
      });
      await recordAudit(tx, {
        actor,
        action: "CONTENT_CREATED",
        targetType: "guideType",
        targetId: created.id,
        label,
        after: created,
      });
      return created.id;
    });
    invalidate("guideType");
    return { id: result };
  });
}

export async function saveImplantSystem(data: z.input<typeof implantSystemInput>) {
  return runAdminAction(
    implantSystemInput,
    data,
    async ({ id, brand, line, diameters, lengths, active }, actor) => {
      const label = `${brand} ${line}`;
      const select = {
        brand: true,
        line: true,
        diameters: true,
        lengths: true,
        active: true,
      } as const;
      const result = await db.$transaction(async (tx) => {
        const clash = await tx.implantSystem.findFirst({
          where: {
            brand: { equals: brand, mode: "insensitive" },
            line: { equals: line, mode: "insensitive" },
            ...(id ? { NOT: { id } } : {}),
          },
          select: { id: true },
        });
        if (clash) throw new AdminActionError("conflict", { line: "duplicateSystem" });
        if (id) {
          const before = await tx.implantSystem.findUniqueOrThrow({
            where: { id },
            select: { ...select, notes: true },
          });
          const after = await tx.implantSystem.update({
            where: { id },
            data: { brand, line, diameters, lengths, active, notes: clearExample(before.notes) },
            select,
          });
          await recordAudit(tx, {
            actor,
            action: "CONTENT_UPDATED",
            targetType: "implantSystem",
            targetId: id,
            label,
            before,
            after,
          });
          return id;
        }
        const created = await tx.implantSystem.create({
          data: {
            brand,
            line,
            diameters,
            lengths,
            active,
            sortOrder: await nextSortOrder("implantSystem"),
          },
          select: { id: true, ...select },
        });
        await recordAudit(tx, {
          actor,
          action: "CONTENT_CREATED",
          targetType: "implantSystem",
          targetId: created.id,
          label,
          after: created,
        });
        return created.id;
      });
      invalidate("implantSystem");
      return { id: result };
    },
  );
}

export async function saveSurgicalKit(data: z.input<typeof surgicalKitInput>) {
  return runAdminAction(
    surgicalKitInput,
    data,
    async ({ id, name, manufacturer, implantSystemIds, active }, actor) => {
      const result = await db.$transaction(async (tx) => {
        const found = await tx.implantSystem.count({ where: { id: { in: implantSystemIds } } });
        if (found !== implantSystemIds.length) throw new AdminActionError("invalid");
        const systems = implantSystemIds.map((sid) => ({ id: sid }));
        const select = {
          name: true,
          manufacturer: true,
          active: true,
          implantSystems: { select: { id: true } },
        } as const;
        if (id) {
          const before = await tx.surgicalKit.findUniqueOrThrow({
            where: { id },
            select: { ...select, description: true },
          });
          const after = await tx.surgicalKit.update({
            where: { id },
            data: {
              name,
              manufacturer: manufacturer || null,
              active,
              implantSystems: { set: systems },
              description: looksLikeExample(before.description) ? Prisma.DbNull : undefined,
            },
            select,
          });
          await recordAudit(tx, {
            actor,
            action: "CONTENT_UPDATED",
            targetType: "surgicalKit",
            targetId: id,
            label: name,
            before: {
              ...before,
              description: undefined,
              implantSystems: before.implantSystems.map((s) => s.id),
            },
            after: { ...after, implantSystems: after.implantSystems.map((s) => s.id) },
          });
          return id;
        }
        const created = await tx.surgicalKit.create({
          data: {
            name,
            manufacturer: manufacturer || null,
            active,
            sortOrder: await nextSortOrder("surgicalKit"),
            implantSystems: { connect: systems },
          },
          select: { id: true },
        });
        await recordAudit(tx, {
          actor,
          action: "CONTENT_CREATED",
          targetType: "surgicalKit",
          targetId: created.id,
          label: name,
          after: { name, manufacturer, active, implantSystems: implantSystemIds },
        });
        return created.id;
      });
      invalidate("surgicalKit");
      return { id: result };
    },
  );
}

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

async function uniqueGuideTypeSlug(tx: Tx, label: string) {
  const base = slugify(label) || "guide-type";
  for (let n = 1; ; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    if (!(await tx.guideType.findUnique({ where: { slug }, select: { id: true } }))) return slug;
  }
}
