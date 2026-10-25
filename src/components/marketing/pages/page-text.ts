import type { Bilingual } from "@/lib/validation/admin";

/**
 * A page text in the visitor's language, falling back to the other language when only one is
 * filled in (the admin form flags the missing translation). "" when both are empty.
 */
export function pageText(value: Bilingual, locale: string) {
  const own = (locale === "en" ? value.en : value.da).trim();
  return own || value.da.trim() || value.en.trim();
}
