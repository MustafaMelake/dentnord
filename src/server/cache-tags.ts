// Cache tags for public reads ("use cache" + cacheTag in server/queries/*). Admin Server Actions call
// `updateTag()` with the matching tag after every save, so the public site shows the change on the very
// next request, without a deploy.

export const TAGS = {
  services: "services",
  guideTypes: "guide-types",
  implantSystems: "implant-systems",
  surgicalKits: "surgical-kits",
  testimonials: "testimonials",
  portfolio: "portfolio",
  /** Any media asset (alt text shows wherever the image is used). */
  media: "media",
  settings: "site-settings",
  setting: (key: SettingKey) => `site-settings:${key}`,
} as const;

export const SETTING_KEYS = [
  "stats",
  "contact",
  "doctor",
  "accounts",
  "legal",
  "images",
  // The texts of the Services / About / Contact pages (/admin/pages/*).
  "page.services",
  "page.about",
  "page.contact",
] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];
