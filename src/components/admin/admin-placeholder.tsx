import { Construction } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { ShellPageHeader } from "@/components/shared/app-shell/app-shell";
import { PageSkeleton } from "@/components/shared/app-shell/page-skeleton";
import { requireAdmin } from "@/server/queries/session";

/** Admin section that isn't built yet. Still re-checks the admin session like every admin page. */
export function AdminPlaceholder({ title }: { title: string }) {
  return (
    <>
      <ShellPageHeader title={title} />
      <Suspense fallback={<PageSkeleton />}>
        <Body />
      </Suspense>
    </>
  );
}

async function Body() {
  await requireAdmin();
  const t = await getTranslations({ locale: "en", namespace: "admin" });
  return (
    <div className="flex items-center gap-3 rounded-card border border-dashed border-line bg-surface p-6 text-ink-muted">
      <Construction aria-hidden className="size-5 shrink-0" />
      {t("comingSoon")}
    </div>
  );
}
