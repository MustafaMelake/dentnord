"use client";

import { CircleDashed } from "lucide-react";
import { useSyncExternalStore } from "react";

import { hasAdminHint } from "@/lib/admin-hint";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

/**
 * Shown in place of public content that hasn't been filled in, to admins only (lib/admin-hint.ts).
 * Visitors get nothing at all: the server renders null and so does the first client render, so the
 * static page is identical for everyone and there is no layout shift for visitors.
 * Use <Missing field="…" /> (components/shared/missing.tsx) from server components.
 */
export function MissingMarker({
  label,
  href,
  tone = "light",
  className,
}: {
  /** English, e.g. "Missing: Clinics (number)". */
  label: string;
  href: string;
  tone?: "light" | "dark";
  className?: string;
}) {
  // Server snapshot is false, so hydration matches the static HTML; the client then re-renders if
  // the hint cookie is present.
  const show = useSyncExternalStore(noopSubscribe, hasAdminHint, () => false);
  if (!show) return null;
  return (
    <a
      href={href}
      data-missing-marker=""
      lang="en"
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 font-mono text-[0.6875rem] leading-tight transition-colors",
        tone === "dark"
          ? "border-white/50 bg-white/10 text-white hover:bg-white/20"
          : "border-[#c9831f]/60 bg-[#fbeedd] text-[#7a4a0c] hover:bg-[#f7e2c4]",
        className,
      )}
    >
      <CircleDashed aria-hidden className="size-3 shrink-0" />
      {label}
    </a>
  );
}
