import { getTranslations } from "next-intl/server";

import { FadeIn } from "@/components/motion/fade-in";
import { SplitText } from "@/components/motion/split-text";
import { ArrowCircle, ButtonLink } from "@/components/shared/button";
import { Chip } from "@/components/shared/chip";
import { Container } from "@/components/shared/container";
import { PlaceholderImage } from "@/components/shared/placeholder-image";
import { Link } from "@/i18n/navigation";
import { localized } from "@/lib/utils";

type HeroProps = {
  locale: string;
  guideTypes: { id: string; name: unknown }[];
  clinics: number | null;
  yearsExperience: number | null;
};

export async function Hero({ locale, guideTypes, clinics, yearsExperience }: HeroProps) {
  const t = await getTranslations("home.hero");
  const fmt = (n: number | null) => (n === null ? "[X]" : new Intl.NumberFormat(locale).format(n));

  return (
    // data-over-hero: the fixed header renders transparent with white text while over this section.
    <section data-over-hero="" aria-labelledby="hero-title" className="p-2 sm:p-3">
      <div className="relative isolate flex min-h-[calc(100svh-1rem)] flex-col overflow-hidden rounded-media text-white sm:min-h-[calc(100svh-1.5rem)] sm:rounded-media-lg lg:min-h-[44rem]">
        <PlaceholderImage
          alt={t("imageAlt")}
          fill
          tone="dark"
          priority
          sizes="100vw"
          className="-z-10"
          captionPosition="top-right"
          captionClassName="hidden sm:flex sm:top-28 lg:top-32"
        />
        {/* Keeps white text legible once the real photo is in. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,rgb(11_27_43/0.72)_0%,rgb(11_27_43/0.35)_45%,rgb(11_27_43/0)_75%)]"
        />

        <Container className="flex flex-1 flex-col pt-28 pb-5 sm:pt-32 sm:pb-8 lg:pt-36">
          <FadeIn delay={0.05}>
            <p className="flex items-center gap-3 text-sm text-white/85">
              <span aria-hidden className="flex -space-x-2">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-7 rounded-full border-2 border-white/80 bg-[linear-gradient(135deg,#d6e6f5,#8fb4dd)]"
                  />
                ))}
              </span>
              <span>{t("trust", { count: fmt(clinics) })}</span>
            </p>
          </FadeIn>

          <div className="flex flex-1 flex-col justify-end gap-8 pt-14 sm:pt-20">
            <div className="flex max-w-3xl flex-col gap-6">
              <SplitText
                as="h1"
                id="hero-title"
                trigger="load"
                delay={0.1}
                text={t("title")}
                className="max-w-[13ch] text-display-2xl"
              />
              <FadeIn delay={0.45}>
                <p className="max-w-[46ch] text-lead text-white/85">{t("subtitle")}</p>
              </FadeIn>
              <FadeIn delay={0.55} className="flex flex-wrap items-center gap-3">
                <ButtonLink href="/portal/cases/new" variant="light" size="lg" icon>
                  {t("primaryCta")}
                </ButtonLink>
                <ButtonLink href="#services" variant="glass" size="lg">
                  {t("secondaryCta")}
                </ButtonLink>
              </FadeIn>
            </div>

            <FadeIn
              delay={0.7}
              className="flex flex-col gap-6 border-t border-white/20 pt-6 lg:flex-row lg:items-end lg:justify-between"
            >
              {guideTypes.length > 0 && (
                <ul aria-label={t("guideTypesLabel")} className="flex flex-wrap gap-2">
                  {guideTypes.map((g, i) => (
                    <li key={g.id}>
                      <Chip variant={i === 0 ? "light" : "glass"}>{localized(g.name, locale)}</Chip>
                    </li>
                  ))}
                </ul>
              )}

              <Link
                href="/about"
                className="group flex w-full items-center gap-4 rounded-card bg-surface p-2.5 pr-4 text-ink transition-transform duration-500 ease-spring motion-safe:hover:-translate-y-0.5 sm:max-w-sm lg:shrink-0"
              >
                <span className="relative size-[4.5rem] shrink-0 overflow-hidden rounded-xl">
                  <PlaceholderImage alt={t("doctor.photoAlt")} fill hideCaption />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-lg leading-tight font-medium tracking-[-0.02em]">
                    {t("doctor.name")}
                  </span>
                  <span className="text-sm text-ink-muted">{t("doctor.role")}</span>
                  <span className="mt-1 font-mono text-label text-ink-muted">
                    {t("doctor.experience", { years: fmt(yearsExperience) })}
                  </span>
                </span>
                <ArrowCircle size="sm" className="self-start" />
                <span className="sr-only">{t("doctor.link")}</span>
              </Link>
            </FadeIn>
          </div>
        </Container>
      </div>
    </section>
  );
}
