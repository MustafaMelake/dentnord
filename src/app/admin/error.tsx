"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { ErrorView, errorDigest } from "@/components/shared/error-view";

// Unexpected errors inside /admin. The admin layout (sidebar, account menu) stays; this replaces the
// page content. English only, like the rest of the admin.
export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations("admin.errorPage");
  const digest = errorDigest(error);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorView
      withLogo={false}
      homeHref="/admin/dashboard"
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
  );
}
