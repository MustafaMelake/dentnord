import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { PageCta } from "@/components/marketing/pages/page-cta";
import { PageHero } from "@/components/marketing/pages/page-hero";
import { pageText } from "@/components/marketing/pages/page-text";
import { Paragraphs } from "@/components/marketing/pages/paragraphs";
import { Reveal, RevealItem } from "@/components/motion/reveal";
import { Container } from "@/components/shared/container";
import { Missing, missingProps } from "@/components/shared/missing";
import { MissingMarker } from "@/components/shared/missing-marker";
import { SectionHeading, SectionLabel } from "@/components/shared/section-label";
import { SiteImage } from "@/components/shared/site-image";
import { formatPrice } from "@/lib/price";
import { localized } from "@/lib/utils";
import { getPublishedServices } from "@/server/queries/catalog";
import { getImages } from "@/server/queries/media";
import { getServicesPageSetting } from "@/server/queries/site-settings";

// Services: the page texts from /admin/pages/services + the published services from /admin/services.

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t, page] = await Promise.all([
    getLocale(),
    getTranslations("pages"),
    getServicesPageSetting(),
  ]);
  return {
    title: pageText(page.title, locale) || t("services"),
    description: pageText(page.intro, locale) || undefined,
  };
}

export default async function ServicesPage() {
  const [locale, t, tNav, page, services] = await Promise.all([
    getLocale(),
    getTranslations("servicesPage"),
    getTranslations("nav"),
    getServicesPageSetting(),
    getPublishedServices(),
  ]);
  const images = await getImages([page.imageId]);
  const image = page.imageId ? (images[page.imageId] ?? null) : null;
  const text = (key: Exclude<keyof typeof page, "imageId" | "starter">) =>
    pageText(page[key], locale);
  const missingImage = await missingProps("services.images");

  return (
    <main>
      <PageHero
        label={tNav("services")}
        title={text("title") || tNav("services")}
        intro={text("intro")}
        missingIntro={<Missing field="servicesPage.intro" />}
      >
        <div className="relative aspect-[4/3] overflow-hidden rounded-media sm:aspect-[16/7] sm:rounded-media-lg">
          <SiteImage
            image={image}
            locale={locale}
            priority
            sizes="(min-width: 1440px) 1360px, 100vw"
            missing={<Missing field="servicesPage.image" />}
          />
        </div>
      </PageHero>

      {services.length > 0 && (
        <section aria-labelledby="services-list" className="py-16 sm:py-24">
          <Container>
            <Reveal>
              {text("listHeading") ? (
                <SectionHeading
                  index="01"
                  label={t("listLabel")}
                  title={text("listHeading")}
                  id="services-list"
                />
              ) : (
                <>
                  <h2 id="services-list" className="sr-only">
                    {t("listLabel")}
                  </h2>
                  <Missing field="servicesPage.listHeading" />
                </>
              )}
            </Reveal>
            <Reveal
              as="ul"
              stagger={0.08}
              className="mt-12 grid gap-x-6 gap-y-14 sm:mt-16 md:grid-cols-2"
            >
              {services.map((s, i) => {
                const summary = localized(s.summary, locale);
                const note = localized(s.priceNote, locale);
                const price =
                  s.priceAmount === null
                    ? t("priceOnRequest")
                    : s.priceAmount === 0
                      ? t("free")
                      : `${s.priceFrom ? `${t("from")} ` : ""}${formatPrice(s.priceAmount, s.currency, locale)}`;
                return (
                  <RevealItem as="li" key={s.id}>
                    {/* Anchor for the home carousel's /services#<slug> links, below the fixed header. */}
                    <article
                      id={s.slug}
                      aria-labelledby={`service-${s.slug}`}
                      className="flex scroll-mt-28 flex-col gap-5"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden rounded-media">
                        <SiteImage
                          image={s.image}
                          locale={locale}
                          sizes="(min-width: 768px) 50vw, 100vw"
                        />
                        {!s.image && (
                          <MissingMarker {...missingImage} className="absolute top-4 left-4 z-10" />
                        )}
                      </div>
                      <div className="flex flex-col gap-3">
                        <span className="font-mono text-label text-ink-muted">
                          {String(i + 1).padStart(2, "0")} /{" "}
                          {String(services.length).padStart(2, "0")}
                        </span>
                        <h3 id={`service-${s.slug}`} className="text-display-sm text-ink">
                          {localized(s.title, locale)}
                        </h3>
                        {summary && <p className="max-w-[52ch] text-ink-muted">{summary}</p>}
                        <p className="flex flex-wrap items-baseline gap-x-2 border-t border-line pt-4 text-ink">
                          <span className="font-medium">{price}</span>
                          {note && s.priceAmount !== null && s.priceAmount > 0 && (
                            <span className="text-sm text-ink-muted">{note}</span>
                          )}
                        </p>
                      </div>
                    </article>
                  </RevealItem>
                );
              })}
            </Reveal>
          </Container>
        </section>
      )}

      <section aria-labelledby="services-process" className="py-16 sm:py-24">
        <Container>
          <Reveal className="grid gap-10 border-t border-line pt-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
            <div className="flex flex-col gap-5">
              <SectionLabel index="02">{t("processLabel")}</SectionLabel>
              <h2
                id="services-process"
                className={text("processHeading") ? "text-display-md text-ink" : "sr-only"}
              >
                {text("processHeading") || t("processLabel")}
              </h2>
            </div>
            <div className="flex flex-col gap-3">
              {text("processBody") ? (
                <Paragraphs text={text("processBody")} className="text-lead text-ink" />
              ) : null}
              {(!text("processHeading") || !text("processBody")) && (
                <Missing field="servicesPage.process" />
              )}
            </div>
          </Reveal>
        </Container>
      </section>

      <PageCta
        id="services-cta"
        title={text("ctaTitle")}
        body={text("ctaBody")}
        label={text("ctaLabel")}
        href="/portal/cases/new"
        missing={
          !text("ctaTitle") || !text("ctaLabel") ? <Missing field="servicesPage.cta" /> : undefined
        }
      />
    </main>
  );
}
