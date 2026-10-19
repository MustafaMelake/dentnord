import { getTranslations } from "next-intl/server";

import { PagePlaceholder } from "@/components/shared/page-placeholder";

// TODO: case counts by status + recent activity.
export default async function PortalDashboardPage() {
  const t = await getTranslations();
  return <PagePlaceholder title={t("portal.dashboard.title")} note={t("common.comingSoon")} />;
}
