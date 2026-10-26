"use client";

import { createTranslator } from "next-intl";
import { useEffect, useState } from "react";

import { ErrorView, errorDigest, type ErrorTexts } from "@/components/shared/error-view";
import { fontVariables } from "@/lib/fonts";

import "./globals.css";

// Replaces a root layout ([locale] or admin) that failed to render, so there is no provider, no
// translations and no styles from the layout. The texts load from the locale's message file on
// demand: a separate chunk, so normal pages don't carry the messages for this rare case.

type Locale = "da" | "en";

async function loadTexts(locale: Locale, digest: string | null): Promise<ErrorTexts> {
  const messages =
    locale === "da"
      ? (await import("../../messages/da.json")).default
      : (await import("../../messages/en.json")).default;
  const t = createTranslator({ locale, messages, namespace: "errorPage" });
  return {
    label: t("label"),
    title: t("title"),
    body: t("body"),
    retry: t("retry"),
    home: t("home"),
    reference: digest ? t("reference", { digest }) : null,
  };
}

export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const [view, setView] = useState<{ locale: Locale; texts: ErrorTexts } | null>(null);
  const digest = errorDigest(error);

  useEffect(() => {
    console.error(error);
    const path = window.location.pathname;
    // /admin is English; elsewhere the locale prefix decides (Danish is the default).
    const locale: Locale = path.startsWith("/en") || path.startsWith("/admin") ? "en" : "da";
    loadTexts(locale, digest)
      .then((texts) => setView({ locale, texts }))
      .catch(() => undefined);
  }, [error, digest]);

  return (
    <html lang={view?.locale ?? "da"} className={fontVariables}>
      <body className="flex min-h-dvh flex-col">
        {view && <ErrorView texts={view.texts} homeHref={`/${view.locale}`} onRetry={retry} />}
      </body>
    </html>
  );
}
