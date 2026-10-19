"use client";

import { useSyncExternalStore } from "react";

// Hydration-safe media queries: the server (and the first client render) assume `false`,
// then the real value takes over. Reduced-motion users never see movement anyway, because
// globals.css forces every [data-motion] element into its final state.

function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export function usePrefersReducedMotion() {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

/** Desktop with a precise pointer (mouse/trackpad). */
export function useFinePointer() {
  return useMediaQuery("(hover: hover) and (pointer: fine)");
}

/** Shared spring: subtle and fast, never linear. */
export const spring = { type: "spring", duration: 0.7, bounce: 0 } as const;
