"use client";

import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Reveal } from "@/components/motion/reveal";
import { spring, usePrefersReducedMotion } from "@/components/motion/use-media-query";
import { ArrowCircle } from "@/components/shared/button";
import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-label";

// Placeholder quotes only, until real, consented testimonials arrive (docs/content-todo.md).
// Never invent names, clinics or ratings here.
const COUNT = 3;

export function Testimonials() {
  const t = useTranslations("home.testimonials");
  const reduce = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const go = (d: number) => setIndex((i) => (i + d + COUNT) % COUNT);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <section
      aria-labelledby="testimonials-title"
      aria-roledescription="carousel"
      className="py-20 sm:py-28"
    >
      <Container>
        <Reveal>
          <SectionHeading
            index="07"
            label={t("label")}
            title={t("title")}
            id="testimonials-title"
          />
        </Reveal>

        <div aria-live="polite" className="mt-12 min-h-[12rem] sm:mt-16">
          <AnimatePresence mode="wait" initial={false}>
            <motion.figure
              key={index}
              data-motion=""
              aria-roledescription="slide"
              aria-label={t("position", { current: index + 1, total: COUNT })}
              initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
              transition={reduce ? { duration: 0 } : { ...spring, duration: 0.5 }}
            >
              <blockquote className="max-w-[32ch] text-display-md text-ink">
                “{t("quote", { n: index + 1 })}”
              </blockquote>
              <figcaption className="mt-8 flex items-center gap-4">
                <span
                  aria-hidden
                  className="size-12 rounded-full bg-[linear-gradient(135deg,#d6e6f5,#8fb4dd)]"
                />
                <span className="text-ink-muted">{t("author")}</span>
              </figcaption>
            </motion.figure>
          </AnimatePresence>
        </div>

        <div className="mt-12 flex items-center justify-between border-t border-line pt-6">
          <p aria-hidden className="font-mono text-label text-ink-muted">
            <span className="text-ink">{pad(index + 1)}</span> / {pad(COUNT)}
          </p>
          <div className="flex gap-2">
            <ArrowCircle
              label={t("previous")}
              direction="right"
              variant="solid"
              size="lg"
              iconClassName="rotate-180"
              onClick={() => go(-1)}
            />
            <ArrowCircle
              label={t("next")}
              direction="right"
              variant="solid"
              size="lg"
              onClick={() => go(1)}
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
