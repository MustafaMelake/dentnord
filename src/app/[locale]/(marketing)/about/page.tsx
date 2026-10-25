import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { PageCta } from "@/components/marketing/pages/page-cta";
import { PageHero } from "@/components/marketing/pages/page-hero";
import { pageText } from "@/components/marketing/pages/page-text";
import { Paragraphs } from "@/components/marketing/pages/paragraphs";
import { Reveal, RevealItem } from "@/components/motion/reveal";
import { Container } from "@/components/shared/container";
import { Missing } from "@/components/shared/missing";
import { SectionHeading, SectionLabel } from "@/components/shared/section-label";
import { SiteImage } from "@/components/shared/site-image";
import type { ContentField } from "@/lib/content-fields";
import { cn, localized } from "@/lib/utils";
import { getImages } from "@/server/queries/media";
import {
  getAboutPageSetting,
  getDoctorSetting,
  getStatsSetting,
} from "@/server/queries/site-settings";

// About: the page texts from /admin/pages/about, the doctor and the numbers from /admin/settings.
// Nothing factual is written here: every fact comes from the admin, and empty ones are hidden.

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t, page] = await Promise.all([
    getLocale(),
    getTranslations("pages"),
    getAboutPageSetting(),
  ]);
  return {
    title: pageText(page.title, locale) || t("about"),
    description: pageText(page.intro, locale) || undefined,
  };
}

