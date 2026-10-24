import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import * as rootParams from "next/root-params";
import { Suspense } from "react";

import { Logo } from "@/components/marketing/logo";
import { AppShell } from "@/components/shared/app-shell/app-shell";
import { PageSkeleton } from "@/components/shared/app-shell/page-skeleton";
import type { ShellNavItem } from "@/components/shared/app-shell/shell-nav";
import { UserMenu, UserMenuSkeleton } from "@/components/shared/app-shell/user-menu";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getOwnProfile } from "@/server/queries/dentist";
import { getSession, requireApprovedDentist } from "@/server/queries/session";
import { unreadCounts } from "@/server/services/case-messages";

// The shell is static (prerendered); the account box and the page content stream in behind
// <Suspense>, each re-checking the session against the DB.
export default async function PortalLayout({ children }: LayoutProps<"/[locale]/portal">) {
  const param = await rootParams.locale();
  const locale = hasLocale(routing.locales, param) ? param : routing.defaultLocale;
  const t = await getTranslations("portal.nav");

  const items: ShellNavItem[] = [
    { href: "/portal/dashboard", label: t("dashboard"), icon: "dashboard" },
    {
      href: "/portal/cases",
      label: t("cases"),
      icon: "cases",
      badge: (
        <Suspense fallback={null}>
          <UnreadBadge />
        </Suspense>
      ),
    },
    { href: "/portal/cases/new", label: t("newCase"), icon: "newCase" },
    { href: "/portal/account", label: t("account"), icon: "account" },
  ];

  return (
    <AppShell
      brand={
        <Link
          href="/portal/dashboard"
          aria-label={t("dashboard")}
          className="inline-flex rounded-full text-ink"
        >
          <Logo />
        </Link>
      }
      items={items}
      navLabel={t("label")}
      menuLabel={t("menu")}
      locale={locale}
      sidebarFooter={
        <Suspense fallback={<UserMenuSkeleton />}>
          <PortalAccount locale={locale} />
        </Suspense>
      }
    >
      <Suspense fallback={<PageSkeleton />}>
        <ApprovedDentistGate locale={locale}>{children}</ApprovedDentistGate>
      </Suspense>
    </AppShell>
  );
}

// Authoritative check (DB). Nothing below renders unless the user is an APPROVED dentist.
async function ApprovedDentistGate({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  await requireApprovedDentist(locale);
  return children;
}

async function PortalAccount({ locale }: { locale: string }) {
  const [profile, t] = await Promise.all([
    getOwnProfile(locale),
    getTranslations("portal.userMenu"),
  ]);
  return (
    <UserMenu
      title={profile.clinicName || profile.name}
      subtitle={profile.name}
      email={profile.email}
      menuLabel={t("label")}
      account={{ href: "/portal/account", label: t("account") }}
      logoutLabel={t("logout")}
      loginPath={`/${locale}/login`}
      locale={locale}
    />
  );
}

/** Unread messages from Dentnord, across the dentist's cases. */
async function UnreadBadge() {
  const session = await getSession();
  if (!session || session.user.role !== "DENTIST") return null;
  const [{ total }, t] = await Promise.all([
    unreadCounts({ id: session.user.id, role: "DENTIST" }),
    getTranslations("portal.nav"),
  ]);
  if (total === 0) return null;
  return (
    <span
      data-nav-badge="unread"
      className="min-w-6 rounded-full bg-brand px-1.5 py-0.5 text-center text-xs font-medium text-white"
    >
      <span aria-hidden>{total}</span>
      <span className="sr-only">{t("unreadBadge", { count: total })}</span>
    </span>
  );
}
