// Every piece of public content the doctor fills in from the admin. One registry, used by:
// - the admin dashboard "Content checklist" (server/queries/content-checklist.ts), and
// - the public site's "missing content" markers, shown to admins only (components/shared/missing-marker.tsx).
// Labels live in en.json under `admin.content.fields.<key>`. `href` opens the admin field.

export const CONTENT_FIELDS = {
  "stats.clinics": { href: "/admin/settings?tab=numbers#clinics" },
  "stats.yearsExperience": { href: "/admin/settings?tab=numbers#yearsExperience" },
  "stats.guidesDelivered": { href: "/admin/settings?tab=numbers#guidesDelivered" },
  "stats.turnaroundDays": { href: "/admin/settings?tab=numbers#turnaroundDays" },
  "contact.email": { href: "/admin/settings?tab=contact#email" },
  "contact.phone": { href: "/admin/settings?tab=contact#phone" },
  "contact.address": { href: "/admin/settings?tab=contact#address" },
  "contact.cvr": { href: "/admin/settings?tab=contact#cvr" },
  "doctor.name": { href: "/admin/settings?tab=doctor#name" },
  "doctor.credentials": { href: "/admin/settings?tab=doctor#credentials" },
  "doctor.bio": { href: "/admin/settings?tab=doctor#bio" },
  "doctor.city": { href: "/admin/settings?tab=doctor#city" },
  "doctor.languages": { href: "/admin/settings?tab=doctor#languages" },
  "doctor.expertise": { href: "/admin/settings?tab=doctor#expertise" },
  "doctor.portrait": { href: "/admin/settings?tab=doctor#portrait" },
  "doctor.cardPhoto": { href: "/admin/settings?tab=doctor#cardPhoto" },
  "images.hero": { href: "/admin/settings?tab=images#hero" },
  "images.technology": { href: "/admin/settings?tab=images#technology" },
  "services.images": { href: "/admin/services" },
  "catalog.examples": { href: "/admin/catalog" },
  "services.examples": { href: "/admin/services" },
  testimonials: { href: "/admin/settings?tab=testimonials" },
  portfolio: { href: "/admin/portfolio" },
  "accounts.reviewDays": { href: "/admin/settings?tab=accounts#reviewDays" },
  "legal.terms": { href: "/admin/settings?tab=legal#terms" },
  "legal.privacy": { href: "/admin/settings?tab=legal#privacy" },
  // Page texts (/admin/pages/*): one checklist item per page, one marker per field.
  "pages.services": { href: "/admin/pages/services" },
  "pages.about": { href: "/admin/pages/about" },
  "pages.contact": { href: "/admin/pages/contact" },
  "servicesPage.intro": { href: "/admin/pages/services#field-intro" },
  "servicesPage.image": { href: "/admin/pages/services#field-imageId" },
  "servicesPage.listHeading": { href: "/admin/pages/services#field-listHeading" },
  "servicesPage.process": { href: "/admin/pages/services#field-processHeading" },
  "servicesPage.cta": { href: "/admin/pages/services#field-ctaTitle" },
  "aboutPage.intro": { href: "/admin/pages/about#field-intro" },
  "aboutPage.expertiseHeading": { href: "/admin/pages/about#field-expertiseHeading" },
  "aboutPage.approach": { href: "/admin/pages/about#field-approachHeading" },
  "aboutPage.image": { href: "/admin/pages/about#field-imageId" },
  "aboutPage.statsHeading": { href: "/admin/pages/about#field-statsHeading" },
  "aboutPage.cta": { href: "/admin/pages/about#field-ctaTitle" },
  "contactPage.intro": { href: "/admin/pages/contact#field-intro" },
  "contactPage.detailsHeading": { href: "/admin/pages/contact#field-detailsHeading" },
  "contactPage.form": { href: "/admin/pages/contact#field-formHeading" },
} as const;

export type ContentField = keyof typeof CONTENT_FIELDS;

/** Seeded catalog rows carry this marker until an admin edits them (prisma/seed.ts). */
export const EXAMPLE_MARKERS = ["EXAMPLE", "EKSEMPEL"];

export function looksLikeExample(...values: unknown[]) {
  const text = JSON.stringify(values);
  return EXAMPLE_MARKERS.some((marker) => text.includes(marker));
}
