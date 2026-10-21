"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import {
  FormProvider,
  useFieldArray,
  useForm,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  accountsSchema,
  contactSchema,
  doctorSchema,
  legalSchema,
  siteImagesSchema,
  statsSchema,
  type AccountsInput,
  type ContactInput,
  type DoctorInput,
  type LegalInput,
  type SiteImagesInput,
  type StatsInput,
} from "@/lib/validation/admin";
import {
  saveAccounts,
  saveContact,
  saveDoctor,
  saveLegal,
  saveSiteImages,
  saveStats,
} from "@/server/actions/admin/settings";
import type { PublicImage } from "@/server/queries/media";
import type { ActionResult } from "@/server/services/admin-action";

import {
  applyServerErrors,
  BilingualField,
  SaveBar,
  TextField,
  useActionErrorToast,
  useUnsavedChangesWarning,
} from "./form-kit";
import { FormSection } from "./form-section";
import { ImageField } from "./image-picker";
import { SortableList } from "./sortable-list";

// One form per /admin/settings tab. Each saves its own SiteSetting and invalidates its cache tag,
// so the public site updates on the next request.

function useSettingsForm<S extends z.ZodType<FieldValues, FieldValues>>(
  schema: S,
  defaultValues: z.input<S>,
  save: (values: z.input<S>) => Promise<ActionResult<unknown>>,
) {
  const tForm = useTranslations("admin.form");
  const router = useRouter();
  const errorToast = useActionErrorToast();
  const [saving, startTransition] = useTransition();
  const form = useForm<z.input<S>>({
    resolver: zodResolver(schema as never, undefined, { raw: true }),
    mode: "onTouched",
    defaultValues: defaultValues as never,
  });
  useUnsavedChangesWarning(form.formState.isDirty);
  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await save(values as z.input<S>).catch(() => null);
      if (!result?.ok) {
        applyServerErrors(form.setError, result?.fieldErrors);
        errorToast(result?.error ?? "generic");
        return;
      }
      form.reset(values);
      toast.success(tForm("saved"));
      router.refresh();
    }),
  );
  return { form, saving, onSubmit };
}

function SettingsForm<T extends FieldValues>({
  form,
  onSubmit,
  saving,
  children,
}: {
  form: UseFormReturn<T>;
  onSubmit: () => void;
  saving: boolean;
  children: ReactNode;
}) {
  return (
    <FormProvider {...form}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        noValidate
        className="flex flex-col gap-6"
      >
        {children}
        <SaveBar dirty={form.formState.isDirty} saving={saving} />
      </form>
    </FormProvider>
  );
}

const num = (n: number | null) => (n === null ? "" : String(n));

// ── Numbers ──────────────────────────────────────────────────────────────────

export function StatsForm({
  values,
}: {
  values: {
    clinics: number | null;
    yearsExperience: number | null;
    guidesDelivered: number | null;
    turnaroundDays: number | null;
  };
}) {
  const t = useTranslations("admin.settings.numbers");
  const { form, saving, onSubmit } = useSettingsForm(
    statsSchema,
    {
      clinics: num(values.clinics),
      yearsExperience: num(values.yearsExperience),
      guidesDelivered: num(values.guidesDelivered),
      turnaroundDays: num(values.turnaroundDays),
    },
    saveStats,
  );
  return (
    <SettingsForm form={form} onSubmit={onSubmit} saving={saving}>
      <FormSection title={t("title")} description={t("description")}>
        <div className="grid gap-5 sm:grid-cols-2">
          {(["clinics", "yearsExperience", "guidesDelivered", "turnaroundDays"] as const).map(
            (key) => (
              <TextField<StatsInput>
                key={key}
                name={key}
                label={t(`${key}.label`)}
                hint={t(`${key}.hint`)}
                inputMode="numeric"
                optional
              />
            ),
          )}
        </div>
      </FormSection>
    </SettingsForm>
  );
}

// ── Contact ──────────────────────────────────────────────────────────────────

