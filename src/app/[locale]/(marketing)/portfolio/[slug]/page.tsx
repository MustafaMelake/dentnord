import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Reveal, RevealItem } from "@/components/motion/reveal";
import { ButtonLink } from "@/components/shared/button";
import { Chip } from "@/components/shared/chip";
import { Container } from "@/components/shared/container";
import { SiteImage } from "@/components/shared/site-image";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { cn, localized } from "@/lib/utils";
import { getPublishedPortfolioCase } from "@/server/queries/content";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/portfolio/[slug]">): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, getLocale()]);
  const item = await getPublishedPortfolioCase(slug);
  if (!item) return {};
  return {
    title: localized(item.title, locale),
    description: localized(item.summary, locale) || undefined,
  };
}

// The slug is only known at request time (cases are added in the admin), so the page content reads
// params inside <Suspense>; the case data itself is cached and invalidated by the admin's save.
export default function PortfolioCasePage({ params }: PageProps<"/[locale]/portfolio/[slug]">) {
  return (
    <Container as="main" className="flex flex-1 flex-col pt-32 pb-24 sm:pt-40">
      <Suspense
        fallback={
          <div className="flex flex-col gap-6">
            <Skeleton className="h-14 w-2/3 rounded-xl" />
            <Skeleton className="aspect-[16/9] rounded-media" />
          </div>
        }
      >
        <CaseStudy params={params} />
      </Suspense>
    </Container>
  );
}

async function CaseStudy({ params }: Pick<PageProps<"/[locale]/portfolio/[slug]">, "params">) {
  const [{ slug }, locale, t] = await Promise.all([
    params,
    getLocale(),
    getTranslations("portfolio"),
  ]);
  const item = await getPublishedPortfolioCase(slug);
  if (!item) notFound();

  const title = localized(item.title, locale);
  const summary = localized(item.summary, locale);
  const [first, ...rest] = item.images;

  return (
    <article className="flex flex-col gap-10 sm:gap-14">
      <Reveal className="flex flex-col gap-6">
        <Link
          href="/portfolio"
          className="inline-flex w-fit items-center gap-2 text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {t("back")}
        </Link>
        <h1 className="max-w-[20ch] text-display-lg text-ink">{title}</h1>
        {(item.guideTypeName || !!item.implantCount) && (
          <ul className="flex flex-wrap gap-2" aria-label={t("factsLabel")}>
            {item.guideTypeName && (
              <li>
                <Chip variant="soft">{localized(item.guideTypeName, locale)}</Chip>
              </li>
            )}
            {!!item.implantCount && (
              <li>
                <Chip>{t("implants", { count: item.implantCount })}</Chip>
              </li>
            )}
          </ul>
        )}
        {summary && <p className="max-w-[60ch] text-lead text-ink-muted">{summary}</p>}
      </Reveal>

      {first && (
        <section aria-label={t("galleryLabel")} className="flex flex-col gap-4">
          <Figure image={first} locale={locale} large />
          {rest.length > 0 && (
            <Reveal stagger={0.06} className="grid gap-4 sm:grid-cols-2">
              {rest.map((img) => (
                <RevealItem key={img.id}>
                  <Figure image={img} locale={locale} />
                </RevealItem>
              ))}
            </Reveal>
          )}
        </section>
      )}

      <div className="flex flex-col items-start gap-5 rounded-media bg-brand-deep p-8 text-white sm:flex-row sm:items-center sm:justify-between sm:p-10">
        <p className="max-w-[30ch] text-display-sm text-white">{t("ctaTitle")}</p>
        <ButtonLink href="/portal/cases/new" variant="light" icon>
          {t("cta")}
        </ButtonLink>
      </div>
    </article>
  );
}

function Figure({
  image,
  locale,
  large,
}: {
  image: {
    id: string;
    caption: { da: string; en: string };
    image: Parameters<typeof SiteImage>[0]["image"];
  };
  locale: string;
  large?: boolean;
}) {
  const caption = localized(image.caption, locale);
  return (
    <figure className="flex flex-col gap-3">
      <div
        className={cn(
          "relative overflow-hidden rounded-media",
          large ? "aspect-[16/10] sm:rounded-media-lg lg:aspect-[16/8]" : "aspect-[4/3]",
        )}
      >
        <SiteImage
          image={image.image}
          locale={locale}
          sizes={large ? "(min-width: 1440px) 1360px, 100vw" : "(min-width: 640px) 50vw, 100vw"}
          priority={large}
        />
      </div>
      {caption && <figcaption className="text-sm text-ink-muted">{caption}</figcaption>}
    </figure>
  );
}