export default async function AboutPage() {
  const [locale, t, tHome, tNav, page, doctor, stats] = await Promise.all([
    getLocale(),
    getTranslations("aboutPage"),
    getTranslations("home"),
    getTranslations("nav"),
    getAboutPageSetting(),
    getDoctorSetting(),
    getStatsSetting(),
  ]);
  const images = await getImages([doctor.portraitId, page.imageId]);
  const img = (id: string | null) => (id ? (images[id] ?? null) : null);
  const text = (key: Exclude<keyof typeof page, "imageId" | "starter">) =>
    pageText(page[key], locale);
  const fmt = (n: number) => new Intl.NumberFormat(locale).format(n);

  const credentials = localized(doctor.credentials, locale);
  const bio = localized(doctor.bio, locale);
  const languages = localized(doctor.languages, locale);
  const facts = [
    {
      key: "experience",
      label: tHome("about.facts.experience.label"),
      value:
        stats.yearsExperience !== null
          ? tHome("about.facts.experience.value", { years: fmt(stats.yearsExperience) })
          : null,
      field: "stats.yearsExperience",
    },
    {
      key: "location",
      label: tHome("about.facts.location.label"),
      value: doctor.city ? tHome("about.facts.location.value", { city: doctor.city }) : null,
      field: "doctor.city",
    },
    {
      key: "languages",
      label: tHome("about.facts.languages.label"),
      value: languages || null,
      field: "doctor.languages",
    },
  ] as const;
  const numbers = [
    { key: "clinics", label: t("stats.clinics"), value: stats.clinics, field: "stats.clinics" },
    {
      key: "guides",
      label: tHome("technology.stats.guides"),
      value: stats.guidesDelivered,
      field: "stats.guidesDelivered",
    },
    {
      key: "turnaround",
      label: tHome("technology.stats.turnaround"),
      value: stats.turnaroundDays,
      unit: tHome("technology.stats.turnaroundUnit"),
      field: "stats.turnaroundDays",
    },
  ] as const;
  const shownNumbers = numbers.filter((n) => n.value !== null);

  return (
    <main>
      <PageHero
        label={tNav("about")}
        title={text("title") || tNav("about")}
        intro={text("intro")}
        missingIntro={<Missing field="aboutPage.intro" />}
      />

      {/* The doctor */}
      <section aria-labelledby="about-doctor" className="pb-16 sm:pb-24">
        <Container className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <Reveal>
            <div className="relative aspect-[4/5] overflow-hidden rounded-media sm:rounded-media-lg">
              <SiteImage
                image={img(doctor.portraitId)}
                locale={locale}
                priority
                sizes="(min-width: 1024px) 40vw, 100vw"
                missing={<Missing field="doctor.portrait" />}
              />
            </div>
          </Reveal>
          <Reveal className="flex flex-col gap-8 lg:pt-6">
            <div className="flex flex-col gap-4">
              <SectionLabel index="01">{t("doctorLabel")}</SectionLabel>
              {doctor.name ? (
                <h2 id="about-doctor" className="text-display-lg text-ink">
                  {doctor.name}
                </h2>
              ) : (
                <>
                  <h2 id="about-doctor" className="sr-only">
                    {t("doctorLabel")}
                  </h2>
                  <Missing field="doctor.name" />
                </>
              )}
              {credentials ? (
                <p className="text-lead text-ink-muted">{credentials}</p>
              ) : (
                <Missing field="doctor.credentials" />
              )}
            </div>
            {bio ? (
              <Paragraphs text={bio} className="max-w-[58ch] text-lead text-ink" />
            ) : (
              <Missing field="doctor.bio" />
            )}
            {facts.some((f) => f.value) && (
              <dl className="grid gap-6 border-t border-line pt-6 sm:grid-cols-3">
                {facts
                  .filter((f) => f.value)
                  .map((f) => (
                    <div key={f.key} className="flex flex-col gap-1">
                      <dt className="text-sm text-ink-muted">{f.label}</dt>
                      <dd className="font-medium text-ink">{f.value}</dd>
                    </div>
                  ))}
              </dl>
            )}
            <div className="flex flex-wrap gap-2 empty:hidden">
              {facts
                .filter((f) => !f.value)
                .map((f) => (
                  <Missing key={f.key} field={f.field} />
                ))}
            </div>
          </Reveal>
        </Container>
      </section>

      {/* Areas of expertise (the list itself is the doctor's, from Settings → Doctor) */}
      {doctor.expertise.length > 0 ? (
        <section aria-labelledby="about-expertise" className="py-16 sm:py-24">
          <Container>
            <Reveal>
              <SectionHeading
                index="02"
                label={tHome("about.expertiseLabel")}
                title={text("expertiseHeading") || tHome("about.expertiseLabel")}
                id="about-expertise"
              />
              {!text("expertiseHeading") && (
                <Missing field="aboutPage.expertiseHeading" className="mt-4" />
              )}
            </Reveal>
            <Reveal as="ul" stagger={0.06} className="mt-10 border-t border-line sm:mt-14">
              {doctor.expertise.map((row, i) => (
                <RevealItem
                  as="li"
                  key={row.id}
                  className="group flex items-baseline gap-5 border-b border-line py-5 sm:gap-10 sm:py-6"
                >
                  <span className="w-6 shrink-0 font-mono text-label text-ink-muted">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 text-display-sm text-ink-muted transition-colors duration-300 group-hover:text-ink">
                    {localized(row.title, locale)}
                  </span>
                  <span className="text-right text-sm text-ink-muted">
                    {localized(row.tag, locale)}
                  </span>
                </RevealItem>
              ))}
            </Reveal>
          </Container>
        </section>
      ) : (
        <Container className="py-8">
          <Missing field="doctor.expertise" />
        </Container>
      )}

      {/* How we work */}
      <section aria-labelledby="about-approach" className="py-16 sm:py-24">
        <Container className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          <Reveal className="flex flex-col gap-6">
            <SectionLabel index="03">{t("approachLabel")}</SectionLabel>
            {text("approachHeading") ? (
              <h2 id="about-approach" className="text-display-lg text-ink">
                {text("approachHeading")}
              </h2>
            ) : (
              <h2 id="about-approach" className="sr-only">
                {t("approachLabel")}
              </h2>
            )}
            {text("approachBody") && (
              <Paragraphs text={text("approachBody")} className="text-lead text-ink-muted" />
            )}
            {(!text("approachHeading") || !text("approachBody")) && (
              <Missing field="aboutPage.approach" />
            )}
          </Reveal>
          <Reveal>
            <div className="relative aspect-[4/3] overflow-hidden rounded-media sm:rounded-media-lg">
              <SiteImage
                image={img(page.imageId)}
                locale={locale}
                sizes="(min-width: 1024px) 50vw, 100vw"
                missing={<Missing field="aboutPage.image" />}
              />
            </div>
          </Reveal>
        </Container>
      </section>

      {/* The numbers (Settings → Numbers); only the ones that are filled in. With none, the
          section is left out and only the admin's markers remain. */}
      {shownNumbers.length > 0 ? (
        <section aria-labelledby="about-numbers" className="py-16 sm:py-24">
          <Container>
            <Reveal className="flex flex-col gap-10 border-t border-line pt-12">
              {text("statsHeading") ? (
                <h2 id="about-numbers" className="max-w-[22ch] text-display-md text-ink">
                  {text("statsHeading")}
                </h2>
              ) : (
                <>
                  <h2 id="about-numbers" className="sr-only">
                    {t("statsLabel")}
                  </h2>
                  <Missing field="aboutPage.statsHeading" />
                </>
              )}
              <dl className="grid gap-8 sm:grid-cols-3">
                {shownNumbers.map((n) => (
                  <div key={n.key} className="flex flex-col gap-2">
                    <dt className="text-sm text-ink-muted">{n.label}</dt>
                    <dd className="text-display-xl text-ink tabular-nums">
                      {fmt(n.value!)}
                      {"unit" in n && (
                        <span className="ml-2 text-lead text-ink-muted">{n.unit}</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>
            <MissingNumbers numbers={numbers} className="mt-6" />
          </Container>
        </section>
      ) : (
        <Container>
          <MissingNumbers numbers={numbers} className="pb-10" />
        </Container>
      )}

      <PageCta
        id="about-cta"
        title={text("ctaTitle")}
        body={text("ctaBody")}
        label={text("ctaLabel")}
        href="/portal/cases/new"
        missing={
          !text("ctaTitle") || !text("ctaLabel") ? <Missing field="aboutPage.cta" /> : undefined
        }
      />
    </main>
  );
}

/** Admin-only markers for the numbers that aren't filled in (renders nothing for visitors). */
function MissingNumbers({
  numbers,
  className,
}: {
  numbers: readonly { key: string; value: number | null; field: ContentField }[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2 empty:hidden", className)}>
      {numbers
        .filter((n) => n.value === null)
        .map((n) => (
          <Missing key={n.key} field={n.field} />
        ))}
    </div>
  );
}