export function ContactForm({ values }: { values: ContactInput }) {
  const t = useTranslations("admin.settings.contact");
  const { form, saving, onSubmit } = useSettingsForm(contactSchema, values, saveContact);
  return (
    <SettingsForm form={form} onSubmit={onSubmit} saving={saving}>
      <FormSection title={t("title")} description={t("description")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField<ContactInput>
            name="email"
            label={t("email")}
            type="email"
            inputMode="email"
            optional
          />
          <TextField<ContactInput>
            name="phone"
            label={t("phone")}
            type="tel"
            inputMode="tel"
            placeholder="+45 12 34 56 78"
            optional
          />
        </div>
        <BilingualField<ContactInput>
          name="address"
          label={t("address")}
          multiline
          rows={3}
          optional
        />
        <TextField<ContactInput>
          name="cvr"
          label={t("cvr")}
          inputMode="numeric"
          hint={t("cvrHint")}
          optional
          className="sm:max-w-xs"
        />
      </FormSection>
    </SettingsForm>
  );
}

// ── About the doctor ─────────────────────────────────────────────────────────

export function DoctorForm({
  values,
  portrait,
  cardPhoto,
  mediaConfigured,
}: {
  values: DoctorInput;
  portrait: PublicImage | null;
  cardPhoto: PublicImage | null;
  mediaConfigured: boolean;
}) {
  const t = useTranslations("admin.settings.doctor");
  const { form, saving, onSubmit } = useSettingsForm(doctorSchema, values, saveDoctor);
  // keyName "key": the rows have their own `id` (stored), which RHF would otherwise overwrite.
  const rows = useFieldArray({ control: form.control, name: "expertise", keyName: "key" });
  const sortable = rows.fields.map((f, index) => ({ id: f.key, index, title: f.title }));

  return (
    <SettingsForm form={form} onSubmit={onSubmit} saving={saving}>
      <FormSection title={t("profileTitle")} description={t("profileDescription")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField<DoctorInput> name="name" label={t("name")} placeholder="Dr. …" />
          <TextField<DoctorInput> name="city" label={t("city")} optional />
        </div>
        <BilingualField<DoctorInput>
          name="credentials"
          label={t("credentials")}
          hint={t("credentialsHint")}
          optional
        />
        <BilingualField<DoctorInput>
          name="bio"
          label={t("bio")}
          hint={t("bioHint")}
          multiline
          rows={5}
          optional
        />
        <BilingualField<DoctorInput>
          name="languages"
          label={t("languages")}
          hint={t("languagesHint")}
          optional
        />
      </FormSection>
      <FormSection title={t("photosTitle")} description={t("photosDescription")}>
        <ImageField<DoctorInput>
          name="portraitId"
          label={t("portrait")}
          initial={portrait}
          configured={mediaConfigured}
        />
        <ImageField<DoctorInput>
          name="cardPhotoId"
          label={t("cardPhoto")}
          hint={t("cardPhotoHint")}
          initial={cardPhoto}
          configured={mediaConfigured}
        />
      </FormSection>
      <FormSection
        id="field-expertise"
        title={t("expertiseTitle")}
        description={t("expertiseDescription")}
      >
        <SortableList
          items={sortable}
          itemLabel={(row) => row.title.en || row.title.da || t("untitled")}
          onCommit={async (keys) => {
            // Re-order the form values to match (saved with the rest of the form).
            const values = form.getValues("expertise");
            const indexOf = new Map(sortable.map((row) => [row.id, row.index]));
            rows.replace(keys.map((key) => values[indexOf.get(key)!]));
            return true;
          }}
          renderItem={({ index }) => (
            <div className="flex items-start gap-3">
              <div className="grid min-w-0 flex-1 gap-4">
                <BilingualField<DoctorInput>
                  name={`expertise.${index}.title`}
                  label={t("rowTitle")}
                />
                <BilingualField<DoctorInput>
                  name={`expertise.${index}.tag`}
                  label={t("rowTag")}
                  optional
                />
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={t("removeRow", { n: index + 1 })}
                onClick={() => rows.remove(index)}
              >
                <Trash2 />
              </Button>
            </div>
          )}
        />
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          disabled={rows.fields.length >= 12}
          onClick={() =>
            rows.append({
              id: crypto.randomUUID(),
              title: { da: "", en: "" },
              tag: { da: "", en: "" },
            })
          }
        >
          <Plus data-icon="inline-start" />
          {t("addRow")}
        </Button>
      </FormSection>
    </SettingsForm>
  );
}

// ── Accounts ─────────────────────────────────────────────────────────────────

export function AccountsForm({ values }: { values: { reviewDays: number | null } }) {
  const t = useTranslations("admin.settings.accounts");
  const { form, saving, onSubmit } = useSettingsForm(
    accountsSchema,
    { reviewDays: num(values.reviewDays) },
    saveAccounts,
  );
  return (
    <SettingsForm form={form} onSubmit={onSubmit} saving={saving}>
      <FormSection title={t("title")} description={t("description")}>
        <TextField<AccountsInput>
          name="reviewDays"
          label={t("reviewDays")}
          hint={t("reviewDaysHint")}
          inputMode="numeric"
          optional
          className="sm:max-w-xs"
        />
      </FormSection>
    </SettingsForm>
  );
}

// ── Legal ────────────────────────────────────────────────────────────────────

export function LegalForm({ values }: { values: LegalInput }) {
  const t = useTranslations("admin.settings.legal");
  const { form, saving, onSubmit } = useSettingsForm(legalSchema, values, saveLegal);
  return (
    <SettingsForm form={form} onSubmit={onSubmit} saving={saving}>
      <FormSection title={t("title")} description={t("description")}>
        <BilingualField<LegalInput>
          name="terms"
          label={t("terms")}
          hint={t("markdownHint")}
          multiline="markdown"
          rows={16}
          optional
        />
        <BilingualField<LegalInput>
          name="privacy"
          label={t("privacy")}
          hint={t("markdownHint")}
          multiline="markdown"
          rows={16}
          optional
        />
      </FormSection>
    </SettingsForm>
  );
}

// ── Site images ──────────────────────────────────────────────────────────────

export function SiteImagesForm({
  hero,
  technology,
  mediaConfigured,
}: {
  hero: PublicImage | null;
  technology: PublicImage | null;
  mediaConfigured: boolean;
}) {
  const t = useTranslations("admin.settings.images");
  const { form, saving, onSubmit } = useSettingsForm(
    siteImagesSchema,
    { heroId: hero?.id ?? null, technologyId: technology?.id ?? null },
    saveSiteImages,
  );
  return (
    <SettingsForm form={form} onSubmit={onSubmit} saving={saving}>
      <FormSection title={t("title")} description={t("description")}>
        <ImageField<SiteImagesInput>
          name="heroId"
          label={t("hero")}
          hint={t("heroHint")}
          initial={hero}
          configured={mediaConfigured}
        />
        <ImageField<SiteImagesInput>
          name="technologyId"
          label={t("technology")}
          hint={t("technologyHint")}
          initial={technology}
          configured={mediaConfigured}
        />
      </FormSection>
    </SettingsForm>
  );
}
