import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import NextLink from "next/link";
import { Suspense } from "react";

import { Logo } from "@/components/marketing/logo";
import { AppShell } from "@/components/shared/app-shell/app-shell";
import { PageSkeleton } from "@/components/shared/app-shell/page-skeleton";
import type { ShellNavItem } from "@/components/shared/app-shell/shell-nav";
import { UserMenu, UserMenuSkeleton } from "@/components/shared/app-shell/user-menu";
import { Toaster } from "@/components/ui/sonner";
import { fontVariables } from "@/lib/fonts";
import { countPendingDentists } from "@/server/queries/admin-dentists";
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
  const t = await getTranslations({ locale: "en", namespace: "admin.nav" });

  const items: ShellNavItem[] = [
    { href: "/admin/dashboard", label: t("dashboard"), icon: "dashboard" },
    {
      href: "/admin/dentists",
      label: t("dentists"),
      icon: "dentists",
      badge: (
        <Suspense fallback={null}>
          <PendingBadge />
        </Suspense>
      ),
    },
    { href: "/admin/cases", label: t("cases"), icon: "cases" },
    { href: "/admin/catalog", label: t("catalog"), icon: "catalog" },
    { href: "/admin/services", label: t("services"), icon: "services" },
    { href: "/admin/portfolio", label: t("portfolio"), icon: "portfolio" },
    { href: "/admin/settings", label: t("settings"), icon: "settings" },
  ];

  return (
    <html lang="en" className={fontVariables}>
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider locale="en" messages={messages} timeZone="Europe/Copenhagen">
          <AppShell
            brand={
              <NextLink
                href="/admin/dashboard"
                className="inline-flex items-center gap-2.5 rounded-full text-ink"
              >
                <Logo />
                <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-label text-ink-muted">
                  {t("label")}
                </span>
              </NextLink>
            }
            items={items}
            navLabel={t("label")}
            menuLabel={t("menu")}
            sidebarFooter={
              <Suspense fallback={<UserMenuSkeleton />}>
                <AdminAccount />
              </Suspense>
            }
          >
            <Suspense fallback={<PageSkeleton />}>
              <AdminGate>{children}</AdminGate>
            </Suspense>
          </AppShell>
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

async function AdminAccount() {
  const [session, t] = await Promise.all([
    requireAdmin(),
    getTranslations({ locale: "en", namespace: "admin.nav" }),
  ]);
  return (
    <UserMenu
      title={session.user.name}
      subtitle={session.user.email}
      email={session.user.email}
      menuLabel={t("label")}
      logoutLabel={t("logout")}
      loginPath="/en/login"
    />
  );
}

async function PendingBadge() {
  const [count, t] = await Promise.all([
    countPendingDentists(),
    getTranslations({ locale: "en", namespace: "admin.nav" }),
  ]);
  if (count === 0) return null;
  return (
    <span className="min-w-6 rounded-full bg-brand px-1.5 py-0.5 text-center text-xs font-medium text-white">
      <span aria-hidden>{count}</span>
      <span className="sr-only">{t("pendingBadge", { count })}</span>
    </span>
  );
}
