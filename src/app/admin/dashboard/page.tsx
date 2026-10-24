import { Stethoscope } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import NextLink from "next/link";
import { Suspense, type ReactNode } from "react";

import { ContentChecklistCard } from "@/components/admin/content-checklist";
import { ShellPageHeader } from "@/components/shared/app-shell/app-shell";
import { PageSkeleton } from "@/components/shared/app-shell/page-skeleton";
import { buttonStyles } from "@/components/shared/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CaseList, type CaseListItem } from "@/components/cases/case-list";
import { CASE_STATUSES } from "@/lib/case-workflow-rules";
import { countCasesByStatus, getAdminCaseOverview } from "@/server/queries/admin-cases";
import { countDentistsByStatus } from "@/server/queries/admin-dentists";
import { requireAdmin } from "@/server/queries/session";
import { unreadCounts } from "@/server/services/case-messages";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminDashboardPage() {
  const t = await getTranslations({ locale: "en", namespace: "admin.dashboard" });
  return (
    <>
      <ShellPageHeader title={t("title")} intro={t("intro")} />
      <Suspense fallback={<PageSkeleton />}>
        <CasesOverview />
      </Suspense>
      <Suspense fallback={<PageSkeleton />}>
        <Overview />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-72 rounded-card" />}>
        <ContentChecklistCard />
      </Suspense>
    </>
  );
}

async function Overview() {
  const [t, counts] = await Promise.all([
    getTranslations({ locale: "en", namespace: "admin.dashboard" }),
    countDentistsByStatus(),
  ]);
  const pending = counts.PENDING;

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <section
        aria-labelledby="pending-heading"
        className="flex flex-col gap-5 rounded-card border border-line bg-surface p-6 sm:p-8"
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-10 items-center justify-center rounded-full bg-brand-ice text-brand"
          >
            <Stethoscope className="size-5" />
          </span>
          <h2 id="pending-heading" className="text-lg font-medium text-ink">
            {t("pendingTitle")}
          </h2>
        </div>
        <p className="flex items-baseline gap-4">
          <span className="text-display-lg text-ink tabular-nums">{pending}</span>
          <span className="text-ink-muted">{t("pendingBody", { count: pending })}</span>
        </p>
        <NextLink
          href="/admin/dentists?status=pending"
          className={buttonStyles({
            variant: pending > 0 ? "primary" : "secondary",
            className: "w-fit",
          })}
        >
          {t("review")}
        </NextLink>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1">
        {(
          [
            ["approvedLabel", counts.APPROVED, "approved"],
            ["rejectedLabel", counts.REJECTED, "rejected"],
          ] as const
        ).map(([label, value, status]) => (
          <NextLink
            key={label}
            href={`/admin/dentists?status=${status}`}
            className="flex flex-col gap-1 rounded-card border border-line bg-surface p-6 transition-colors hover:border-ink/20"
          >
            <p className="text-sm text-ink-muted">{t(label)}</p>
            <p className="text-display-sm text-ink tabular-nums">{value}</p>
          </NextLink>
        ))}
      </div>
    </div>
  );
}

/** Cases: counts per status, what waits on us (oldest first), surgeries in the next 14 days. */
async function CasesOverview() {
  const [t, tStatus, counts, overview, session] = await Promise.all([
    getTranslations({ locale: "en", namespace: "admin.dashboard.cases" }),
    getTranslations({ locale: "en", namespace: "caseStatus" }),
    countCasesByStatus(),
    getAdminCaseOverview(),
    requireAdmin(),
  ]);
  const unread = await unreadCounts({ id: session.user.id, role: "ADMIN" });
  const statuses = CASE_STATUSES.filter((s) => s !== "DRAFT" && counts[s]);
  const link = (row: CaseListItem, children: ReactNode, className: string) => (
    <NextLink href={`/admin/cases/${row.id}`} className={className}>
      {children}
    </NextLink>
  );

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="case-counts" className="flex flex-col gap-3">
        <h2 id="case-counts" className="font-mono text-label text-ink-muted">
          {t("byStatus")}
        </h2>
        {statuses.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("none")}</p>
        ) : (
          <ul className="flex flex-wrap gap-2" data-case-counts="">
            {statuses.map((s) => (
              <li key={s}>
                <NextLink
                  href={`/admin/cases?status=${s.toLowerCase()}`}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 pr-3 pl-1 text-sm text-ink hover:border-ink/25"
                >
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">
                    {tStatus(s)}
                  </span>
                  <span className="tabular-nums">{counts[s]}</span>
                </NextLink>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="waiting-on-us" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="waiting-on-us" className="font-mono text-label text-ink-muted">
            {t("waitingOnUs")}
          </h2>
          <NextLink href="/admin/cases?queue=us" className="text-sm text-brand hover:underline">
            {t("viewAll")}
          </NextLink>
        </div>
        {overview.waiting.length === 0 ? (
          <p className="rounded-card border border-dashed border-line bg-surface p-5 text-sm text-ink-muted">
            {t("nothingWaiting")}
          </p>
        ) : (
          <CaseList
            rows={overview.waiting}
            locale="en"
            highlightNew
            showSurgery
            unread={unread.perCase}
            link={link}
          />
        )}
      </section>
      <section aria-labelledby="upcoming-surgeries" className="flex flex-col gap-3">
        <h2 id="upcoming-surgeries" className="font-mono text-label text-ink-muted">
          {t("upcoming")}
        </h2>
        {overview.upcoming.length === 0 ? (
          <p className="rounded-card border border-dashed border-line bg-surface p-5 text-sm text-ink-muted">
            {t("noUpcoming")}
          </p>
        ) : (
          <CaseList
            rows={overview.upcoming}
            locale="en"
            showSurgery
            unread={unread.perCase}
            link={link}
          />
        )}
      </section>
    </div>
  );
}
