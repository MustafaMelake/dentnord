import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AdminPlaceholder } from "@/components/admin/admin-placeholder";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: "en", namespace: "admin" });
  return { title: t("nav.services") };
}

// TODO: CRUD for Service (da/en text, price, order, published).
export default async function ServicesPage() {
  const t = await getTranslations({ locale: "en", namespace: "admin" });
  return <AdminPlaceholder title={t("nav.services")} />;
}
