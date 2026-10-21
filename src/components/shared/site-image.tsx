import Image from "next/image";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { PublicImage } from "@/server/queries/media";

import { PlaceholderImage } from "./placeholder-image";

/**
 * An admin-managed image (MediaAsset on R2) via next/image, or — while none is uploaded — a neutral,
 * decorative gradient (visitors see no caption or placeholder text) plus an admin-only `missing`
 * marker (pass <Missing field="…" /> or a <MissingMarker />).
 */
export function SiteImage({
  image,
  locale,
  sizes,
  priority,
  tone = "light",
  className,
  imageClassName,
  missing,
  markerClassName,
}: {
  image: PublicImage | null | undefined;
  locale: string;
  sizes: string;
  priority?: boolean;
  tone?: "light" | "dark";
  /** On the wrapper (positioning). The image fills it. */
  className?: string;
  imageClassName?: string;
  missing?: ReactNode;
  markerClassName?: string;
}) {
  if (image) {
    const alt = (locale === "en" ? image.alt.en : image.alt.da) || image.alt.da || image.alt.en;
    return (
      <div className={cn("absolute inset-0 overflow-hidden", className)}>
        <Image
          src={image.url}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className={cn("object-cover", imageClassName)}
        />
      </div>
    );
  }
  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      <PlaceholderImage alt="" fill tone={tone} decorative />
      {missing && (
        <div className={cn("absolute top-3 left-3 z-10", markerClassName)}>{missing}</div>
      )}
    </div>
  );
}
