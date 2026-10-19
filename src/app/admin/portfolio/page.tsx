import { getTranslations } from "next-intl/server";

import { PagePlaceholder } from "@/components/shared/page-placeholder";

// TODO: CRUD for PortfolioCase (slug, images, published, order).
export default async function AdminPortfolioPage() {
  const t = await getTranslations({ locale: "en", namespace: "admin" });
  return <PagePlaceholder title={t("nav.portfolio")} note={t("comingSoon")} />;
}
