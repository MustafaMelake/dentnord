"use client";

import "lenis/dist/lenis.css";

import { ReactLenis } from "lenis/react";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

import { usePrefersReducedMotion } from "./use-media-query";

// Mounted once in the marketing layout: Lenis smooth scrolling + motion defaults.
// Off entirely for reduced-motion users (native scrolling, no animations).

export function SmoothScroll({ children }: { children: ReactNode }) {
  const reduce = usePrefersReducedMotion();
  return (
    <MotionConfig reducedMotion="user">
      {!reduce && <ReactLenis root options={{ lerp: 0.12, anchors: { offset: -88 } }} />}
      {children}
    </MotionConfig>
  );
}
