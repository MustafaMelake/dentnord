import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import {
  AccountsForm,
  ContactForm,
  DoctorForm,
  LegalForm,
  SiteImagesForm,
  StatsForm,
} from "@/components/admin/settings-forms";
import { SettingsTabs } from "@/components/admin/settings-tabs";
import { SETTINGS_TABS, type SettingsTab } from "@/components/admin/tabs";
import { TestimonialsManager } from "@/components/admin/testimonials-manager";
import { ShellPageHeader } from "@/components/shared/app-shell/app-shell";
import { PageSkeleton } from "@/components/shared/app-shell/page-skeleton";
import { adminMediaStatus, listAdminTestimonials } from "@/server/queries/admin-content";
import { getImages } from "@/server/queries/media";
import {
  getAccountsSetting,
  getContactSetting,
  getDoctorSetting,
  getImagesSetting,
  getLegalSetting,
  getStatsSetting,
} from "@/server/queries/site-settings";

export const metadata: Metadata = { title: "Site content" };

// Everything on the public site that isn't a catalog row: numbers, contact details, the doctor,
// testimonials, photos, account review time and the legal pages.
export default async function AdminSettingsPage({ searchParams }: PageProps<"/admin/settings">) {
  const t = await getTranslations({ locale: "en", namespace: "admin.settings" });
  return (
    <>
      <ShellPageHeader title={t("pageTitle")} intro={t("intro")} />
      <Suspense fallback={<PageSkeleton />}>
        <Settings searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Settings({ searchParams }: Pick<PageProps<"/admin/settings">, "searchParams">) {
  const { tab } = await searchParams;
  const defaultTab = (SETTINGS_TABS as readonly string[]).includes(String(tab))
    ? (tab as SettingsTab)
    : "numbers";

  // listAdminTestimonials / adminMediaStatus re-check the admin session.
  const [media, testimonials, stats, contact, doctor, accounts, legal, siteImages] =
    await Promise.all([
      adminMediaStatus(),
      listAdminTestimonials(),
      getStatsSetting(),
      getContactSetting(),
      getDoctorSetting(),
      getAccountsSetting(),
      getLegalSetting(),
      getImagesSetting(),
    ]);
  const images = await getImages([
    doctor.portraitId,
    doctor.cardPhotoId,
    siteImages.heroId,
    siteImages.technologyId,
  ]);
  const img = (id: string | null) => (id ? (images[id] ?? null) : null);

  return (
    <SettingsTabs
      defaultTab={defaultTab}
      panels={{
        numbers: <StatsForm values={stats} />,
        contact: <ContactForm values={contact} />,
        doctor: (
          <DoctorForm
            values={{
              name: doctor.name,
              credentials: doctor.credentials,
              bio: doctor.bio,
              city: doctor.city,
              languages: doctor.languages,
              portraitId: img(doctor.portraitId)?.id ?? null,
              cardPhotoId: img(doctor.cardPhotoId)?.id ?? null,
              expertise: doctor.expertise,
            }}
            portrait={img(doctor.portraitId)}
            cardPhoto={img(doctor.cardPhotoId)}
            mediaConfigured={media.configured}
          />
        ),
        testimonials: <TestimonialsManager items={testimonials} />,
        images: (
          <SiteImagesForm
            hero={img(siteImages.heroId)}
            technology={img(siteImages.technologyId)}
            mediaConfigured={media.configured}
          />
        ),
        accounts: <AccountsForm values={accounts} />,
        legal: <LegalForm values={legal} />,
      }}
    />
  );
}
