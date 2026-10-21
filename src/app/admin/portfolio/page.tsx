import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import NextLink from "next/link";
import { Suspense } from "react";

import { ContentList } from "@/components/admin/content-list";
import { ShellPageHeader } from "@/components/shared/app-shell/app-shell";
import { PageSkeleton } from "@/components/shared/app-shell/page-skeleton";
import { Button } from "@/components/ui/button";
import { listAdminPortfolio } from "@/server/queries/admin-content";

export const metadata: Metadata = { title: "Portfolio" };

export default async function AdminPortfolioPage() {
  const t = await getTranslations({ locale: "en", namespace: "admin.portfolio" });
  return (
    <>
      <ShellPageHeader
        title={t("pageTitle")}
        intro={t("intro")}
        actions={
          <Button asChild>
            <NextLink href="/admin/portfolio/new">
              <Plus data-icon="inline-start" />
              {t("new")}
            </NextLink>
          </Button>
        }
      />
      <Suspense fallback={<PageSkeleton />}>
        <Portfolio />
      </Suspense>
    </>
  );
}

async function Portfolio() {
  const [t, cases] = await Promise.all([
    getTranslations({ locale: "en", namespace: "admin.portfolio" }),
    listAdminPortfolio(),
  ]);
  return (
    <ContentList
      model="portfolioCase"
      flagLabel={t("published")}
      editPath="/admin/portfolio/"
      emptyText={t("empty")}
      items={cases.map((c) => ({
        id: c.id,
        title: c.title.en || c.title.da,
        subtitle: [
          `/${c.slug}`,
          c.guideTypeName ? c.guideTypeName.en || c.guideTypeName.da : null,
          t("imageCount", { count: c.imageCount }),
        ]
          .filter(Boolean)
          .join(" · "),
        thumbnail: c.cover,
        flag: c.published,
      }))}
    />
  );
}
