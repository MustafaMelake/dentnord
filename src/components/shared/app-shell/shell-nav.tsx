"use client";

import {
  Boxes,
  FilePlus2,
  FileText,
  FolderOpen,
  Images,
  Inbox,
  LayoutDashboard,
  Layers,
  Settings,
  Stethoscope,
  UserRound,
} from "lucide-react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Link as IntlLink } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

// Sidebar navigation for the portal and the admin. Icons are referenced by name so the server can
// pass plain item lists. `locale` set → hrefs are locale-less and go through the next-intl Link.

const ICONS = {
  dashboard: LayoutDashboard,
  cases: FolderOpen,
  newCase: FilePlus2,
  account: UserRound,
  dentists: Stethoscope,
  catalog: Boxes,
  services: Layers,
  portfolio: Images,
  settings: Settings,
  pages: FileText,
  messages: Inbox,
} as const;

export type ShellIcon = keyof typeof ICONS;

export type ShellNavItem = {
  href: string;
  label: string;
  icon: ShellIcon;
  /** e.g. a pending count, usually wrapped in <Suspense>. */
  badge?: ReactNode;
};

type NavProps = {
  items: ShellNavItem[];
  label: string;
  /** Portal: the current locale (hrefs are locale-less). Admin: omit. */
  locale?: string;
  onNavigate?: () => void;
};

const fullHref = (href: string, locale?: string) => (locale ? `/${locale}${href}` : href);

/** The most specific item matching the path ("/portal/cases/new" beats "/portal/cases"). */
function activeHref(pathname: string, items: ShellNavItem[], locale?: string) {
  const matches = items.filter(({ href }) => {
    const full = fullHref(href, locale);
    return pathname === full || pathname.startsWith(`${full}/`);
  });
  return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}

/** With active state. Suspends on dynamic routes: render inside <Suspense fallback={<ShellNavList/>}>. */
export function ShellNav(props: NavProps) {
  const pathname = usePathname();
  return <ShellNavList {...props} active={activeHref(pathname, props.items, props.locale)} />;
}

export function ShellNavList({
  items,
  label,
  locale,
  onNavigate,
  active = null,
}: NavProps & { active?: string | null }) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-col gap-1">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const isActive = item.href === active;
          const className = cn(
            "group flex h-10 items-center gap-3 rounded-xl px-3 text-[0.9375rem] transition-colors duration-200",
            isActive
              ? "bg-brand-ice font-medium text-brand-deep"
              : "text-ink-muted hover:bg-surface-2 hover:text-ink",
          );
          const content = (
            <>
              <Icon
                aria-hidden
                className={cn(
                  "size-[1.125rem] shrink-0",
                  isActive ? "text-brand" : "text-ink-muted group-hover:text-ink",
                )}
              />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge}
            </>
          );
          return (
            <li key={item.href}>
              {locale ? (
                <IntlLink
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={className}
                  onClick={onNavigate}
                >
                  {content}
                </IntlLink>
              ) : (
                <NextLink
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={className}
                  onClick={onNavigate}
                >
                  {content}
                </NextLink>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
