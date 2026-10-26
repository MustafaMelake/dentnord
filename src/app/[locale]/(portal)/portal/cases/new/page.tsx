import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { WizardLoader } from "@/components/cases/wizard/wizard-page";
import { ShellPageHeader } from "@/components/shared/app-shell/app-shell";
import { PageSkeleton } from "@/components/shared/app-shell/page-skeleton";
import { FormAlert } from "@/components/shared/form-controls";
import { Link } from "@/i18n/navigation";
import { canOpenDraft, STORAGE_LIMITS } from "@/lib/storage-limits";
import { countOwnDrafts } from "@/server/queries/dentist";

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
  const locale = await getLocale();
  // createDraft enforces the limit; this only explains it up front instead of a failing autosave.
  if (!canOpenDraft(await countOwnDrafts(locale))) {
    const t = await getTranslations("portal.newCase");
    return (
      <FormAlert tone="info" className="max-w-2xl">
        {t("draftLimit", { max: STORAGE_LIMITS.maxOpenDrafts })}{" "}
        <Link href="/portal/cases" className="font-medium underline underline-offset-4">
          {t("draftLimitLink")}
        </Link>
      </FormAlert>
    );
  }
  return <WizardLoader locale={locale} caseId={null} />;
}
