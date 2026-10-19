import { getTranslations } from "next-intl/server";

import { PagePlaceholder } from "@/components/shared/page-placeholder";

// TODO: contact details from SiteSetting + contact form (server action + zod).
export default async function ContactPage() {
  const t = await getTranslations();
  return <PagePlaceholder title={t("pages.contact")} note={t("common.comingSoon")} />;
}
