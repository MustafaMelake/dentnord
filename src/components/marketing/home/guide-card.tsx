import { existsSync } from "node:fs";
import { join } from "node:path";

import { getTranslations } from "next-intl/server";
import { cacheLife } from "next/cache";

import { MagneticButton } from "@/components/motion/magnetic";
import { Reveal } from "@/components/motion/reveal";
import { ButtonLink } from "@/components/shared/button";
import { Container } from "@/components/shared/container";
import { Missing } from "@/components/shared/missing";
import { SectionLabel } from "@/components/shared/section-label";
import { GuideViewerLazy } from "@/components/three/guide-viewer-lazy";

import { hasGaps, type HomeCopy } from "./home-copy";

const MODEL_PATH = "/models/guide.glb";

/** Uses the real model once public/models/guide.glb exists (checked at build), else the procedural guide. */
async function getGuideModelUrl() {
  "use cache";
  cacheLife("max");
  return existsSync(join(process.cwd(), "public", "models", "guide.glb")) ? MODEL_PATH : null;
}

export async function GuideCard({
  copy,
}: {
  copy: HomeCopy<"guideLabel" | "guideTitle" | "guideBody" | "guideCta">;
}) {
  const [t, modelUrl] = await Promise.all([getTranslations("home.guide3d"), getGuideModelUrl()]);
  return (
    <section
      aria-labelledby={copy.guideTitle ? "guide3d-title" : undefined}
      className="py-6 sm:py-10"
    >
      <Container>
        <Reveal amount={0.1}>
          <div className="grid overflow-hidden rounded-media bg-brand-deep text-white sm:rounded-media-lg lg:grid-cols-2">
            <div className="flex flex-col justify-center gap-6 p-7 sm:p-12 lg:p-16">
              {copy.guideLabel && (
                <SectionLabel index="04" tone="onDark">
                  {copy.guideLabel}
                </SectionLabel>
              )}
              {copy.guideTitle && (
                <h2 id="guide3d-title" className="max-w-[14ch] text-display-lg">
                  {copy.guideTitle}
                </h2>
              )}
              {copy.guideBody && <p className="max-w-[44ch] text-white/75">{copy.guideBody}</p>}
              {copy.guideCta && (
                <MagneticButton className="w-fit">
                  <ButtonLink href="/portal/cases/new" variant="light" size="lg" icon>
                    {copy.guideCta}
                  </ButtonLink>
                </MagneticButton>
              )}
              {hasGaps(copy) && <Missing field="homePage.guide" tone="dark" />}
            </div>
            <div className="relative aspect-square w-full sm:aspect-[4/3] lg:aspect-auto lg:min-h-[36rem]">
              <GuideViewerLazy
                modelUrl={modelUrl}
                label={t("viewerLabel")}
                posterLabel={t("poster")}
              />
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
