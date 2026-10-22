import { Download, FileBox } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { StatusBadge } from "@/components/shared/status-badge";
import { DENTIST_FILE_KINDS } from "@/lib/case-files";
import { cn, localized } from "@/lib/utils";
import type { CaseDetail } from "@/server/queries/cases";

import { formatBytes, formatMm } from "./format";
import { ToothChart } from "./tooth-chart";

// Read-only case page body, shared by the dentist portal and the admin (which passes locale "en").
// File links go to the download route, which re-checks access and redirects to a 5-minute signed URL.

export const caseFileDownloadHref = (fileId: string) => `/api/uploads/files/${fileId}/download`;

export function CaseDetailView({
  detail,
  locale,
  aside,
}: {
  detail: CaseDetail;
  locale: string;
  aside?: ReactNode;
}) {
  const t = useTranslations("cases.detail");
  const tFiles = useTranslations("cases.wizard.files");
  const tStatus = useTranslations("caseStatus");
  const format = useFormatter();
  const mm = (v: number | null) => (v === null ? t("suggested") : `${formatMm(v, locale)} mm`);
  const fileKinds = [...DENTIST_FILE_KINDS, ...new Set(detail.files.map((f) => f.kind))].filter(
    (k, i, all) => all.indexOf(k) === i && detail.files.some((f) => f.kind === k),
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
      <div className="flex min-w-0 flex-col gap-6">
        <Panel title={t("summary")}>
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <Item label={t("status")} value={<StatusBadge status={detail.status} />} />
            <Item
              label={t("patientCode")}
              value={<span className="font-mono">{detail.patientCode}</span>}
            />
            <Item
              label={t("guideType")}
              value={detail.guideTypeName ? localized(detail.guideTypeName, locale) : "–"}
            />
            <Item
              label={t("surgeryDate")}
              value={
                detail.surgeryDate
                  ? format.dateTime(new Date(`${detail.surgeryDate}T00:00:00Z`), {
                      dateStyle: "long",
                      timeZone: "UTC",
                    })
                  : "–"
              }
            />
            <Item
              label={t("submitted")}
              value={
                detail.submittedAt
                  ? format.dateTime(new Date(detail.submittedAt), {
                      dateStyle: "long",
                      timeStyle: "short",
                    })
                  : "–"
              }
            />
            {aside}
            <Item
              label={t("notes")}
              value={detail.notes || "–"}
              className="whitespace-pre-line sm:col-span-2"
            />
          </dl>
        </Panel>

        <Panel title={t("sites", { count: detail.implants.length })}>
          <div className="flex flex-col gap-6">
            <ToothChart
              selected={detail.implants.map((i) => i.fdiTooth)}
              readOnly
              className="max-w-xl"
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="border-b border-line text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      {t("tooth")}
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      {t("system")}
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      {t("diameter")}
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      {t("length")}
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      {t("kit")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {detail.implants.map((i) => (
                    <tr key={i.fdiTooth}>
                      <td className="py-2.5 pr-4 font-mono font-medium text-ink">{i.fdiTooth}</td>
                      <td className="py-2.5 pr-4 text-ink">{i.system ?? "–"}</td>
                      <td className="py-2.5 pr-4 text-ink">{mm(i.diameter)}</td>
                      <td className="py-2.5 pr-4 text-ink">{mm(i.length)}</td>
                      <td className="py-2.5 text-ink">{i.kit ?? "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Panel>

        <Panel title={t("files")}>
          {detail.files.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("noFiles")}</p>
          ) : (
            <div className="flex flex-col gap-5">
              {fileKinds.map((kind) => (
                <section
                  key={kind}
                  aria-labelledby={`files-${kind}`}
                  className="flex flex-col gap-2"
                >
                  <h3 id={`files-${kind}`} className="font-mono text-label text-ink-muted">
                    {t(`fileKinds.${kind}`)}
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {detail.files
                      .filter((f) => f.kind === kind)
                      .map((f) => (
                        <li
                          key={f.id}
                          className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-sm"
                        >
                          <FileBox aria-hidden className="size-4 shrink-0 text-brand" />
                          <span className="min-w-0 flex-1 truncate text-ink" title={f.fileName}>
                            {f.fileName}
                            {f.scanPart && (
                              <span className="ml-2 text-xs text-ink-muted">
                                ({tFiles(`parts.${f.scanPart}`)})
                              </span>
                            )}
                          </span>
                          <span className="hidden shrink-0 text-xs text-ink-muted tabular-nums sm:inline">
                            {formatBytes(f.sizeBytes, locale)}
                          </span>
                          <a
                            href={caseFileDownloadHref(f.id)}
                            data-download={f.id}
                            aria-label={t("download", { name: f.fileName })}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-brand transition-colors hover:bg-brand-ice"
                          >
                            <Download aria-hidden className="size-4" />
                            <span className="hidden sm:inline">{t("downloadShort")}</span>
                          </a>
                        </li>
                      ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title={t("timeline")} className="xl:sticky xl:top-6">
        <ol className="relative flex flex-col gap-5 border-l border-line pl-5">
          {[...detail.events].reverse().map((e) => (
            <li key={e.id} className="relative">
              <span
                aria-hidden
                className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full border-2 border-surface bg-brand"
              />
              <p className="text-sm text-ink">
                {e.type === "STATUS_CHANGED" && e.toStatus
                  ? t("events.STATUS_CHANGED", { status: tStatus(e.toStatus) })
                  : t(`events.${e.type}`)}
              </p>
              <time dateTime={e.createdAt} className="text-xs text-ink-muted">
                {format.dateTime(new Date(e.createdAt), {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </time>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}

function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-card border border-line bg-surface p-5 sm:p-6",
        className,
      )}
    >
      <h2 className="font-medium text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Item({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="mt-1 break-words text-ink">{value}</dd>
    </div>
  );
}
