import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Mono index + title, e.g. "02  Services /". */
export function SectionLabel({
  index,
  children,
  tone = "default",
  className,
}: {
  index?: string;
  children: ReactNode;
  tone?: "default" | "onDark";
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-baseline gap-3 font-mono text-label",
        tone === "onDark" ? "text-white/75" : "text-ink-muted",
        className,
      )}
    >
      {index && <span className={tone === "onDark" ? "text-white" : "text-brand"}>{index}</span>}
      <span>{children} /</span>
    </p>
  );
}

/**
 * Label + big headline, laid out like an editorial heading: on wider screens the label sits on the
 * headline's first line and the headline is indented past it.
 */
export function SectionHeading({
  index,
  label,
  title,
  id,
  align = "start",
  className,
  titleClassName,
}: {
  index?: string;
  label: string;
  title: ReactNode;
  id?: string;
  align?: "start" | "center";
  className?: string;
  titleClassName?: string;
}) {
  if (align === "center") {
    return (
      <div className={cn("flex flex-col items-center gap-5 text-center", className)}>
        <SectionLabel index={index}>{label}</SectionLabel>
        <h2 id={id} className={cn("max-w-[20ch] text-display-lg text-ink", titleClassName)}>
          {title}
        </h2>
      </div>
    );
  }
  return (
    <div className={cn("relative", className)}>
      <SectionLabel index={index} className="mb-4 sm:absolute sm:top-[0.85em] sm:left-0 sm:mb-0">
        {label}
      </SectionLabel>
      <h2
        id={id}
        className={cn("max-w-[22ch] text-display-lg text-ink sm:indent-[11rem]", titleClassName)}
      >
        {title}
      </h2>
    </div>
  );
}
