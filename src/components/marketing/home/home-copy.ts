import type { HomePageInput } from "@/lib/validation/admin";

// The home page's texts (/admin/pages/home, SiteSetting "page.home"), already in the visitor's
// language. Each section gets the fields it shows; an empty text is hidden and the section shows
// the admin's "Missing: …" marker.

export type HomeTextKey = keyof HomePageInput;
export type HomeCopy<K extends HomeTextKey> = Record<K, string>;

/** True when one of the section's texts is empty (the admin sees a marker). */
export const hasGaps = (copy: Record<string, string>) => Object.values(copy).some((v) => !v);
