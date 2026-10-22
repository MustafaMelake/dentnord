import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { WizardLoader } from "@/components/cases/wizard/wizard-page";
import { ShellPageHeader } from "@/components/shared/app-shell/app-shell";
import { PageSkeleton } from "@/components/shared/app-shell/page-skeleton";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portal.newCase");
  return { title: t("editTitle") };
}

// Continue a draft. 404 unless it belongs to the signed-in dentist; submitted cases redirect to their page.
export default async function EditDraftPage({
  params,
  searchParams,
}: PageProps<"/[locale]/portal/cases/[id]/edit">) {
  const t = await getTranslations("portal.newCase");
  return (
    <>
      <ShellPageHeader title={t("editTitle")} intro={t("intro")} />
      <Suspense fallback={<PageSkeleton />}>
        <EditDraft params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function EditDraft({ params, searchParams }: PageProps<"/[locale]/portal/cases/[id]/edit">) {
  const [{ id }, { step }, locale] = await Promise.all([params, searchParams, getLocale()]);
  return <WizardLoader locale={locale} caseId={id} step={step} />;
}
