"use client";

import { Check, Copy, Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/shared/button";

// One-time backup codes, shown once right after they were created (2FA setup, or "new backup
// codes"). Better Auth stores them encrypted and never returns them again.

export function BackupCodes({ codes, email }: { codes: string[]; email: string }) {
  const t = useTranslations("twoFactor.backup");
  const [copied, setCopied] = useState(false);
  const text = [t("fileHeading", { email }), "", ...codes].join("\n");

  async function copy() {
    await navigator.clipboard.writeText(codes.join("\n")).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function download() {
    const url = URL.createObjectURL(new Blob([`${text}\n`], { type: "text/plain" }));
    const link = Object.assign(document.createElement("a"), {
      href: url,
      download: "dentnord-backup-codes.txt",
    });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="flex flex-col gap-4">
      <ul
        aria-label={t("listLabel")}
        data-backup-codes
        className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-xl border border-line bg-surface-2 p-4 font-mono text-[0.9375rem] tracking-wide text-ink"
      >
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={copy}>
          <span className="inline-flex items-center gap-2">
            {copied ? (
              <Check aria-hidden className="size-4" />
            ) : (
              <Copy aria-hidden className="size-4" />
            )}
            {copied ? t("copied") : t("copy")}
          </span>
        </Button>
        <Button type="button" variant="secondary" onClick={download}>
          <span className="inline-flex items-center gap-2">
            <Download aria-hidden className="size-4" />
            {t("download")}
          </span>
        </Button>
      </div>
    </div>
  );
}
