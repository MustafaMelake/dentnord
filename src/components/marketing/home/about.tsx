import { getTranslations } from "next-intl/server";

import { Parallax } from "@/components/motion/parallax";
import { Reveal, RevealItem } from "@/components/motion/reveal";
import { ButtonLink } from "@/components/shared/button";
import { Container } from "@/components/shared/container";
import { PlaceholderImage } from "@/components/shared/placeholder-image";
import { SectionHeading } from "@/components/shared/section-label";

const EXPERTISE = ["single", "fullArch", "bone", "planning"] as const;
const FACTS = ["experience", "location", "languages"] as const;

export async function About() {
  const t = await getTranslations("home.about");
  return (
    <section aria-labelledby="about-title" className="py-20 sm:py-28">
      <Container>
        <Reveal className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading index="05" label={t("label")} title={t("title")} id="about-title" />
          <ButtonLink href="/contact" variant="secondary" icon className="w-fit shrink-0">
            {t("cta")}
          </ButtonLink>
        </Reveal>

        <Reveal className="mt-10 sm:mt-14">
          <div className="relative">
            <Parallax className="aspect-[4/5] rounded-media sm:aspect-[16/10] sm:rounded-media-lg lg:aspect-[16/8]">
              <PlaceholderImage
                alt={t("portraitAlt")}
                fill
                sizes="(min-width: 1440px) 1360px, 100vw"
              />
            </Parallax>
            <p className="absolute bottom-4 left-4 rounded-full bg-surface px-4 py-2 text-sm text-ink sm:bottom-6 sm:left-6">
              {t("badge")}
            </p>
          </div>
        </Reveal>

        <h3 className="sr-only">{t("expertiseLabel")}</h3>
        <Reveal as="ul" stagger={0.06} className="mt-10 border-t border-line sm:mt-14">
          {EXPERTISE.map((key, i) => (
            <RevealItem
              as="li"
              key={key}
              className="group flex items-baseline gap-5 border-b border-line py-5 sm:gap-10 sm:py-6"
            >
              <span className="w-6 shrink-0 font-mono text-label text-ink-muted">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 text-display-sm text-ink-muted transition-colors duration-300 group-hover:text-ink">
                {t(`expertise.${key}.title`)}
              </span>
              <span className="text-right text-sm text-ink-muted">{t(`expertise.${key}.tag`)}</span>
            </RevealItem>
          ))}
        </Reveal>

        <Reveal className="mt-12 grid gap-10 lg:grid-cols-2">
          <p className="max-w-[48ch] text-lead text-ink">{t("bio")}</p>
          <dl className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {FACTS.map((key) => (
              <div key={key} className="flex flex-col gap-1">
                <dt className="text-sm text-ink-muted">{t(`facts.${key}.label`)}</dt>
                <dd className="font-medium text-ink">{t(`facts.${key}.value`)}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </Container>
    </section>
  );
}
