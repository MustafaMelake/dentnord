import { getTranslations } from "next-intl/server";

import { PagePlaceholder } from "@/components/shared/page-placeholder";

// TODO: KPIs: cases by status, pending dentist approvals, recent messages.
export default async function AdminDashboardPage() {
  const t = await getTranslations({ locale: "en", namespace: "admin" });
  return <PagePlaceholder title={t("nav.dashboard")} note={t("comingSoon")} />;
}
