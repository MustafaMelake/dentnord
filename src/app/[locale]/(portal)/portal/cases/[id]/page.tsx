import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { CaseDetailView } from "@/components/cases/case-detail-view";
import { ShellPageHeader } from "@/components/shared/app-shell/app-shell";
import { PageSkeleton } from "@/components/shared/app-shell/page-skeleton";
import { Link } from "@/i18n/navigation";
import { getOwnCaseDetail } from "@/server/queries/cases";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portal.caseDetail");
  return { title: t("title") };
}

// TODO (later phase): plan approval / change request, message thread.
export default function PortalCasePage({ params }: PageProps<"/[locale]/portal/cases/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CaseDetail params={params} />
    </Suspense>
  );
}

async function CaseDetail({ params }: Pick<PageProps<"/[locale]/portal/cases/[id]">, "params">) {
  const [{ id }, locale] = await Promise.all([params, getLocale()]);
  // 404 unless the case belongs to the signed-in dentist; drafts redirect to the wizard.
  const [detail, t] = await Promise.all([
    getOwnCaseDetail(locale, id),
    getTranslations("portal.caseDetail"),
  ]);
  return (
    <>
      <div className="flex flex-col gap-4">
        <Link
          href="/portal/cases"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {t("back")}
        </Link>
        <ShellPageHeader title={`${t("title")} ${detail.caseNumber}`} />
      </div>
      <CaseDetailView detail={detail} locale={locale} />
    </>
  );
}
