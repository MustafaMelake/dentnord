export { cn } from "cn";

/** Translatable DB field: { "da": "...", "en": "..." } */
export type LocalizedText = Partial<Record<"da" | "en", string>>;

/** Pick the text for `locale` from a translatable JSON field, falling back to Danish, then English. */
export function localized(value: unknown, locale: string): string {
  if (!value || typeof value !== "object") return "";
  const text = value as LocalizedText;
  return text[locale as keyof LocalizedText] ?? text.da ?? text.en ?? "";
}
