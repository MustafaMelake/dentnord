import { getTranslations } from "next-intl/server";

import { PagePlaceholder } from "@/components/shared/page-placeholder";

// TODO: case detail: change status (writes CaseEvent), upload plan/guide files, message thread.
export default async function AdminCasePage() {
  const t = await getTranslations({ locale: "en", namespace: "admin" });
  return <PagePlaceholder title={t("caseDetail")} note={t("comingSoon")} />;
}
