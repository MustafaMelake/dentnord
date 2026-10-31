import { Reveal, RevealItem } from "@/components/motion/reveal";
import { Container } from "@/components/shared/container";
import { Missing } from "@/components/shared/missing";
import { SectionLabel } from "@/components/shared/section-label";

import { hasGaps, type HomeCopy } from "./home-copy";

const STEPS = [1, 2, 3, 4] as const;
type StepKey = `workflowStep${(typeof STEPS)[number]}${"Title" | "Body"}`;

export function Workflow({
  copy,
}: {
  copy: HomeCopy<"workflowLabel" | "workflowTitle" | StepKey>;
}) {
  // A step with neither title nor text is left out; the numbering follows the steps shown.
  const steps = STEPS.map((n) => ({
    n,
    title: copy[`workflowStep${n}Title`],
    body: copy[`workflowStep${n}Body`],
  })).filter((s) => s.title || s.body);
  return (
    <section
      aria-labelledby={copy.workflowTitle ? "workflow-title" : undefined}
      className="py-20 sm:py-28"
    >
      <Container>
        <div className="mb-10 flex flex-col gap-3 sm:mb-14">
          {copy.workflowLabel && <SectionLabel index="01">{copy.workflowLabel}</SectionLabel>}
          {copy.workflowTitle && (
            <h2 id="workflow-title" className="sr-only">
              {copy.workflowTitle}
            </h2>
          )}
          {hasGaps(copy) && <Missing field="homePage.workflow" />}
        </div>
        {steps.length > 0 && (
          <Reveal
            as="ol"
            stagger={0.08}
            className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4"
          >
            {steps.map((step, i) => (
              <RevealItem as="li" key={step.n} className="flex flex-col gap-4">
                <div aria-hidden className="relative h-px bg-line">
                  <span className="absolute inset-y-0 left-0 w-12 bg-brand" />
                </div>
                <span className="pt-2 font-mono text-label text-ink-muted">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {step.title && (
                  <h3 className="text-xl font-medium tracking-[-0.02em] text-ink">{step.title}</h3>
                )}
                {step.body && <p className="max-w-[34ch] text-ink-muted">{step.body}</p>}
              </RevealItem>
            ))}
          </Reveal>
        )}
      </Container>
    </section>
  );
}
