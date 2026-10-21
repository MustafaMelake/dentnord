import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AdminPlaceholder } from "@/components/admin/admin-placeholder";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: "en", namespace: "admin" });
  return { title: t("nav.settings") };
}

// TODO: edit SiteSetting entries (contact info, hero text, accounts.reviewDays, ...).
export default async function SettingsPage() {
  const t = await getTranslations({ locale: "en", namespace: "admin" });
  return <AdminPlaceholder title={t("nav.settings")} />;
}
