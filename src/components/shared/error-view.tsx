"use client";

import { RotateCcw } from "lucide-react";

import { Logo } from "@/components/marketing/logo";
import { buttonStyles } from "@/components/shared/button";

// The branded error screen behind app/[locale]/error.tsx, app/admin/error.tsx and
// app/global-error.tsx. No i18n or router hooks: global-error renders without any provider, so the
// texts come in as props and "home" is a plain link (a full page load is the safe way back).

export type ErrorTexts = {
  label: string;
  title: string;
  body: string;
  retry: string;
  home: string;
  /** "Reference: {digest}" already filled in, or null when the error has no digest. */
  reference: string | null;
};

export function ErrorView({
  texts,
  homeHref,
  onRetry,
  withLogo = true,
}: {
  texts: ErrorTexts;
  homeHref: string;
  onRetry: () => void;
  withLogo?: boolean;
}) {
  return (
    <div
      role="alert"
      className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-8 px-4 py-20 sm:px-6"
    >
      {withLogo && (
        <a href={homeHref} className="w-fit rounded-full text-ink">
          <Logo />
        </a>
      )}
      <div className="flex flex-col gap-4">
        <p className="font-mono text-label text-brand">{texts.label} /</p>
        <h1 className="text-display-md text-ink">{texts.title}</h1>
        <p className="text-lead text-ink-muted">{texts.body}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onRetry} className={buttonStyles({ variant: "primary" })}>
          <span className="inline-flex items-center gap-2">
            <RotateCcw aria-hidden className="size-4" />
            {texts.retry}
          </span>
        </button>
        <a href={homeHref} className={buttonStyles({ variant: "secondary" })}>
          {texts.home}
        </a>
      </div>
      {texts.reference && <p className="font-mono text-xs text-ink-muted">{texts.reference}</p>}
    </div>
  );
}

/** The server's error id (`digest`), for matching the server log. Never the message itself. */
export function errorDigest(error: unknown) {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" ? digest : null;
}
