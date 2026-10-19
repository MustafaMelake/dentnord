import { getTranslations } from "next-intl/server";

import { PagePlaceholder } from "@/components/shared/page-placeholder";

// TODO: edit SiteSetting entries (contact info, hero text, ...).
export default async function AdminSettingsPage() {
  const t = await getTranslations({ locale: "en", namespace: "admin" });
  return <PagePlaceholder title={t("nav.settings")} note={t("comingSoon")} />;
}
