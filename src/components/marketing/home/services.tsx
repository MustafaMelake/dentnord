import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/shared/container";
import { Missing, missingProps } from "@/components/shared/missing";
import { SectionHeading } from "@/components/shared/section-label";
import { localized } from "@/lib/utils";
import { getPublishedServices } from "@/server/queries/catalog";

import { hasGaps, type HomeCopy } from "./home-copy";
import { ServicesCarousel } from "./services-carousel";

export async function Services({
  locale,
  copy,
}: {
  locale: string;
  copy: HomeCopy<"servicesLabel" | "servicesTitle">;
}) {
  const services = await getPublishedServices();
  if (services.length === 0) return null;

  const missingImage = await missingProps("services.images");
  const items = services.map((s) => ({
    id: s.id,
    slug: s.slug,
    title: localized(s.title, locale),
    image: s.image,
  }));

  return (
    // scroll-mt: lands below the fixed header when reached via "#services".
    <section
      id="services"
      aria-labelledby={copy.servicesTitle ? "services-title" : undefined}
      className="scroll-mt-24 overflow-x-clip py-20 sm:py-28"
    >
      <Container>
        <Reveal>
          <SectionHeading
            index="02"
            label={copy.servicesLabel}
            title={copy.servicesTitle}
            id="services-title"
          />
        </Reveal>
        {hasGaps(copy) && <Missing field="homePage.services" className="mt-6" />}
        <ServicesCarousel
          items={items}
          locale={locale}
          missingImage={missingImage}
          className="mt-12 sm:mt-16"
        />
      </Container>
    </section>
  );
}
