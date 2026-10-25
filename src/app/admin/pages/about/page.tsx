import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AboutPageForm } from "@/components/admin/page-forms";
import { PagesNav } from "@/components/admin/pages-nav";
import { ShellPageHeader } from "@/components/shared/app-shell/app-shell";
import { PageSkeleton } from "@/components/shared/app-shell/page-skeleton";
import { adminMediaStatus } from "@/server/queries/admin-content";
import { getImages } from "@/server/queries/media";
import { getAboutPageSetting } from "@/server/queries/site-settings";

export const metadata: Metadata = { title: "About page" };

export default async function AdminAboutPage() {
  const t = await getTranslations({ locale: "en", namespace: "admin.pages" });
  return (
    <>
      <ShellPageHeader title={t("pageTitle")} intro={t("intro")} />
      <PagesNav current="about" />
      <Suspense fallback={<PageSkeleton />}>
        <Editor />
      </Suspense>
    </>
  );
}

async function Editor() {
  // adminMediaStatus re-checks the admin session.
  const [media, { imageId, starter, ...values }] = await Promise.all([
    adminMediaStatus(),
    getAboutPageSetting(),
  ]);
  const images = await getImages([imageId]);
  return (
    <AboutPageForm
      values={values}
      image={imageId ? (images[imageId] ?? null) : null}
      starter={starter}
      mediaConfigured={media.configured}
    />
  );
}
