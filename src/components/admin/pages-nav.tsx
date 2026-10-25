import { ExternalLink } from "lucide-react";
import { getTranslations } from "next-intl/server";
import NextLink from "next/link";

import type { PageName } from "@/lib/validation/admin";
import { cn } from "@/lib/utils";

const PAGES: PageName[] = ["services", "about", "contact"];

/** Tabs between the three page editors, plus links to the live page in both languages. */
export async function PagesNav({ current }: { current: PageName }) {
  const t = await getTranslations({ locale: "en", namespace: "admin.pages" });
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label={t("navLabel")}>
        <ul className="flex flex-wrap gap-1 rounded-full bg-muted p-1">
          {PAGES.map((page) => (
            <li key={page}>
              <NextLink
                href={`/admin/pages/${page}`}
                aria-current={page === current ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center rounded-full px-4 text-sm transition-colors",
                  page === current
                    ? "bg-surface font-medium text-ink shadow-sm"
                    : "text-muted-foreground hover:text-ink",
                )}
              >
                {t(`names.${page}`)}
              </NextLink>
            </li>
          ))}
        </ul>
      </nav>
      <p className="flex items-center gap-3 text-sm text-muted-foreground">
        {t("viewOnSite")}
        {(["da", "en"] as const).map((locale) => (
          <a
            key={locale}
            href={`/${locale}/${current}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-xs text-brand uppercase hover:underline"
          >
            {locale}
            <ExternalLink aria-hidden className="size-3" />
          </a>
        ))}
      </p>
    </div>
  );
}
