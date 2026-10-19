import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

// Same look as <Reveal>, but pure CSS and on page load: for above-the-fold content (the hero),
// so it animates without waiting for hydration. Server component.

export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  /** Seconds */
  delay?: number;
  className?: string;
}) {
  return (
    <div
      data-motion=""
      className={cn("animate-fade-rise", className)}
      style={{ animationDelay: `${delay}s` } as CSSProperties}
    >
      {children}
    </div>
  );
}
