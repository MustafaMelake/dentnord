"use client";

import {
  CheckCircle2,
  CircleAlert,
  FileBox,
  LoaderCircle,
  Pause,
  Play,
  RotateCw,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { FormEvent, ReactNode } from "react";
import { toast } from "sonner";

import { FormAlert } from "@/components/shared/form-controls";
import {
  DENTIST_FILE_KINDS,
  FILE_RULES,
  REQUIRED_FILE_KINDS,
  type DentistFileKind,
} from "@/lib/case-files";
import { cn } from "@/lib/utils";
import { setScanPartAction } from "@/server/actions/cases";

import { formatBytes } from "../format";
import { SlotUploader } from "./slot-uploader";
import type { WizardFile } from "./types";
import type { CaseUploads, LiveUpload } from "./use-case-uploads";
import { WizardNav } from "./wizard-nav";

const SCAN_PARTS = ["UPPER", "LOWER", "BITE"] as const;

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
          <Slot
            key={kind}
            kind={kind}
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

function Slot({
  kind,
  locale,
  files,
  live,
  enabled,
  uploads,
  onFilesChange,
}: {
  kind: DentistFileKind;
  locale: string;
  files: WizardFile[];
  live: LiveUpload[];
  enabled: boolean;
  uploads: CaseUploads;
  onFilesChange: (update: (files: WizardFile[]) => WizardFile[]) => void;
}) {
  const t = useTranslations("cases.wizard.files");
  const rules = FILE_RULES[kind];
  const complete = files.some((f) => f.uploadStatus === "COMPLETE");
  const liveIds = new Set(live.map((l) => l.serverId));
  const stored = files.filter((f) => !liveIds.has(f.id));
  const byId = new Map(files.map((f) => [f.id, f]));

  async function changeScanPart(fileId: string, value: string) {
    const scanPart = value === "" ? null : (value as (typeof SCAN_PARTS)[number]);
    const result = await setScanPartAction(locale, { fileId, scanPart }).catch(() => null);
    if (!result?.ok) {
      toast.error(t("errors.generic"));
      return;
    }
    onFilesChange((all) => all.map((f) => (f.id === fileId ? { ...f, scanPart } : f)));
  }

  const scanSelect = (file: WizardFile | undefined) =>
    kind === "INTRAORAL_SCAN" && file ? (
      <select
        value={file.scanPart ?? ""}
        onChange={(e) => changeScanPart(file.id, e.target.value)}
        aria-label={t("scanPartFor", { name: file.fileName })}
        className="h-8 rounded-full border border-line bg-surface px-2.5 text-xs text-ink"
      >
        <option value="">{t("scanPartNone")}</option>
        {SCAN_PARTS.map((p) => (
          <option key={p} value={p}>
            {t(`parts.${p}`)}
          </option>
        ))}
      </select>
    ) : null;

  return (
    <section
      aria-labelledby={`slot-${kind}`}
      data-slot={kind}
      className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5"
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

      {(live.length > 0 || stored.length > 0) && (
        <ul className="flex flex-col gap-2" aria-label={t("uploadedFiles")}>
          {live.map((l) => (
            <FileRow
              key={l.uppyId}
              name={l.name}
              size={formatBytes(l.size, locale)}
              state={l.complete ? "done" : l.error ? "error" : l.paused ? "paused" : "uploading"}
              percent={l.percent}
              message={l.error ? t(`errors.${l.error}` as "errors.generic") : null}
              extra={scanSelect(l.serverId ? byId.get(l.serverId) : undefined)}
              actions={
                <>
                  {!l.complete && !l.error && (
                    <IconButton
                      label={t(l.paused ? "resume" : "pause", { name: l.name })}
                      onClick={() => uploads.pauseResume(l.uppyId)}
                    >
                      {l.paused ? <Play className="size-4" /> : <Pause className="size-4" />}
                    </IconButton>
                  )}
                  {l.error && l.serverId && (
                    <IconButton
                      label={t("retry", { name: l.name })}
                      onClick={() => uploads.retry(l.uppyId)}
                    >
                      <RotateCw className="size-4" />
                    </IconButton>
                  )}
                  <IconButton
                    label={t(l.complete ? "remove" : "cancel", { name: l.name })}
                    onClick={() => uploads.removeLive(l.uppyId)}
                    danger
                  >
                    <X className="size-4" />
                  </IconButton>
                </>
              }
            />
          ))}
          {stored.map((f) => (
            <FileRow
              key={f.id}
              name={f.fileName}
              size={formatBytes(f.sizeBytes, locale)}
              state={f.uploadStatus === "COMPLETE" ? "done" : "error"}
              message={f.uploadStatus === "COMPLETE" ? null : t("interrupted")}
              extra={scanSelect(f)}
              actions={
                <IconButton
                  label={t("remove", { name: f.fileName })}
                  onClick={async () => {
                    if (!(await uploads.removeStored(f.id))) toast.error(t("errors.generic"));
                  }}
                  danger
                >
                  <X className="size-4" />
                </IconButton>
              }
            />
          ))}
        </ul>
      )}

      <SlotUploader kind={kind} enabled={enabled} onAdd={(list) => uploads.add(kind, list)} />
    </section>
  );
}

function FileRow({
  name,
  size,
  state,
  percent,
  message,
  extra,
  actions,
}: {
  name: string;
  size: string;
  state: "uploading" | "paused" | "done" | "error";
  percent?: number;
  message: string | null;
  extra?: ReactNode;
  actions: ReactNode;
}) {
  const t = useTranslations("cases.wizard.files");
  const icon = {
    done: <CheckCircle2 aria-hidden className="size-4 shrink-0 text-[#2f8a57]" />,
    error: <CircleAlert aria-hidden className="size-4 shrink-0 text-destructive" />,
    paused: <Pause aria-hidden className="size-4 shrink-0 text-ink-muted" />,
    uploading: <LoaderCircle aria-hidden className="size-4 shrink-0 animate-spin text-brand" />,
  }[state];
  const showProgress = state === "uploading" || state === "paused";
  return (
    <li
      data-file-row={name}
      data-state={state}
      className={cn(
        "flex flex-col gap-2 rounded-xl border px-3 py-2.5 text-sm",
        state === "error" ? "border-destructive/30 bg-destructive/5" : "border-line",
      )}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="min-w-0 flex-1 truncate text-ink" title={name}>
          {name}
        </span>
        <span className="hidden shrink-0 text-xs text-ink-muted tabular-nums sm:inline">
          {size}
        </span>
        <span className="flex shrink-0 items-center gap-1">{actions}</span>
      </div>
      {(extra || showProgress || message) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pl-7">
          {extra}
          {showProgress && (
            <div className="flex min-w-40 flex-1 items-center gap-2">
              <div
                role="progressbar"
                aria-label={t("progressFor", { name })}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(percent ?? 0)}
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-300",
                    state === "paused" ? "bg-ink-muted" : "bg-brand",
                  )}
                  style={{ width: `${percent ?? 0}%` }}
                />
              </div>
              <span className="w-16 text-right text-xs text-ink-muted tabular-nums">
                {state === "paused" ? t("paused") : `${Math.round(percent ?? 0)} %`}
              </span>
            </div>
          )}
          {message && <p className="text-xs text-destructive">{message}</p>}
        </div>
      )}
    </li>
  );
}

function IconButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-2",
        danger ? "hover:text-destructive" : "hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
