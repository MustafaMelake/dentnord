// Tab ids for admin pages. Kept out of the "use client" components that render the tabs: server
// pages read them too, and a client module's exports are only references on the server.

export const SETTINGS_TABS = [
  "numbers",
  "contact",
  "doctor",
  "testimonials",
  "images",
  "accounts",
  "legal",
] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

export const CATALOG_TABS = ["guide-types", "implant-systems", "surgical-kits"] as const;
export type CatalogTab = (typeof CATALOG_TABS)[number];
