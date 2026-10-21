import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import NextLink from "next/link";
import { Suspense } from "react";

import { ContentList, ExampleBanner } from "@/components/admin/content-list";
import { ShellPageHeader } from "@/components/shared/app-shell/app-shell";
import { PageSkeleton } from "@/components/shared/app-shell/page-skeleton";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/price";
import { listAdminServices } from "@/server/queries/admin-content";

export const metadata: Metadata = { title: "Services" };

export default async function AdminServicesPage() {
  const t = await getTranslations({ locale: "en", namespace: "admin.services" });
  return (
    <>
      <ShellPageHeader
        title={t("pageTitle")}
        intro={t("intro")}
        actions={
          <Button asChild>
            <NextLink href="/admin/services/new">
              <Plus data-icon="inline-start" />
              {t("new")}
            </NextLink>
          </Button>
        }
      />
      <Suspense fallback={<PageSkeleton />}>
        <Services />
      </Suspense>
    </>
  );
}

async function Services() {
  const [t, services] = await Promise.all([
    getTranslations({ locale: "en", namespace: "admin.services" }),
    listAdminServices(),
  ]);
  const price = (s: (typeof services)[number]) =>
    s.priceAmount === null
      ? t("onRequest")
      : `${s.priceFrom ? t("from") + " " : ""}${formatPrice(s.priceAmount, "DKK", "en")}`;

  return (
    <div className="flex flex-col gap-4">
      <ExampleBanner count={services.filter((s) => s.isExample).length} storageKey="services" />
      <ContentList
        model="service"
        flagLabel={t("published")}
        editPath="/admin/services/"
        emptyText={t("empty")}
        items={services.map((s) => ({
          id: s.id,
          title: s.title.en || s.title.da,
          subtitle: price(s),
          thumbnail: s.image,
          flag: s.published,
          isExample: s.isExample,
        }))}
      />
    </div>
  );
}
