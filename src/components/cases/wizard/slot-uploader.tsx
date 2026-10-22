"use client";

import { UploadCloud } from "lucide-react";
import { useTranslations } from "next-intl";

import type { DentistFileKind } from "@/lib/case-files";

import type { WizardFile } from "./types";

/**
 * Upload area for one file slot. Wired to Uppy (@uppy/aws-s3 multipart, straight to R2) once R2 is
 * configured; until then it shows that uploads aren't available yet.
 */
export function SlotUploader({
  kind,
  enabled,
}: {
  kind: DentistFileKind;
  caseId: string;
  enabled: boolean;
  files: WizardFile[];
  onFilesChange: (update: (files: WizardFile[]) => WizardFile[]) => void;
}) {
  const t = useTranslations("cases.wizard.files");
  return (
    <div
      data-uploader={kind}
      aria-disabled={!enabled}
      className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-muted"
    >
      <UploadCloud aria-hidden className="size-6" />
      {enabled ? t("dropHere") : t("unavailable")}
    </div>
  );
}
