import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AdminPlaceholder } from "@/components/admin/admin-placeholder";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: "en", namespace: "admin" });
  return { title: t("nav.catalog") };
}

// TODO: CRUD for GuideType, ImplantSystem (diameters/lengths), SurgicalKit.
export default async function CatalogPage() {
  const t = await getTranslations({ locale: "en", namespace: "admin" });
  return <AdminPlaceholder title={t("nav.catalog")} />;
}
