import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/lib/db";
import { PAGE_TEXT_FIELDS, toBilingual, type Bilingual } from "@/lib/validation/admin";
import { TAGS, type SettingKey } from "@/server/cache-tags";

// SiteSetting rows (key → JSON), edited in /admin/settings. Each getter normalises the stored JSON
// into a complete shape. Empty values are HIDDEN on the public site (admins see a marker instead,
// components/shared/missing-marker.tsx) and listed in the admin content checklist.

async function getSetting(key: SettingKey): Promise<Record<string, unknown>> {
  "use cache";
  cacheTag(TAGS.settings, TAGS.setting(key));
  cacheLife("hours");
  const row = await db.siteSetting.findUnique({ where: { key }, select: { value: true } });
  const value = row?.value;
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
const ref = (v: unknown) => (typeof v === "string" && v ? v : null);

export type StatsSetting = {
  clinics: number | null;
  yearsExperience: number | null;
  guidesDelivered: number | null;
  turnaroundDays: number | null;
};

export async function getStatsSetting(): Promise<StatsSetting> {
  const v = await getSetting("stats");
  return {
    clinics: count(v.clinics),
    yearsExperience: count(v.yearsExperience),
    guidesDelivered: count(v.guidesDelivered),
    turnaroundDays: count(v.turnaroundDays),
  };
}

export type ContactSetting = { email: string; phone: string; address: Bilingual; cvr: string };

export async function getContactSetting(): Promise<ContactSetting> {
  const v = await getSetting("contact");
  return {
    email: str(v.email),
    phone: str(v.phone),
    address: toBilingual(v.address),
    cvr: str(v.cvr),
  };
}

export type ExpertiseRow = { id: string; title: Bilingual; tag: Bilingual };

export type DoctorSetting = {
  name: string;
  credentials: Bilingual;
  bio: Bilingual;
  city: string;
  languages: Bilingual;
  portraitId: string | null;
  cardPhotoId: string | null;
  expertise: ExpertiseRow[];
};

export async function getDoctorSetting(): Promise<DoctorSetting> {
  const v = await getSetting("doctor");
  const rows = Array.isArray(v.expertise) ? v.expertise : [];
  return {
    name: str(v.name),
    credentials: toBilingual(v.credentials),
    bio: toBilingual(v.bio),
    city: str(v.city),
    languages: toBilingual(v.languages),
    portraitId: ref(v.portraitId),
    cardPhotoId: ref(v.cardPhotoId),
    expertise: rows
      .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
      .map((r, i) => ({
        id: str(r.id) || `row-${i}`,
        title: toBilingual(r.title),
        tag: toBilingual(r.tag),
      })),
  };
}

export type AccountsSetting = { reviewDays: number | null };

export async function getAccountsSetting(): Promise<AccountsSetting> {
  const v = await getSetting("accounts");
  return { reviewDays: count(v.reviewDays) };
}

export type LegalSetting = { terms: Bilingual; privacy: Bilingual };

export async function getLegalSetting(): Promise<LegalSetting> {
  const v = await getSetting("legal");
  return { terms: toBilingual(v.terms), privacy: toBilingual(v.privacy) };
}

export type ImagesSetting = { heroId: string | null; technologyId: string | null };

export async function getImagesSetting(): Promise<ImagesSetting> {
  const v = await getSetting("images");
  return { heroId: ref(v.heroId), technologyId: ref(v.technologyId) };
}

// ── Page texts (/admin/pages/*) ──────────────────────────────────────────────
// `starter`: the seeded starter copy (prisma/seed-pages.ts) that nobody has reviewed yet. It is shown
// like any other text; the content checklist lists the page until an admin saves it once.

type PageFields<P extends keyof typeof PAGE_TEXT_FIELDS> = Record<
  (typeof PAGE_TEXT_FIELDS)[P][number],
  Bilingual
>;

function pageTexts<P extends keyof typeof PAGE_TEXT_FIELDS>(
  page: P,
  v: Record<string, unknown>,
): PageFields<P> & { starter: boolean } {
  const fields = Object.fromEntries(PAGE_TEXT_FIELDS[page].map((f) => [f, toBilingual(v[f])]));
  return { ...(fields as PageFields<P>), starter: v.starter === true };
}

export type ServicesPageSetting = PageFields<"services"> & {
  imageId: string | null;
  starter: boolean;
};

export async function getServicesPageSetting(): Promise<ServicesPageSetting> {
  const v = await getSetting("page.services");
  return { ...pageTexts("services", v), imageId: ref(v.imageId) };
}

export type AboutPageSetting = PageFields<"about"> & { imageId: string | null; starter: boolean };

export async function getAboutPageSetting(): Promise<AboutPageSetting> {
  const v = await getSetting("page.about");
  return { ...pageTexts("about", v), imageId: ref(v.imageId) };
}

export type ContactPageSetting = PageFields<"contact"> & { starter: boolean };

export async function getContactPageSetting(): Promise<ContactPageSetting> {
  return pageTexts("contact", await getSetting("page.contact"));
}

/** Cached so the footer can prerender (Cache Components forbids `new Date()` in a static shell). */
export async function getCurrentYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}
