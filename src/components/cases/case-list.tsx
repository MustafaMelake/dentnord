import { ChevronRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { StatusBadge } from "@/components/shared/status-badge";
import { localized } from "@/lib/utils";
import type { CaseListRow } from "@/server/queries/cases";

// Submitted cases as a table (md and up) or as cards (phones), from the same rows. Server component:
// the caller passes `link` so the same list renders portal links (localized) and admin links.

export type CaseListItem = CaseListRow & {
  /** Admin only: who sent it. */
  dentist?: { name: string; clinicName: string | null } | null;
};

export function CaseList({
  rows,
  locale,
  link,
  highlightNew = false,
}: {
  rows: CaseListItem[];
  locale: string;
  link: (row: CaseListItem, children: ReactNode, className: string) => ReactNode;
  /** Admin: mark SUBMITTED cases (not looked at yet) as "new". */
  highlightNew?: boolean;
}) {
  const t = useTranslations("cases.list");
  const format = useFormatter();
  const date = (iso: string | null) =>
    iso ? format.dateTime(new Date(iso), { dateStyle: "medium" }) : "–";
  const showDentist = rows.some((r) => r.dentist);

  const newBadge = (row: CaseListItem) =>
    highlightNew && row.status === "SUBMITTED" ? (
      <span className="rounded-full bg-brand px-2 py-0.5 text-[0.6875rem] font-medium text-white">
        {t("new")}
      </span>
    ) : null;

  return (
    <>
      <div className="hidden overflow-hidden rounded-card border border-line bg-surface md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-surface-2/60 text-ink-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                {t("columns.case")}
              </th>
              {showDentist && (
                <th scope="col" className="px-4 py-3 font-medium">
                  {t("columns.dentist")}
                </th>
              )}
              <th scope="col" className="px-4 py-3 font-medium">
                {t("columns.patientCode")}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t("columns.guideType")}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                {t("columns.implants")}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t("columns.submitted")}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t("columns.status")}
              </th>
              <th scope="col" className="w-10 px-2">
                <span className="sr-only">{t("columns.open")}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr
                key={row.id}
                data-case-row={row.caseNumber ?? row.id}
                className="group relative hover:bg-surface-2/50"
              >
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2">
                    {link(
                      row,
                      <>
                        <span className="font-mono font-medium text-ink">{row.caseNumber}</span>
                        <span aria-hidden className="absolute inset-0" />
                      </>,
                      "outline-none focus-visible:underline",
                    )}
                    {newBadge(row)}
                  </span>
                </td>
                {showDentist && (
                  <td className="px-4 py-3">
                    <span className="flex flex-col">
                      <span className="text-ink">
                        {row.dentist?.clinicName || row.dentist?.name}
                      </span>
                      {row.dentist?.clinicName && (
                        <span className="text-xs text-ink-muted">{row.dentist.name}</span>
                      )}
                    </span>
                  </td>
                )}
                <td className="px-4 py-3 font-mono text-ink">{row.patientCode}</td>
                <td className="px-4 py-3 text-ink">
                  {row.guideTypeName ? localized(row.guideTypeName, locale) : "–"}
                </td>
                <td className="px-4 py-3 text-right text-ink tabular-nums">{row.implantCount}</td>
                <td className="px-4 py-3 whitespace-nowrap text-ink-muted">
                  {date(row.submittedAt)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-2 text-ink-muted">
                  <ChevronRight aria-hidden className="size-4" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <li
            key={row.id}
            data-case-card={row.caseNumber ?? row.id}
            className="relative rounded-card border border-line bg-surface p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="flex flex-wrap items-center gap-2">
                {link(
                  row,
                  <>
                    <span className="font-mono font-medium text-ink">{row.caseNumber}</span>
                    <span aria-hidden className="absolute inset-0" />
                  </>,
                  "outline-none focus-visible:underline",
                )}
                {newBadge(row)}
              </span>
              <StatusBadge status={row.status} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {row.dentist && (
                <div className="col-span-2">
                  <dt className="text-ink-muted">{t("columns.dentist")}</dt>
                  <dd className="text-ink">{row.dentist.clinicName || row.dentist.name}</dd>
                </div>
              )}
              <div>
                <dt className="text-ink-muted">{t("columns.patientCode")}</dt>
                <dd className="font-mono text-ink">{row.patientCode}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">{t("columns.implants")}</dt>
                <dd className="text-ink tabular-nums">{row.implantCount}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">{t("columns.guideType")}</dt>
                <dd className="text-ink">
                  {row.guideTypeName ? localized(row.guideTypeName, locale) : "–"}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">{t("columns.submitted")}</dt>
                <dd className="text-ink">{date(row.submittedAt)}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
