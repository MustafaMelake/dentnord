"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations("localeSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname(); // current path without the locale prefix
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: AppLocale) {
    const query = searchParams.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { locale: next });
    });
  }

  return (
    <nav
      aria-label={t("label")}
      className={cn("flex items-center gap-1 text-sm", isPending && "opacity-60", className)}
    >
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-current={l === locale ? "true" : undefined}
          disabled={l === locale || isPending}
          onClick={() => switchTo(l)}
          className="rounded-md px-2 py-1 tracking-wide text-muted-foreground uppercase transition-colors hover:text-foreground aria-[current]:font-medium aria-[current]:text-foreground"
        >
          <span className="sr-only">{t(l)}</span>
          <span aria-hidden>{l}</span>
        </button>
      ))}
    </nav>
  );
}
