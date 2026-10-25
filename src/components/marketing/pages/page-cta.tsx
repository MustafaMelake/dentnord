import type { ReactNode } from "react";

import { MagneticButton } from "@/components/motion/magnetic";
import { Reveal } from "@/components/motion/reveal";
import { ButtonLink } from "@/components/shared/button";
import { Container } from "@/components/shared/container";

/**
 * The closing call to action of an inner page, with the texts from the page's settings (same look
 * as the home page's CTA band). Without a title nothing renders, except the admin's marker.
 */
export function PageCta({
  id,
  title,
  body,
  label,
  href,
  missing,
}: {
  id: string;
  title: string;
  body: string;
  label: string;
  href: "/portal/cases/new" | "/contact";
  /** Admin-only marker shown when a CTA text is empty. */
  missing?: ReactNode;
}) {
  if (!title) return missing ? <Container className="py-10">{missing}</Container> : null;
  return (
    <section aria-labelledby={id} className="pt-6 sm:pt-10">
      <Container>
        <Reveal>
          <div className="relative isolate overflow-hidden rounded-media bg-brand-deep px-6 py-16 text-white sm:rounded-media-lg sm:px-12 sm:py-24 lg:px-16">
            <div
              aria-hidden
              className="absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_90%_10%,rgb(30_90_168/0.55),transparent_70%)]"
            />
            <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex max-w-2xl flex-col gap-5">
                <h2 id={id} className="text-display-xl">
                  {title}
                </h2>
                {body && <p className="max-w-[44ch] text-lead text-white/75">{body}</p>}
              </div>
              {label && (
                <MagneticButton className="w-fit">
                  <ButtonLink href={href} variant="light" size="lg" icon>
                    {label}
                  </ButtonLink>
                </MagneticButton>
              )}
            </div>
            {missing && <div className="mt-8">{missing}</div>}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
