"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";

import { ErrorView, errorDigest } from "@/components/shared/error-view";

// Unexpected errors on the public site, the auth pages and the portal. The root layout (and its
// translations) still renders; global-error.tsx covers a failing root layout.
export default function LocaleError({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations("errorPage");
  const locale = useLocale();
  const digest = errorDigest(error);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="content" className="flex min-h-dvh flex-col">
      <ErrorView
        homeHref={`/${locale}`}
        onRetry={retry}
        texts={{
          label: t("label"),
          title: t("title"),
          body: t("body"),
          retry: t("retry"),
          home: t("home"),
          reference: digest ? t("reference", { digest }) : null,
        }}
      />
    </main>
  );
}
