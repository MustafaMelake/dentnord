import { ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// Stand-in for a real photo. The props mirror next/image, so swapping in the photo is one line:
//   <PlaceholderImage alt="…" fill sizes="…" className="…" />
//   <Image src={photo} alt="…" fill sizes="…" className="…" />
// The caption (= alt) is shown so everyone can see which photo still needs supplying.
// Every placeholder is listed in docs/content-todo.md.

type PlaceholderImageProps = {
  alt: string;
  /** Fill the nearest positioned parent (like next/image `fill`). */
  fill?: boolean;
  className?: string;
  /** Visual tone: "light" for cards on canvas, "dark" for heroes with white text on top. */
  tone?: "light" | "dark";
  /** Where to show the caption, so it doesn't collide with overlaid content. */
  captionPosition?: "top-right" | "bottom-right" | "center";
  /** Extra classes for the caption (e.g. to offset it below a fixed header). */
  captionClassName?: string;
  /** For tiny images (avatars): keep the accessible label, hide the visible caption. */
  hideCaption?: boolean;
  /** Stand-in for an image that isn't uploaded yet: no label, no caption, hidden from screen readers. */
  decorative?: boolean;
  // Accepted for next/image parity; unused here.
  sizes?: string;
  priority?: boolean;
};

export function PlaceholderImage({
  alt,
  fill,
  className,
  tone = "light",
  captionPosition = "bottom-right",
  captionClassName,
  hideCaption,
  decorative,
}: PlaceholderImageProps) {
  return (
    <div
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": alt })}
      className={cn(
        "overflow-hidden",
        fill && "absolute inset-0 size-full",
        tone === "dark"
          ? "bg-[radial-gradient(120%_90%_at_75%_30%,#2f6cb5_0%,#1a4a80_35%,#0f2e4c_70%,#0a2138_100%)]"
          : "bg-[radial-gradient(110%_90%_at_70%_20%,#ffffff_0%,#e3edf7_45%,#d3e2f1_100%)]",
        className,
      )}
    >
      {/* Subtle technical grid, so placeholders read as intentional rather than broken */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 [background-size:48px_48px]",
          tone === "dark"
            ? "bg-[linear-gradient(to_right,rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.05)_1px,transparent_1px)]"
            : "bg-[linear-gradient(to_right,rgb(15_46_76/0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(15_46_76/0.05)_1px,transparent_1px)]",
        )}
      />
      {!hideCaption && !decorative && (
        <span
          aria-hidden
          className={cn(
            "absolute flex max-w-[80%] items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[0.6875rem] leading-tight",
            tone === "dark" ? "bg-white/10 text-white/80" : "bg-white/70 text-ink-muted",
            captionPosition === "top-right" && "top-4 right-4",
            captionPosition === "bottom-right" && "right-4 bottom-4",
            captionPosition === "center" && "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
            captionClassName,
          )}
        >
          <ImageIcon className="size-3.5 shrink-0" />
          <span className="truncate">{alt}</span>
        </span>
      )}
    </div>
  );
}
