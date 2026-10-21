import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import NextLink from "next/link";
import { Suspense, type ReactNode } from "react";

import { DentistActions } from "@/components/admin/dentist-actions";
import { PageSkeleton } from "@/components/shared/app-shell/page-skeleton";
import type { DentistStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { getDentistDetail } from "@/server/queries/admin-dentists";

export const metadata: Metadata = { title: "Dentist" };

export default function AdminDentistPage({ params }: PageProps<"/admin/dentists/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DentistDetail params={params} />
    </Suspense>
  );
}

const statusTone: Record<DentistStatus, string> = {
  PENDING: "bg-brand-soft text-brand-deep",
  APPROVED: "bg-[#e1f2e8] text-[#1d5b38]",
  REJECTED: "bg-destructive/10 text-destructive",
};

async function DentistDetail({ params }: Pick<PageProps<"/admin/dentists/[id]">, "params">) {
  const { id } = await params;
  const [{ dentist, history }, t, tStatus, format] = await Promise.all([
    getDentistDetail(id),
    getTranslations({ locale: "en", namespace: "admin.dentists" }),
    getTranslations({ locale: "en", namespace: "dentistStatus" }),
    getFormatter({ locale: "en" }),
  ]);

  const none = t("detail.none");
  const dateTime = (d: Date | null) =>
    d
      ? format.dateTime(d, {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Europe/Copenhagen",
        })
      : none;
  const country = dentist.country
    ? (new Intl.DisplayNames(["en"], { type: "region" }).of(dentist.country) ?? dentist.country)
    : none;
  const language =
    dentist.preferredLocale === "en" ? t("detail.languages.en") : t("detail.languages.da");

  return (
    <>
      <NextLink
        href={`/admin/dentists?status=${dentist.dentistStatus.toLowerCase()}`}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {t("back")}
      </NextLink>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <span
            className={cn(
              "w-fit rounded-full px-3 py-1 text-xs font-medium",
              statusTone[dentist.dentistStatus],
            )}
          >
            {tStatus(dentist.dentistStatus)}
          </span>
          <h1 className="text-display-sm text-ink sm:text-[2rem] sm:leading-tight">
            {dentist.name}
          </h1>
          <p className="text-ink-muted">{dentist.clinicName || none}</p>
        </div>
        <DentistActions
          dentist={{ id: dentist.id, name: dentist.name, status: dentist.dentistStatus }}
        />
      </div>

      {dentist.dentistStatus === "REJECTED" && dentist.rejectionReason && (
        <div className="rounded-card border border-destructive/20 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">{t("detail.rejectionReason")}</p>
          <p className="whitespace-pre-line text-ink">{dentist.rejectionReason}</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("detail.account")}>
          <Row label={t("detail.name")} value={dentist.name} />
          <Row
            label={t("detail.email")}
            value={
              <a href={`mailto:${dentist.email}`} className="text-brand hover:underline">
                {dentist.email}
              </a>
            }
          />
          <Row
            label={t("detail.phone")}
            value={
              dentist.phone ? (
                <a href={`tel:${dentist.phone}`} className="text-brand hover:underline">
                  {dentist.phone}
                </a>
              ) : (
                none
              )
            }
          />
          <Row label={t("detail.language")} value={language} />
          <Row label={t("detail.registered")} value={dateTime(dentist.createdAt)} />
          <Row label={t("detail.termsAccepted")} value={dateTime(dentist.termsAcceptedAt)} />
          <Row label={t("detail.reviewed")} value={dateTime(dentist.reviewedAt)} />
        </Card>
        <Card title={t("detail.clinic")}>
          <Row label={t("detail.clinicName")} value={dentist.clinicName || none} />
          <Row
            label={t("detail.address")}
            value={<span className="whitespace-pre-line">{dentist.address || none}</span>}
          />
          <Row label={t("detail.country")} value={country} />
          <Row label={t("detail.cvr")} value={dentist.cvr || none} />
          <Row label={t("detail.cases")} value={String(dentist._count.cases)} />
          <Row label={t("detail.sessions")} value={String(dentist._count.sessions)} />
        </Card>
      </div>

      <section aria-labelledby="history-heading" className="flex flex-col gap-3">
        <h2 id="history-heading" className="font-mono text-label text-ink-muted">
          {t("detail.history")}
        </h2>
        {history.length === 0 ? (
          <p className="rounded-card border border-dashed border-line bg-surface p-5 text-sm text-ink-muted">
            {t("detail.historyEmpty")}
          </p>
        ) : (
          <ol className="flex flex-col divide-y divide-line rounded-card border border-line bg-surface">
            {history.map((entry) => {
              const reason = (entry.metadata as { reason?: string } | null)?.reason;
              return (
                <li
                  key={entry.id}
                  className="flex flex-col gap-1 p-4 text-sm sm:flex-row sm:items-baseline sm:gap-4"
                >
                  <span className="w-44 shrink-0 text-ink-muted tabular-nums">
                    {dateTime(entry.createdAt)}
                  </span>
                  <span className="flex flex-col gap-1">
                    <span>
                      <span className="font-medium text-ink">{t(`audit.${entry.action}`)}</span>{" "}
                      <span className="text-ink-muted">
                        {t("detail.by", { email: entry.actorEmail })}
                      </span>
                    </span>
                    {reason && (
                      <span className="whitespace-pre-line text-ink-muted">“{reason}”</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface p-5 sm:p-6">
      <h2 className="mb-3 font-mono text-label text-ink-muted">{title}</h2>
      <dl className="flex flex-col divide-y divide-line">{children}</dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 py-2.5 text-sm sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="break-words text-ink">{value}</dd>
    </div>
  );
}
