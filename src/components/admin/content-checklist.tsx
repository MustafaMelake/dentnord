import { CheckCircle2, Circle, ListChecks } from "lucide-react";
import { getTranslations } from "next-intl/server";
import NextLink from "next/link";

import { getContentChecklist } from "@/server/queries/content-checklist";

/** Dashboard card: everything still missing on the public site, each linking to its admin field. */
export async function ContentChecklistCard() {
  const [t, checklist] = await Promise.all([
    getTranslations({ locale: "en", namespace: "admin.content" }),
    getContentChecklist(),
  ]);
  const missing = checklist.items.filter((i) => !i.done);
  const done = checklist.items.filter((i) => i.done);

  return (
    <section
      aria-labelledby="checklist-heading"
      className="flex flex-col gap-5 rounded-card border border-line bg-surface p-6 sm:p-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-10 items-center justify-center rounded-full bg-brand-ice text-brand"
          >
            <ListChecks className="size-5" />
          </span>
          <div>
            <h2 id="checklist-heading" className="text-lg font-medium text-ink">
              {t("checklistTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("checklistIntro")}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="text-display-sm text-ink tabular-nums">{checklist.percent}%</span>{" "}
          {t("checklistProgress", { done: checklist.done, total: checklist.total })}
        </p>
      </div>
      <div
        role="progressbar"
        aria-label={t("checklistTitle")}
        aria-valuenow={checklist.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-brand" style={{ width: `${checklist.percent}%` }} />
      </div>

      {missing.length === 0 ? (
        <p className="text-sm text-ink">{t("checklistComplete")}</p>
      ) : (
        <ul className="grid gap-1 sm:grid-cols-2">
          {missing.map((item) => (
            <li key={item.field}>
              <NextLink
                href={item.href}
                className="group flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
              >
                <Circle aria-hidden className="mt-0.5 size-4 shrink-0 text-[#c9831f]" />
                <span className="flex flex-col">
                  <span className="text-ink group-hover:underline">
                    {t(`fields.${item.field}`)}
                  </span>
                  {item.detail && (
                    <span className="text-xs text-muted-foreground">
                      {t(`detail.${item.detail.key}`, { count: item.detail.count })}
                    </span>
                  )}
                </span>
              </NextLink>
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-ink">
            {t("checklistDone", { count: done.length })}
          </summary>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {done.map((item) => (
              <li
                key={item.field}
                className="flex items-center gap-2.5 px-2 py-1 text-muted-foreground"
              >
                <CheckCircle2 aria-hidden className="size-4 shrink-0 text-[#2f8a57]" />
                {t(`fields.${item.field}`)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
