import { getTranslations } from "next-intl/server";

import { PagePlaceholder } from "@/components/shared/page-placeholder";

// TODO: grid of published PortfolioCase rows (DB).
export default async function PortfolioPage() {
  const t = await getTranslations();
  return <PagePlaceholder title={t("pages.portfolio")} note={t("common.comingSoon")} />;
}
