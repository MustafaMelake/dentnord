"use client";

import { motion, useMotionValue, useSpring } from "motion/react";
import type { PointerEvent, ReactNode } from "react";

import { useFinePointer, usePrefersReducedMotion } from "./use-media-query";

// Pulls its child subtly toward the cursor. Desktop (fine pointer) only, off under reduced motion.

export function MagneticButton({
  children,
  strength = 0.25,
  className,
}: {
  children: ReactNode;
  /** Fraction of the cursor offset applied. */
  strength?: number;
  className?: string;
}) {
  const fine = useFinePointer();
  const reduce = usePrefersReducedMotion();
  const x = useSpring(useMotionValue(0), { stiffness: 260, damping: 20, mass: 0.6 });
  const y = useSpring(useMotionValue(0), { stiffness: 260, damping: 20, mass: 0.6 });
  const enabled = fine && !reduce;

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (!enabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - (rect.left + rect.width / 2)) * strength);
    y.set((e.clientY - (rect.top + rect.height / 2)) * strength);
  }

  function reset() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      data-motion=""
      className={className ?? "inline-block"}
      style={{ x, y }}
      onPointerMove={onMove}
      onPointerLeave={reset}
    >
      {children}
    </motion.div>
  );
}
