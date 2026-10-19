import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { Link } from "@/i18n/navigation";

// TODO: real navigation design (next prompt).
export async function SiteHeader() {
  const t = await getTranslations("common");
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
      <Link href="/" className="font-display text-lg font-semibold tracking-tight">
        {t("brand")}
      </Link>
      {/* Reads search params, so it needs its own boundary under Cache Components. */}
      <Suspense>
        <LocaleSwitcher />
      </Suspense>
    </header>
  );
}
