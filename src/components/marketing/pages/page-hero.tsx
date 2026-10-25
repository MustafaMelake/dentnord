import type { ReactNode } from "react";

import { FadeIn } from "@/components/motion/fade-in";
import { Container } from "@/components/shared/container";
import { SectionLabel } from "@/components/shared/section-label";

/**
 * Top of an inner marketing page (Services, About, Contact): label, title and intro from the page's
 * settings. Above the fold, so it animates with CSS (<FadeIn>), not on hydration.
 */
export function PageHero({
  label,
  title,
  intro,
  missingIntro,
  children,
}: {
  label: string;
  title: string;
  intro: string;
  /** Admin-only marker shown when the intro is empty. */
  missingIntro?: ReactNode;
  /** Below the text, e.g. a wide photo. */
  children?: ReactNode;
}) {
  return (
    <header className="pt-32 pb-12 sm:pt-40 sm:pb-16 lg:pt-48">
      <Container className="flex flex-col gap-10 sm:gap-14">
        {/* The title gets the full width, so long Danish compounds ("implantatplanlægning") fit on
            one line and wrap between words; only on phones, where one can be wider than the
            screen, are they hyphenated. The intro sits under it, in the right-hand column. */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-x-16 lg:gap-y-10">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <FadeIn>
              <SectionLabel>{label}</SectionLabel>
            </FadeIn>
            <FadeIn delay={0.08}>
              <h1 className="max-w-[20ch] text-display-xl text-ink max-sm:hyphens-auto">{title}</h1>
            </FadeIn>
          </div>
          <FadeIn delay={0.18} className="flex flex-col gap-3 lg:col-start-2">
            {intro ? (
              <p className="max-w-[46ch] text-lead text-ink-muted">{intro}</p>
            ) : (
              missingIntro
            )}
          </FadeIn>
        </div>
        {children}
      </Container>
    </header>
  );
}
