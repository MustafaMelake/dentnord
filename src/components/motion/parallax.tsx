"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

// The inner layer moves slightly slower than the page. It is scaled up so its edges never show.
// Put the rounded frame on `className`; children (an image) should fill the frame.

export function Parallax({
  children,
  className,
  strength = 6,
}: {
  children: ReactNode;
  className?: string;
  /** Max offset in % of the frame height. */
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [`-${strength}%`, `${strength}%`]);

  return (
    <div ref={ref} className={cn("relative overflow-hidden", className)}>
      <motion.div data-motion="" className="absolute inset-0 scale-[1.14]" style={{ y }}>
        {children}
      </motion.div>
    </div>
  );
}
