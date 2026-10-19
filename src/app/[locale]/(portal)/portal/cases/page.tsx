import { getTranslations } from "next-intl/server";

import { PagePlaceholder } from "@/components/shared/page-placeholder";

// TODO: the dentist's own cases (never other dentists').
export default async function PortalCasesPage() {
  const t = await getTranslations();
  return <PagePlaceholder title={t("portal.cases.title")} note={t("common.comingSoon")} />;
}
