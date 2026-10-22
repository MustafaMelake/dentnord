"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";

import {
  describedBy,
  FormField,
  TextArea,
  TextInput,
  useFieldError,
} from "@/components/shared/form-controls";
import { cn, localized } from "@/lib/utils";
import { detailsDraftSchema, detailsSchema, patientCodeIssue } from "@/lib/validation/case";

import type { WizardCatalog, WizardDetails } from "./types";
import { WizardNav } from "./wizard-nav";

/** Step 1: patient code (never a name), guide type, planned surgery date, notes. */
export function DetailsStep({
  locale,
  initial,
  guideTypes,
  onChange,
  onNext,
  serverErrors,
}: {
  locale: string;
  initial: WizardDetails;
  guideTypes: WizardCatalog["guideTypes"];
  /** Autosave hook: called with the current values whenever they change. */
  onChange: (values: WizardDetails) => void;
  /** "Next": strict validation passed; the wizard saves and moves on. */
  onNext: (values: WizardDetails) => Promise<void>;
  serverErrors: Record<string, string> | null;
}) {
  const t = useTranslations("cases.wizard.details");
  const tv = useTranslations("validation");
  const fieldError = useFieldError();
  const form = useForm<WizardDetails>({
    resolver: zodResolver(detailsSchema, undefined, { raw: true }),
    mode: "onTouched",
    defaultValues: initial,
  });
  const { register, formState, control, setError } = form;
  const values = useWatch({ control }) as WizardDetails;
  const liveIssue = patientCodeIssue(values.patientCode ?? "");

  // Autosave only values the lenient draft schema accepts (never a name-like patient code).
  // Keyed on the serialised values: useWatch returns a new object on every render.
  const serialized = JSON.stringify(values);
  useEffect(() => {
    const current = JSON.parse(serialized) as WizardDetails;
    if (detailsDraftSchema.safeParse(current).success) onChange(current);
  }, [serialized, onChange]);

  useEffect(() => {
    for (const [path, message] of Object.entries(serverErrors ?? {})) {
      if (path in initial) setError(path as keyof WizardDetails, { message });
    }
  }, [serverErrors, setError, initial]);

  const e = {
    patientCode: fieldError(formState.errors.patientCode),
    guideTypeId: fieldError(formState.errors.guideTypeId),
    surgeryDate: fieldError(formState.errors.surgeryDate),
    notes: fieldError(formState.errors.notes),
  };

  return (
    <form
      onSubmit={form.handleSubmit((v) => onNext(v))}
      noValidate
      className="flex flex-col gap-8"
      aria-labelledby="wizard-step-title"
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <FormField
          id="patientCode"
          label={t("patientCode")}
          error={e.patientCode}
          hint={!e.patientCode && !liveIssue ? t("patientCodeHint") : undefined}
        >
          <TextInput
            id="patientCode"
            autoComplete="off"
            spellCheck={false}
            maxLength={40}
            placeholder={t("patientCodePlaceholder")}
            {...describedBy("patientCode", e.patientCode, !e.patientCode)}
            {...register("patientCode")}
          />
          {!e.patientCode && liveIssue && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-[#fbeedd] px-3 py-2 text-sm text-[#7a4a0c]"
            >
              <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              {tv(liveIssue)}
            </p>
          )}
        </FormField>
        <FormField
          id="surgeryDate"
          label={t("surgeryDate")}
          optional={t("optional")}
          error={e.surgeryDate}
        >
          <TextInput
            id="surgeryDate"
            type="date"
            lang={locale}
            {...describedBy("surgeryDate", e.surgeryDate)}
            {...register("surgeryDate")}
          />
        </FormField>
      </div>

      <fieldset
        aria-describedby={e.guideTypeId ? "guideTypeId-error" : undefined}
        className="flex flex-col gap-3"
      >
        <legend className="mb-3 text-sm font-medium text-ink">{t("guideType")}</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {guideTypes.map((g) => {
            const checked = values.guideTypeId === g.id;
            return (
              <label
                key={g.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-card border bg-surface p-4 transition-colors",
                  checked ? "border-brand bg-brand-ice" : "border-line hover:border-ink/25",
                )}
              >
                <input
                  type="radio"
                  value={g.id}
                  className="mt-1 size-4 shrink-0 accent-brand"
                  {...register("guideTypeId")}
                />
                <span className="flex flex-col gap-1">
                  <span className="font-medium text-ink">{localized(g.name, locale)}</span>
                  {localized(g.description, locale) && (
                    <span className="text-sm text-ink-muted">
                      {localized(g.description, locale)}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
        {e.guideTypeId && (
          <p id="guideTypeId-error" role="alert" className="text-sm text-destructive">
            {e.guideTypeId}
          </p>
        )}
      </fieldset>

      <FormField
        id="notes"
        label={t("notes")}
        optional={t("optional")}
        hint={t("notesHint")}
        error={e.notes}
      >
        <TextArea
          id="notes"
          rows={4}
          maxLength={2000}
          {...describedBy("notes", e.notes, true)}
          {...register("notes")}
        />
      </FormField>

      <WizardNav step={1} submitting={formState.isSubmitting} />
    </form>
  );
}
