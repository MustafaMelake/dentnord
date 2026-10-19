import { getTranslations } from "next-intl/server";

import { PagePlaceholder } from "@/components/shared/page-placeholder";

// TODO: clinic profile and password change.
export default async function PortalAccountPage() {
  const t = await getTranslations();
  return <PagePlaceholder title={t("portal.account.title")} note={t("common.comingSoon")} />;
}
