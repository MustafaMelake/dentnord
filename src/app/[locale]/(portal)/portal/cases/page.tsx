import { FolderOpen, Search } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Form from "next/form";
import { Suspense } from "react";

import { CaseList } from "@/components/cases/case-list";
import { DraftList } from "@/components/cases/draft-list";
import { EmptyState } from "@/components/portal/empty-state";
import { ShellPageHeader } from "@/components/shared/app-shell/app-shell";
import { PageSkeleton } from "@/components/shared/app-shell/page-skeleton";
import { Button, ButtonLink } from "@/components/shared/button";
import { SelectInput, TextInput } from "@/components/shared/form-controls";
import { CaseStatus } from "@/generated/prisma/enums";
import { Link } from "@/i18n/navigation";
import { listOwnCases, listOwnDrafts } from "@/server/queries/cases";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portal.cases");
  return { title: t("title") };
}

const FILTER_STATUSES = Object.values(CaseStatus).filter((s) => s !== "DRAFT");

export default async function PortalCasesPage({
  searchParams,
}: PageProps<"/[locale]/portal/cases">) {
  const t = await getTranslations("portal");
  return (
    <>
      <ShellPageHeader
        title={t("cases.title")}
        intro={t("cases.intro")}
        actions={
          <ButtonLink href="/portal/cases/new" icon>
            {t("nav.newCase")}
          </ButtonLink>
        }
      />
      <Suspense fallback={<PageSkeleton />}>
        <Cases searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Cases({ searchParams }: Pick<PageProps<"/[locale]/portal/cases">, "searchParams">) {
  const params = await searchParams;
  const status = FILTER_STATUSES.find((s) => s === String(params.status ?? "").toUpperCase());
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 60) : "";
  const locale = await getLocale();
  const [t, tStatus, rows, drafts] = await Promise.all([
    getTranslations("portal.cases"),
    getTranslations("caseStatus"),
    listOwnCases(locale, { status, query }),
    listOwnDrafts(locale),
  ]);
  const filtered = Boolean(status || query);

  if (!filtered && rows.length === 0 && drafts.length === 0) {
    return (
      <EmptyState
        icon={<FolderOpen />}
        title={t("emptyTitle")}
        body={t("emptyBody")}
        cta={{ href: "/portal/cases/new", label: t("emptyCta") }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {drafts.length > 0 && (
        <section aria-labelledby="drafts-heading" className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="drafts-heading" className="font-mono text-label text-ink-muted">
              {t("draftsTitle", { count: drafts.length })}
            </h2>
            <p className="text-sm text-ink-muted">{t("draftsIntro")}</p>
          </div>
          <DraftList drafts={drafts} />
        </section>
      )}

      <section aria-labelledby="submitted-heading" className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 id="submitted-heading" className="font-mono text-label text-ink-muted">
            {t("submittedTitle")}
          </h2>
          <Form
            action={`/${locale}/portal/cases`}
            role="search"
            className="flex flex-col gap-2 sm:flex-row"
          >
            <div className="relative sm:w-72">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted"
              />
              <TextInput
                name="q"
                type="search"
                defaultValue={query}
                aria-label={t("searchLabel")}
                placeholder={t("searchPlaceholder")}
                className="pl-10"
              />
            </div>
            <SelectInput
              name="status"
              defaultValue={status?.toLowerCase() ?? ""}
              aria-label={t("statusLabel")}
              className="sm:w-52"
            >
              <option value="">{t("allStatuses")}</option>
              {FILTER_STATUSES.map((s) => (
                <option key={s} value={s.toLowerCase()}>
                  {tStatus(s)}
                </option>
              ))}
            </SelectInput>
            <Button type="submit" variant="secondary">
              {t("filter")}
            </Button>
          </Form>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center text-ink-muted">
            <p>{filtered ? t("noResults") : t("noneSubmitted")}</p>
            {filtered && (
              <Link href="/portal/cases" className="text-sm text-brand hover:underline">
                {t("clearFilters")}
              </Link>
            )}
          </div>
        ) : (
          <CaseList
            rows={rows}
            locale={locale}
            link={(row, children, className) => (
              <Link href={`/portal/cases/${row.id}`} className={className}>
                {children}
              </Link>
            )}
          />
        )}
      </section>
    </div>
  );
}
