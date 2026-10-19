"use client";

import { useInView } from "motion/react";
import dynamic from "next/dynamic";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";

import { usePrefersReducedMotion } from "@/components/motion/use-media-query";
import { cn } from "@/lib/utils";

import { GuidePoster } from "./guide-poster";

// three.js only loads (code-split, client-only) once the card is near the viewport, and only
// with WebGL and without reduced motion. Otherwise, and while loading, the static poster shows.
// Rendering pauses whenever the card is off-screen.

const GuideViewer = dynamic(() => import("./GuideViewer"), { ssr: false });

let webglSupport: boolean | undefined;
function detectWebGL() {
  if (webglSupport === undefined) {
    try {
      const canvas = document.createElement("canvas");
      webglSupport = !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
    } catch {
      webglSupport = false;
    }
  }
  return webglSupport;
}
const noop = () => () => {};

export function GuideViewerLazy({
  modelUrl,
  label,
  posterLabel,
  className,
}: {
  modelUrl: string | null;
  /** Accessible name while the interactive model is shown. */
  label: string;
  /** Accessible name for the static poster. */
  posterLabel: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const near = useInView(ref, { once: true, margin: "300px 0px" });
  const onScreen = useInView(ref, { margin: "80px 0px" });
  const reduce = usePrefersReducedMotion();
  const webgl = useSyncExternalStore(noop, detectWebGL, () => false);
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);

  const interactive = near && webgl && !reduce;

  return (
    <div
      ref={ref}
      role="img"
      aria-label={interactive ? label : posterLabel}
      className={cn("relative size-full", className)}
    >
      <GuidePoster
        className={cn(
          "absolute inset-0 transition-opacity duration-700",
          interactive && ready ? "opacity-0" : "opacity-100",
        )}
      />
      {interactive && (
        <div
          className={cn(
            "absolute inset-0 cursor-grab transition-opacity duration-700 active:cursor-grabbing",
            ready ? "opacity-100" : "opacity-0",
          )}
        >
          <GuideViewer modelUrl={modelUrl} active={onScreen} onReady={onReady} />
        </div>
      )}
    </div>
  );
}
