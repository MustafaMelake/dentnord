import { getTranslations } from "next-intl/server";

import { CONTENT_FIELDS, type ContentField } from "@/lib/content-fields";

import { MissingMarker } from "./missing-marker";

/** Server wrapper: admin-only "Missing: …" marker for a content field (labels are English). */
export async function Missing({
  field,
  tone,
  className,
}: {
  field: ContentField;
  tone?: "light" | "dark";
  className?: string;
}) {
  const t = await getTranslations({ locale: "en", namespace: "admin.content" });
  return (
    <MissingMarker
      label={t("missing", { field: t(`fields.${field}`) })}
      href={CONTENT_FIELDS[field].href}
      tone={tone}
      className={className}
    />
  );
}

/** For client components that need several marker labels: resolve them on the server. */
export async function missingProps(field: ContentField) {
  const t = await getTranslations({ locale: "en", namespace: "admin.content" });
  return { label: t("missing", { field: t(`fields.${field}`) }), href: CONTENT_FIELDS[field].href };
}
