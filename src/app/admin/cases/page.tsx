import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AdminPlaceholder } from "@/components/admin/admin-placeholder";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: "en", namespace: "admin" });
  return { title: t("nav.cases") };
}

// TODO: all cases, @tanstack/react-table with status/dentist filters.
export default async function AdminCasesPage() {
  const t = await getTranslations({ locale: "en", namespace: "admin" });
  return <AdminPlaceholder title={t("nav.cases")} />;
}
