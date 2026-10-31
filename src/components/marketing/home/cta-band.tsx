import { MagneticButton } from "@/components/motion/magnetic";
import { Reveal } from "@/components/motion/reveal";
import { ButtonLink } from "@/components/shared/button";
import { Container } from "@/components/shared/container";
import { Missing } from "@/components/shared/missing";

import { hasGaps, type HomeCopy } from "./home-copy";

/** Without a heading the band is left out (admins see a marker). */
export function CtaBand({
  copy,
}: {
  copy: HomeCopy<"ctaTitle" | "ctaBody" | "ctaPrimary" | "ctaSecondary">;
}) {
  if (!copy.ctaTitle) {
    return (
      <Container className="pt-6 sm:pt-10">
        <Missing field="homePage.cta" />
      </Container>
    );
  }
  const missing = hasGaps(copy) && <Missing field="homePage.cta" tone="dark" />;
  return (
    <section aria-labelledby="cta-title" className="pt-6 sm:pt-10">
      <Container>
        <Reveal>
          <div className="relative isolate overflow-hidden rounded-media bg-brand-deep px-6 py-16 text-white sm:rounded-media-lg sm:px-12 sm:py-24 lg:px-16">
            <div
              aria-hidden
              className="absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_90%_10%,rgb(30_90_168/0.55),transparent_70%)]"
            />
            <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex max-w-2xl flex-col gap-5">
                <h2 id="cta-title" className="text-display-xl">
                  {copy.ctaTitle}
                </h2>
                {copy.ctaBody && (
                  <p className="max-w-[44ch] text-lead text-white/75">{copy.ctaBody}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-3 empty:hidden">
                {copy.ctaPrimary && (
                  <MagneticButton>
                    <ButtonLink href="/portal/cases/new" variant="light" size="lg" icon>
                      {copy.ctaPrimary}
                    </ButtonLink>
                  </MagneticButton>
                )}
                {copy.ctaSecondary && (
                  <ButtonLink href="/contact" variant="glass" size="lg">
                    {copy.ctaSecondary}
                  </ButtonLink>
                )}
              </div>
            </div>
            {missing && <div className="mt-8">{missing}</div>}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
