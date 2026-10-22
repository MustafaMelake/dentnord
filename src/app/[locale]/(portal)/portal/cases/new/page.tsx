import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { WizardLoader } from "@/components/cases/wizard/wizard-page";
import { ShellPageHeader } from "@/components/shared/app-shell/app-shell";
import { PageSkeleton } from "@/components/shared/app-shell/page-skeleton";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portal.newCase");
  return { title: t("title") };
}

// The draft is created on the first autosave; the URL then becomes /portal/cases/<id>/edit.
export default async function NewCasePage() {
  const t = await getTranslations("portal.newCase");
  return (
    <>
      <ShellPageHeader title={t("title")} intro={t("intro")} />
      <Suspense fallback={<PageSkeleton />}>
        <NewCase />
      </Suspense>
    </>
  );
}

async function NewCase() {
  return <WizardLoader locale={await getLocale()} caseId={null} />;
}
