"use server";

import { updateTag } from "next/cache";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  aboutPageSchema,
  accountsSchema,
  contactPageSchema,
  contactSchema,
  doctorSchema,
  legalSchema,
  servicesPageSchema,
  siteImagesSchema,
  statsSchema,
  type AboutPageInput,
  type AccountsInput,
  type ContactInput,
  type ContactPageInput,
  type DoctorInput,
  type LegalInput,
  type ServicesPageInput,
  type SiteImagesInput,
  type StatsInput,
} from "@/lib/validation/admin";
import { TAGS, type SettingKey } from "@/server/cache-tags";
import { AdminActionError, runAdminAction, type Actor } from "@/server/services/admin-action";
import { recordAudit } from "@/server/services/audit";

// Site content (SiteSetting rows), one action per tab of /admin/settings.

async function writeSetting(key: SettingKey, value: Record<string, unknown>, actor: Actor) {
  await db.$transaction(async (tx) => {
    const row = await tx.siteSetting.findUnique({ where: { key }, select: { value: true } });
    const before = (row?.value ?? {}) as Record<string, unknown>;
    // Keep keys this form doesn't manage (e.g. legacy fields), overwrite the rest.
    const next = { ...before, ...value } as Prisma.InputJsonObject;
    await tx.siteSetting.upsert({
      where: { key },
      create: { key, value: next },
      update: { value: next },
    });
    await recordAudit(tx, {
      actor,
      action: "CONTENT_UPDATED",
      targetType: `setting:${key}`,
      targetId: key,
      before,
      after: next as Record<string, unknown>,
    });
  });
  updateTag(TAGS.setting(key));
}

async function assertMediaExists(ids: (string | null)[]) {
  const wanted = [...new Set(ids.filter((id): id is string => !!id))];
  if (wanted.length === 0) return;
  const found = await db.mediaAsset.count({ where: { id: { in: wanted } } });
  if (found !== wanted.length) throw new AdminActionError("invalid");
}

export async function saveStats(input: StatsInput) {
  return runAdminAction(statsSchema, input, (data, actor) => writeSetting("stats", data, actor));
}

export async function saveContact(input: ContactInput) {
  return runAdminAction(contactSchema, input, (data, actor) =>
    writeSetting("contact", { ...data, cvr: data.cvr.replace(/\s/g, "") }, actor),
  );
}

export async function saveDoctor(input: DoctorInput) {
  return runAdminAction(doctorSchema, input, async (data, actor) => {
    await assertMediaExists([data.portraitId, data.cardPhotoId]);
    await writeSetting("doctor", data, actor);
  });
}

export async function saveAccounts(input: AccountsInput) {
  return runAdminAction(accountsSchema, input, (data, actor) =>
    writeSetting("accounts", data, actor),
  );
}

export async function saveLegal(input: LegalInput) {
  return runAdminAction(legalSchema, input, (data, actor) => writeSetting("legal", data, actor));
}

export async function saveSiteImages(input: SiteImagesInput) {
  return runAdminAction(siteImagesSchema, input, async (data, actor) => {
    await assertMediaExists([data.heroId, data.technologyId]);
    await writeSetting("images", data, actor);
  });
}

// Page texts (/admin/pages/*). Saving a page also marks its seeded starter copy as reviewed.

export async function saveServicesPage(input: ServicesPageInput) {
  return runAdminAction(servicesPageSchema, input, async (data, actor) => {
    await assertMediaExists([data.imageId]);
    await writeSetting("page.services", { ...data, starter: false }, actor);
  });
}

export async function saveAboutPage(input: AboutPageInput) {
  return runAdminAction(aboutPageSchema, input, async (data, actor) => {
    await assertMediaExists([data.imageId]);
    await writeSetting("page.about", { ...data, starter: false }, actor);
  });
}

export async function saveContactPage(input: ContactPageInput) {
  return runAdminAction(contactPageSchema, input, (data, actor) =>
    writeSetting("page.contact", { ...data, starter: false }, actor),
  );
}
