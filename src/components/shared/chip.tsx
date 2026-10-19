import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const chipStyles = cva(
  "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm whitespace-nowrap transition-colors duration-300",
  {
    variants: {
      variant: {
        outline: "border-line bg-surface text-ink",
        soft: "border-transparent bg-brand-soft text-brand-deep",
        ice: "border-transparent bg-brand-ice text-brand",
        /** On photos / dark cards */
        glass: "border-white/35 bg-white/5 text-white backdrop-blur-sm",
        /** Selected chip on photos / dark cards */
        light: "border-transparent bg-surface text-ink",
      },
    },
    defaultVariants: { variant: "outline" },
  },
);

export function Chip({
  variant,
  className,
  ...props
}: VariantProps<typeof chipStyles> & ComponentProps<"span">) {
  return <span className={cn(chipStyles({ variant }), className)} {...props} />;
}
