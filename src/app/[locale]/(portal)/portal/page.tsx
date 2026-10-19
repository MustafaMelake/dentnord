import { hasLocale } from "next-intl";
import * as rootParams from "next/root-params";

import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export default async function PortalIndexPage() {
  const param = await rootParams.locale();
  const locale = hasLocale(routing.locales, param) ? param : routing.defaultLocale;
  redirect({ href: "/portal/dashboard", locale });
}
