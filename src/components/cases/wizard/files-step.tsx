"use client";

import { CheckCircle2, CircleAlert, FileBox, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { FormEvent } from "react";

import { FormAlert } from "@/components/shared/form-controls";
import {
  DENTIST_FILE_KINDS,
  FILE_RULES,
  REQUIRED_FILE_KINDS,
  type DentistFileKind,
} from "@/lib/case-files";
import { cn } from "@/lib/utils";

import { formatBytes } from "../format";
import { SlotUploader } from "./slot-uploader";
import type { WizardFile } from "./types";
import { WizardNav } from "./wizard-nav";

/** Step 3: CBCT and intraoral scan (required), photos and other files (optional). */
export function FilesStep({
  locale,
  caseId,
  files,
  storageConfigured,
  onFilesChange,
  onBack,
  onNext,
}: {
  locale: string;
  caseId: string;
  files: WizardFile[];
  storageConfigured: boolean;
  onFilesChange: (update: (files: WizardFile[]) => WizardFile[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const t = useTranslations("cases.wizard.files");
  const missing = REQUIRED_FILE_KINDS.filter(
    (kind) => !files.some((f) => f.kind === kind && f.uploadStatus === "COMPLETE"),
  );
  const busy = files.some((f) => f.uploadStatus === "PENDING" || f.uploadStatus === "UPLOADING");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (missing.length === 0 && !busy) onNext();
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-6"
      aria-labelledby="wizard-step-title"
    >
      {!storageConfigured && <FormAlert tone="info">{t("notConfigured")}</FormAlert>}
      <div className="grid gap-4 lg:grid-cols-2">
        {DENTIST_FILE_KINDS.map((kind) => (
          <Slot
            key={kind}
            kind={kind}
            locale={locale}
            caseId={caseId}
            files={files.filter((f) => f.kind === kind)}
            storageConfigured={storageConfigured}
            onFilesChange={onFilesChange}
          />
        ))}
      </div>
      <WizardNav
        step={3}
        onBack={onBack}
        nextDisabled={missing.length > 0 || busy}
        disabledReason={
          busy
            ? t("waitForUploads")
            : missing.length
              ? t("missingRequired", {
                  slots: missing.map((k) => t(`slots.${k}.title`)).join(", "),
                })
              : undefined
        }
      />
    </form>
  );
}

function Slot({
  kind,
  locale,
  caseId,
  files,
  storageConfigured,
  onFilesChange,
}: {
  kind: DentistFileKind;
  locale: string;
  caseId: string;
  files: WizardFile[];
  storageConfigured: boolean;
  onFilesChange: (update: (files: WizardFile[]) => WizardFile[]) => void;
}) {
  const t = useTranslations("cases.wizard.files");
  const rules = FILE_RULES[kind];
  const complete = files.some((f) => f.uploadStatus === "COMPLETE");
  return (
    <section
      aria-labelledby={`slot-${kind}`}
      data-slot={kind}
      className={cn(
        "flex flex-col gap-4 rounded-card border bg-surface p-5",
        rules.required && !complete ? "border-line" : "border-line",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 id={`slot-${kind}`} className="flex items-center gap-2 font-medium text-ink">
            <FileBox aria-hidden className="size-4 text-brand" />
            {t(`slots.${kind}.title`)}
          </h3>
          <p className="text-sm text-ink-muted">{t(`slots.${kind}.description`)}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-0.5 text-xs",
            rules.required
              ? complete
                ? "bg-[#e1f2e8] text-[#1d5b38]"
                : "bg-brand-soft text-brand-deep"
              : "bg-surface-2 text-ink-muted",
          )}
        >
          {rules.required ? (complete ? t("done") : t("required")) : t("optional")}
        </span>
      </div>
      <p className="font-mono text-label text-ink-muted">
        {t("accepts", { types: rules.extensions.join(" ") })} · {t("maxSize")}
      </p>
      {kind === "CBCT" && (
        <details className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink">
          <summary className="cursor-pointer font-medium">{t("zipHelp.title")}</summary>
          <ul className="mt-2 flex flex-col gap-2 text-ink-muted">
            <li>
              <strong className="text-ink">Windows:</strong> {t("zipHelp.windows")}
            </li>
            <li>
              <strong className="text-ink">Mac:</strong> {t("zipHelp.mac")}
            </li>
          </ul>
        </details>
      )}

      {files.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label={t("uploadedFiles")}>
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm"
            >
              {f.uploadStatus === "COMPLETE" ? (
                <CheckCircle2 aria-hidden className="size-4 shrink-0 text-[#2f8a57]" />
              ) : f.uploadStatus === "FAILED" ? (
                <CircleAlert aria-hidden className="size-4 shrink-0 text-destructive" />
              ) : (
                <LoaderCircle aria-hidden className="size-4 shrink-0 animate-spin text-brand" />
              )}
              <span className="min-w-0 flex-1 truncate text-ink" title={f.fileName}>
                {f.fileName}
                {f.scanPart && (
                  <span className="ml-2 text-xs text-ink-muted">({t(`parts.${f.scanPart}`)})</span>
                )}
              </span>
              <span className="shrink-0 text-xs text-ink-muted tabular-nums">
                {formatBytes(f.sizeBytes, locale)}
              </span>
              <span className="sr-only">{t(`status.${f.uploadStatus}`)}</span>
            </li>
          ))}
        </ul>
      )}

      <SlotUploader
        kind={kind}
        caseId={caseId}
        enabled={storageConfigured}
        files={files}
        onFilesChange={onFilesChange}
      />
    </section>
  );
}
