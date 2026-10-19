import { getTranslations } from "next-intl/server";

import { PagePlaceholder } from "@/components/shared/page-placeholder";

// TODO: status timeline, files (signed URLs), plan approval / change request, message thread.
export default async function PortalCasePage() {
  const t = await getTranslations();
  return <PagePlaceholder title={t("portal.caseDetail.title")} note={t("common.comingSoon")} />;
}
