import { getTranslations } from "next-intl/server";

import { PagePlaceholder } from "@/components/shared/page-placeholder";

// TODO: CRUD for Service (da/en text, price, order, published).
export default async function AdminServicesPage() {
  const t = await getTranslations({ locale: "en", namespace: "admin" });
  return <PagePlaceholder title={t("nav.services")} note={t("comingSoon")} />;
}
