import { getTranslations } from "next-intl/server";
import NextLink from "next/link";

import { formatBytes, STORAGE_LIMITS } from "@/lib/storage-limits";
import { R2_FREE_TIER_BYTES, usageShare } from "@/lib/storage-usage";
import { cn } from "@/lib/utils";
import type { StorageOverview } from "@/server/queries/admin-storage";

// Read-only: totals per bucket, the total against R2's free allowance, and case files per dentist
// against the per-dentist cap.

export async function StorageOverviewPanel({ overview }: { overview: StorageOverview }) {
  const t = await getTranslations({ locale: "en", namespace: "admin.storage" });
  const { cases, media, dentists } = overview;
  const total = cases.bytes + media.bytes;
  const share = usageShare(total, R2_FREE_TIER_BYTES);
  const allowance = t("allowance.value", {
    used: formatBytes(total),
    limit: formatBytes(R2_FREE_TIER_BYTES),
    percent: share.percent,
  });

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="storage-usage-heading" className="flex flex-col gap-4">
        <h2 id="storage-usage-heading" className="font-mono text-label text-ink-muted">
          {t("usageHeading")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Stat
            id="cases"
            label={t("cases.label")}
            value={formatBytes(cases.bytes)}
            detail={t("cases.detail", { count: cases.files })}
            swatch="bg-brand"
          />
          <Stat
            id="media"
            label={t("media.label")}
            value={formatBytes(media.bytes)}
            detail={t("media.detail", { count: media.files })}
            swatch="bg-brand-soft"
          />
        </div>

        <div
          data-storage-allowance=""
          className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium text-ink">{t("allowance.title")}</p>
            <p className="text-sm text-ink-muted tabular-nums">{allowance}</p>
          </div>
          <div
            role="meter"
            aria-label={t("allowance.title")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(share.percent, 100)}
            aria-valuetext={allowance}
            className="flex h-3 overflow-hidden rounded-full bg-surface-2"
          >
            <span
              className="h-full bg-brand"
              style={{ width: `${usageShare(cases.bytes, R2_FREE_TIER_BYTES).ratio * 100}%` }}
            />
            <span
              className="h-full bg-brand-soft"
              style={{ width: `${usageShare(media.bytes, R2_FREE_TIER_BYTES).ratio * 100}%` }}
            />
          </div>
          <p className={cn("text-sm", share.over ? "text-destructive" : "text-ink-muted")}>
            {share.over ? t("allowance.over") : t("allowance.note")}
          </p>
        </div>
      </section>

      <section aria-labelledby="storage-dentists-heading" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="storage-dentists-heading" className="font-mono text-label text-ink-muted">
            {t("dentists.heading")}
          </h2>
          <p className="text-sm text-ink-muted">
            {t("dentists.intro", { cap: formatBytes(STORAGE_LIMITS.maxBytesPerDentist) })}
          </p>
        </div>
        {dentists.length === 0 ? (
          <p className="rounded-card border border-dashed border-line bg-surface p-6 text-center text-sm text-ink-muted">
            {t("dentists.empty")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-card border border-line bg-surface">
            <table className="w-full min-w-[36rem] text-sm" data-storage-dentists="">
              <thead className="text-left text-ink-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-3 font-medium">{t("dentists.columns.dentist")}</th>
                  <th className="px-4 py-3 text-right font-medium">
                    {t("dentists.columns.files")}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    {t("dentists.columns.stored")}
                  </th>
                  <th className="px-4 py-3 font-medium">{t("dentists.columns.cap")}</th>
                </tr>
              </thead>
              <tbody>
                {dentists.map((d) => {
                  const cap = usageShare(d.quotaBytes, STORAGE_LIMITS.maxBytesPerDentist);
                  return (
                    <tr
                      key={d.dentistId}
                      data-dentist-id={d.dentistId}
                      className="border-b border-line last:border-0"
                    >
                      <td className="px-4 py-3">
                        <NextLink
                          href={`/admin/dentists/${d.dentistId}`}
                          className="font-medium text-ink hover:underline"
                        >
                          {d.name || t("dentists.unnamed")}
                        </NextLink>
                        {d.clinic && <p className="text-ink-muted">{d.clinic}</p>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums" data-files="">
                        {d.fileCount}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums" data-stored="">
                        {formatBytes(d.storedBytes)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="h-2 w-24 shrink-0 overflow-hidden rounded-full bg-surface-2">
                            <span
                              className={cn(
                                "block h-full",
                                cap.ratio >= 0.9 ? "bg-destructive" : "bg-brand",
                              )}
                              style={{ width: `${cap.ratio * 100}%` }}
                            />
                          </span>
                          <span className="whitespace-nowrap text-ink-muted tabular-nums">
                            {t("dentists.capValue", {
                              used: formatBytes(d.quotaBytes),
                              percent: cap.percent,
                            })}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  id,
  label,
  value,
  detail,
  swatch,
}: {
  id: string;
  label: string;
  value: string;
  detail: string;
  swatch: string;
}) {
  return (
    <div
      data-storage-total={id}
      className="flex flex-col gap-1 rounded-card border border-line bg-surface p-5 sm:p-6"
    >
      <p className="flex items-center gap-2 text-sm text-ink-muted">
        <span aria-hidden className={cn("size-2.5 rounded-full", swatch)} />
        {label}
      </p>
      <p className="text-display-sm text-ink tabular-nums" data-value="">
        {value}
      </p>
      <p className="text-sm text-ink-muted">{detail}</p>
    </div>
  );
}
