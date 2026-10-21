"use client";

import { animate, useInView } from "motion/react";
import { useEffect, useRef } from "react";

import { usePrefersReducedMotion } from "./use-media-query";

// Counts up to `value` when it scrolls into view. The server renders the final value, so
// the number is correct without JS, for crawlers and under reduced motion.
// `value: null` renders `placeholder` (empty by default; callers hide missing figures instead).

export function Counter({
  value,
  placeholder = "",
  locale,
  className,
}: {
  value: number | null;
  placeholder?: string;
  locale: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = usePrefersReducedMotion();
  const format = (n: number) => new Intl.NumberFormat(locale).format(Math.round(n));

  useEffect(() => {
    const el = ref.current;
    if (!el || value === null || reduce || !inView) return;
    const controls = animate(0, value, {
      type: "spring",
      duration: 1.4,
      bounce: 0,
      onUpdate: (n) => {
        el.textContent = format(n);
      },
    });
    return () => controls.stop();
    // `format` only depends on `locale`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, value, reduce, locale]);

  return (
    <span ref={ref} className={className}>
      {value === null ? placeholder : format(value)}
    </span>
  );
}
