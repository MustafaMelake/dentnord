import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { CaseDetailView } from "@/components/cases/case-detail-view";
import { CaseStepper } from "@/components/cases/case-stepper";
import { CaseThread } from "@/components/cases/case-thread";
import { DentistCaseActions } from "@/components/cases/dentist-case-actions";
import { PlanVersions } from "@/components/cases/plan-versions";
import { CaseViewer } from "@/components/cases/viewer/case-viewer";
import { ShellPageHeader } from "@/components/shared/app-shell/app-shell";
import { PageSkeleton } from "@/components/shared/app-shell/page-skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { Link } from "@/i18n/navigation";
import { caseStorageConfigured } from "@/lib/storage";
import { getCasePage } from "@/server/queries/case-page";
import { requireApprovedDentist } from "@/server/queries/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portal.caseDetail");
  return { title: t("title") };
}

export default function PortalCasePage({ params }: PageProps<"/[locale]/portal/cases/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CaseDetail params={params} />
    </Suspense>
  );
}

async function CaseDetail({ params }: Pick<PageProps<"/[locale]/portal/cases/[id]">, "params">) {
  const [{ id }, locale] = await Promise.all([params, getLocale()]);
  const session = await requireApprovedDentist(locale);
  // 404 unless the case belongs to the signed-in dentist; drafts open in the wizard.
  const data = await getCasePage({ id: session.user.id, role: "DENTIST" }, id);
  if (!data) redirect(`/${locale}/portal/cases/${id}/edit`);
  const [t, tNext, tMessages] = await Promise.all([
    getTranslations("portal.caseDetail"),
    getTranslations("cases.stepper.next"),
    getTranslations("cases.messages"),
  ]);
  const { detail, status } = data;
  const latestPlan = data.plans.find((p) => p.id === data.latestSentPlanId) ?? null;

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
        <ShellPageHeader
          title={`${t("title")} ${detail.caseNumber}`}
          actions={<StatusBadge status={detail.status} className="text-sm" />}
        />
      </div>
      <CaseStepper status={status} next={tNext(status)} />
      <DentistCaseActions
        caseId={detail.id}
        locale={locale}
        status={status}
        allowed={data.allowed}
        needsFilesNote={data.needsFilesNote}
        statusChangedAt={detail.statusChangedAt}
        files={data.uploadFiles}
        storageConfigured={caseStorageConfigured()}
        latestPlan={latestPlan ? { id: latestPlan.id, version: latestPlan.version } : null}
        shipping={detail.shipping}
      />
      <CaseDetailView
        detail={detail}
        locale={locale}
        top={
          <>
            {data.plans.length > 0 && <PlanVersions plans={data.plans} locale={locale} />}
            <CaseViewer
              // A new set of layers (e.g. a plan was just sent) starts a fresh viewer.
              key={`${status}:${data.layers.map((l) => l.fileId).join(",")}`}
              layers={data.layers}
              hasCbct={data.hasCbct}
            />
          </>
        }
        bottom={
          <CaseThread
            caseId={detail.id}
            messages={data.messages}
            viewer="DENTIST"
            labels={{
              title: tMessages("title"),
              description: tMessages("description"),
              empty: tMessages("empty"),
              placeholder: tMessages("placeholder"),
            }}
          />
        }
      />
    </>
  );
}
