import type { ComponentProps, ReactNode } from "react";

import { ButtonLink } from "@/components/shared/button";

/** "Nothing here yet" panel with an optional call to action. */
export function EmptyState({
  icon,
  title,
  body,
  cta,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  cta?: { href: ComponentProps<typeof ButtonLink>["href"]; label: string };
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-card border border-dashed border-line bg-surface px-6 py-14 text-center">
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-full bg-brand-ice text-brand [&_svg]:size-5"
      >
        {icon}
      </span>
      <div className="flex max-w-md flex-col gap-1.5">
        <h2 className="text-lg font-medium text-ink">{title}</h2>
        <p className="text-ink-muted">{body}</p>
      </div>
      {cta && (
        <ButtonLink href={cta.href} icon className="mt-2">
          {cta.label}
        </ButtonLink>
      )}
    </div>
  );
}
