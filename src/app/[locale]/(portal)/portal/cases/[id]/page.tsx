import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { ShellPageHeader } from "@/components/shared/app-shell/app-shell";
import { PageSkeleton } from "@/components/shared/app-shell/page-skeleton";
import { getOwnCase } from "@/server/queries/dentist";

// TODO: status timeline, files (signed URLs), plan approval / change request, message thread.
export default function PortalCasePage({ params }: PageProps<"/[locale]/portal/cases/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CaseDetail params={params} />
    </Suspense>
  );
}

async function CaseDetail({ params }: Pick<PageProps<"/[locale]/portal/cases/[id]">, "params">) {
  const { id } = await params;
  // 404 unless the case belongs to the signed-in dentist.
  const found = await getOwnCase(await getLocale(), id, { caseNumber: true });
  const t = await getTranslations();
  return (
    <ShellPageHeader
      title={`${t("portal.caseDetail.title")} ${found.caseNumber}`}
      intro={t("common.comingSoon")}
    />
  );
}
