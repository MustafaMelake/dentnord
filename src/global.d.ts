import type messages from "../messages/en.json";
import type { routing } from "./i18n/routing";

declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    // en.json is the source of truth for keys. It also holds the English-only `admin` namespace.
    Messages: typeof messages;
  }
}
