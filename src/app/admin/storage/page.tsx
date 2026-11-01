import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { StorageMediaLibrary } from "@/components/admin/storage-media-library";
import { StorageOverviewPanel } from "@/components/admin/storage-overview";
import { ShellPageHeader } from "@/components/shared/app-shell/app-shell";
import { PageSkeleton } from "@/components/shared/app-shell/page-skeleton";
import { getStorageOverview, listMediaWithUsage } from "@/server/queries/admin-storage";

export const metadata: Metadata = { title: "Storage" };

// R2 usage (from the database) and the media library, where unused site images can be deleted.
// Case files are read-only here.
export default async function AdminStoragePage() {
  const t = await getTranslations({ locale: "en", namespace: "admin.storage" });
  return (
    <>
      <ShellPageHeader title={t("title")} intro={t("intro")} />
      <Suspense fallback={<PageSkeleton />}>
        <Overview />
      </Suspense>
      <Suspense fallback={<PageSkeleton />}>
        <Media />
      </Suspense>
    </>
  );
}

async function Overview() {
  // Both queries re-check the admin session.
  return <StorageOverviewPanel overview={await getStorageOverview()} />;
}

async function Media() {
  const { configured, items } = await listMediaWithUsage();
  return <StorageMediaLibrary configured={configured} items={items} />;
}
