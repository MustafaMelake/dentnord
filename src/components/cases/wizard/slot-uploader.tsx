"use client";

import { UploadCloud } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type DragEvent } from "react";

import { cn } from "@/lib/utils";

/**
 * Drop zone + file picker for one slot. A real <input type="file"> inside a <label>, so it works with
 * the keyboard and on phones. Files the browser can already tell are wrong (type, size) are listed
 * with the reason; the server checks every file again.
 */
export function SlotUploader({
  kind,
  title,
  extensions,
  enabled,
  onAdd,
}: {
  kind: string;
  title: string;
  extensions: readonly string[];
  enabled: boolean;
  /** Returns the files refused before upload, with a reason code. */
  onAdd: (files: File[]) => { name: string; reason: string }[];
}) {
  const t = useTranslations("cases.wizard.files");
  const inputId = useId();
  const [over, setOver] = useState(false);
  const [refused, setRefused] = useState<{ name: string; reason: string }[]>([]);

  function take(list: FileList | null) {
    if (!list?.length) return;
    setRefused(onAdd([...list]));
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    if (enabled) take(e.dataTransfer.files);
  }

  if (!enabled) {
    return (
      <div
        data-uploader={kind}
        aria-disabled
        className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-muted"
      >
        <UploadCloud aria-hidden className="size-6" />
        {t("unavailable")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={inputId}
        data-uploader={kind}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center text-sm transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-brand/40",
          over
            ? "border-brand bg-brand-ice text-brand-deep"
            : "border-line text-ink-muted hover:border-brand hover:text-ink",
        )}
      >
        <UploadCloud aria-hidden className="size-6" />
        <span>
          {over ? t("dropActive") : t("dropHere")}{" "}
          <span className="font-medium text-brand underline-offset-2 hover:underline">
            {t("browse")}
          </span>
        </span>
        <input
          id={inputId}
          type="file"
          multiple
          accept={extensions.join(",")}
          aria-label={t("chooseFor", { slot: title })}
          className="sr-only"
          onChange={(e) => {
            take(e.target.files);
            e.target.value = ""; // the same file can be picked again after a removal
          }}
        />
      </label>
      {refused.length > 0 && (
        <ul role="alert" className="flex flex-col gap-1 text-sm text-destructive">
          {refused.map((r) => (
            <li key={`${r.name}-${r.reason}`} className="[overflow-wrap:anywhere]">
              {t("refused", { name: r.name, reason: t(`errors.${r.reason}` as "errors.generic") })}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
