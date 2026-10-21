import { Suspense, type ReactNode } from "react";

import { MobileBar } from "./mobile-bar";
import { ShellNav, ShellNavList, type ShellNavItem } from "./shell-nav";

// Layout frame for the dentist portal and the admin: a calm sidebar on desktop, a top bar with a
// sheet menu below `lg`. Everything here is static; session-dependent parts arrive as slots, each
// behind its own <Suspense>, so the frame prerenders.

export function AppShell({
  brand,
  items,
  navLabel,
  menuLabel,
  locale,
  sidebarFooter,
  children,
}: {
  /** Logo link. */
  brand: ReactNode;
  items: ShellNavItem[];
  navLabel: string;
  menuLabel: string;
  locale?: string;
  /** Account box at the bottom of the sidebar (and of the mobile sheet). */
  sidebarFooter: ReactNode;
  children: ReactNode;
}) {
  const nav = (
    <Suspense fallback={<ShellNavList items={items} label={navLabel} locale={locale} />}>
      <ShellNav items={items} label={navLabel} locale={locale} />
    </Suspense>
  );

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-canvas lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-8 border-r border-line bg-surface px-4 py-5 lg:flex">
        <div className="px-2">{brand}</div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        {sidebarFooter}
      </aside>

      <MobileBar
        brand={brand}
        menuLabel={menuLabel}
        items={items}
        navLabel={navLabel}
        locale={locale}
        footer={sidebarFooter}
      />

      <main id="content" className="flex min-w-0 flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
          {children}
        </div>
      </main>
    </div>
  );
}

/** Page title row used inside the shell. */
export function ShellPageHeader({
  title,
  intro,
  actions,
}: {
  title: string;
  intro?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-display-sm text-ink sm:text-[2rem] sm:leading-tight">{title}</h1>
        {intro && <p className="text-ink-muted">{intro}</p>}
      </div>
      {actions}
    </div>
  );
}
