import { getTranslations } from "next-intl/server";

import { PagePlaceholder } from "@/components/shared/page-placeholder";

// TODO: about Dr. Hossam and the lab; copy from SiteSetting.
export default async function AboutPage() {
  const t = await getTranslations();
  return <PagePlaceholder title={t("pages.about")} note={t("common.comingSoon")} />;
}
