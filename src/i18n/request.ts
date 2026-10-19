import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import * as rootParams from "next/root-params";

import { routing } from "./routing";

export default getRequestConfig(async ({ locale }) => {
  // An explicit locale (e.g. `getTranslations({ locale })`) wins. Pass one in Server Actions,
  // Route Handlers and /admin, where the `[locale]` root param is not available.
  if (!locale) {
    const param = await rootParams.locale();
    // Invalid segments are rejected with notFound() in app/[locale]/layout.tsx.
    locale = hasLocale(routing.locales, param) ? param : routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "Europe/Copenhagen",
  };
});
