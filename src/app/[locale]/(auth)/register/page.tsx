import { getTranslations } from "next-intl/server";

import { PagePlaceholder } from "@/components/shared/page-placeholder";

// TODO: sign-up form incl. clinicName, phone, country, address. New accounts start as PENDING.
export default async function RegisterPage() {
  const t = await getTranslations();
  return <PagePlaceholder title={t("auth.register.title")} note={t("common.comingSoon")} />;
}
