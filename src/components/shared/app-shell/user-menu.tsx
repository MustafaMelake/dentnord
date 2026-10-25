"use client";

import { ChevronsUpDown, LogOut, UserRound } from "lucide-react";
import NextLink from "next/link";

import { useLogout } from "@/components/auth/use-logout";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link as IntlLink } from "@/i18n/navigation";

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** Account box at the bottom of the sidebar: who is signed in, plus account link and logout. */
export function UserMenu({
  title,
  subtitle,
  email,
  menuLabel,
  account,
  logoutLabel,
  loginPath,
  locale,
}: {
  /** Clinic name (portal) or the admin's name. */
  title: string;
  subtitle: string;
  email: string;
  menuLabel: string;
  account?: { href: string; label: string };
  logoutLabel: string;
  loginPath: string;
  /** Portal: hrefs are locale-less and go through the next-intl Link. */
  locale?: string;
}) {
  const { logout, pending } = useLogout(loginPath);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={menuLabel}
        className="flex w-full items-center gap-3 rounded-card border border-line bg-canvas p-2.5 text-left transition-colors hover:bg-surface-2 data-[state=open]:bg-surface-2"
      >
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-medium text-brand-deep"
        >
          {initials(title) || "?"}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium text-ink">{title}</span>
          <span className="truncate text-xs text-ink-muted">{subtitle}</span>
        </span>
        <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-ink-muted" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
      >
        <DropdownMenuLabel className="truncate font-normal text-ink-muted">
          {email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {account && (
          <DropdownMenuItem asChild>
            {locale ? (
              <IntlLink href={account.href}>
                <UserRound aria-hidden />
                {account.label}
              </IntlLink>
            ) : (
              <NextLink href={account.href}>
                <UserRound aria-hidden />
                {account.label}
              </NextLink>
            )}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem disabled={pending} onSelect={() => void logout()}>
          <LogOut aria-hidden />
          {logoutLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function UserMenuSkeleton() {
  return (
    <div
      aria-hidden
      className="h-[3.75rem] animate-pulse rounded-card border border-line bg-surface-2"
    />
  );
}
