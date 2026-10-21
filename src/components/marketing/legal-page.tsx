import { getLocale, getTranslations } from "next-intl/server";

import { Container } from "@/components/shared/container";
import { Markdown } from "@/components/shared/markdown";
import { Missing } from "@/components/shared/missing";
import { localized } from "@/lib/utils";
import { getLegalSetting } from "@/server/queries/site-settings";

// Terms / Privacy policy: Markdown written in the admin (Settings → Legal). The sign-up consent
// links here and records the acceptance timestamp on the user. Empty → "Coming soon".
export async function LegalPage({ page }: { page: "terms" | "privacy" }) {
  const [t, locale, legal] = await Promise.all([
    getTranslations("legal"),
    getLocale(),
    getLegalSetting(),
  ]);
  const body = localized(legal[page], locale).trim();

  return (
    <Container as="main" className="flex flex-1 flex-col gap-6 pt-36 pb-24">
      <div className="flex max-w-3xl flex-col gap-6">
        <h1 className="text-display-lg text-ink">{t(`${page}.title`)}</h1>
        <p className="text-lead text-ink-muted">{t(`${page}.intro`)}</p>
      </div>
      {body ? (
        <Markdown className="mt-4">{body}</Markdown>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="w-fit rounded-card border border-line bg-surface px-6 py-5 text-ink-muted">
            {t("comingSoon")}
          </p>
          <Missing field={page === "terms" ? "legal.terms" : "legal.privacy"} />
        </div>
      )}
    </Container>
  );
}
