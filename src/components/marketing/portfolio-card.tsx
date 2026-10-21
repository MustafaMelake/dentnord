import { useTranslations } from "next-intl";

import { ArrowCircle } from "@/components/shared/button";
import { SiteImage } from "@/components/shared/site-image";
import { Link } from "@/i18n/navigation";
import { localized } from "@/lib/utils";
import type { PublicPortfolioCase } from "@/server/queries/content";

/** Grid card: cover image (first gallery image), title, guide type and number of implants. */
export function PortfolioCard({
  item,
  locale,
  index,
}: {
  item: PublicPortfolioCase;
  locale: string;
  index: number;
}) {
  const t = useTranslations("portfolio");
  const cover = item.images[0]?.image ?? null;
  const facts = [
    item.guideTypeName ? localized(item.guideTypeName, locale) : null,
    item.implantCount ? t("implants", { count: item.implantCount }) : null,
  ].filter(Boolean);

  return (
    <Link
      href={`/portfolio/${item.slug}`}
      className="group flex flex-col gap-5"
      aria-label={localized(item.title, locale)}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-media transition-transform duration-500 ease-spring motion-safe:group-hover:-translate-y-1">
        <div className="absolute inset-0 transition-transform duration-700 ease-spring motion-safe:group-hover:scale-[1.03]">
          <SiteImage image={cover} locale={locale} sizes="(min-width: 1024px) 40vw, 100vw" />
        </div>
        <ArrowCircle variant="glass" size="lg" className="absolute right-5 bottom-5" />
      </div>
      <div className="flex flex-col gap-2">
        <p className="font-mono text-label text-ink-muted">
          {String(index + 1).padStart(2, "0")}
          {facts.length > 0 && <span> · {facts.join(" · ")}</span>}
        </p>
        <h2 className="text-display-sm text-ink">{localized(item.title, locale)}</h2>
        {localized(item.summary, locale) && (
          <p className="line-clamp-2 max-w-[56ch] text-ink-muted">
            {localized(item.summary, locale)}
          </p>
        )}
      </div>
    </Link>
  );
}
