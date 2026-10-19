import { getTranslations } from "next-intl/server";

import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-label";
import { localized } from "@/lib/utils";
import { getPublishedServices } from "@/server/queries/catalog";

import { ServicesCarousel } from "./services-carousel";

export async function Services({ locale }: { locale: string }) {
  const [t, services] = await Promise.all([
    getTranslations("home.services"),
    getPublishedServices(),
  ]);
  if (services.length === 0) return null;

  const items = services.map((s) => {
    const title = localized(s.title, locale);
    return { id: s.id, slug: s.slug, title, imageAlt: t("imageAlt", { title }) };
  });

  return (
    // scroll-mt: lands below the fixed header when reached via "#services".
    <section
      id="services"
      aria-labelledby="services-title"
      className="scroll-mt-24 overflow-x-clip py-20 sm:py-28"
    >
      <Container>
        <Reveal>
          <SectionHeading index="02" label={t("label")} title={t("title")} id="services-title" />
        </Reveal>
        <ServicesCarousel items={items} className="mt-12 sm:mt-16" />
      </Container>
    </section>
  );
}
