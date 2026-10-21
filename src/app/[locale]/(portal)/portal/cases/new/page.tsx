import { FilePlus2 } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { EmptyState } from "@/components/portal/empty-state";
import { ShellPageHeader } from "@/components/shared/app-shell/app-shell";
import { PageSkeleton } from "@/components/shared/app-shell/page-skeleton";
import { getDentistScope } from "@/server/queries/dentist";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portal.newCase");
  return { title: t("title") };
}

// TODO: case form: patient code (never a name), FDI implant sites, implant system/diameter/length, guide type, surgical kit, Uppy uploads direct to R2.
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
  await getDentistScope(await getLocale());
  const t = await getTranslations("portal.newCase");
  return (
    <EmptyState icon={<FilePlus2 />} title={t("comingSoonTitle")} body={t("comingSoonBody")} />
  );
}
