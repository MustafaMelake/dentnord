import { ArrowLeft } from "lucide-react";

import { Link as IntlLink } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * `plain`: the admin (outside [locale]) links to "/" with a plain <a>: a full page load into the
 * site's own root layout, where the proxy picks the visitor's language (cookie, then browser).
 */
export type SiteLink = { label: string; plain?: boolean };

/** Portal and admin: back to the marketing home page (the portal keeps its current locale). */
export function BackToSite({
  label,
  plain = false,
  compact = false,
  onNavigate,
  className,
}: SiteLink & {
  /** Mobile top bar: icon only below `sm`, where the label doesn't fit next to the logo. */
  compact?: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  const props = {
    href: "/",
    onClick: onNavigate,
    "aria-label": compact ? label : undefined,
    "data-back-to-site": "",
    className: cn(
      "inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm text-ink transition-colors hover:bg-surface-2",
      compact && "w-10 justify-center px-0 sm:w-auto sm:px-4",
      className,
    ),
  };
  const content = (
    <>
      <ArrowLeft aria-hidden className="size-4 shrink-0" />
      <span className={cn(compact && "sr-only sm:not-sr-only")}>{label}</span>
    </>
  );
  return plain ? <a {...props}>{content}</a> : <IntlLink {...props}>{content}</IntlLink>;
}
