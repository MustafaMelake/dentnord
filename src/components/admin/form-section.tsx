import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** A titled card that groups related fields in an admin form. */
export function FormSection({
  title,
  description,
  children,
  className,
  id,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "grid scroll-mt-24 gap-6 rounded-card border border-line bg-surface p-5 sm:p-6 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] lg:gap-10",
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <h2 className="font-medium text-ink">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
    </section>
  );
}
