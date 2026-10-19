import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { About } from "@/components/marketing/home/about";
import { CasePreview } from "@/components/marketing/home/case-preview";
import { CtaBand } from "@/components/marketing/home/cta-band";
import { GuideCard } from "@/components/marketing/home/guide-card";
import { Hero } from "@/components/marketing/home/hero";
import { Services } from "@/components/marketing/home/services";
import { Statement } from "@/components/marketing/home/statement";
import { Technology } from "@/components/marketing/home/technology";
import { Testimonials } from "@/components/marketing/home/testimonials";
import { Workflow } from "@/components/marketing/home/workflow";
import { routing } from "@/i18n/routing";
import { countActiveImplantSystems, getActiveGuideTypes } from "@/server/queries/catalog";
import { getStatsSetting } from "@/server/queries/site-settings";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t, tMeta] = await Promise.all([
    getLocale(),
    getTranslations("home.meta"),
    getTranslations("metadata"),
  ]);
  const ogLocales = { da: "da_DK", en: "en_GB" } as const;
  return {
    title: { absolute: t("title") },
    description: t("description"),
    alternates: {
      canonical: `/${locale}`,
      languages: {
        ...Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])),
        "x-default": `/${routing.defaultLocale}`,
      },
    },
    openGraph: {
      type: "website",
      siteName: "Dentnord",
      url: `/${locale}`,
      title: t("title"),
      description: t("description"),
      locale: tMeta("ogLocale"),
      alternateLocale: routing.locales.filter((l) => l !== locale).map((l) => ogLocales[l]),
    },
  };
}

export default async function HomePage() {
  const [locale, guideTypes, stats, implantSystems] = await Promise.all([
    getLocale(),
    getActiveGuideTypes(),
    getStatsSetting(),
    countActiveImplantSystems(),
  ]);
  const stat = (n: number | null | undefined) => (typeof n === "number" ? n : null);

  return (
    <main>
      <Hero
        locale={locale}
        guideTypes={guideTypes}
        clinics={stat(stats?.clinics)}
        yearsExperience={stat(stats?.yearsExperience)}
      />
      <Workflow />
      <Statement />
      <Services locale={locale} />
      <CasePreview locale={locale} guideTypes={guideTypes} />
      <GuideCard />
      <About />
      <Technology
        locale={locale}
        guidesDelivered={stat(stats?.guidesDelivered)}
        turnaroundDays={stat(stats?.turnaroundDays)}
        implantSystems={implantSystems}
      />
      <Testimonials />
      <CtaBand />
    </main>
  );
}
