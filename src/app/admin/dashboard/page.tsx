import { Stethoscope } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import NextLink from "next/link";
import { Suspense } from "react";

import { ContentChecklistCard } from "@/components/admin/content-checklist";
import { ShellPageHeader } from "@/components/shared/app-shell/app-shell";
import { PageSkeleton } from "@/components/shared/app-shell/page-skeleton";
import { buttonStyles } from "@/components/shared/button";
import { Skeleton } from "@/components/ui/skeleton";
import { countDentistsByStatus } from "@/server/queries/admin-dentists";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminDashboardPage() {
  const t = await getTranslations({ locale: "en", namespace: "admin.dashboard" });
  return (
    <>
      <ShellPageHeader title={t("title")} intro={t("intro")} />
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
