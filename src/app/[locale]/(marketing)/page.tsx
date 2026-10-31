import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { About } from "@/components/marketing/home/about";
import { CasePreview } from "@/components/marketing/home/case-preview";
import { CtaBand } from "@/components/marketing/home/cta-band";
import { GuideCard } from "@/components/marketing/home/guide-card";
import { Hero } from "@/components/marketing/home/hero";
import type { HomeTextKey } from "@/components/marketing/home/home-copy";
import { Services } from "@/components/marketing/home/services";
import { Statement } from "@/components/marketing/home/statement";
import { Technology } from "@/components/marketing/home/technology";
import { Testimonials } from "@/components/marketing/home/testimonials";
import { Workflow } from "@/components/marketing/home/workflow";
import { routing } from "@/i18n/routing";
import { localized } from "@/lib/utils";
import { countActiveImplantSystems, getActiveGuideTypes } from "@/server/queries/catalog";
import { getImages } from "@/server/queries/media";
import {
  getDoctorSetting,
  getHomePageSetting,
  getImagesSetting,
  getStatsSetting,
  type HomePageSetting,
} from "@/server/queries/site-settings";

// Every text on this page comes from /admin/pages/home (SiteSetting "page.home"); the facts (numbers,
// doctor, photos) from /admin/settings. Empty texts are hidden; admins see "Missing: …" markers.

/** The given texts in the visitor's language (the other language when one is empty). */
function homeCopy<K extends HomeTextKey>(home: HomePageSetting, locale: string, keys: K[]) {
  return Object.fromEntries(keys.map((k) => [k, localized(home[k], locale)])) as Record<K, string>;
}

export async function generateMetadata(): Promise<Metadata> {
  const [locale, tMeta, home] = await Promise.all([
    getLocale(),
    getTranslations("metadata"),
    getHomePageSetting(),
  ]);
  const { metaTitle, metaDescription } = homeCopy(home, locale, ["metaTitle", "metaDescription"]);
  const title = metaTitle || "Dentnord";
  const description = metaDescription || undefined;
  const ogLocales = { da: "da_DK", en: "en_GB" } as const;
  return {
    title: { absolute: title },
    description,
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
      title,
      description,
      locale: tMeta("ogLocale"),
      alternateLocale: routing.locales.filter((l) => l !== locale).map((l) => ogLocales[l]),
    },
  };
}

export default async function HomePage() {
  const [locale, home, guideTypes, stats, doctor, siteImages, implantSystems] = await Promise.all([
    getLocale(),
    getHomePageSetting(),
    getActiveGuideTypes(),
    getStatsSetting(),
    getDoctorSetting(),
    getImagesSetting(),
    countActiveImplantSystems(),
  ]);
  const copy = <K extends HomeTextKey>(...keys: K[]) => homeCopy(home, locale, keys);
  const images = await getImages([
    siteImages.heroId,
    siteImages.technologyId,
    doctor.portraitId,
    doctor.cardPhotoId,
  ]);
  const img = (id: string | null) => (id ? (images[id] ?? null) : null);

  return (
    <main>
      <Hero
        locale={locale}
        copy={copy(
          "heroTrust",
          "heroTitle",
          "heroSubtitle",
          "heroPrimaryCta",
          "heroSecondaryCta",
          "heroDoctorRole",
          "heroDoctorExperience",
        )}
        guideTypes={guideTypes}
        clinics={stats.clinics}
        yearsExperience={stats.yearsExperience}
        doctorName={doctor.name}
        image={img(siteImages.heroId)}
        doctorPhoto={img(doctor.cardPhotoId)}
      />
      <Workflow
        copy={copy(
          "workflowLabel",
          "workflowTitle",
          "workflowStep1Title",
          "workflowStep1Body",
          "workflowStep2Title",
          "workflowStep2Body",
          "workflowStep3Title",
          "workflowStep3Body",
          "workflowStep4Title",
          "workflowStep4Body",
        )}
      />
      <Statement text={copy("statement").statement} />
      <Services locale={locale} copy={copy("servicesLabel", "servicesTitle")} />
      <CasePreview
        locale={locale}
        copy={copy("portalLabel", "portalTitle", "portalIntro")}
        guideTypes={guideTypes}
      />
      <GuideCard copy={copy("guideLabel", "guideTitle", "guideBody", "guideCta")} />
      <About
        locale={locale}
        copy={copy("aboutLabel", "aboutTitle", "aboutCta", "aboutCtaGeneric")}
        doctor={doctor}
        portrait={img(doctor.portraitId)}
        yearsExperience={stats.yearsExperience}
      />
      <Technology
        locale={locale}
        copy={copy(
          "technologyLabel",
          "technologyTitle",
          "technologyIntro",
          "technologyFeature1Title",
          "technologyFeature1Body",
          "technologyFeature2Title",
          "technologyFeature2Body",
          "technologyFeature3Title",
          "technologyFeature3Body",
        )}
        guidesDelivered={stats.guidesDelivered}
        turnaroundDays={stats.turnaroundDays}
        implantSystems={implantSystems}
        image={img(siteImages.technologyId)}
      />
      <Testimonials locale={locale} copy={copy("testimonialsLabel", "testimonialsTitle")} />
      <CtaBand copy={copy("ctaTitle", "ctaBody", "ctaPrimary", "ctaSecondary")} />
    </main>
  );
}
