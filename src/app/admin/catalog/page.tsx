import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { CatalogManager } from "@/components/admin/catalog-manager";
import { CATALOG_TABS, type CatalogTab } from "@/components/admin/tabs";
import { ShellPageHeader } from "@/components/shared/app-shell/app-shell";
import { PageSkeleton } from "@/components/shared/app-shell/page-skeleton";
import {
  listAdminGuideTypes,
  listAdminImplantSystems,
  listAdminSurgicalKits,
} from "@/server/queries/admin-content";

export const metadata: Metadata = { title: "Catalog" };

export default async function AdminCatalogPage({ searchParams }: PageProps<"/admin/catalog">) {
  const t = await getTranslations({ locale: "en", namespace: "admin.catalog" });
  return (
    <>
      <ShellPageHeader title={t("pageTitle")} intro={t("intro")} />
      <Suspense fallback={<PageSkeleton />}>
        <Catalog searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Catalog({ searchParams }: Pick<PageProps<"/admin/catalog">, "searchParams">) {
  const { tab } = await searchParams;
  const defaultTab = (CATALOG_TABS as readonly string[]).includes(String(tab))
    ? (tab as CatalogTab)
    : "guide-types";
  const [guideTypes, implantSystems, kits] = await Promise.all([
    listAdminGuideTypes(),
    listAdminImplantSystems(),
    listAdminSurgicalKits(),
  ]);
  return (
    <CatalogManager
      guideTypes={guideTypes}
      implantSystems={implantSystems}
      kits={kits}
      defaultTab={defaultTab}
    />
  );
}
