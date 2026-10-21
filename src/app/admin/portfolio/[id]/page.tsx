import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import NextLink from "next/link";
import { Suspense } from "react";

import { PortfolioForm } from "@/components/admin/portfolio-form";
import { ShellPageHeader } from "@/components/shared/app-shell/app-shell";
import { PageSkeleton } from "@/components/shared/app-shell/page-skeleton";
import { emptyBilingual } from "@/lib/validation/admin";
import {
  adminMediaStatus,
  getAdminPortfolioCase,
  guideTypeOptions,
} from "@/server/queries/admin-content";

export const metadata: Metadata = { title: "Edit case" };

/** /admin/portfolio/new creates; /admin/portfolio/<id> edits. */
export default function AdminPortfolioCasePage({ params }: PageProps<"/admin/portfolio/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Case params={params} />
    </Suspense>
  );
}

async function Case({ params }: Pick<PageProps<"/admin/portfolio/[id]">, "params">) {
  const { id } = await params;
  const [t, media, guideTypes] = await Promise.all([
    getTranslations({ locale: "en", namespace: "admin.portfolio" }),
    adminMediaStatus(),
    guideTypeOptions(),
  ]);
  const item =
    id === "new"
      ? {
          id: null,
          slug: "",
          title: emptyBilingual(),
          summary: emptyBilingual(),
          guideTypeId: null,
          implantCount: null,
          published: false,
          images: [],
        }
      : await getAdminPortfolioCase(id);

  return (
    <>
      <NextLink
        href="/admin/portfolio"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {t("back")}
      </NextLink>
      <ShellPageHeader title={item.id ? item.title.en || item.title.da : t("new")} />
      <PortfolioForm item={item} guideTypes={guideTypes} mediaConfigured={media.configured} />
    </>
  );
}
