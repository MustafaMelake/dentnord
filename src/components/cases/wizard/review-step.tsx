"use client";

import { CheckCircle2, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent, type ReactNode } from "react";

import { ButtonLink } from "@/components/shared/button";
import { FormAlert } from "@/components/shared/form-controls";
import { DENTIST_FILE_KINDS } from "@/lib/case-files";
import { localized } from "@/lib/utils";

import { formatBytes, formatMm } from "../format";
import { ToothChart } from "../tooth-chart";
import type { WizardCatalog, WizardDetails, WizardFile, WizardSite, WizardStep } from "./types";
import { WizardNav } from "./wizard-nav";

/** Step 4: everything at a glance, with edit links; the confirmation; submit. */
export function ReviewStep({
  locale,
  details,
  sites,
  files,
  catalog,
  onEdit,
  onBack,
  onSubmit,
  submitError,
}: {
  locale: string;
  details: WizardDetails;
  sites: WizardSite[];
  files: WizardFile[];
  catalog: WizardCatalog;
  onEdit: (step: WizardStep) => void;
  onBack: () => void;
  onSubmit: (consent: boolean) => Promise<void>;
  submitError: string | null;
}) {
  const t = useTranslations("cases.wizard.review");
  const tDetails = useTranslations("cases.wizard.details");
  const tSites = useTranslations("cases.wizard.sites");
  const tFiles = useTranslations("cases.wizard.files");
  const tv = useTranslations("validation");
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const guideType = catalog.guideTypes.find((g) => g.id === details.guideTypeId);
  const dateFmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "da-DK", {
    dateStyle: "long",
    timeZone: "UTC",
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!consent) {
      setConsentError(true);
      document.getElementById("consent")?.focus();
      return;
    }
    setSubmitting(true);
    await onSubmit(consent);
    setSubmitting(false);
  }

  const systemName = (s: WizardSite) => {
    const sys = catalog.systems.find((x) => x.id === s.implantSystemId);
    return sys ? `${sys.brand} ${sys.line}` : s.implantSystemOther || "–";
  };
  const size = (v: number | null) =>
    v === null ? tSites("suggestShort") : `${formatMm(v, locale)} mm`;

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-6"
      aria-labelledby="wizard-step-title"
    >
      <Section
        title={t("details")}
        onEdit={() => onEdit(1)}
        editLabel={t("edit", { section: t("details") })}
      >
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          <Item
            label={tDetails("patientCode")}
            value={<span className="font-mono">{details.patientCode}</span>}
          />
          <Item
            label={tDetails("guideType")}
            value={guideType ? localized(guideType.name, locale) : "–"}
          />
          <Item
            label={tDetails("surgeryDate")}
            value={
              details.surgeryDate
                ? dateFmt.format(new Date(`${details.surgeryDate}T00:00:00Z`))
                : "–"
            }
          />
          <Item label={tDetails("notes")} value={details.notes || "–"} className="sm:col-span-2" />
        </dl>
      </Section>

      <Section
        title={t("sites")}
        onEdit={() => onEdit(2)}
        editLabel={t("edit", { section: t("sites") })}
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-start">
          <ToothChart selected={sites.map((s) => s.fdiTooth)} readOnly className="max-w-md" />
          <ul className="flex flex-col divide-y divide-line">
            {sites.map((s) => (
              <li
                key={s.fdiTooth}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2.5 text-sm"
              >
                <span className="w-10 font-mono font-medium text-ink">{s.fdiTooth}</span>
                <span className="text-ink">{systemName(s)}</span>
                <span className="text-ink-muted">
                  {s.diameter === null && s.length === null
                    ? tSites("sizesSuggested")
                    : `Ø ${size(s.diameter)} · L ${size(s.length)}`}
                </span>
                {s.surgicalKitId && (
                  <span className="text-ink-muted">
                    · {catalog.kits.find((k) => k.id === s.surgicalKitId)?.name}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section
        title={t("files")}
        onEdit={() => onEdit(3)}
        editLabel={t("edit", { section: t("files") })}
      >
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          {DENTIST_FILE_KINDS.map((kind) => {
            const list = files.filter((f) => f.kind === kind && f.uploadStatus === "COMPLETE");
            return (
              <Item
                key={kind}
                label={tFiles(`slots.${kind}.title`)}
                value={
                  list.length ? (
                    <ul className="flex flex-col gap-1">
                      {list.map((f) => (
                        <li key={f.id} className="flex gap-2">
                          <span className="truncate">{f.fileName}</span>
                          <span className="shrink-0 text-ink-muted">
                            {formatBytes(f.sizeBytes, locale)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    "–"
                  )
                }
              />
            );
          })}
        </dl>
      </Section>

      <div className="flex flex-col gap-2 rounded-card border border-line bg-surface p-5">
        <label
          htmlFor="consent"
          className="flex items-start gap-3 text-[0.9375rem] leading-snug text-ink"
        >
          <input
            id="consent"
            type="checkbox"
            checked={consent}
            onChange={(e) => {
              setConsent(e.target.checked);
              if (e.target.checked) setConsentError(false);
            }}
            aria-invalid={consentError || undefined}
            aria-describedby={consentError ? "consent-error" : undefined}
            className="mt-0.5 size-[1.125rem] shrink-0 accent-brand"
          />
          {t("consent")}
        </label>
        {consentError && (
          <p id="consent-error" role="alert" className="pl-[1.875rem] text-sm text-destructive">
            {tv("consentRequired")}
          </p>
        )}
      </div>

      {submitError && <FormAlert>{submitError}</FormAlert>}
      <WizardNav step={4} onBack={onBack} submitting={submitting} nextLabel={t("submit")} />
    </form>
  );
}

function Section({
  title,
  onEdit,
  editLabel,
  children,
}: {
  title: string;
  onEdit: () => void;
  editLabel: string;
  children: ReactNode;
}) {
  const t = useTranslations("cases.wizard.review");
  return (
    <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium text-ink">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          aria-label={editLabel}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm text-brand hover:bg-brand-ice"
        >
          <Pencil aria-hidden className="size-3.5" />
          {t("editShort")}
        </button>
      </div>
      {children}
    </section>
  );
}

function Item({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-ink">{value}</dd>
    </div>
  );
}

/** Shown after a successful submit. */
export function SubmittedScreen({ caseId, caseNumber }: { caseId: string; caseNumber: string }) {
  const t = useTranslations("cases.wizard.success");
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-5 rounded-media border border-line bg-surface px-6 py-14 text-center"
    >
      <span
        aria-hidden
        className="flex size-14 items-center justify-center rounded-full bg-[#e1f2e8] text-[#2f8a57]"
      >
        <CheckCircle2 className="size-7" />
      </span>
      <div className="flex max-w-md flex-col gap-2">
        <h2 className="text-display-sm text-ink">{t("title")}</h2>
        <p className="text-ink-muted">{t("body")}</p>
      </div>
      <p
        className="rounded-full bg-brand-ice px-5 py-2 font-mono text-lg text-brand-deep"
        data-case-number=""
      >
        {caseNumber}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <ButtonLink href={`/portal/cases/${caseId}`} icon>
          {t("view")}
        </ButtonLink>
        <ButtonLink href="/portal/cases" variant="secondary">
          {t("all")}
        </ButtonLink>
      </div>
    </div>
  );
}
