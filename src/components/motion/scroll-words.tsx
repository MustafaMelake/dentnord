"use client";

import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef } from "react";

import { cn } from "@/lib/utils";

// Big statement paragraph: each word goes from muted to ink as it scrolls through the viewport.
// Starts at ink-muted (still ≥ 4.5:1 contrast), so the text is readable at every scroll position.

const FROM = "#546577"; // --color-ink-muted
const TO = "#0b1b2b"; // --color-ink

export function ScrollWords({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.45"] });
  const words = text.split(/\s+/).filter(Boolean);

  return (
    <p ref={ref} data-motion="words" className={cn("text-ink", className)}>
      {words.map((word, i) => (
        <Word
          key={`${word}-${i}`}
          progress={scrollYProgress}
          range={[i / words.length, (i + 1) / words.length]}
        >
          {word}
          {i < words.length - 1 ? " " : ""}
        </Word>
      ))}
    </p>
  );
}

function Word({
  children,
  progress,
  range,
}: {
  children: React.ReactNode;
  progress: MotionValue<number>;
  range: [number, number];
}) {
  const color = useTransform(progress, range, [FROM, TO]);
  return <motion.span style={{ color }}>{children}</motion.span>;
}
