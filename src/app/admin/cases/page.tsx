import { getTranslations } from "next-intl/server";

import { PagePlaceholder } from "@/components/shared/page-placeholder";

// TODO: all cases, @tanstack/react-table with status/dentist filters.
export default async function AdminCasesPage() {
  const t = await getTranslations({ locale: "en", namespace: "admin" });
  return <PagePlaceholder title={t("nav.cases")} note={t("comingSoon")} />;
}
