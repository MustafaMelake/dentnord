import { CalendarClock, ChevronRight, MessageSquare } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { StatusBadge } from "@/components/shared/status-badge";
import { cn, localized } from "@/lib/utils";
import type { CaseListRow } from "@/server/queries/cases";

// Submitted cases as a table (md and up) or as cards (phones), from the same rows. Server component:
// the caller passes `link` so the same list renders portal links (localized) and admin links.
// Markers: "new" (admin, SUBMITTED), unread messages, and a surgery date within 7 days.

const SOON_DAYS = 7;
const FINAL = ["DELIVERED", "CANCELLED"];

/** Days until the planned surgery (0 = today), or null when there is none or it is past. */
export function daysUntilSurgery(surgeryDate: string | null, now: Date) {
  if (!surgeryDate) return null;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.round((new Date(`${surgeryDate}T00:00:00Z`).getTime() - today) / 86_400_000);
  return days >= 0 ? days : null;
}

export type CaseListItem = CaseListRow & {
  /** Admin only: who sent it. */
  dentist?: { name: string; clinicName: string | null } | null;
};

export function CaseList({
  rows,
  locale,
  link,
  highlightNew = false,
  unread = {},
  showSurgery = false,
  now = new Date(),
}: {
  rows: CaseListItem[];
  locale: string;
  link: (row: CaseListItem, children: ReactNode, className: string) => ReactNode;
  /** Admin: mark SUBMITTED cases (not looked at yet) as "new". */
  highlightNew?: boolean;
  /** Unread messages per case id. */
  unread?: Record<string, number>;
  /** A planned-surgery column (admin). */
  showSurgery?: boolean;
  now?: Date;
}) {
  const t = useTranslations("cases.list");
  const format = useFormatter();
  const date = (iso: string | null) =>
    iso ? format.dateTime(new Date(iso), { dateStyle: "medium" }) : "–";
  const showDentist = rows.some((r) => r.dentist);

  const soon = (row: CaseListItem) => {
    if (FINAL.includes(row.status)) return null;
    const days = daysUntilSurgery(row.surgeryDate, now);
    return days !== null && days <= SOON_DAYS ? days : null;
  };

  const newBadge = (row: CaseListItem) => {
    const days = soon(row);
    return (
      <>
        {highlightNew && row.status === "SUBMITTED" && (
          <span className="rounded-full bg-brand px-2 py-0.5 text-[0.6875rem] font-medium text-white">
            {t("new")}
          </span>
        )}
        {!!unread[row.id] && (
          <span
            data-unread={unread[row.id]}
            className="inline-flex items-center gap-1 rounded-full border border-brand px-1.5 py-0.5 text-[0.6875rem] font-medium text-brand"
          >
            <MessageSquare aria-hidden className="size-3" />
            {unread[row.id]}
            <span className="sr-only">{t("unread", { count: unread[row.id] })}</span>
          </span>
        )}
        {days !== null && (
          <span
            data-surgery-soon={days}
            className="inline-flex items-center gap-1 rounded-full bg-[#fbeedd] px-2 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap text-[#7a4a0c]"
          >
            <CalendarClock aria-hidden className="size-3" />
            {t("surgeryIn", { days })}
          </span>
        )}
      </>
    );
  };
  const surgery = (row: CaseListItem) =>
    row.surgeryDate
      ? format.dateTime(new Date(`${row.surgeryDate}T00:00:00Z`), {
          dateStyle: "medium",
          timeZone: "UTC",
        })
      : "–";

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
              {showSurgery && (
                <th scope="col" className="px-4 py-3 font-medium">
                  {t("columns.surgery")}
                </th>
              )}
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
                className={cn(
                  "group relative hover:bg-surface-2/50",
                  soon(row) !== null && "bg-[#fffaf0]",
                )}
              >
                <td className="px-4 py-3">
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
                {showSurgery && (
                  <td className="px-4 py-3 whitespace-nowrap text-ink">{surgery(row)}</td>
                )}
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
              {showSurgery && (
                <div>
                  <dt className="text-ink-muted">{t("columns.surgery")}</dt>
                  <dd className="text-ink">{surgery(row)}</dd>
                </div>
              )}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
