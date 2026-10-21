"use client";

import { Menu } from "lucide-react";
import { Suspense, useState, type ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { ShellNav, ShellNavList, type ShellNavItem } from "./shell-nav";

/** Top bar + slide-in menu below `lg`. */
export function MobileBar({
  brand,
  menuLabel,
  items,
  navLabel,
  locale,
  footer,
}: {
  brand: ReactNode;
  menuLabel: string;
  items: ShellNavItem[];
  navLabel: string;
  locale?: string;
  footer: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-line bg-canvas/85 px-4 backdrop-blur-xl sm:px-6 lg:hidden">
      {brand}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          aria-label={menuLabel}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm text-ink"
        >
          <Menu aria-hidden className="size-4" />
          {menuLabel}
        </SheetTrigger>
        <SheetContent side="left" className="flex w-[18rem] flex-col gap-6 bg-surface px-4 py-5">
          <SheetTitle className="px-2">{brand}</SheetTitle>
          <SheetDescription className="sr-only">{navLabel}</SheetDescription>
          <div className="flex-1 overflow-y-auto">
            <Suspense
              fallback={
                <ShellNavList items={items} label={navLabel} locale={locale} onNavigate={close} />
              }
            >
              <ShellNav items={items} label={navLabel} locale={locale} onNavigate={close} />
            </Suspense>
          </div>
          {footer}
        </SheetContent>
      </Sheet>
    </header>
  );
}
