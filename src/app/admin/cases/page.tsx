import { Search } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Form from "next/form";
import NextLink from "next/link";
import { Suspense } from "react";

import { CaseList } from "@/components/cases/case-list";
import { ShellPageHeader } from "@/components/shared/app-shell/app-shell";
import { PageSkeleton } from "@/components/shared/app-shell/page-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CaseStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { countCasesByStatus, listAdminCases, listCaseDentists } from "@/server/queries/admin-cases";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: "en", namespace: "admin" });
  return { title: t("nav.cases") };
}

const STATUSES = Object.values(CaseStatus).filter((s) => s !== "DRAFT");

// Read-only for now: status changes, plan uploads and messages come in a later phase.
export default async function AdminCasesPage({ searchParams }: PageProps<"/admin/cases">) {
  const t = await getTranslations({ locale: "en", namespace: "admin.cases" });
  return (
    <>
      <ShellPageHeader title={t("title")} intro={t("intro")} />
      <Suspense fallback={<PageSkeleton />}>
        <Cases searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Cases({ searchParams }: Pick<PageProps<"/admin/cases">, "searchParams">) {
  const params = await searchParams;
  const status = STATUSES.find((s) => s === String(params.status ?? "").toUpperCase());
  const dentistId = typeof params.dentist === "string" ? params.dentist.slice(0, 64) : "";
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 60) : "";

  const [t, tStatus, counts, dentists, rows] = await Promise.all([
    getTranslations({ locale: "en", namespace: "admin.cases" }),
    getTranslations({ locale: "en", namespace: "caseStatus" }),
    countCasesByStatus(),
    listCaseDentists(),
    listAdminCases({ status, dentistId: dentistId || undefined, query }),
  ]);
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);

  const href = (next: { status?: string }) => {
    const p = new URLSearchParams();
    if (next.status) p.set("status", next.status.toLowerCase());
    if (dentistId) p.set("dentist", dentistId);
    if (query) p.set("q", query);
    const s = p.toString();
    return s ? `/admin/cases?${s}` : "/admin/cases";
  };

  return (
    <div className="flex flex-col gap-5">
      <nav
        aria-label={t("tabsLabel")}
        className="flex w-full overflow-x-auto rounded-full bg-surface-2 p-1 lg:w-fit"
      >
        {[undefined, ...STATUSES.filter((s) => counts[s])].map((s) => {
          const active = s === status;
          const n = s ? (counts[s] ?? 0) : total;
          return (
            <NextLink
              key={s ?? "all"}
              href={href({ status: s })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center justify-center gap-2 rounded-full px-4 py-1.5 text-sm whitespace-nowrap transition-colors",
                active
                  ? "bg-surface font-medium text-ink shadow-[0_1px_2px_rgb(11_27_43/0.08)]"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              {s ? tStatus(s) : t("all")}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  s === "SUBMITTED" && n > 0 ? "bg-brand text-white" : "bg-ink/5",
                )}
              >
                {n}
              </span>
            </NextLink>
          );
        })}
      </nav>

      <Form action="/admin/cases" role="search" className="flex flex-col gap-2 sm:flex-row">
        {status && <input type="hidden" name="status" value={status.toLowerCase()} />}
        <div className="relative flex-1 sm:max-w-80">
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
        <select
          name="dentist"
          defaultValue={dentistId}
          aria-label={t("dentistLabel")}
          className="h-9 rounded-md border border-input bg-surface px-3 text-sm sm:w-64"
        >
          <option value="">{t("allDentists")}</option>
          {dentists.map((d) => (
            <option key={d.id} value={d.id}>
              {d.clinicName ? `${d.clinicName} (${d.name})` : d.name}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline" className="h-9">
          {t("filter")}
        </Button>
      </Form>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line bg-surface px-6 py-14 text-center text-ink-muted">
          <p>{status || dentistId || query ? t("noResults") : t("empty")}</p>
          {(status || dentistId || query) && (
            <NextLink href="/admin/cases" className="text-sm text-brand hover:underline">
              {t("clear")}
            </NextLink>
          )}
        </div>
      ) : (
        <CaseList
          rows={rows}
          locale="en"
          highlightNew
          link={(row, children, className) => (
            <NextLink href={`/admin/cases/${row.id}`} className={className}>
              {children}
            </NextLink>
          )}
        />
      )}
    </div>
  );
}
