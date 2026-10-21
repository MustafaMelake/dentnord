import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AdminPlaceholder } from "@/components/admin/admin-placeholder";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: "en", namespace: "admin" });
  return { title: t("nav.portfolio") };
}

// TODO: CRUD for PortfolioCase (slug, images, published, order).
export default async function PortfolioPage() {
  const t = await getTranslations({ locale: "en", namespace: "admin" });
  return <AdminPlaceholder title={t("nav.portfolio")} />;
}
