import { getTranslations } from "next-intl/server";

import { PagePlaceholder } from "@/components/shared/page-placeholder";

// TODO: approve/reject PENDING dentists, edit profiles.
export default async function AdminDentistsPage() {
  const t = await getTranslations({ locale: "en", namespace: "admin" });
  return <PagePlaceholder title={t("nav.dentists")} note={t("comingSoon")} />;
}
