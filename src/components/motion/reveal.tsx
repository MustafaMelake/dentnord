"use client";

import { motion, type Variants } from "motion/react";
import type { ReactNode } from "react";

import { spring } from "./use-media-query";

// Fade + 24px rise + slight blur → sharp, once, when scrolled into view.
// <Reveal> animates itself. <Reveal stagger={0.08}> animates its <RevealItem> children in sequence.

const item: Variants = {
  hidden: { opacity: 0, y: 24, filter: "blur(6px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: spring },
};

type Tag = "div" | "section" | "ul" | "ol" | "li" | "p" | "span" | "article" | "figure";

type RevealProps = {
  children: ReactNode;
  as?: Tag;
  className?: string;
  delay?: number;
  /** Seconds between children. Turns this into a container for <RevealItem>. */
  stagger?: number;
  /** Fraction of the element that must be visible before it animates. */
  amount?: number;
};

export function Reveal({
  children,
  as = "div",
  className,
  delay = 0,
  stagger,
  amount = 0.2,
}: RevealProps) {
  const Comp = motion[as] as typeof motion.div;
  const variants: Variants = stagger
    ? { hidden: {}, visible: { transition: { staggerChildren: stagger, delayChildren: delay } } }
    : {
        hidden: item.hidden,
        visible: { ...(item.visible as object), transition: { ...spring, delay } },
      };

  return (
    <Comp
      className={className}
      data-motion={stagger ? undefined : ""}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount }}
      variants={variants}
    >
      {children}
    </Comp>
  );
}

export function RevealItem({
  children,
  as = "div",
  className,
}: {
  children: ReactNode;
  as?: Tag;
  className?: string;
}) {
  const Comp = motion[as] as typeof motion.div;
  return (
    <Comp className={className} data-motion="" variants={item}>
      {children}
    </Comp>
  );
}
