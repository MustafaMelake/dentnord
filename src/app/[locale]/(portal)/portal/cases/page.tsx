import { FolderOpen } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { EmptyState } from "@/components/portal/empty-state";
import { ShellPageHeader } from "@/components/shared/app-shell/app-shell";
import { PageSkeleton } from "@/components/shared/app-shell/page-skeleton";
import { ButtonLink } from "@/components/shared/button";
import { countOwnCases } from "@/server/queries/dentist";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portal.cases");
  return { title: t("title") };
}

// TODO: list the dentist's own cases (via server/queries/dentist.ts → ownCaseWhere).
export default async function PortalCasesPage() {
  const t = await getTranslations("portal");
  return (
    <>
      <ShellPageHeader
        title={t("cases.title")}
        intro={t("cases.intro")}
        actions={
          <ButtonLink href="/portal/cases/new" icon>
            {t("nav.newCase")}
          </ButtonLink>
        }
      />
      <Suspense fallback={<PageSkeleton />}>
        <Cases />
      </Suspense>
    </>
  );
}

async function Cases() {
  const locale = await getLocale();
  const [t, count] = await Promise.all([getTranslations("portal.cases"), countOwnCases(locale)]);
  if (count > 0) return null; // The case list arrives with the case submission feature.
  return (
    <EmptyState
      icon={<FolderOpen />}
      title={t("emptyTitle")}
      body={t("emptyBody")}
      cta={{ href: "/portal/cases/new", label: t("emptyCta") }}
    />
  );
}
