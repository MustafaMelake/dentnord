import { CheckCircle2, Download, FileText, MessageSquareWarning } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { PlanView } from "@/server/services/case-plans";

import { caseFileDownloadHref } from "./case-detail-view";
import { formatBytes } from "./format";

// Plan versions, newest first. The latest sent version is highlighted; older ones stay visible,
// read-only, with their decision (who, when, the comment or the approval statement). The dentist's
// page only ever receives sent versions; the admin also sees the one being prepared.

export function PlanVersions({ plans, locale }: { plans: PlanView[]; locale: string }) {
  const t = useTranslations("cases.plans");
  const format = useFormatter();
  const dt = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" });
  const latestSent = plans.find((p) => p.sentAt);

  return (
    <section
      id="plans"
      aria-labelledby="plans-heading"
      className="flex scroll-mt-24 flex-col gap-4 rounded-card border border-line bg-surface p-5 sm:p-6"
    >
      <h2 id="plans-heading" className="font-medium text-ink">
        {t("title")}
      </h2>
      {plans.length === 0 ? (
        <p className="text-sm text-ink-muted">{t("none")}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {plans.map((p) => {
            const note = p.note
              ? locale === "en"
                ? p.note.en || p.note.da
                : p.note.da || p.note.en
              : "";
            const isLatest = p.id === latestSent?.id;
            return (
              <li
                key={p.id}
                data-plan-version={p.version}
                className={cn(
                  "flex flex-col gap-3 rounded-xl border p-4",
                  isLatest ? "border-brand/40 bg-brand-ice/40" : "border-line",
                )}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-medium text-ink">
                    {t("version", { version: p.version })}
                    {isLatest && (
                      <span className="ml-2 text-xs font-normal text-brand">{t("latest")}</span>
                    )}
                  </h3>
                  <span className="text-xs text-ink-muted">
                    {p.sentAt ? t("sent", { date: dt(p.sentAt) }) : t("preparing")}
                  </span>
                </div>
                {note && (
                  <p className="text-sm [overflow-wrap:anywhere] whitespace-pre-wrap text-ink">
                    {note}
                  </p>
                )}
                {p.files.length > 0 && (
                  <ul className="flex flex-col gap-1.5">
                    {p.files
                      .filter((f) => f.uploadStatus === "COMPLETE")
                      .map((f) => (
                        <li key={f.id} className="flex items-center gap-2 text-sm">
                          <FileText aria-hidden className="size-4 shrink-0 text-brand" />
                          <span className="min-w-0 flex-1 truncate text-ink" title={f.fileName}>
                            <span className="text-ink-muted">
                              {t(`kinds.${f.kind}` as "kinds.PLAN_REPORT")}:
                            </span>{" "}
                            {f.fileName}
                          </span>
                          <span className="hidden shrink-0 text-xs text-ink-muted sm:inline">
                            {formatBytes(f.sizeBytes, locale)}
                          </span>
                          <a
                            href={caseFileDownloadHref(f.id)}
                            data-download={f.id}
                            aria-label={t("download", { name: f.fileName })}
                            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-brand hover:bg-brand-ice"
                          >
                            <Download aria-hidden className="size-4" />
                          </a>
                        </li>
                      ))}
                  </ul>
                )}
                {p.decision === "APPROVED" && (
                  <div
                    className="flex flex-col gap-1 rounded-lg bg-[#e1f2e8] px-3 py-2 text-sm text-[#1d5b38]"
                    data-decision="APPROVED"
                  >
                    <span className="flex items-center gap-1.5 font-medium">
                      <CheckCircle2 aria-hidden className="size-4" />
                      {t("approvedBy", { name: p.decidedBy ?? "–", date: dt(p.decidedAt!) })}
                    </span>
                    {p.approvalStatement && <q className="text-xs italic">{p.approvalStatement}</q>}
                  </div>
                )}
                {p.decision === "CHANGES_REQUESTED" && (
                  <div
                    className="flex flex-col gap-1 rounded-lg bg-[#fbeedd] px-3 py-2 text-sm text-[#7a4a0c]"
                    data-decision="CHANGES_REQUESTED"
                  >
                    <span className="flex items-center gap-1.5 font-medium">
                      <MessageSquareWarning aria-hidden className="size-4" />
                      {t("changesBy", { name: p.decidedBy ?? "–", date: dt(p.decidedAt!) })}
                    </span>
                    {p.decisionComment && (
                      <p className="[overflow-wrap:anywhere] whitespace-pre-wrap">
                        {p.decisionComment}
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
