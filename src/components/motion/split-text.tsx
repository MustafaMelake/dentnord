"use client";

import { motion } from "motion/react";
import type { CSSProperties, ElementType } from "react";

import { spring } from "./use-media-query";

// Headline words rise in from a mask, staggered.
// trigger="load": pure CSS keyframes, so above-the-fold headlines animate before hydration
//                 (no LCP penalty from waiting on JS).
// trigger="view": motion, once, when scrolled into view.

type SplitTextProps = {
  text: string;
  as?: ElementType;
  id?: string;
  className?: string;
  trigger?: "load" | "view";
  /** Seconds before the first word. */
  delay?: number;
  /** Seconds between words. */
  stagger?: number;
};

export function SplitText({
  text,
  as: Tag = "h2",
  id,
  className,
  trigger = "view",
  delay = 0,
  stagger = 0.06,
}: SplitTextProps) {
  const words = text.split(/\s+/).filter(Boolean);

  const content = words.map((word, i) => (
    <span key={`${word}-${i}`}>
      <span className="-mb-[0.12em] inline-block overflow-hidden pb-[0.12em] align-bottom">
        {trigger === "load" ? (
          <span
            data-motion=""
            className="inline-block animate-word-rise"
            style={{ animationDelay: `${delay + i * stagger}s` } as CSSProperties}
          >
            {word}
          </span>
        ) : (
          <motion.span
            data-motion=""
            className="inline-block"
            variants={{
              hidden: { y: "105%" },
              visible: { y: "0%", transition: { ...spring, delay: delay + i * stagger } },
            }}
          >
            {word}
          </motion.span>
        )}
      </span>
      {i < words.length - 1 ? " " : null}
    </span>
  ));

  if (trigger === "load")
    return (
      <Tag id={id} className={className}>
        {content}
      </Tag>
    );

  return (
    <Tag id={id} className={className}>
      <motion.span
        className="block"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.4 }}
      >
        {content}
      </motion.span>
    </Tag>
  );
}
