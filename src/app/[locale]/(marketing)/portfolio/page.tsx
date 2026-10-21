import { Images } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { Reveal } from "@/components/motion/reveal";
import { PortfolioCard } from "@/components/marketing/portfolio-card";
import { ButtonLink } from "@/components/shared/button";
import { Container } from "@/components/shared/container";
import { Missing } from "@/components/shared/missing";
import { SectionHeading } from "@/components/shared/section-label";
import { getPublishedPortfolio } from "@/server/queries/content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portfolio");
  return { title: t("title"), description: t("intro") };
}

// Published cases from the admin (Portfolio). Cached; the admin's save invalidates it immediately.
export default async function PortfolioPage() {
  const [t, locale, cases] = await Promise.all([
    getTranslations("portfolio"),
    getLocale(),
    getPublishedPortfolio(),
  ]);

  return (
    <Container as="main" className="flex flex-1 flex-col pt-32 pb-24 sm:pt-40">
      <Reveal className="flex flex-col gap-6">
        <SectionHeading label={t("label")} title={t("title")} />
        <p className="max-w-[52ch] text-lead text-ink-muted sm:ml-[11rem]">{t("intro")}</p>
      </Reveal>

      {cases.length === 0 ? (
        <div className="mt-14 flex flex-col items-center gap-5 rounded-media border border-line bg-surface px-6 py-20 text-center sm:mt-20">
          <span
            aria-hidden
            className="flex size-14 items-center justify-center rounded-full bg-brand-ice text-brand"
          >
            <Images className="size-6" />
          </span>
          <div className="flex max-w-md flex-col gap-2">
            <h2 className="text-display-sm text-ink">{t("comingSoonTitle")}</h2>
            <p className="text-ink-muted">{t("comingSoonBody")}</p>
          </div>
          <ButtonLink href="/contact" variant="secondary" icon>
            {t("contactCta")}
          </ButtonLink>
          <Missing field="portfolio" />
        </div>
      ) : (
        <Reveal stagger={0.08} className="mt-14 grid gap-x-6 gap-y-14 sm:mt-20 lg:grid-cols-2">
          {cases.map((item, i) => (
            <PortfolioCard key={item.id} item={item} locale={locale} index={i} />
          ))}
        </Reveal>
      )}
    </Container>
  );
}
