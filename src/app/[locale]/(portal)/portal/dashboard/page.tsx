import { FolderOpen } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { EmptyState } from "@/components/portal/empty-state";
import { ShellPageHeader } from "@/components/shared/app-shell/app-shell";
import { PageSkeleton } from "@/components/shared/app-shell/page-skeleton";
import { ButtonLink } from "@/components/shared/button";
import { SectionLabel } from "@/components/shared/section-label";
import { countOwnCases, getOwnProfile } from "@/server/queries/dentist";

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
  const [t, profile, caseCount] = await Promise.all([
    getTranslations("portal.dashboard"),
    getOwnProfile(locale),
    countOwnCases(locale),
  ]);

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

      <section aria-labelledby="cases-heading" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 id="cases-heading" className="font-mono text-label text-ink-muted">
            {t("casesLabel")}
          </h2>
          {caseCount > 0 && (
            <ButtonLink href="/portal/cases" variant="secondary">
              {t("viewCases")}
            </ButtonLink>
          )}
        </div>
        {caseCount === 0 ? (
          <EmptyState
            icon={<FolderOpen />}
            title={t("emptyTitle")}
            body={t("emptyBody")}
            cta={{ href: "/portal/cases/new", label: t("emptyCta") }}
          />
        ) : (
          <p className="rounded-card border border-line bg-surface p-6 text-display-sm text-ink">
            {t("casesCount", { count: caseCount })}
          </p>
        )}
      </section>
    </>
  );
}
