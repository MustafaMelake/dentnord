"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";

import { useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const LOCALE_PREFIX = new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`);

/**
 * DA / EN toggle that keeps the current page.
 * tone: "default" (light backgrounds), "onDark" (dark cards), "header" (switches to onDark while the
 * header floats over the home hero).
 * The path is read from `window.location` on click rather than `usePathname()`, so the component
 * never suspends on routes with unknown params (Cache Components).
 */
export function LocaleSwitcher({
  className,
  tone = "default",
}: {
  className?: string;
  tone?: "default" | "onDark" | "header";
}) {
  const t = useTranslations("localeSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: AppLocale) {
    const { pathname, search, hash } = window.location;
    const path = pathname.replace(LOCALE_PREFIX, "") || "/";
    startTransition(() => {
      router.replace(`${path}${search}${hash}`, { locale: next, scroll: false });
    });
  }

  return (
    <div
      role="group"
      aria-label={t("label")}
      className={cn(
        "inline-flex items-center rounded-full p-0.5 font-mono text-xs",
        tone === "onDark" ? "bg-white/10" : "bg-surface-2",
        tone === "header" && "transition-colors duration-500 over-hero:bg-white/10",
        isPending && "opacity-60",
        className,
      )}
    >
      {routing.locales.map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            lang={l}
            aria-pressed={active}
            aria-label={t(l)}
            disabled={active || isPending}
            onClick={() => switchTo(l)}
            className={cn(
              "rounded-full px-2.5 py-1 uppercase transition-colors duration-300",
              tone === "onDark"
                ? active
                  ? "bg-white text-ink"
                  : "text-white/80 hover:text-white"
                : active
                  ? "bg-surface text-ink shadow-[0_1px_2px_rgb(11_27_43/0.08)]"
                  : "text-ink-muted hover:text-ink",
              tone === "header" &&
                (active
                  ? "over-hero:bg-white over-hero:text-ink"
                  : "over-hero:text-white/80 over-hero:hover:text-white"),
            )}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}
