import { cva, type VariantProps } from "class-variance-authority";
import { ArrowRight, ArrowUpRight, ChevronRight } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

// Marketing buttons (pills). The portal/admin use shadcn's components/ui/button.
//   <Button>      a <button>
//   <ButtonLink>  a locale-aware link (or a plain <a> for "#hash" and external URLs)
//   <ArrowCircle> the round icon button with an arrow (cards, carousels)

export const buttonStyles = cva(
  "group/btn relative inline-flex shrink-0 items-center justify-center gap-3 rounded-full font-medium whitespace-nowrap transition-[background-color,color,border-color,transform] duration-300 ease-spring select-none disabled:pointer-events-none disabled:opacity-50 motion-safe:active:scale-[0.98]",
  {
    variants: {
      variant: {
        /** Brand blue: the main action on light backgrounds. */
        primary: "bg-brand text-white hover:bg-brand-deep",
        /** Outline on light backgrounds. */
        secondary:
          "border border-line bg-transparent text-ink hover:border-ink/25 hover:bg-surface",
        /** White pill on dark/photo backgrounds. */
        light: "bg-surface text-ink hover:bg-brand-ice",
        /** Glassy outline on dark/photo backgrounds. */
        glass:
          "border border-white/30 bg-white/10 text-white backdrop-blur-md hover:border-white/50 hover:bg-white/15",
      },
      size: {
        md: "h-11 px-5 text-[0.9375rem]",
        lg: "h-14 px-7 text-base",
      },
      /** Leaves room for the trailing icon circle. */
      withIcon: { true: "pr-1.5 sm:pr-1.5", false: "" },
    },
    compoundVariants: [
      { size: "md", withIcon: true, className: "pl-5" },
      { size: "lg", withIcon: true, className: "pl-7" },
    ],
    defaultVariants: { variant: "primary", size: "md", withIcon: false },
  },
);

const iconCircleStyles = cva(
  "inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-300",
  {
    variants: {
      variant: {
        primary: "bg-white/15 text-white",
        secondary: "bg-surface-2 text-ink",
        light: "bg-brand-ice text-brand",
        glass: "bg-white/15 text-white",
      },
      size: { md: "size-8", lg: "size-11" },
    },
  },
);

type StyleProps = VariantProps<typeof buttonStyles> & {
  /** Adds a trailing icon circle with a chevron that slides on hover. */
  icon?: boolean;
};

function Inner({ children, icon, variant, size }: StyleProps & { children: ReactNode }) {
  return (
    <>
      <span>{children}</span>
      {icon && (
        <span
          aria-hidden
          className={iconCircleStyles({ variant: variant ?? "primary", size: size ?? "md" })}
        >
          <ChevronRight className="size-4 transition-transform duration-300 ease-spring group-hover/btn:translate-x-0.5" />
        </span>
      )}
    </>
  );
}

export function Button({
  variant,
  size,
  icon,
  className,
  children,
  type = "button",
  ...props
}: StyleProps & ComponentProps<"button">) {
  return (
    <button
      type={type}
      className={cn(buttonStyles({ variant, size, withIcon: !!icon }), className)}
      {...props}
    >
      <Inner icon={icon} variant={variant} size={size}>
        {children}
      </Inner>
    </button>
  );
}

type LinkHref = ComponentProps<typeof Link>["href"];

export function ButtonLink({
  href,
  variant,
  size,
  icon,
  className,
  children,
  ...props
}: StyleProps & { href: LinkHref | `#${string}` | `mailto:${string}` } & Omit<
    ComponentProps<"a">,
    "href"
  >) {
  const classes = cn(buttonStyles({ variant, size, withIcon: !!icon }), className);
  const inner = (
    <Inner icon={icon} variant={variant} size={size}>
      {children}
    </Inner>
  );
  if (typeof href === "string" && /^(#|mailto:|https?:)/.test(href)) {
    return (
      <a href={href} className={classes} {...props}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href as LinkHref} className={classes} {...props}>
      {inner}
    </Link>
  );
}

const arrowCircleStyles = cva(
  "inline-flex shrink-0 items-center justify-center rounded-full transition-[background-color,color,border-color,transform] duration-300 ease-spring disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        outline: "border border-line bg-surface text-ink hover:border-ink/30",
        solid: "bg-ink text-white hover:bg-brand-deep",
        glass: "border border-white/40 bg-white/5 text-white backdrop-blur-sm hover:bg-white/15",
        soft: "bg-surface-2 text-ink-muted",
      },
      size: { sm: "size-9", md: "size-11", lg: "size-12" },
    },
    defaultVariants: { variant: "outline", size: "md" },
  },
);

const arrowIcons = {
  right: ArrowRight,
  "up-right": ArrowUpRight,
  chevron: ChevronRight,
};

/**
 * Round arrow icon. Decorative inside a link card (default), or a real button when `label` is set.
 * The arrow slides in when a parent with the `group` class is hovered.
 */
export function ArrowCircle({
  variant,
  size,
  direction = "up-right",
  label,
  className,
  iconClassName,
  ...props
}: VariantProps<typeof arrowCircleStyles> & {
  direction?: keyof typeof arrowIcons;
  /** Accessible name. When set, renders a <button>. */
  label?: string;
  iconClassName?: string;
} & Omit<ComponentProps<"button">, "children">) {
  const Icon = arrowIcons[direction];
  const icon = (
    <Icon
      aria-hidden
      className={cn(
        "size-[1.1rem] transition-transform duration-300 ease-spring",
        direction === "up-right"
          ? "group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          : "group-hover:translate-x-0.5",
        iconClassName,
      )}
    />
  );
  if (!label) {
    return (
      <span aria-hidden className={cn(arrowCircleStyles({ variant, size }), className)}>
        {icon}
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(arrowCircleStyles({ variant, size }), className)}
      {...props}
    >
      {icon}
    </button>
  );
}
