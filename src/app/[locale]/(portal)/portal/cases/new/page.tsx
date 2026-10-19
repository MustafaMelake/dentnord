import { getTranslations } from "next-intl/server";

import { PagePlaceholder } from "@/components/shared/page-placeholder";

// TODO: case form: patient code (never a name), FDI implant sites, implant system/diameter/length, guide type, surgical kit, Uppy uploads direct to R2.
export default async function NewCasePage() {
  const t = await getTranslations();
  return <PagePlaceholder title={t("portal.newCase.title")} note={t("common.comingSoon")} />;
}
