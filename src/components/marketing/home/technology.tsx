import { getTranslations } from "next-intl/server";

import { Counter } from "@/components/motion/counter";
import { Parallax } from "@/components/motion/parallax";
import { Reveal, RevealItem } from "@/components/motion/reveal";
import { Container } from "@/components/shared/container";
import { PlaceholderImage } from "@/components/shared/placeholder-image";
import { SectionHeading } from "@/components/shared/section-label";

const FEATURES = ["planning", "printing", "sleeves"] as const;

export async function Technology({
  locale,
  guidesDelivered,
  turnaroundDays,
  implantSystems,
}: {
  locale: string;
  guidesDelivered: number | null;
  turnaroundDays: number | null;
  /** Live count of active implant systems in the catalog (DB). */
  implantSystems: number;
}) {
  const t = await getTranslations("home.technology");

  const stats = [
    { key: "guides", value: guidesDelivered, unit: null },
    { key: "turnaround", value: turnaroundDays, unit: t("stats.turnaroundUnit") },
    { key: "systems", value: implantSystems, unit: null },
  ] as const;

  return (
    <section aria-labelledby="technology-title" className="py-20 sm:py-28">
      <Container>
        <Reveal className="grid gap-6 lg:grid-cols-2 lg:items-end">
          <SectionHeading index="06" label={t("label")} title={t("title")} id="technology-title" />
          <p className="max-w-[46ch] text-lead text-ink-muted lg:justify-self-end">{t("intro")}</p>
        </Reveal>

        <Reveal as="ol" stagger={0.07} className="mt-12 border-t border-line">
          {FEATURES.map((key, i) => (
            <RevealItem
              as="li"
              key={key}
              className="grid gap-2 border-b border-line py-6 sm:grid-cols-[4rem_1fr_1.4fr] sm:items-baseline sm:gap-6"
            >
              <span className="font-mono text-label text-ink-muted">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="text-xl font-medium tracking-[-0.02em] text-ink">
                {t(`features.${key}.title`)}
              </h3>
              <p className="text-ink-muted">{t(`features.${key}.body`)}</p>
            </RevealItem>
          ))}
        </Reveal>

        <Reveal className="relative mt-12 sm:mt-16">
          <Parallax className="aspect-[4/5] rounded-media sm:aspect-[16/10] sm:rounded-media-lg lg:aspect-[16/8]">
            <PlaceholderImage
              alt={t("imageAlt")}
              fill
              captionPosition="top-right"
              sizes="(min-width: 1440px) 1360px, 100vw"
            />
          </Parallax>
          <dl className="absolute inset-x-3 bottom-3 grid gap-4 rounded-card border border-line/60 bg-surface/90 p-5 backdrop-blur-md sm:inset-x-5 sm:bottom-5 sm:grid-cols-3 sm:gap-0 sm:p-6">
            {stats.map((s, i) => (
              <div
                key={s.key}
                className={
                  i > 0
                    ? "flex flex-col gap-1 sm:border-l sm:border-line sm:pl-6"
                    : "flex flex-col gap-1 sm:pr-6"
                }
              >
                <dt className="order-2 text-sm text-ink-muted">{t(`stats.${s.key}`)}</dt>
                <dd className="order-1 flex items-baseline gap-2 text-ink">
                  <Counter
                    value={s.value}
                    locale={locale}
                    className="text-display-md tabular-nums"
                  />
                  {s.unit && <span className="text-sm text-ink-muted">{s.unit}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </Container>
    </section>
  );
}
