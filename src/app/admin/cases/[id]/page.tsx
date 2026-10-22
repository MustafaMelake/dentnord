import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import NextLink from "next/link";
import { Suspense } from "react";

import { CaseDetailView } from "@/components/cases/case-detail-view";
import { ShellPageHeader } from "@/components/shared/app-shell/app-shell";
import { PageSkeleton } from "@/components/shared/app-shell/page-skeleton";
import { getAdminCaseDetail } from "@/server/queries/admin-cases";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: "en", namespace: "admin" });
  return { title: t("caseDetail") };
}

// Read-only for now. TODO (later phase): change status (writes CaseEvent), upload plan/guide files, messages.
export default function AdminCasePage({ params }: PageProps<"/admin/cases/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CaseDetail params={params} />
    </Suspense>
  );
}

async function CaseDetail({ params }: Pick<PageProps<"/admin/cases/[id]">, "params">) {
  const { id } = await params;
  const [detail, t] = await Promise.all([
    getAdminCaseDetail(id),
    getTranslations({ locale: "en", namespace: "admin.cases" }),
  ]);
  return (
    <>
      <div className="flex flex-col gap-4">
        <NextLink
          href="/admin/cases"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {t("back")}
        </NextLink>
        <ShellPageHeader title={`${t("case")} ${detail.caseNumber}`} />
      </div>
      <CaseDetailView
        detail={detail}
        locale="en"
        aside={
          <div className="sm:col-span-2">
            <dt className="text-sm text-ink-muted">{t("dentist")}</dt>
            <dd className="mt-1 text-ink">
              <NextLink href={`/admin/dentists/${detail.dentist.id}`} className="hover:underline">
                {detail.dentist.clinicName || detail.dentist.name}
              </NextLink>
              <span className="block text-sm text-ink-muted">
                {detail.dentist.name} · {detail.dentist.email}
              </span>
            </dd>
          </div>
        }
      />
    </>
  );
}
