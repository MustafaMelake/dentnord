import { getTranslations } from "next-intl/server";

import { Parallax } from "@/components/motion/parallax";
import { Reveal, RevealItem } from "@/components/motion/reveal";
import { ButtonLink } from "@/components/shared/button";
import { Container } from "@/components/shared/container";
import { Missing } from "@/components/shared/missing";
import { SectionHeading } from "@/components/shared/section-label";
import { SiteImage } from "@/components/shared/site-image";
import { localized } from "@/lib/utils";
import type { PublicImage } from "@/server/queries/media";
import type { DoctorSetting } from "@/server/queries/site-settings";

// "About the doctor": all content comes from the admin (SiteSetting "doctor"). Empty fields are
// hidden; admins see "Missing: …" markers instead.

export async function About({
  locale,
  doctor,
  portrait,
  yearsExperience,
}: {
  locale: string;
  doctor: DoctorSetting;
  portrait: PublicImage | null;
  yearsExperience: number | null;
}) {
  const t = await getTranslations("home.about");
  const credentials = localized(doctor.credentials, locale);
  const bio = localized(doctor.bio, locale);
  const languages = localized(doctor.languages, locale);
  const badge = [doctor.name, credentials].filter(Boolean).join(" · ");

  const facts = [
    {
      key: "experience",
      value:
        yearsExperience !== null
          ? t("facts.experience.value", {
              years: new Intl.NumberFormat(locale).format(yearsExperience),
            })
          : null,
      field: "stats.yearsExperience",
    },
    {
      key: "location",
      value: doctor.city ? t("facts.location.value", { city: doctor.city }) : null,
      field: "doctor.city",
    },
    { key: "languages", value: languages || null, field: "doctor.languages" },
  ] as const;
  const shownFacts = facts.filter((f) => f.value);

  return (
    <section aria-labelledby="about-title" className="py-20 sm:py-28">
      <Container>
        <Reveal className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading index="05" label={t("label")} title={t("title")} id="about-title" />
          <ButtonLink href="/contact" variant="secondary" icon className="w-fit shrink-0">
            {doctor.name ? t("cta", { name: doctor.name }) : t("ctaGeneric")}
          </ButtonLink>
        </Reveal>

        <Reveal className="mt-10 sm:mt-14">
          <div className="relative">
            <Parallax className="aspect-[4/5] rounded-media sm:aspect-[16/10] sm:rounded-media-lg lg:aspect-[16/8]">
              <SiteImage
                image={portrait}
                locale={locale}
                sizes="(min-width: 1440px) 1360px, 100vw"
                missing={<Missing field="doctor.portrait" />}
              />
            </Parallax>
            {badge && (
              <p className="absolute bottom-4 left-4 rounded-full bg-surface px-4 py-2 text-sm text-ink sm:bottom-6 sm:left-6">
                {badge}
              </p>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 empty:hidden">
            {!doctor.name && <Missing field="doctor.name" />}
            {!credentials && <Missing field="doctor.credentials" />}
          </div>
        </Reveal>

        {doctor.expertise.length > 0 ? (
          <>
            <h3 className="sr-only">{t("expertiseLabel")}</h3>
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
          </>
        ) : (
          <Missing field="doctor.expertise" className="mt-10" />
        )}

        <Reveal className="mt-12 grid gap-10 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <p className="max-w-[48ch] text-lead text-ink">{bio || t("bioFallback")}</p>
            {!bio && <Missing field="doctor.bio" />}
          </div>
          <div className="flex flex-col gap-3">
            {shownFacts.length > 0 && (
              <dl
                className="grid grid-cols-1 gap-6 sm:[grid-template-columns:repeat(var(--facts),minmax(0,1fr))]"
                style={{ "--facts": shownFacts.length } as React.CSSProperties}
              >
                {shownFacts.map((f) => (
                  <div key={f.key} className="flex flex-col gap-1">
                    <dt className="text-sm text-ink-muted">{t(`facts.${f.key}.label`)}</dt>
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
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
