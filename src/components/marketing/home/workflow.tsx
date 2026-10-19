import { getTranslations } from "next-intl/server";

import { Reveal, RevealItem } from "@/components/motion/reveal";
import { Container } from "@/components/shared/container";
import { SectionLabel } from "@/components/shared/section-label";

const STEPS = ["scans", "planning", "approve", "shipped"] as const;

export async function Workflow() {
  const t = await getTranslations("home.workflow");
  return (
    <section aria-labelledby="workflow-title" className="py-20 sm:py-28">
      <Container>
        <div className="mb-10 flex flex-col gap-3 sm:mb-14">
          <SectionLabel index="01">{t("label")}</SectionLabel>
          <h2 id="workflow-title" className="sr-only">
            {t("title")}
          </h2>
        </div>
        <Reveal
          as="ol"
          stagger={0.08}
          className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4"
        >
          {STEPS.map((step, i) => (
            <RevealItem as="li" key={step} className="flex flex-col gap-4">
              <div aria-hidden className="relative h-px bg-line">
                <span className="absolute inset-y-0 left-0 w-12 bg-brand" />
              </div>
              <span className="pt-2 font-mono text-label text-ink-muted">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="text-xl font-medium tracking-[-0.02em] text-ink">
                {t(`steps.${step}.title`)}
              </h3>
              <p className="max-w-[34ch] text-ink-muted">{t(`steps.${step}.body`)}</p>
            </RevealItem>
          ))}
        </Reveal>
      </Container>
    </section>
  );
}
