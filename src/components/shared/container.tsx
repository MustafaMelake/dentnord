import type { ComponentProps, ElementType } from "react";

import { cn } from "@/lib/utils";

/** Page content width (max 1440px) with 16px side padding on phones. */
export function Container<T extends ElementType = "div">({
  as,
  className,
  ...props
}: { as?: T } & ComponentProps<T>) {
  const Tag = as ?? "div";
  return (
    <Tag className={cn("mx-auto w-full max-w-page px-4 sm:px-6 lg:px-10", className)} {...props} />
  );
}
