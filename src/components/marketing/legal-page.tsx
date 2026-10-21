import { getTranslations } from "next-intl/server";

import { Container } from "@/components/shared/container";

// Terms / Privacy policy. The legal text is a [placeholder] (docs/content-todo.md); the sign-up consent
// links here and records the acceptance timestamp on the user.
export async function LegalPage({ page }: { page: "terms" | "privacy" }) {
  const t = await getTranslations("legal");
  return (
    <Container as="main" className="flex flex-1 flex-col gap-6 pt-36 pb-24">
      <div className="flex max-w-3xl flex-col gap-6">
        <h1 className="text-display-lg text-ink">{t(`${page}.title`)}</h1>
        <p className="text-lead text-ink-muted">{t(`${page}.intro`)}</p>
        <p className="rounded-card border border-dashed border-line bg-surface p-6 font-mono text-sm text-ink-muted">
          {t("placeholder")}
        </p>
      </div>
    </Container>
  );
}
