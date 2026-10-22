"use client";

import { useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Saves `value` a moment after it stops changing (not on mount). `save` returns false on failure.
 * `pending` (a timer is waiting or a save is running) drives the "leave the page?" warning.
 */
export function useAutosave<T>(
  value: T,
  save: (value: T) => Promise<boolean>,
  { delay = 800, enabled = true }: { delay?: number; enabled?: boolean } = {},
) {
  const [state, setState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(false);
  const saveRef = useRef(save);
  const skipFirst = useRef(true);
  const serialized = JSON.stringify(value);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    if (!enabled) return;
    pending.current = true;
    timer.current = setTimeout(async () => {
      setState("saving");
      const ok = await saveRef.current(JSON.parse(serialized) as T).catch(() => false);
      pending.current = false;
      setState(ok ? "saved" : "error");
    }, delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [serialized, enabled, delay]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (pending.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  /** Drop a waiting autosave (e.g. because "Next" saves the same data right now). */
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    pending.current = false;
  };
  return { state, cancel };
}
