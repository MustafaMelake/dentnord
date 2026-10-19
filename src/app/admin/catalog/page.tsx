import { getTranslations } from "next-intl/server";

import { PagePlaceholder } from "@/components/shared/page-placeholder";

// TODO: CRUD for GuideType, ImplantSystem (diameters/lengths), SurgicalKit.
export default async function AdminCatalogPage() {
  const t = await getTranslations({ locale: "en", namespace: "admin" });
  return <PagePlaceholder title={t("nav.catalog")} note={t("comingSoon")} />;
}
