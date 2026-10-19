import { cn } from "@/lib/utils";

/** Wordmark + a simple arch-with-sleeves mark. Uses currentColor. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 32 32" aria-hidden className="size-7" fill="none">
        <path
          d="M6 9c0 9.5 4.4 16 10 16s10-6.5 10-16"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx="9.4" cy="17.5" r="2" fill="currentColor" />
        <circle cx="16" cy="21.6" r="2" fill="currentColor" />
        <circle cx="22.6" cy="17.5" r="2" fill="currentColor" />
      </svg>
      <span className="text-xl font-medium tracking-[-0.03em]">Dentnord</span>
    </span>
  );
}
