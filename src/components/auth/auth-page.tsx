import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Title + intro + content column used by every page in the (auth) group. */
export function AuthPage({
  title,
  intro,
  width = "sm",
  footer,
  children,
}: {
  title: string;
  intro?: ReactNode;
  width?: "sm" | "md";
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-8 lg:my-auto",
        width === "sm" ? "max-w-md" : "max-w-xl",
      )}
    >
      <div className="flex flex-col gap-3">
        <h1 className="text-display-md text-ink">{title}</h1>
        {intro && <p className="text-ink-muted">{intro}</p>}
      </div>
      {children}
      {footer && <div className="border-t border-line pt-6 text-sm text-ink-muted">{footer}</div>}
    </div>
  );
}
