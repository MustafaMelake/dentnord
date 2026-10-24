import { BellRing, FilePen, FolderOpen } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { CaseList } from "@/components/cases/case-list";
import { EmptyState } from "@/components/portal/empty-state";
import { ShellPageHeader } from "@/components/shared/app-shell/app-shell";
import { PageSkeleton } from "@/components/shared/app-shell/page-skeleton";
import { ButtonLink } from "@/components/shared/button";
import { SectionLabel } from "@/components/shared/section-label";
import { StatusBadge } from "@/components/shared/status-badge";
import type { CaseStatus } from "@/generated/prisma/enums";
import { Link } from "@/i18n/navigation";
import { getOwnCaseOverview } from "@/server/queries/cases";
import { getOwnProfile } from "@/server/queries/dentist";
import { requireApprovedDentist } from "@/server/queries/session";
import { unreadCounts } from "@/server/services/case-messages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portal.dashboard");
  return { title: t("title") };
}

export default async function PortalDashboardPage() {
  const t = await getTranslations("portal.dashboard");
  return (
    <>
      <ShellPageHeader title={t("title")} />
      <Suspense fallback={<PageSkeleton />}>
        <Dashboard />
      </Suspense>
    </>
  );
}

async function Dashboard() {
  const locale = await getLocale();
  const session = await requireApprovedDentist(locale);
  const [t, profile, overview, unread] = await Promise.all([
    getTranslations("portal.dashboard"),
    getOwnProfile(locale),
    getOwnCaseOverview(locale),
    unreadCounts({ id: session.user.id, role: "DENTIST" }),
  ]);
  const statusCounts = (Object.entries(overview.counts) as [CaseStatus, number][]).filter(
    ([status, n]) => status !== "DRAFT" && n > 0,
  );
  const submittedCount = statusCounts.reduce((sum, [, n]) => sum + n, 0);

  return (
    <>
      <section className="relative overflow-hidden rounded-media bg-[radial-gradient(120%_120%_at_85%_10%,#2f6cb5_0%,#1a4a80_40%,#0f2e4c_80%)] p-6 text-white sm:p-10">
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.05)_1px,transparent_1px)] [background-size:40px_40px]"
        />
        <div className="relative flex max-w-2xl flex-col gap-4">
          <SectionLabel tone="onDark">{profile.clinicName || profile.name}</SectionLabel>
          <h2 className="text-display-md text-white">{t("welcome", { name: profile.name })}</h2>
          <p className="text-white/80">{t("welcomeBody")}</p>
          <ButtonLink href="/portal/cases/new" variant="light" icon className="mt-2 w-fit">
            {t("newCase")}
          </ButtonLink>
        </div>
      </section>

      {overview.actionNeeded.length > 0 && (
        <section
          aria-labelledby="action-needed"
          className="flex flex-col gap-3"
          data-action-needed-list=""
        >
          <h2 id="action-needed" className="flex items-center gap-2 font-medium text-ink">
            <BellRing aria-hidden className="size-4 text-brand" />
            {t("actionNeeded", { count: overview.actionNeeded.length })}
          </h2>
          <ul className="flex flex-col gap-2">
            {overview.actionNeeded.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/portal/cases/${c.id}`}
                  data-action-case={c.caseNumber ?? c.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card border border-brand/30 bg-brand-ice/50 px-4 py-3 transition-colors hover:border-brand"
                >
                  <span className="font-mono font-medium text-ink">{c.caseNumber}</span>
                  <StatusBadge status={c.status} />
                  <span className="flex-1 text-sm text-ink">
                    {t(`actions.${c.status}` as "actions.NEEDS_FILES")}
                  </span>
                  <span className="text-sm font-medium text-brand">{t("open")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {overview.drafts > 0 && (
        <Link
          href="/portal/cases"
          className="flex items-center gap-3 rounded-card border border-dashed border-line bg-surface px-5 py-4 text-ink transition-colors hover:border-brand"
        >
          <FilePen aria-hidden className="size-5 shrink-0 text-brand" />
          <span className="flex-1">{t("drafts", { count: overview.drafts })}</span>
          <span className="text-sm text-brand">{t("continueDrafts")}</span>
        </Link>
      )}

      <section aria-labelledby="cases-heading" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 id="cases-heading" className="font-mono text-label text-ink-muted">
            {t("casesLabel")}
          </h2>
          {submittedCount > 0 && (
            <ButtonLink href="/portal/cases" variant="secondary">
              {t("viewCases")}
            </ButtonLink>
          )}
        </div>
        {submittedCount === 0 ? (
          <EmptyState
            icon={<FolderOpen />}
            title={t("emptyTitle")}
            body={t("emptyBody")}
            cta={{ href: "/portal/cases/new", label: t("emptyCta") }}
          />
        ) : (
          <>
            <ul aria-label={t("countsLabel")} className="flex flex-wrap gap-2">
              {statusCounts.map(([status, n]) => (
                <li key={status}>
                  <Link
                    href={`/portal/cases?status=${status.toLowerCase()}`}
                    className="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 pr-3 pl-1 text-sm text-ink hover:border-ink/25"
                  >
                    <StatusBadge status={status} />
                    <span className="tabular-nums">{n}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <CaseList
              rows={overview.recent}
              unread={unread.perCase}
              locale={locale}
              link={(row, children, className) => (
                <Link href={`/portal/cases/${row.id}`} className={className}>
                  {children}
                </Link>
              )}
            />
          </>
        )}
      </section>
    </>
  );
}
