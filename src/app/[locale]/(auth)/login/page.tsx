import { getTranslations } from "next-intl/server";

import { PagePlaceholder } from "@/components/shared/page-placeholder";

// TODO: email/password form (react-hook-form + zod) using authClient.signIn.email. Honour ?next= only for same-origin relative paths.
export default async function LoginPage() {
  const t = await getTranslations();
  return <PagePlaceholder title={t("auth.login.title")} note={t("common.comingSoon")} />;
}
