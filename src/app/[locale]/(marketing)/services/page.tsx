import { getTranslations } from "next-intl/server";

import { PagePlaceholder } from "@/components/shared/page-placeholder";

// TODO: services overview, rendered from the Service catalog (DB).
export default async function ServicesPage() {
  const t = await getTranslations();
  return <PagePlaceholder title={t("pages.services")} note={t("common.comingSoon")} />;
}
