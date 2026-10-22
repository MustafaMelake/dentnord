"use client";

import { Check, CircleAlert, Cloud, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";

import { FormAlert } from "@/components/shared/form-controls";
import { REQUIRED_FILE_KINDS } from "@/lib/case-files";
import { cn } from "@/lib/utils";
import { detailsSchema, sitesSchema } from "@/lib/validation/case";
import {
  saveCaseDetails,
  saveCaseSites,
  submitCaseAction,
  type CaseActionResult,
} from "@/server/actions/cases";

import { DetailsStep } from "./details-step";
import { FilesStep } from "./files-step";
import { ReviewStep, SubmittedScreen } from "./review-step";
import { SitesStep } from "./sites-step";
import type { WizardCatalog, WizardDetails, WizardFile, WizardSite, WizardStep } from "./types";
import { WIZARD_STEPS } from "./types";
import { useAutosave, type SaveState } from "./use-autosave";
import { useCaseUploads } from "./use-case-uploads";

const draftUrl = (locale: string, id: string, step: WizardStep) =>
  `/${locale}/portal/cases/${id}/edit?step=${step}`;

/**
 * The new-case wizard. The DRAFT is created on the first save, then every step autosaves, so the
 * dentist can leave and come back (/portal/cases/<id>/edit?step=N restores it). Saves go through a
 * queue so they never race (two quick autosaves can't create two drafts).
 */
export function CaseWizard({
  locale,
  initial,
  initialStep,
  catalog,
  defaults,
  storageConfigured,
}: {
  locale: string;
  initial: {
    caseId: string | null;
    details: WizardDetails;
    sites: WizardSite[];
    files: WizardFile[];
  };
  initialStep: WizardStep;
  catalog: WizardCatalog;
  defaults: { implantSystemId: string | null; surgicalKitId: string | null };
  storageConfigured: boolean;
}) {
  const t = useTranslations("cases.wizard");
  const tErr = useTranslations("cases.errors");
  const [caseId, setCaseId] = useState(initial.caseId);
  const caseIdRef = useRef(initial.caseId);
  const [step, setStep] = useState<WizardStep>(initial.caseId ? initialStep : 1);
  const [details, setDetails] = useState(initial.details);
  const [sites, setSites] = useState(initial.sites);
  const [files, setFiles] = useState(initial.files);
  const [errors, setErrors] = useState<{
    step: WizardStep;
    fieldErrors: Record<string, string>;
  } | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const enqueue = useCallback(<T,>(task: () => Promise<T>) => {
    const run = queue.current.then(task, task);
    queue.current = run.catch(() => undefined);
    return run;
  }, []);

  const describe = (result: Exclude<CaseActionResult<unknown>, { ok: true }>) =>
    tErr.has(result.error) ? tErr(result.error) : tErr("generic");

  const saveDetailsNow = useCallback(
    (values: WizardDetails, complete: boolean) =>
      enqueue(async () => {
        const result = await saveCaseDetails(locale, {
          caseId: caseIdRef.current,
          complete,
          details: values,
        }).catch(() => null);
        if (result?.ok && !caseIdRef.current) {
          caseIdRef.current = result.data.caseId;
          setCaseId(result.data.caseId);
          // The draft exists now: give the page its own address without reloading.
          window.history.replaceState(null, "", draftUrl(locale, result.data.caseId, 1));
        }
        return result;
      }),
    [enqueue, locale],
  );

  const saveSitesNow = useCallback(
    (values: WizardSite[], complete: boolean) =>
      enqueue(async () => {
        if (!caseIdRef.current) return null;
        return saveCaseSites(locale, { caseId: caseIdRef.current, complete, sites: values }).catch(
          () => null,
        );
      }),
    [enqueue, locale],
  );

  const hasDetails = Boolean(
    details.patientCode || details.guideTypeId || details.notes || details.surgeryDate,
  );
  const detailsAutosave = useAutosave(
    details,
    async (v) => !!(await saveDetailsNow(v, false))?.ok,
    {
      enabled: hasDetails,
    },
  );
  const sitesAutosave = useAutosave(sites, async (v) => !!(await saveSitesNow(v, false))?.ok, {
    enabled: !!caseId,
  });
  // Lives here, not in the files step, so going back a step never aborts an upload.
  const uploads = useCaseUploads({ caseId, onFilesChange: setFiles });

  function goTo(next: WizardStep) {
    setErrors(null);
    setAlert(null);
    setStep(next);
    if (caseIdRef.current)
      window.history.replaceState(null, "", draftUrl(locale, caseIdRef.current, next));
    document.getElementById("wizard-step-title")?.focus();
  }

  const reachable: WizardStep = !caseId
    ? 1
    : !detailsSchema.safeParse(details).success
      ? 1
      : !sitesSchema.safeParse({ sites }).success
        ? 2
        : REQUIRED_FILE_KINDS.some(
              (k) => !files.some((f) => f.kind === k && f.uploadStatus === "COMPLETE"),
            ) ||
            uploads.uploading ||
            files.some((f) => f.uploadStatus !== "COMPLETE")
          ? 3
          : 4;

  const saveState: SaveState =
    detailsAutosave.state === "saving" || sitesAutosave.state === "saving"
      ? "saving"
      : detailsAutosave.state === "error" || sitesAutosave.state === "error"
        ? "error"
        : detailsAutosave.state === "saved" || sitesAutosave.state === "saved"
          ? "saved"
          : "idle";

  if (submitted && caseId) return <SubmittedScreen caseId={caseId} caseNumber={submitted} />;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <ol className="flex min-w-0 flex-wrap gap-2" aria-label={t("progress")}>
          {WIZARD_STEPS.map((key, i) => {
            const n = (i + 1) as WizardStep;
            const current = n === step;
            const done = n < reachable || (n < step && n <= reachable);
            const canGo = n <= reachable && n !== step;
            return (
              <li key={key}>
                <button
                  type="button"
                  disabled={!canGo}
                  onClick={() => goTo(n)}
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                    current
                      ? "border-brand bg-brand text-white"
                      : done
                        ? "border-brand-soft bg-brand-ice text-brand-deep hover:border-brand"
                        : "border-line bg-surface text-ink-muted",
                    !canGo && !current && "cursor-default",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full font-mono text-xs",
                      current ? "bg-white/20" : done ? "bg-brand text-white" : "bg-surface-2",
                    )}
                  >
                    {done && !current ? <Check aria-hidden className="size-3" /> : n}
                  </span>
                  <span className={current ? "" : "hidden sm:inline"}>{t(`steps.${key}`)}</span>
                  <span className="sr-only">
                    {t("stepOf", { step: n, total: WIZARD_STEPS.length })}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <SaveIndicator state={caseId ? saveState : "idle"} />
      </div>

      <div className="flex flex-col gap-1">
        <h2 id="wizard-step-title" tabIndex={-1} className="text-display-sm text-ink outline-none">
          {t(`titles.${WIZARD_STEPS[step - 1]}`)}
        </h2>
        <p className="text-ink-muted">{t(`intros.${WIZARD_STEPS[step - 1]}`)}</p>
      </div>

      {alert && <FormAlert>{alert}</FormAlert>}

      {step === 1 && (
        <DetailsStep
          locale={locale}
          initial={details}
          guideTypes={catalog.guideTypes}
          onChange={setDetails}
          serverErrors={errors?.step === 1 ? errors.fieldErrors : null}
          onNext={async (values) => {
            detailsAutosave.cancel();
            setDetails(values);
            const result = await saveDetailsNow(values, true);
            if (!result?.ok) {
              if (result) setErrors({ step: 1, fieldErrors: result.fieldErrors ?? {} });
              setAlert(result ? describe(result) : tErr("network"));
              return;
            }
            goTo(2);
          }}
        />
      )}
      {step === 2 && (
        <SitesStep
          locale={locale}
          sites={sites}
          catalog={catalog}
          defaults={defaults}
          onChange={setSites}
          onBack={() => goTo(1)}
          serverErrors={errors?.step === 2 ? errors.fieldErrors : null}
          onNext={async (values) => {
            sitesAutosave.cancel();
            const result = await saveSitesNow(values, true);
            if (!result?.ok) {
              if (result) setErrors({ step: 2, fieldErrors: result.fieldErrors ?? {} });
              setAlert(result ? describe(result) : tErr("network"));
              return;
            }
            goTo(3);
          }}
        />
      )}
      {step === 3 && caseId && (
        <FilesStep
          locale={locale}
          files={files}
          storageConfigured={storageConfigured}
          uploads={uploads}
          onFilesChange={setFiles}
          onBack={() => goTo(2)}
          onNext={() => goTo(4)}
        />
      )}
      {step === 4 && caseId && (
        <ReviewStep
          locale={locale}
          details={details}
          sites={sites}
          files={files}
          catalog={catalog}
          onEdit={goTo}
          onBack={() => goTo(3)}
          submitError={alert}
          onSubmit={async (consent) => {
            setAlert(null);
            const result = await enqueue(() =>
              submitCaseAction(locale, { caseId, consent }).catch(() => null),
            );
            if (!result?.ok) {
              setAlert(result ? describe(result) : tErr("network"));
              return;
            }
            setSubmitted(result.data.caseNumber);
            window.scrollTo({ top: 0 });
          }}
        />
      )}
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const t = useTranslations("cases.wizard.save");
  if (state === "idle") return null;
  const Icon = state === "saving" ? LoaderCircle : state === "error" ? CircleAlert : Cloud;
  return (
    <p
      role="status"
      className={cn(
        "flex shrink-0 items-center gap-1.5 text-sm whitespace-nowrap",
        state === "error" ? "text-destructive" : "text-ink-muted",
      )}
    >
      <Icon aria-hidden className={cn("size-4", state === "saving" && "animate-spin")} />
      {t(state)}
    </p>
  );
}
