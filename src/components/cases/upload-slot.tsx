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
import type { ReactNode } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { setScanPartAction } from "@/server/actions/cases";

import { formatBytes } from "./format";
import { SlotUploader } from "./wizard/slot-uploader";
import type { WizardFile } from "./wizard/types";
import type { CaseUploads, LiveUpload } from "./wizard/use-case-uploads";

// One upload slot (a file kind): its files with live progress, pause/resume, retry and remove, and
// the drop zone. Used by the wizard (dentist files), the "files requested" banner (NEEDS_FILES) and
// the lab's plan preparation. What may be removed is decided by the caller (and re-checked by the
// server, lib/upload-permissions.ts).

const SCAN_PARTS = ["UPPER", "LOWER", "BITE"] as const;

export function UploadSlot({
  kind,
  title,
  description,
  extensions,
  required,
  help,
  locale,
  files,
  live,
  enabled,
  uploads,
  onFilesChange,
  removeComplete = true,
}: {
  kind: string;
  title: string;
  description?: string;
  extensions: readonly string[];
  /** true / false shows a Required / Optional badge; undefined shows none. */
  required?: boolean;
  help?: ReactNode;
  locale: string;
  files: WizardFile[];
  live: LiveUpload[];
  enabled: boolean;
  uploads: CaseUploads;
  onFilesChange: (update: (files: WizardFile[]) => WizardFile[]) => void;
  /** Finished files can be removed (drafts, plans being prepared); not on a submitted case. */
  removeComplete?: boolean;
}) {
  const t = useTranslations("cases.wizard.files");
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
    kind === "INTRAORAL_SCAN" && file && enabled ? (
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
      className="flex min-w-0 flex-col gap-4 rounded-card border border-line bg-surface p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 id={`slot-${kind}`} className="flex items-center gap-2 font-medium text-ink">
            <FileBox aria-hidden className="size-4 text-brand" />
            {title}
          </h3>
          {description && <p className="text-sm text-ink-muted">{description}</p>}
        </div>
        {required !== undefined && (
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-0.5 text-xs",
              required
                ? complete
                  ? "bg-[#e1f2e8] text-[#1d5b38]"
                  : "bg-brand-soft text-brand-deep"
                : "bg-surface-2 text-ink-muted",
            )}
          >
            {required ? (complete ? t("done") : t("required")) : t("optional")}
          </span>
        )}
      </div>
      <p className="font-mono text-label text-ink-muted">
        {t("accepts", { types: extensions.join(" ") })} · {t("maxSize")}
      </p>
      {help}

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
                  {(!l.complete || removeComplete) && (
                    <IconButton
                      label={t(l.complete ? "remove" : "cancel", { name: l.name })}
                      onClick={() => uploads.removeLive(l.uppyId)}
                      danger
                    >
                      <X className="size-4" />
                    </IconButton>
                  )}
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
                (f.uploadStatus !== "COMPLETE" || removeComplete) && enabled ? (
                  <IconButton
                    label={t("remove", { name: f.fileName })}
                    onClick={async () => {
                      if (!(await uploads.removeStored(f.id))) toast.error(t("errors.generic"));
                    }}
                    danger
                  >
                    <X className="size-4" />
                  </IconButton>
                ) : null
              }
            />
          ))}
        </ul>
      )}

      <SlotUploader
        kind={kind}
        title={title}
        extensions={extensions}
        enabled={enabled}
        onAdd={(list) => uploads.add(kind, list)}
      />
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
