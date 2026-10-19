import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";

import { Toaster } from "@/components/ui/sonner";
import { env } from "@/env";
import { routing } from "@/i18n/routing";
import { fontVariables } from "@/lib/fonts";

import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return {
    metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
    title: { default: t("title"), template: "%s · Dentnord" },
    description: t("description"),
    openGraph: {
      type: "website",
      siteName: "Dentnord",
      locale: t("ogLocale"),
      title: t("title"),
      description: t("description"),
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#f4f7fa",
};

// Without JS, motion's initial (hidden) styles would never clear: show everything as-is.
const NO_JS_MOTION_RESET =
  "[data-motion]{opacity:1!important;transform:none!important;filter:none!important;clip-path:none!important}";

export default async function LocaleLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await rootParams.locale();
  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    <html lang={locale} className={fontVariables}>
      <body className="flex min-h-dvh flex-col">
        <noscript>
          <style>{NO_JS_MOTION_RESET}</style>
        </noscript>
        <NextIntlClientProvider>
          {children}
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
