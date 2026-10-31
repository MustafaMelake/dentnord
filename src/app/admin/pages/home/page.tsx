import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { HomePageForm } from "@/components/admin/page-forms";
import { PagesNav } from "@/components/admin/pages-nav";
import { ShellPageHeader } from "@/components/shared/app-shell/app-shell";
import { PageSkeleton } from "@/components/shared/app-shell/page-skeleton";
import { requireAdmin } from "@/server/queries/session";
import { getHomePageSetting } from "@/server/queries/site-settings";

export const metadata: Metadata = { title: "Home page" };

export default async function AdminHomePage() {
  const t = await getTranslations({ locale: "en", namespace: "admin.pages" });
  return (
    <>
      <ShellPageHeader title={t("pageTitle")} intro={t("intro")} />
      <PagesNav current="home" />
      <Suspense fallback={<PageSkeleton />}>
        <Editor />
      </Suspense>
    </>
  );
}

async function Editor() {
  const [, { starter, ...values }] = await Promise.all([requireAdmin(), getHomePageSetting()]);
  return <HomePageForm values={values} starter={starter} />;
}
