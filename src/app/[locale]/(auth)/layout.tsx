import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Logo } from "@/components/marketing/logo";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { SectionLabel } from "@/components/shared/section-label";
import { Link } from "@/i18n/navigation";

// Auth shell: form column on the left, brand panel on the right (lg+). Static, so it prerenders.
export default async function AuthLayout({ children }: LayoutProps<"/[locale]">) {
  const t = await getTranslations();
  const points = ["upload", "approve", "follow"] as const;

  return (
    <div className="flex flex-1 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
      <div className="flex min-h-dvh flex-1 flex-col">
        <header className="flex h-[4.5rem] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
          <Link href="/" aria-label={t("common.homeLink")} className="rounded-full text-ink">
            <Logo />
          </Link>
          <LocaleSwitcher />
        </header>
        <main
          id="content"
          className="flex flex-1 flex-col px-4 pt-6 pb-16 sm:px-6 sm:pt-10 lg:px-10"
        >
          {children}
        </main>
        <footer className="px-4 pb-6 sm:px-6 lg:px-10">
          <Link
            href="/"
            className="text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
          >
            ← {t("auth.shell.backToSite")}
          </Link>
        </footer>
      </div>

      <aside className="sticky top-0 hidden h-dvh p-3 lg:block">
        <div className="relative flex h-full flex-col justify-end overflow-hidden rounded-media-lg bg-[radial-gradient(120%_90%_at_75%_20%,#2f6cb5_0%,#1a4a80_38%,#0f2e4c_72%,#0a2138_100%)] p-10 text-white xl:p-14">
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.05)_1px,transparent_1px)] [background-size:48px_48px]"
          />
          <ArchMark />
          <div className="relative flex max-w-md flex-col gap-6">
            <SectionLabel tone="onDark">{t("auth.shell.panelLabel")}</SectionLabel>
            <p className="text-display-md text-white">{t("auth.shell.panelTitle")}</p>
            <ul className="flex flex-col gap-3 text-[0.9375rem] text-white/85">
              {points.map((key) => (
                <li key={key} className="flex items-center gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/15">
                    <Check aria-hidden className="size-3.5" />
                  </span>
                  {t(`auth.shell.points.${key}`)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}

/** The logo's arch-with-sleeves, drawn large and faint as the panel's focal point. */
function ArchMark() {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden
      fill="none"
      className="absolute top-[12%] left-1/2 w-[55%] max-w-80 -translate-x-1/2 text-white/12"
    >
      <path
        d="M6 9c0 9.5 4.4 16 10 16s10-6.5 10-16"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="9.4" cy="17.5" r="1.4" stroke="currentColor" strokeWidth="0.6" />
      <circle cx="16" cy="21.6" r="1.4" stroke="currentColor" strokeWidth="0.6" />
      <circle cx="22.6" cy="17.5" r="1.4" stroke="currentColor" strokeWidth="0.6" />
    </svg>
  );
}
