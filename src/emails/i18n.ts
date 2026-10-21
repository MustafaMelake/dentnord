import { createTranslator } from "next-intl";

import da from "../../messages/da.json";
import en from "../../messages/en.json";

// Emails are rendered outside the [locale] tree (Better Auth hooks, Server Actions), so they use a
// plain translator over the message files instead of request-scoped next-intl.

export type EmailLocale = "da" | "en";

const messages = { da: da as unknown as typeof en, en };

/** The recipient's `preferredLocale`, falling back to Danish. */
export function emailLocale(value: string | null | undefined): EmailLocale {
  return value === "en" ? "en" : "da";
}

export function getEmailTranslator(locale: EmailLocale) {
  return createTranslator({ locale, messages: messages[locale], namespace: "emails" });
}

export type EmailTranslator = ReturnType<typeof getEmailTranslator>;
