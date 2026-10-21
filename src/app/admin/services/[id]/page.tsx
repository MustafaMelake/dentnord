import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import NextLink from "next/link";
import { Suspense } from "react";

import { ServiceForm } from "@/components/admin/service-form";
import { ShellPageHeader } from "@/components/shared/app-shell/app-shell";
import { PageSkeleton } from "@/components/shared/app-shell/page-skeleton";
import { emptyBilingual } from "@/lib/validation/admin";
import { adminMediaStatus, getAdminService } from "@/server/queries/admin-content";

export const metadata: Metadata = { title: "Edit service" };

/** /admin/services/new creates; /admin/services/<id> edits. */
export default function AdminServicePage({ params }: PageProps<"/admin/services/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Service params={params} />
    </Suspense>
  );
}

async function Service({ params }: Pick<PageProps<"/admin/services/[id]">, "params">) {
  const { id } = await params;
  const [t, media] = await Promise.all([
    getTranslations({ locale: "en", namespace: "admin.services" }),
    adminMediaStatus(),
  ]);
  const service =
    id === "new"
      ? {
          id: null,
          title: emptyBilingual(),
          summary: emptyBilingual(),
          description: emptyBilingual(),
          priceAmount: null,
          priceFrom: false,
          priceNote: emptyBilingual(),
          published: false,
          image: null,
          isExample: false,
        }
      : await getAdminService(id);

  return (
    <>
      <NextLink
        href="/admin/services"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {t("back")}
      </NextLink>
      <ShellPageHeader title={service.id ? service.title.en || service.title.da : t("new")} />
      {service.isExample && (
        <p
          role="status"
          className="rounded-card border border-[#c9831f]/40 bg-[#fbeedd] px-4 py-3 text-sm text-[#7a4a0c]"
        >
          {t("exampleNotice")}
        </p>
      )}
      <ServiceForm service={service} mediaConfigured={media.configured} />
    </>
  );
}
