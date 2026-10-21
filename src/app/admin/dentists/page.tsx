import { Search } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Form from "next/form";
import NextLink from "next/link";
import { Suspense } from "react";

import { DentistsTable } from "@/components/admin/dentists-table";
import { ShellPageHeader } from "@/components/shared/app-shell/app-shell";
import { PageSkeleton } from "@/components/shared/app-shell/page-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DentistStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { countDentistsByStatus, DENTIST_TABS, listDentists } from "@/server/queries/admin-dentists";

export const metadata: Metadata = { title: "Dentists" };

export default async function AdminDentistsPage({ searchParams }: PageProps<"/admin/dentists">) {
  const t = await getTranslations({ locale: "en", namespace: "admin.dentists" });
  return (
    <>
      <ShellPageHeader title={t("title")} intro={t("intro")} />
      <Suspense fallback={<PageSkeleton />}>
        <Dentists searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function parseStatus(value: unknown): DentistStatus {
  const upper = typeof value === "string" ? value.toUpperCase() : "";
  return (DENTIST_TABS as readonly string[]).includes(upper) ? (upper as DentistStatus) : "PENDING";
}

async function Dentists({ searchParams }: Pick<PageProps<"/admin/dentists">, "searchParams">) {
  const params = await searchParams;
  const status = parseStatus(params.status);
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";

  const [t, tStatus, counts, rows] = await Promise.all([
    getTranslations({ locale: "en", namespace: "admin.dentists" }),
    getTranslations({ locale: "en", namespace: "dentistStatus" }),
    countDentistsByStatus(),
    listDentists({ status, query }),
  ]);

  const tabHref = (s: DentistStatus) => {
    const next = new URLSearchParams({ status: s.toLowerCase() });
    if (query) next.set("q", query);
    return `/admin/dentists?${next}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav
          aria-label={t("tabsLabel")}
          className="flex w-full overflow-x-auto rounded-full bg-surface-2 p-1 sm:w-fit"
        >
          {DENTIST_TABS.map((s) => {
            const active = s === status;
            return (
              <NextLink
                key={s}
                href={tabHref(s)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-1.5 text-sm whitespace-nowrap transition-colors sm:flex-none",
                  active
                    ? "bg-surface font-medium text-ink shadow-[0_1px_2px_rgb(11_27_43/0.08)]"
                    : "text-ink-muted hover:text-ink",
                )}
              >
                {tStatus(s)}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs tabular-nums",
                    active && s === "PENDING" && counts.PENDING > 0
                      ? "bg-brand text-white"
                      : "bg-ink/5",
                  )}
                >
                  {counts[s]}
                </span>
              </NextLink>
            );
          })}
        </nav>

        <Form action="/admin/dentists" role="search" className="flex w-full gap-2 lg:w-auto">
          <input type="hidden" name="status" value={status.toLowerCase()} />
          <div className="relative flex-1 lg:w-80">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
            />
            <Input
              name="q"
              type="search"
              defaultValue={query}
              aria-label={t("searchLabel")}
              placeholder={t("searchPlaceholder")}
              className="h-9 bg-surface pl-9"
            />
          </div>
          <Button type="submit" variant="outline" className="h-9">
            {t("search")}
          </Button>
        </Form>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line bg-surface px-6 py-14 text-center text-ink-muted">
          <p>{query ? t("emptySearch", { query }) : t("empty")}</p>
          {query && (
            <NextLink
              href={`/admin/dentists?status=${status.toLowerCase()}`}
              className="text-sm text-brand hover:underline"
            >
              {t("clear")}
            </NextLink>
          )}
        </div>
      ) : (
        <DentistsTable rows={rows} />
      )}
    </div>
  );
}
