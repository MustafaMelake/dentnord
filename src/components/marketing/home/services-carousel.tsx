"use client";

import { animate, motion, useMotionValue, useMotionValueEvent } from "motion/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

import { spring, usePrefersReducedMotion } from "@/components/motion/use-media-query";
import { ArrowCircle } from "@/components/shared/button";
import { PlaceholderImage } from "@/components/shared/placeholder-image";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type Item = { id: string; slug: string; title: string; imageAlt: string };

// Draggable carousel (drag="x" with momentum), prev/next buttons and arrow keys.
// The track may extend past the container to the right; the section clips it at the viewport.

export function ServicesCarousel({ items, className }: { items: Item[]; className?: string }) {
  const t = useTranslations("home.services");
  const reduce = usePrefersReducedMotion();
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const dragging = useRef(false);
  const x = useMotionValue(0);
  const [minX, setMinX] = useState(0);
  const [pos, setPos] = useState({ canPrev: false, canNext: true, index: 0 });

  const step = useCallback(() => {
    const first = trackRef.current?.children[0] as HTMLElement | undefined;
    const gap = trackRef.current
      ? parseFloat(getComputedStyle(trackRef.current).columnGap) || 0
      : 0;
    return (first?.offsetWidth ?? 320) + gap;
  }, []);

  const position = useCallback(
    (v: number, min: number) => ({
      canPrev: v < -2,
      canNext: v > min + 2,
      index: Math.min(items.length - 1, Math.round(-v / step())),
    }),
    [items.length, step],
  );

  // Measure how far the track can move.
  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;
    const ro = new ResizeObserver(() => {
      const min = Math.min(0, viewport.clientWidth - track.scrollWidth);
      if (x.get() < min) x.set(min);
      setMinX(min);
      setPos(position(x.get(), min));
    });
    ro.observe(viewport);
    ro.observe(track);
    return () => ro.disconnect();
  }, [x, position]);

  useMotionValueEvent(x, "change", (v) => setPos(position(v, minX)));

  const go = useCallback(
    (target: number) => {
      const clamped = Math.max(minX, Math.min(0, target));
      animate(x, clamped, reduce ? { duration: 0 } : spring);
    },
    [minX, reduce, x],
  );

  const prev = () => go(Math.round(x.get() / step() + 1) * step());
  const next = () => go(Math.round(x.get() / step() - 1) * step());

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      prev();
    }
  }

  // Keep a focused card (Tab) fully visible.
  function onFocusCard(el: HTMLElement) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const left = el.offsetLeft + x.get();
    const right = left + el.offsetWidth;
    if (left < 0 || right > viewport.clientWidth) go(-el.offsetLeft);
  }

  return (
    <div className={className}>
      <div
        ref={viewportRef}
        role="region"
        aria-roledescription="carousel"
        aria-label={t("carousel")}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="rounded-media outline-offset-8"
      >
        <motion.ul
          ref={trackRef}
          drag="x"
          dragConstraints={{ left: minX, right: 0 }}
          dragElastic={0.08}
          dragTransition={{
            power: 0.3,
            timeConstant: 280,
            bounceStiffness: 320,
            bounceDamping: 34,
          }}
          onDragStart={() => {
            dragging.current = true;
          }}
          onDragEnd={() => {
            // Let the click that ends a drag be swallowed first.
            requestAnimationFrame(() => {
              dragging.current = false;
            });
          }}
          onClickCapture={(e) => {
            if (dragging.current) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          style={{ x }}
          className="flex w-max cursor-grab gap-4 active:cursor-grabbing sm:gap-5"
        >
          {items.map((item, i) => (
            <li
              key={item.id}
              aria-roledescription="slide"
              aria-label={t("position", { current: i + 1, total: items.length })}
              className="w-[78vw] max-w-[22rem] sm:w-[20rem] lg:w-[22rem]"
            >
              <Link
                href={`/services#${item.slug}`}
                draggable={false}
                onFocus={(e) => onFocusCard(e.currentTarget.parentElement ?? e.currentTarget)}
                className="group relative block aspect-[4/5] overflow-hidden rounded-media transition-transform duration-500 ease-spring motion-safe:hover:-translate-y-1"
              >
                <div className="absolute inset-0 transition-transform duration-700 ease-spring motion-safe:group-hover:scale-[1.03]">
                  <PlaceholderImage
                    alt={item.imageAlt}
                    fill
                    tone="dark"
                    captionPosition="top-right"
                  />
                </div>
                <div
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[rgb(11_27_43/0.75)] to-transparent"
                />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 text-white sm:p-6">
                  <div className="flex min-w-0 flex-col gap-2">
                    <span className="font-mono text-label text-white/80">
                      {String(i + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
                    </span>
                    <h3 className="max-w-[12ch] text-[1.5rem] leading-[1.05] tracking-[-0.03em] hyphens-auto sm:text-[1.625rem]">
                      {item.title}
                    </h3>
                  </div>
                  <ArrowCircle variant="glass" size="lg" />
                </div>
              </Link>
            </li>
          ))}
        </motion.ul>
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          <span aria-hidden className="font-mono text-label text-ink-muted">
            <span className="text-ink">{String(pos.index + 1).padStart(2, "0")}</span> /{" "}
            {String(items.length).padStart(2, "0")}
          </span>
          <Link
            href="/services"
            className="group inline-flex items-center gap-2 text-ink underline-offset-4 hover:underline"
          >
            {t("all")}
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <ArrowCircle
            label={t("previous")}
            direction="right"
            size="lg"
            variant={pos.canPrev ? "solid" : "soft"}
            disabled={!pos.canPrev}
            onClick={prev}
            iconClassName="rotate-180"
            className={cn(!pos.canPrev && "opacity-100")}
          />
          <ArrowCircle
            label={t("next")}
            direction="right"
            size="lg"
            variant={pos.canNext ? "solid" : "soft"}
            disabled={!pos.canNext}
            onClick={next}
          />
        </div>
      </div>
    </div>
  );
}
