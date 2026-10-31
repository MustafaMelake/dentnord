"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  aboutPageSchema,
  contactPageSchema,
  homePageSchema,
  servicesPageSchema,
  type AboutPageInput,
  type Bilingual,
  type ContactPageInput,
  type HomePageInput,
  type ServicesPageInput,
} from "@/lib/validation/admin";
import {
  saveAboutPage,
  saveContactPage,
  saveHomePage,
  saveServicesPage,
} from "@/server/actions/admin/settings";
import type { PublicImage } from "@/server/queries/media";

import { BilingualField } from "./form-kit";
import { FormSection } from "./form-section";
import { ImageField } from "./image-picker";
import { SettingsForm, useSettingsForm } from "./settings-forms";

// The texts of the public Home / Services / About / Contact pages (/admin/pages/*). Empty texts are
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

// ── Home ─────────────────────────────────────────────────────────────────────

type HomeSectionName =
  | "hero"
  | "workflow"
  | "statement"
  | "services"
  | "portal"
  | "guide"
  | "about"
  | "technology"
  | "testimonials"
  | "cta"
  | "meta";

/** Fields with a hint under them (`admin.pages.home.hints`): where a button leads, placeholders. */
const HOME_HINTS = [
  "heroPrimaryCta",
  "heroSecondaryCta",
  "heroTrust",
  "heroDoctorExperience",
  "workflowTitle",
  "guideCta",
  "aboutCta",
  "aboutCtaGeneric",
  "ctaPrimary",
  "ctaSecondary",
] as const satisfies (keyof HomePageInput)[];
const hasHint = (name: keyof HomePageInput): name is (typeof HOME_HINTS)[number] =>
  (HOME_HINTS as readonly string[]).includes(name);

/** The texts of one home page section, with the section's own heading and description. */
function HomeSection({
  section,
  fields,
}: {
  section: HomeSectionName;
  fields: { name: keyof HomePageInput; multiline?: boolean }[];
}) {
  const t = useTranslations("admin.pages.home");
  return (
    <FormSection
      title={t(`sections.${section}.title`)}
      description={t(`sections.${section}.description`)}
    >
      {fields.map(({ name, multiline }) => (
        <BilingualField<HomePageInput>
          key={name}
          name={name}
          label={t(`fields.${name}`)}
          hint={hasHint(name) ? t(`hints.${name}`) : undefined}
          multiline={multiline}
        />
      ))}
    </FormSection>
  );
}

export function HomePageForm({ values, starter }: { values: HomePageInput; starter: boolean }) {
  const { form, saving, onSubmit } = useSettingsForm(homePageSchema, values, saveHomePage);
  return (
    <SettingsForm form={form} onSubmit={onSubmit} saving={saving}>
      <StarterNotice starter={starter} />
      <HomeSection
        section="hero"
        fields={[
          { name: "heroTitle" },
          { name: "heroSubtitle", multiline: true },
          { name: "heroPrimaryCta" },
          { name: "heroSecondaryCta" },
          { name: "heroTrust" },
          { name: "heroDoctorRole" },
          { name: "heroDoctorExperience" },
        ]}
      />
      <HomeSection
        section="workflow"
        fields={[
          { name: "workflowLabel" },
          { name: "workflowTitle" },
          { name: "workflowStep1Title" },
          { name: "workflowStep1Body", multiline: true },
          { name: "workflowStep2Title" },
          { name: "workflowStep2Body", multiline: true },
          { name: "workflowStep3Title" },
          { name: "workflowStep3Body", multiline: true },
          { name: "workflowStep4Title" },
          { name: "workflowStep4Body", multiline: true },
        ]}
      />
      <HomeSection section="statement" fields={[{ name: "statement", multiline: true }]} />
      <HomeSection
        section="services"
        fields={[{ name: "servicesLabel" }, { name: "servicesTitle" }]}
      />
      <HomeSection
        section="portal"
        fields={[
          { name: "portalLabel" },
          { name: "portalTitle" },
          { name: "portalIntro", multiline: true },
        ]}
      />
      <HomeSection
        section="guide"
        fields={[
          { name: "guideLabel" },
          { name: "guideTitle" },
          { name: "guideBody", multiline: true },
          { name: "guideCta" },
        ]}
      />
      <HomeSection
        section="about"
        fields={[
          { name: "aboutLabel" },
          { name: "aboutTitle" },
          { name: "aboutCta" },
          { name: "aboutCtaGeneric" },
        ]}
      />
      <HomeSection
        section="technology"
        fields={[
          { name: "technologyLabel" },
          { name: "technologyTitle" },
          { name: "technologyIntro", multiline: true },
          { name: "technologyFeature1Title" },
          { name: "technologyFeature1Body", multiline: true },
          { name: "technologyFeature2Title" },
          { name: "technologyFeature2Body", multiline: true },
          { name: "technologyFeature3Title" },
          { name: "technologyFeature3Body", multiline: true },
        ]}
      />
      <HomeSection
        section="testimonials"
        fields={[{ name: "testimonialsLabel" }, { name: "testimonialsTitle" }]}
      />
      <HomeSection
        section="cta"
        fields={[
          { name: "ctaTitle" },
          { name: "ctaBody", multiline: true },
          { name: "ctaPrimary" },
          { name: "ctaSecondary" },
        ]}
      />
      <HomeSection
        section="meta"
        fields={[{ name: "metaTitle" }, { name: "metaDescription", multiline: true }]}
      />
    </SettingsForm>
  );
}

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
