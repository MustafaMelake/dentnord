import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/lib/db";
import type { LocalizedText } from "@/lib/utils";

// SiteSetting rows (key → JSON), editable in /admin/settings. Missing keys/fields render as
// [placeholder]s on the site (see docs/content-todo.md).

export const SITE_SETTINGS_TAG = "site-settings";

export type ContactSetting = {
  email?: string;
  phone?: string;
  address?: LocalizedText;
  cvr?: string;
};

/** Public figures shown on the home page. `null`/missing → "[X]" placeholder. */
export type StatsSetting = {
  clinics?: number | null;
  yearsExperience?: number | null;
  guidesDelivered?: number | null;
  turnaroundDays?: number | null;
};

async function getSetting<T>(key: string): Promise<T | null> {
  "use cache";
  cacheTag(SITE_SETTINGS_TAG, `${SITE_SETTINGS_TAG}:${key}`);
  cacheLife("hours");
  const row = await db.siteSetting.findUnique({ where: { key }, select: { value: true } });
  return (row?.value as T | undefined) ?? null;
}

export const getContactSetting = () => getSetting<ContactSetting>("contact");
export const getStatsSetting = () => getSetting<StatsSetting>("stats");

/** Cached so the footer can prerender (Cache Components forbids `new Date()` in a static shell). */
export async function getCurrentYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}
