import { getTranslations } from "next-intl/server";

import { PagePlaceholder } from "@/components/shared/page-placeholder";

// TODO: show status (PENDING vs REJECTED) for the signed-in user + sign-out button.
export default async function PendingApprovalPage() {
  const t = await getTranslations("auth.pendingApproval");
  return <PagePlaceholder title={t("title")} note={t("body")} />;
}
