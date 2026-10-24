"use client";

import { Box, Eye, EyeOff, Info, LoaderCircle, Maximize, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import type * as THREE from "three";

import { cn } from "@/lib/utils";
import type { ViewerLayer } from "@/server/queries/case-page";

import { formatBytes } from "../format";
import { applyLayerMaterial, loadCaseModel, ModelLoadError } from "./load-model";
import type { ViewerControls } from "./viewer-canvas";

// The case's 3D viewer: a layer list (show/hide, colour, opacity per file) next to the scene.
// Lazy twice over: the three.js scene is a separate chunk mounted only once the viewer is on screen,
// and a layer's file is only downloaded when it is switched on. On phones, files over 100 MB ask
// first. CBCT/DICOM is not previewed.

const ViewerCanvas = dynamic(() => import("./viewer-canvas"), { ssr: false });

const MOBILE_CONFIRM_BYTES = 100 * 1024 ** 2;

type Status = "idle" | "confirm" | "loading" | "ready" | "error";
type LayerState = {
  visible: boolean;
  color: string;
  opacity: number;
  status: Status;
  progress: number;
  error: string | null;
};

function defaultLook(layer: ViewerLayer): { color: string; opacity: number } {
  if (layer.kind === "PLAN_3D") return { color: "#d0543f", opacity: 1 };
  if (layer.kind === "GUIDE_STL") return { color: "#2f6cb5", opacity: 0.8 };
  if (layer.kind === "INTRAORAL_SCAN") {
    if (layer.scanPart === "LOWER") return { color: "#d6c9b6", opacity: 1 };
    if (layer.scanPart === "BITE") return { color: "#bfae95", opacity: 1 };
    return { color: "#ebe2d4", opacity: 1 };
  }
  return { color: "#c3c9d0", opacity: 1 };
}

const initialState = (l: ViewerLayer): LayerState => ({
  ...defaultLook(l),
  visible: l.defaultOn,
  status: "idle",
  progress: 0,
  error: null,
});

const isPhone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768);

