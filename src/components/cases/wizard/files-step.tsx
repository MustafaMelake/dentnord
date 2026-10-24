"use client";

import { useTranslations } from "next-intl";
import type { FormEvent } from "react";

import { FormAlert } from "@/components/shared/form-controls";
import { DENTIST_FILE_KINDS, FILE_RULES, REQUIRED_FILE_KINDS } from "@/lib/case-files";

import { UploadSlot } from "../upload-slot";
import type { WizardFile } from "./types";
import type { CaseUploads } from "./use-case-uploads";
import { WizardNav } from "./wizard-nav";

/** Step 3: CBCT and intraoral scan (required), photos and other files (optional). */
export function FilesStep({
  locale,
  files,
  storageConfigured,
  uploads,
  onFilesChange,
  onBack,
  onNext,
}: {
  locale: string;
  files: WizardFile[];
  storageConfigured: boolean;
  uploads: CaseUploads;
  onFilesChange: (update: (files: WizardFile[]) => WizardFile[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const t = useTranslations("cases.wizard.files");
  const liveIds = new Set(uploads.live.map((l) => l.serverId).filter(Boolean));
  const missing = REQUIRED_FILE_KINDS.filter(
    (kind) => !files.some((f) => f.kind === kind && f.uploadStatus === "COMPLETE"),
  );
  // Rows that block "Next": a failed live upload, or an upload interrupted in an earlier visit.
  const problems =
    uploads.live.some((l) => l.error) ||
    files.some((f) => f.uploadStatus !== "COMPLETE" && !liveIds.has(f.id));
  const busy = uploads.uploading;
  const blocked = missing.length > 0 || busy || problems;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!blocked) onNext();
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-6"
      aria-labelledby="wizard-step-title"
    >
      {!storageConfigured && <FormAlert tone="info">{t("notConfigured")}</FormAlert>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {DENTIST_FILE_KINDS.map((kind) => (
          <UploadSlot
            key={kind}
            kind={kind}
            title={t(`slots.${kind}.title`)}
            description={t(`slots.${kind}.description`)}
            extensions={FILE_RULES[kind].extensions}
            required={FILE_RULES[kind].required}
            help={kind === "CBCT" ? <ZipHelp /> : undefined}
            locale={locale}
            files={files.filter((f) => f.kind === kind)}
            live={uploads.live.filter((l) => l.kind === kind)}
            enabled={storageConfigured && uploads.ready}
            uploads={uploads}
            onFilesChange={onFilesChange}
          />
        ))}
      </div>
      <WizardNav
        step={3}
        onBack={onBack}
        nextDisabled={blocked}
        disabledReason={
          busy
            ? t("waitForUploads")
            : problems
              ? t("fixProblems")
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

/** How to zip a DICOM folder (CBCT slot). */
export function ZipHelp() {
  const t = useTranslations("cases.wizard.files");
  return (
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
  );
}
