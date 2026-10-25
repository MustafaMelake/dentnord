"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  aboutPageSchema,
  contactPageSchema,
  servicesPageSchema,
  type AboutPageInput,
  type Bilingual,
  type ContactPageInput,
  type ServicesPageInput,
} from "@/lib/validation/admin";
import { saveAboutPage, saveContactPage, saveServicesPage } from "@/server/actions/admin/settings";
import type { PublicImage } from "@/server/queries/media";

import { BilingualField } from "./form-kit";
import { FormSection } from "./form-section";
import { ImageField } from "./image-picker";
import { SettingsForm, useSettingsForm } from "./settings-forms";

// The texts of the public Services / About / Contact pages (/admin/pages/*). Empty texts are
// hidden on the site. Saving once also confirms the seeded starter copy (the checklist stops
// listing the page).

/** Shown while the page still has the seeded starter copy nobody has reviewed. */
function StarterNotice({ starter }: { starter: boolean }) {
  const t = useTranslations("admin.pages");
  if (!starter) return null;
  return (
    <div
      role="status"
      data-starter-notice=""
      className="flex items-start gap-3 rounded-card border border-brand/20 bg-brand-ice px-4 py-3 text-sm text-brand-deep"
    >
      <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p>{t("starterNotice")}</p>
    </div>
  );
}

/** The closing call to action (Services and About share the same three fields). */
function CtaSection() {
  const t = useTranslations("admin.pages");
  type Cta = Pick<ServicesPageInput & AboutPageInput, "ctaTitle" | "ctaBody" | "ctaLabel">;
  return (
    <FormSection title={t("ctaTitle")} description={t("ctaDescription")}>
      <BilingualField<Cta> name="ctaTitle" label={t("fields.ctaTitle")} />
      <BilingualField<Cta> name="ctaBody" label={t("fields.ctaBody")} multiline />
      <BilingualField<Cta>
        name="ctaLabel"
        label={t("fields.ctaLabel")}
        hint={t("fields.ctaLabelHint")}
      />
    </FormSection>
  );
}

type TextValues<K extends string> = Record<K, Bilingual>;

// ── Services ─────────────────────────────────────────────────────────────────

export function ServicesPageForm({
  values,
  image,
  starter,
  mediaConfigured,
}: {
  values: TextValues<Exclude<keyof ServicesPageInput, "imageId">>;
  image: PublicImage | null;
  starter: boolean;
  mediaConfigured: boolean;
}) {
  const t = useTranslations("admin.pages");
  const { form, saving, onSubmit } = useSettingsForm(
    servicesPageSchema,
    { ...values, imageId: image?.id ?? null },
    saveServicesPage,
  );
  return (
    <SettingsForm form={form} onSubmit={onSubmit} saving={saving}>
      <StarterNotice starter={starter} />
      <FormSection title={t("topTitle")} description={t("topDescription")}>
        <BilingualField<ServicesPageInput> name="title" label={t("fields.title")} />
        <BilingualField<ServicesPageInput> name="intro" label={t("fields.intro")} multiline />
        <ImageField<ServicesPageInput>
          name="imageId"
          label={t("fields.image")}
          hint={t("fields.imageHint")}
          initial={image}
          configured={mediaConfigured}
        />
      </FormSection>
      <FormSection title={t("services.listTitle")} description={t("services.listDescription")}>
        <BilingualField<ServicesPageInput> name="listHeading" label={t("fields.heading")} />
      </FormSection>
      <FormSection
        title={t("services.processTitle")}
        description={t("services.processDescription")}
      >
        <BilingualField<ServicesPageInput> name="processHeading" label={t("fields.heading")} />
        <BilingualField<ServicesPageInput>
          name="processBody"
          label={t("fields.body")}
          hint={t("fields.paragraphsHint")}
          multiline
          rows={6}
        />
      </FormSection>
      <CtaSection />
    </SettingsForm>
  );
}

// ── About ────────────────────────────────────────────────────────────────────

export function AboutPageForm({
  values,
  image,
  starter,
  mediaConfigured,
}: {
  values: TextValues<Exclude<keyof AboutPageInput, "imageId">>;
  image: PublicImage | null;
  starter: boolean;
  mediaConfigured: boolean;
}) {
  const t = useTranslations("admin.pages");
  const { form, saving, onSubmit } = useSettingsForm(
    aboutPageSchema,
    { ...values, imageId: image?.id ?? null },
    saveAboutPage,
  );
  return (
    <SettingsForm form={form} onSubmit={onSubmit} saving={saving}>
      <StarterNotice starter={starter} />
      <FormSection title={t("topTitle")} description={t("about.topDescription")}>
        <BilingualField<AboutPageInput> name="title" label={t("fields.title")} />
        <BilingualField<AboutPageInput> name="intro" label={t("fields.intro")} multiline />
      </FormSection>
      <FormSection title={t("about.expertiseTitle")} description={t("about.expertiseDescription")}>
        <BilingualField<AboutPageInput> name="expertiseHeading" label={t("fields.heading")} />
      </FormSection>
      <FormSection title={t("about.approachTitle")} description={t("about.approachDescription")}>
        <BilingualField<AboutPageInput> name="approachHeading" label={t("fields.heading")} />
        <BilingualField<AboutPageInput>
          name="approachBody"
          label={t("fields.body")}
          hint={t("fields.paragraphsHint")}
          multiline
          rows={6}
        />
        <ImageField<AboutPageInput>
          name="imageId"
          label={t("fields.image")}
          hint={t("about.imageHint")}
          initial={image}
          configured={mediaConfigured}
        />
      </FormSection>
      <FormSection title={t("about.statsTitle")} description={t("about.statsDescription")}>
        <BilingualField<AboutPageInput> name="statsHeading" label={t("fields.heading")} />
      </FormSection>
      <CtaSection />
    </SettingsForm>
  );
}

// ── Contact ──────────────────────────────────────────────────────────────────

export function ContactPageForm({
  values,
  starter,
}: {
  values: ContactPageInput;
  starter: boolean;
}) {
  const t = useTranslations("admin.pages");
  const { form, saving, onSubmit } = useSettingsForm(contactPageSchema, values, saveContactPage);
  return (
    <SettingsForm form={form} onSubmit={onSubmit} saving={saving}>
      <StarterNotice starter={starter} />
      <FormSection title={t("topTitle")} description={t("topDescription")}>
        <BilingualField<ContactPageInput> name="title" label={t("fields.title")} />
        <BilingualField<ContactPageInput> name="intro" label={t("fields.intro")} multiline />
      </FormSection>
      <FormSection title={t("contact.detailsTitle")} description={t("contact.detailsDescription")}>
        <BilingualField<ContactPageInput> name="detailsHeading" label={t("fields.heading")} />
      </FormSection>
      <FormSection title={t("contact.formTitle")} description={t("contact.formDescription")}>
        <BilingualField<ContactPageInput> name="formHeading" label={t("fields.heading")} />
        <BilingualField<ContactPageInput> name="formIntro" label={t("fields.intro")} multiline />
      </FormSection>
    </SettingsForm>
  );
}