export function CaseViewer({ layers, hasCbct }: { layers: ViewerLayer[]; hasCbct: boolean }) {
  const t = useTranslations("cases.viewer");
  const locale = useLocale();
  const section = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  const [models, setModels] = useState<Record<string, THREE.Object3D>>({});
  const aborts = useRef(new Map<string, AbortController>());
  const controlsRef = useRef<ViewerControls | null>(null);
  // The page remounts the viewer (key) when its set of layers changes; the fallback in `look` only
  // guards against a layer the state hasn't seen.
  const [state, setState] = useState<Record<string, LayerState>>(() =>
    Object.fromEntries(layers.map((l) => [l.fileId, initialState(l)])),
  );
  const look = (l: ViewerLayer) => state[l.fileId] ?? initialState(l);

  // The latest look per layer, for loads that finish later.
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  }, [state]);

  const patch = useCallback(
    (id: string, p: Partial<LayerState>) => {
      setState((s) => {
        const base = s[id] ?? initialState(layers.find((l) => l.fileId === id)!);
        return { ...s, [id]: { ...base, ...p } };
      });
    },
    [layers],
  );

  const load = useCallback(
    (layer: ViewerLayer) => {
      const controller = new AbortController();
      aborts.current.set(layer.fileId, controller);
      patch(layer.fileId, { status: "loading", progress: 0, error: null });
      loadCaseModel(layer, (progress) => patch(layer.fileId, { progress }), controller.signal)
        .then((object) => {
          const current = latest.current[layer.fileId] ?? initialState(layer);
          applyLayerMaterial(object, current.color, current.opacity);
          setModels((m) => ({ ...m, [layer.fileId]: object }));
          patch(layer.fileId, { status: "ready", progress: 1 });
        })
        .catch((e: unknown) => {
          if ((e as Error).name === "AbortError") return;
          patch(layer.fileId, {
            status: "error",
            error: e instanceof ModelLoadError ? e.code : "network",
          });
        });
    },
    [patch],
  );

  /** Downloads a layer, asking first on a phone when the file is large. */
  const start = useCallback(
    (layer: ViewerLayer) => {
      if (isPhone() && layer.sizeBytes > MOBILE_CONFIRM_BYTES)
        patch(layer.fileId, { status: "confirm" });
      else load(layer);
    },
    [load, patch],
  );

  // Once the viewer is on screen: mount the scene and download the layers that start switched on.
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        setInView(true);
        for (const layer of layers) {
          const s = latest.current[layer.fileId] ?? initialState(layer);
          if (s.visible && s.status === "idle") start(layer);
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [layers, start]);

  useEffect(() => {
    const pending = aborts.current;
    return () => pending.forEach((c) => c.abort());
  }, []);

  function setLook(layer: ViewerLayer, change: Partial<Pick<LayerState, "color" | "opacity">>) {
    const next = { ...look(layer), ...change };
    const object = models[layer.fileId];
    if (object) applyLayerMaterial(object, next.color, next.opacity);
    patch(layer.fileId, change);
  }

  const shown = layers
    .filter((l) => look(l).visible && look(l).status === "ready")
    .filter((l) => models[l.fileId])
    .map((l) => ({ key: l.fileId, object: models[l.fileId] }));
  const loading = layers.filter((l) => look(l).status === "loading");

  const layerLabel = (l: ViewerLayer) => {
    const what =
      l.kind === "INTRAORAL_SCAN"
        ? t(`layers.scan${l.scanPart ?? ""}` as "layers.scan")
        : t(`layers.${l.kind}` as "layers.OTHER");
    return l.planVersion ? t("layers.planPrefix", { version: l.planVersion, what }) : what;
  };

  return (
    <section
      ref={section}
      aria-labelledby="viewer-heading"
      id="viewer"
      data-viewer=""
      className="flex scroll-mt-24 flex-col gap-4 rounded-card border border-line bg-surface p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="viewer-heading" className="flex items-center gap-2 font-medium text-ink">
          <Box aria-hidden className="size-4 text-brand" />
          {t("title")}
        </h2>
        <div className="flex gap-2">
          <ToolButton
            label={t("fit")}
            onClick={() => controlsRef.current?.fit()}
            disabled={!shown.length}
          >
            <Maximize className="size-4" />
          </ToolButton>
          <ToolButton
            label={t("reset")}
            onClick={() => controlsRef.current?.reset()}
            disabled={!shown.length}
          >
            <RotateCcw className="size-4" />
          </ToolButton>
        </div>
      </div>

      {layers.length === 0 ? (
        <p className="text-sm text-ink-muted">{t("noModels")}</p>
      ) : (
        <div className="@container">
          <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-[minmax(0,1fr)_17rem]">
            <div className="relative h-72 overflow-hidden rounded-xl border border-line bg-[#f4f6f8] sm:h-96">
              {inView && <ViewerCanvas objects={shown} controlsRef={controlsRef} />}
              {shown.length === 0 && loading.length === 0 && (
                <p className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-ink-muted">
                  {t("emptyScene")}
                </p>
              )}
              {loading.length > 0 && (
                <div
                  role="status"
                  className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-full bg-surface/95 px-3 py-1.5 text-xs text-ink shadow-sm"
                >
                  <LoaderCircle aria-hidden className="size-3.5 animate-spin text-brand" />
                  {t("loading", {
                    percent: Math.round(
                      (loading.reduce((sum, l) => sum + look(l).progress, 0) / loading.length) *
                        100,
                    ),
                  })}
                </div>
              )}
              <p className="pointer-events-none absolute top-2 left-3 text-[0.6875rem] text-ink-muted">
                {t("hint")}
              </p>
            </div>

            <ul className="flex flex-col gap-2" aria-label={t("layersLabel")}>
              {layers.map((layer) => {
                const s = look(layer);
                const label = layerLabel(layer);
                return (
                  <li
                    key={layer.fileId}
                    data-layer={layer.fileId}
                    data-layer-state={s.status}
                    className="flex flex-col gap-2 rounded-xl border border-line px-3 py-2.5 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-pressed={s.visible}
                        aria-label={t(s.visible ? "hide" : "show", { name: label })}
                        onClick={() => {
                          const visible = !s.visible;
                          patch(layer.fileId, { visible });
                          // Switched on and not loaded yet (or failed before): download it now.
                          if (visible && (s.status === "idle" || s.status === "error"))
                            start(layer);
                        }}
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-full transition-colors",
                          s.visible
                            ? "bg-brand-ice text-brand"
                            : "text-ink-muted hover:bg-surface-2",
                        )}
                      >
                        {s.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                      </button>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-ink">{label}</span>
                        <span className="block truncate text-xs text-ink-muted" title={layer.name}>
                          {layer.name} · {formatBytes(layer.sizeBytes, locale)}
                        </span>
                      </span>
                      <input
                        type="color"
                        value={s.color}
                        onChange={(e) => setLook(layer, { color: e.target.value })}
                        aria-label={t("color", { name: label })}
                        className="size-7 shrink-0 cursor-pointer rounded-full border border-line bg-transparent p-0.5"
                      />
                    </div>
                    {s.status === "loading" && (
                      <div
                        role="progressbar"
                        aria-label={t("progressFor", { name: label })}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(s.progress * 100)}
                        className="h-1 overflow-hidden rounded-full bg-surface-2"
                      >
                        <div
                          className="h-full bg-brand transition-[width]"
                          style={{ width: `${s.progress * 100}%` }}
                        />
                      </div>
                    )}
                    {s.status === "confirm" && (
                      <div className="flex flex-col gap-2 rounded-lg bg-[#fbeedd] p-2 text-xs text-[#7a4a0c]">
                        {t("largeOnPhone", { size: formatBytes(layer.sizeBytes, locale) })}
                        <span className="flex gap-2">
                          <button
                            type="button"
                            className="font-medium underline"
                            onClick={() => load(layer)}
                          >
                            {t("loadAnyway")}
                          </button>
                          <button
                            type="button"
                            className="underline"
                            onClick={() => patch(layer.fileId, { visible: false, status: "idle" })}
                          >
                            {t("skip")}
                          </button>
                        </span>
                      </div>
                    )}
                    {s.status === "error" && (
                      <p className="text-xs text-destructive">
                        {t(`errors.${s.error ?? "network"}` as "errors.network")}
                      </p>
                    )}
                    {s.visible && s.status === "ready" && (
                      <label className="flex items-center gap-2 text-xs text-ink-muted">
                        <span className="w-16 shrink-0">{t("opacity")}</span>
                        <input
                          type="range"
                          min={0.15}
                          max={1}
                          step={0.05}
                          value={s.opacity}
                          onChange={(e) => setLook(layer, { opacity: Number(e.target.value) })}
                          aria-label={t("opacityFor", { name: label })}
                          className="w-full accent-brand"
                        />
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {hasCbct && (
        <p className="flex items-start gap-2 text-sm text-ink-muted">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t("cbctNote")}
        </p>
      )}
    </section>
  );
}

function ToolButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-sm text-ink transition-colors hover:bg-surface-2 disabled:opacity-40"
    >
      {children}
      {label}
    </button>
  );
}
