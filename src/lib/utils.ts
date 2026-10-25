import { createCn } from "cn/config";

/**
 * Class merging (clsx + tailwind-merge semantics). Our custom font sizes must be registered,
 * otherwise `text-display-lg` and `text-ink` look like the same group and one gets dropped.
 * Keep in sync with the `--text-*` tokens in globals.css. Always import `cn` from here, not "cn".
 */
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display-2xl",
            "display-xl",
            "display-lg",
            "display-md",
            "display-sm",
            "lead",
            "label",
          ],
        },
      ],
    },
  },
});

/** Translatable DB field: { "da": "...", "en": "..." } */
export type LocalizedText = Partial<Record<"da" | "en", string>>;

/**
 * Pick the text for `locale` from a translatable JSON field (trimmed). When that language is
 * missing, empty or only whitespace, fall back to the other one (Danish first), as the admin form's
 * missing-translation hint promises. "" when neither is filled in.
 */
export function localized(value: unknown, locale: string): string {
  if (!value || typeof value !== "object") return "";
  const text = value as LocalizedText;
  const pick = (lang: keyof LocalizedText) =>
    typeof text[lang] === "string" ? text[lang].trim() : "";
  return pick(locale as keyof LocalizedText) || pick("da") || pick("en");
}
