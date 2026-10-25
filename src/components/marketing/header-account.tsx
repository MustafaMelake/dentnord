"use client";

import { ChevronDown, LayoutDashboard, LogOut, UserRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import NextLink from "next/link";
import { createContext, useContext } from "react";

import { useLogout } from "@/components/auth/use-logout";
import { initials } from "@/components/shared/app-shell/user-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

// The marketing header's account control. The server passes it in as a slot (signed in → the menu,
// signed out or still streaming → the Login link), and the header renders that one slot twice: in
// the bar (desktop) and in the full-screen menu (mobile). The placement comes from this context.

export type HeaderUser = { name: string; email: string; role: "ADMIN" | "DENTIST" };

type Placement = { placement: "bar" | "menu"; onNavigate?: () => void };

export const AccountPlacement = createContext<Placement>({ placement: "bar" });

export function AccountControl({ user }: { user: HeaderUser | null }) {
  const { placement, onNavigate } = useContext(AccountPlacement);
  const t = useTranslations("nav");

  if (!user) {
    return (
      <Link
        href="/login"
        onClick={onNavigate}
        data-account="signed-out"
        className={
          placement === "bar"
            ? "hidden rounded-full px-3 py-2 text-[0.9375rem] text-ink transition-colors duration-300 hover:bg-ink/5 lg:inline-block over-hero:text-white over-hero:hover:bg-white/10"
            : "rounded-full px-3 py-2 text-white/90 hover:text-white"
        }
      >
        {t("login")}
      </Link>
    );
  }
  return placement === "bar" ? (
    <AccountMenu user={user} />
  ) : (
    <AccountLinks user={user} onNavigate={onNavigate} />
  );
}

function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium",
        className,
      )}
    >
      {initials(name) || "?"}
    </span>
  );
}

/** Desktop: avatar button + dropdown, in the header's two tones (white over the hero, ink scrolled). */
function AccountMenu({ user }: { user: HeaderUser }) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const { logout, pending } = useLogout(`/${locale}`);
  return (
    // Not modal: no scroll lock, so the fixed header and Lenis don't shift while it's open.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label={t("accountMenu")}
        data-account="signed-in"
        className="hidden items-center gap-1 rounded-full p-1 pr-2 text-ink transition-colors duration-300 hover:bg-ink/5 data-[state=open]:bg-ink/5 lg:inline-flex over-hero:text-white over-hero:hover:bg-white/10 over-hero:data-[state=open]:bg-white/10"
      >
        <Avatar
          name={user.name}
          className="bg-brand-soft text-brand-deep transition-colors duration-500 over-hero:bg-white/15 over-hero:text-white over-hero:ring-1 over-hero:ring-white/30"
        />
        <ChevronDown aria-hidden className="size-4 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-auto min-w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
          <span className="truncate text-sm font-medium text-ink">{user.name}</span>
          <span className="truncate text-xs text-ink-muted">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {user.role === "ADMIN" ? (
          <DropdownMenuItem asChild>
            <NextLink href="/admin/dashboard">
              <LayoutDashboard aria-hidden />
              {t("adminDashboard")}
            </NextLink>
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem asChild>
              <Link href="/portal/dashboard">
                <LayoutDashboard aria-hidden />
                {t("dashboard")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/portal/account">
                <UserRound aria-hidden />
                {t("account")}
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={pending} onSelect={() => void logout()}>
          <LogOut aria-hidden />
          {t("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Mobile menu: the same choices as plain links. The full-screen menu is already a focus-trapped
 * dialog, so a dropdown inside it (portalled outside the trap, sharing its Escape key) would fight it.
 */
function AccountLinks({ user, onNavigate }: { user: HeaderUser; onNavigate?: () => void }) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const { logout, pending } = useLogout(`/${locale}`);
  const linkClass = "rounded-full px-3 py-2 text-white/90 hover:text-white";
  return (
    <div
      role="group"
      aria-label={t("accountMenu")}
      data-account="signed-in"
      className="flex w-full flex-col gap-2"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <Avatar name={user.name} className="bg-white/15 text-white ring-1 ring-white/30" />
        <span className="truncate text-sm text-white/90">{user.name}</span>
      </span>
      <span className="-ml-3 flex flex-wrap items-center">
        {user.role === "ADMIN" ? (
          <NextLink href="/admin/dashboard" onClick={onNavigate} className={linkClass}>
            {t("adminDashboard")}
          </NextLink>
        ) : (
          <>
            <Link href="/portal/dashboard" onClick={onNavigate} className={linkClass}>
              {t("dashboard")}
            </Link>
            <Link href="/portal/account" onClick={onNavigate} className={linkClass}>
              {t("account")}
            </Link>
          </>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => void logout()}
          className={cn(linkClass, "disabled:opacity-60")}
        >
          {t("logout")}
        </button>
      </span>
    </div>
  );
}
