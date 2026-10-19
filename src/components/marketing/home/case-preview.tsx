import { Check, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { Reveal, RevealItem } from "@/components/motion/reveal";
import { Chip } from "@/components/shared/chip";
import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-label";
import { StatusBadge } from "@/components/shared/status-badge";
import type { CaseStatus } from "@/generated/prisma/enums";
import { cn, localized } from "@/lib/utils";

// Three fake portal screens (plain markup, not forms) that show dentists the portal before
// they sign up. Each mock is aria-hidden; its <figcaption> describes it for screen readers.

const TIMELINE: CaseStatus[] = [
  "SUBMITTED",
  "IN_PLANNING",
  "AWAITING_APPROVAL",
  "IN_PRODUCTION",
  "SHIPPED",
];
const CURRENT = 2;

export async function CasePreview({
  locale,
  guideTypes,
}: {
  locale: string;
  guideTypes: { id: string; name: unknown }[];
}) {
  const t = await getTranslations("home.portal");
  const tStatus = await getTranslations("caseStatus");

  return (
    <section aria-labelledby="portal-title" className="py-20 sm:py-28">
      <Container>
        <Reveal className="mb-12 sm:mb-16">
          <SectionHeading
            index="03"
            label={t("label")}
            title={t("title")}
            id="portal-title"
            align="center"
          />
          <p className="mx-auto mt-5 max-w-[48ch] text-center text-ink-muted">{t("intro")}</p>
        </Reveal>

        <Reveal stagger={0.1} className="grid gap-4 lg:grid-cols-2 lg:grid-rows-[auto_auto]">
          {/* (a) New case: guide type picker */}
          <MockCard caption={t("newCase.caption")} className="lg:row-span-2">
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-display-sm text-ink">{t("newCase.title")}</h3>
              <Chip variant="ice" className="px-3 py-1 text-xs">
                {t("newCase.step")}
              </Chip>
            </div>
            <p className="mt-6 mb-3 font-mono text-label text-ink-muted">
              {t("newCase.guideType")}
            </p>
            <ul className="flex flex-col gap-2">
              {guideTypes.map((g, i) => (
                <li
                  key={g.id}
                  className={cn(
                    "flex items-center justify-between rounded-xl border px-4 py-3.5 text-[0.9375rem]",
                    i === 0 ? "border-brand bg-brand-ice text-ink" : "border-line text-ink",
                  )}
                >
                  {localized(g.name, locale)}
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full border",
                      i === 0 ? "border-brand bg-brand text-white" : "border-line",
                    )}
                  >
                    {i === 0 && <Check className="size-3" strokeWidth={3} />}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-auto flex flex-wrap items-end justify-between gap-4 border-t border-line pt-6">
              <div>
                <p className="text-sm text-ink-muted">{t("newCase.patientCode")}</p>
                <p className="font-mono text-ink">PC-1042</p>
              </div>
              <span className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 font-medium text-white">
                {t("newCase.continue")}
                <ChevronRight className="size-4" />
              </span>
            </div>
          </MockCard>

          {/* (b) Case status timeline */}
          <MockCard caption={t("caseStatus.caption")}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="text-display-sm text-ink">{t("caseStatus.title")}</h3>
              <StatusBadge status={TIMELINE[CURRENT]} />
            </div>
            {/* Vertical on phones, horizontal bar from sm up */}
            <ol className="mt-8 flex flex-col gap-3 sm:grid sm:grid-cols-5 sm:gap-2">
              {TIMELINE.map((status, i) => (
                <li key={status} className="flex items-center gap-3 sm:flex-col sm:items-stretch">
                  <span
                    className={cn(
                      "size-2.5 shrink-0 rounded-full sm:h-1.5 sm:w-auto",
                      i < CURRENT && "bg-brand",
                      i === CURRENT && "bg-brand ring-4 ring-brand-soft",
                      i > CURRENT && "bg-surface-2",
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm leading-tight sm:text-xs",
                      i === CURRENT ? "font-medium text-ink" : "text-ink-muted",
                    )}
                  >
                    {tStatus(status)}
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
              <p className="text-[0.9375rem] text-ink">{t("caseStatus.note")}</p>
              <p className="font-mono text-label text-ink-muted">{t("caseStatus.updated")}</p>
            </div>
          </MockCard>

          {/* (c) Estimate */}
          <MockCard caption={t("estimate.caption")}>
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-display-sm text-ink">{t("estimate.title")}</h3>
              <Chip className="px-3 py-1 text-xs">{t("estimate.badge")}</Chip>
            </div>
            <dl className="mt-6">
              {(["planning", "guide", "sleeves"] as const).map((line) => (
                <div
                  key={line}
                  className="flex items-center justify-between gap-4 border-b border-dashed border-line py-3.5 text-[0.9375rem]"
                >
                  <dt className="text-ink">{t(`estimate.${line}`)}</dt>
                  <dd className="font-mono text-ink-muted">{t("estimate.price")}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-ink-muted">{t("estimate.total")}</p>
                <p className="font-mono text-label text-ink-muted">{t("estimate.note")}</p>
              </div>
              <p className="text-display-md text-ink">{t("estimate.price")}</p>
            </div>
          </MockCard>
        </Reveal>
      </Container>
    </section>
  );
}

function MockCard({
  caption,
  className,
  children,
}: {
  caption: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <RevealItem as="figure" className={cn("flex", className)}>
      <div
        aria-hidden
        className="flex w-full flex-col rounded-media border border-line bg-surface p-6 transition-transform duration-500 ease-spring select-none motion-safe:hover:-translate-y-1 sm:p-8"
      >
        {children}
      </div>
      <figcaption className="sr-only">{caption}</figcaption>
    </RevealItem>
  );
}
