import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Toaster } from "@/components/ui/sonner";
import { fontVariables } from "@/lib/fonts";
import { requireAdmin } from "@/server/queries/session";

import "../globals.css";

// Separate root layout: the admin dashboard is English only and lives outside [locale].
// next-intl calls here must pass `locale: "en"` explicitly.

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Dentnord admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const messages = await getMessages({ locale: "en" });
  const t = await getTranslations({ locale: "en", namespace: "common" });
  return (
    <html lang="en" className={fontVariables}>
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider locale="en" messages={messages}>
          {/* TODO: admin shell (sidebar nav, account menu). */}
          <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">{t("loading")}</p>}>
            <AdminGate>{children}</AdminGate>
          </Suspense>
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

// Authoritative check (DB). Nothing below renders unless the user is an ADMIN.
async function AdminGate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}
