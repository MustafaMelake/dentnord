import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CaseActionPanel } from "@/components/admin/case-action-panel";
import { CaseDetailView } from "@/components/cases/case-detail-view";
import { CaseStepper } from "@/components/cases/case-stepper";
import { CaseThread } from "@/components/cases/case-thread";
import { PlanVersions } from "@/components/cases/plan-versions";
import { CaseViewer } from "@/components/cases/viewer/case-viewer";
import { ShellPageHeader } from "@/components/shared/app-shell/app-shell";
import { PageSkeleton } from "@/components/shared/app-shell/page-skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { caseStorageConfigured } from "@/lib/storage";
import { getCasePage } from "@/server/queries/case-page";
import { requireAdmin } from "@/server/queries/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: "en", namespace: "admin" });
  return { title: t("caseDetail") };
}

export default function AdminCasePage({ params }: PageProps<"/admin/cases/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CaseDetail params={params} />
    </Suspense>
  );
}

async function CaseDetail({ params }: Pick<PageProps<"/admin/cases/[id]">, "params">) {
  const { id } = await params;
  const session = await requireAdmin();
  const data = await getCasePage({ id: session.user.id, role: "ADMIN" }, id);
  if (!data) notFound(); // drafts are private to the dentist
  const [t, tl] = await Promise.all([
    getTranslations({ locale: "en", namespace: "admin.cases" }),
    getTranslations({ locale: "en", namespace: "admin.lifecycle" }),
  ]);
  const { detail, status } = data;

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
        <ShellPageHeader
          title={`${t("case")} ${detail.caseNumber}`}
          actions={<StatusBadge status={detail.status} className="text-sm" />}
        />
      </div>
      <CaseStepper status={status} next={tl(`next.${status}`)} />
      <CaseActionPanel
        caseId={detail.id}
        status={status}
        allowed={data.allowed}
        plans={data.plans}
        storageConfigured={caseStorageConfigured()}
      />
      <CaseDetailView
        detail={detail}
        locale="en"
        audience="admin"
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
        top={
          <>
            {data.plans.length > 0 && <PlanVersions plans={data.plans} locale="en" />}
            <CaseViewer
              // A new set of layers (e.g. a plan was just sent) starts a fresh viewer.
              key={`${status}:${data.layers.map((l) => l.fileId).join(",")}`}
              layers={data.layers}
              hasCbct={data.hasCbct}
            />
          </>
        }
        bottom={
          <>
            <CaseThread
              caseId={detail.id}
              messages={data.messages}
              viewer="ADMIN"
              labels={{
                title: tl("thread.title"),
                description: tl("thread.description"),
                empty: tl("thread.empty"),
                placeholder: tl("thread.placeholder"),
              }}
            />
            <CaseThread
              caseId={detail.id}
              messages={data.internalNotes}
              viewer="ADMIN"
              internal
              labels={{
                title: tl("internal.title"),
                description: tl("internal.description"),
                empty: tl("internal.empty"),
                placeholder: tl("internal.placeholder"),
              }}
            />
          </>
        }
      />
    </>
  );
}
