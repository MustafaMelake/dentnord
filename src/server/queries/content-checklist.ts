import "server-only";

import { CONTENT_FIELDS, looksLikeExample, type ContentField } from "@/lib/content-fields";
import { db } from "@/lib/db";
import { PAGE_TEXT_FIELDS, type Bilingual, type PageName } from "@/lib/validation/admin";
import { getImages } from "@/server/queries/media";
import { requireAdmin } from "@/server/queries/session";
import {
  getAboutPageSetting,
  getAccountsSetting,
  getContactPageSetting,
  getContactSetting,
  getDoctorSetting,
  getImagesSetting,
  getLegalSetting,
  getServicesPageSetting,
  getStatsSetting,
} from "@/server/queries/site-settings";

// The admin dashboard's "Content checklist": every piece of public content the doctor still has to
// fill in. This replaces docs/content-todo.md as the source of truth.

export type ChecklistItem = {
  field: ContentField;
  href: string;
  done: boolean;
  /** Extra detail, e.g. "2 of 4 services". */
  detail?: {
    key:
      | "servicesWithoutImage"
      | "exampleRows"
      | "translationMissing"
      | "fieldsMissing"
      | "starterText";
    count: number;
  };
};

const both = (v: { da: string; en: string }) => !!v.da.trim() && !!v.en.trim();

/** A page is done when every text is filled in (both languages) and the starter copy was reviewed. */
function pageCheck<P extends PageName>(
  page: P,
  texts: Record<(typeof PAGE_TEXT_FIELDS)[P][number], Bilingual> & { starter: boolean },
): [boolean, ChecklistItem["detail"]] {
  const fields: readonly (typeof PAGE_TEXT_FIELDS)[P][number][] = PAGE_TEXT_FIELDS[page];
  const missing = fields.filter((f) => !both(texts[f])).length;
  if (missing > 0) return [false, { key: "fieldsMissing", count: missing }];
  return [!texts.starter, { key: "starterText", count: 1 }];
}

export async function getContentChecklist() {
  await requireAdmin();
  const [
    stats,
    contact,
    doctor,
    accounts,
    legal,
    siteImages,
    services,
    examples,
    testimonials,
    portfolio,
    servicesPage,
    aboutPage,
    contactPage,
  ] = await Promise.all([
    getStatsSetting(),
    getContactSetting(),
    getDoctorSetting(),
    getAccountsSetting(),
    getLegalSetting(),
    getImagesSetting(),
    db.service.findMany({
      where: { published: true },
      select: { imageId: true, summary: true, description: true },
    }),
    Promise.all([
      db.guideType.findMany({ select: { description: true } }),
      db.implantSystem.findMany({ select: { notes: true } }),
      db.surgicalKit.findMany({ select: { description: true } }),
    ]),
    db.testimonial.count({ where: { published: true, consent: true } }),
    db.portfolioCase.count({ where: { published: true } }),
    getServicesPageSetting(),
    getAboutPageSetting(),
    getContactPageSetting(),
  ]);
  const images = await getImages([
    doctor.portraitId,
    doctor.cardPhotoId,
    siteImages.heroId,
    siteImages.technologyId,
  ]);
  const has = (id: string | null) => !!id && !!images[id];

  const servicesWithoutImage = services.filter((s) => !s.imageId).length;
  const exampleServices = services.filter((s) => looksLikeExample(s.summary, s.description)).length;
  const exampleCatalogRows =
    examples[0].filter((r) => looksLikeExample(r.description)).length +
    examples[1].filter((r) => looksLikeExample(r.notes)).length +
    examples[2].filter((r) => looksLikeExample(r.description)).length;

  const checks: [ContentField, boolean, ChecklistItem["detail"]?][] = [
    ["doctor.name", !!doctor.name],
    ["doctor.credentials", both(doctor.credentials)],
    ["doctor.bio", both(doctor.bio)],
    ["doctor.city", !!doctor.city],
    ["doctor.languages", both(doctor.languages)],
    ["doctor.expertise", doctor.expertise.length > 0],
    ["doctor.portrait", has(doctor.portraitId)],
    ["doctor.cardPhoto", has(doctor.cardPhotoId)],
    ["images.hero", has(siteImages.heroId)],
    ["images.technology", has(siteImages.technologyId)],
    ["stats.clinics", stats.clinics !== null],
    ["stats.yearsExperience", stats.yearsExperience !== null],
    ["stats.guidesDelivered", stats.guidesDelivered !== null],
    ["stats.turnaroundDays", stats.turnaroundDays !== null],
    ["contact.email", !!contact.email],
    ["contact.phone", !!contact.phone],
    ["contact.address", both(contact.address)],
    ["contact.cvr", !!contact.cvr],
    [
      "services.images",
      servicesWithoutImage === 0,
      { key: "servicesWithoutImage", count: servicesWithoutImage },
    ],
    ["services.examples", exampleServices === 0, { key: "exampleRows", count: exampleServices }],
    [
      "catalog.examples",
      exampleCatalogRows === 0,
      { key: "exampleRows", count: exampleCatalogRows },
    ],
    ["testimonials", testimonials > 0],
    ["portfolio", portfolio > 0],
    ["accounts.reviewDays", accounts.reviewDays !== null],
    ["legal.terms", both(legal.terms)],
    ["legal.privacy", both(legal.privacy)],
    ["pages.services", ...pageCheck("services", servicesPage)],
    ["pages.about", ...pageCheck("about", aboutPage)],
    ["pages.contact", ...pageCheck("contact", contactPage)],
  ];

  const items: ChecklistItem[] = checks.map(([field, done, detail]) => ({
    field,
    href: CONTENT_FIELDS[field].href,
    done,
    ...(detail && !done ? { detail } : {}),
  }));
  const done = items.filter((i) => i.done).length;
  return { items, done, total: items.length, percent: Math.round((done / items.length) * 100) };
}
