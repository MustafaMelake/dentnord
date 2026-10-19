import { getTranslations } from "next-intl/server";

import { PagePlaceholder } from "@/components/shared/page-placeholder";

// TODO: case study detail, looked up by slug (DB).
export default async function PortfolioCasePage() {
  const t = await getTranslations();
  return <PagePlaceholder title={t("pages.portfolioCase")} note={t("common.comingSoon")} />;
}
