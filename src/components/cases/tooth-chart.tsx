"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import {
  LOWER_ARCH,
  nextTooth,
  toothType,
  UPPER_ARCH,
  type ArrowKey,
  type ToothType,
} from "@/lib/fdi";
import { cn } from "@/lib/utils";

// Interactive FDI tooth chart: 32 real <button>s placed along two arches over an SVG drawing.
// Keyboard: one tab stop (roving focus), ←/→ along the arch, ↑/↓ to the other arch, Home/End,
// Space/Enter toggles. On phones the chart keeps a readable size and scrolls sideways.
// Orientation: as the dentist faces the patient (patient's right on the left of the screen).

const VIEW_W = 1000;
const VIEW_H = 760;
const UPPER = { cx: 500, cy: 340, rx: 430, ry: 260 };
const LOWER = { cx: 500, cy: 420, rx: 430, ry: 260 };
const SIZE: Record<ToothType, number> = { molar: 78, premolar: 64, canine: 62, incisor: 58 };
const WEIGHT: Record<ToothType, number> = { molar: 1.3, premolar: 1, canine: 1, incisor: 0.88 };

type Point = { x: number; y: number };

/** Places teeth along a half ellipse by arc length, each taking room in proportion to its size. */
function layoutArch(
  teeth: readonly number[],
  arch: typeof UPPER,
  upper: boolean,
): Map<number, Point> {
  const steps = 720;
  const angleAt = (i: number) => Math.PI - (Math.PI * i) / steps; // 180° → 0°
  const pointAt = (a: number) => ({
    x: arch.cx + arch.rx * Math.cos(a),
    y: upper ? arch.cy - arch.ry * Math.sin(a) : arch.cy + arch.ry * Math.sin(a),
  });
  const cumulative = [0];
  for (let i = 1; i <= steps; i++) {
    const p = pointAt(angleAt(i - 1));
    const q = pointAt(angleAt(i));
    cumulative.push(cumulative[i - 1] + Math.hypot(q.x - p.x, q.y - p.y));
  }
  const total = cumulative[steps];
  const weights = teeth.map((t) => WEIGHT[toothType(t)]);
  const sum = weights.reduce((a, b) => a + b, 0);
  const positions = new Map<number, Point>();
  let acc = 0;
  teeth.forEach((tooth, i) => {
    const target = ((acc + weights[i] / 2) / sum) * total;
    acc += weights[i];
    let j = 0;
    while (j < steps && cumulative[j] < target) j++;
    positions.set(tooth, pointAt(angleAt(j)));
  });
  return positions;
}

function archPath(arch: typeof UPPER, upper: boolean) {
  const sweep = upper ? 1 : 0;
  return `M ${arch.cx - arch.rx} ${arch.cy} A ${arch.rx} ${arch.ry} 0 0 ${sweep} ${arch.cx + arch.rx} ${arch.cy}`;
}

export function ToothChart({
  selected,
  onToggle,
  readOnly = false,
  className,
}: {
  selected: readonly number[];
  onToggle?: (tooth: number) => void;
  readOnly?: boolean;
  className?: string;
}) {
  const t = useTranslations("cases.chart");
  const tTeeth = useTranslations("cases.teeth");
  const positions = useMemo(
    () =>
      new Map([...layoutArch(UPPER_ARCH, UPPER, true), ...layoutArch(LOWER_ARCH, LOWER, false)]),
    [],
  );
  const [focusTooth, setFocusTooth] = useState<number>(selected[0] ?? 11);
  const refs = useRef(new Map<number, HTMLButtonElement>());
  const scroller = useRef<HTMLDivElement>(null);

  // When the chart is wider than the screen, start centred on the midline.
  useEffect(() => {
    const el = scroller.current;
    if (el && el.scrollWidth > el.clientWidth)
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, []);

  const toothName = (n: number) =>
    tTeeth("label", {
      tooth: n,
      quadrant: tTeeth(`quadrants.${Math.floor(n / 10)}` as "quadrants.1"),
      name: tTeeth(`names.${n % 10}` as "names.1"),
    });

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, tooth: number) {
    const keys: ArrowKey[] = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
    if (!keys.includes(e.key as ArrowKey)) return;
    e.preventDefault();
    const next = nextTooth(tooth, e.key as ArrowKey);
    setFocusTooth(next);
    refs.current.get(next)?.focus();
  }

  const renderArch = (teeth: readonly number[], label: string) => (
    <div role="group" aria-label={label} className="contents">
      {teeth.map((tooth) => {
        const p = positions.get(tooth)!;
        const type = toothType(tooth);
        const size = SIZE[type];
        const isSelected = selected.includes(tooth);
        const style = {
          left: `${(p.x / VIEW_W) * 100}%`,
          top: `${(p.y / VIEW_H) * 100}%`,
          width: `${(size / VIEW_W) * 100}%`,
          height: `${(size / VIEW_H) * 100}%`,
        };
        const visual = <ToothShape type={type} tooth={tooth} selected={isSelected} />;
        if (readOnly) {
          return (
            <span
              key={tooth}
              aria-hidden
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={style}
            >
              {visual}
            </span>
          );
        }
        return (
          <button
            key={tooth}
            ref={(el) => {
              if (el) refs.current.set(tooth, el);
              else refs.current.delete(tooth);
            }}
            type="button"
            data-tooth={tooth}
            aria-pressed={isSelected}
            aria-label={toothName(tooth)}
            tabIndex={tooth === focusTooth ? 0 : -1}
            onFocus={() => setFocusTooth(tooth)}
            onClick={() => onToggle?.(tooth)}
            onKeyDown={(e) => onKeyDown(e, tooth)}
            className="group absolute -translate-x-1/2 -translate-y-1/2 rounded-[30%] outline-none focus-visible:ring-3 focus-visible:ring-brand focus-visible:ring-offset-2"
            style={style}
          >
            {visual}
          </button>
        );
      })}
    </div>
  );

  return (
    <div ref={scroller} className={cn("overflow-x-auto overscroll-x-contain", className)}>
      <div
        role={readOnly ? "img" : "group"}
        aria-label={
          readOnly
            ? t("readOnlyLabel", { teeth: selected.length ? selected.join(", ") : t("none") })
            : t("label")
        }
        // Interactive: keep teeth big enough to tap (the card scrolls sideways on phones).
        className={cn(
          "relative mx-auto aspect-[1000/760] w-full max-w-3xl select-none",
          !readOnly && "min-w-[34rem]",
        )}
      >
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} aria-hidden className="absolute inset-0 size-full">
          <path
            d={archPath(UPPER, true)}
            fill="none"
            stroke="var(--color-brand-ice)"
            strokeWidth="96"
            strokeLinecap="round"
          />
          <path
            d={archPath(LOWER, false)}
            fill="none"
            stroke="var(--color-brand-ice)"
            strokeWidth="96"
            strokeLinecap="round"
          />
          <line
            x1="500"
            y1="20"
            x2="500"
            y2="740"
            stroke="var(--color-line)"
            strokeDasharray="6 10"
            strokeWidth="2"
          />
          <text
            x="500"
            y="365"
            textAnchor="middle"
            className="fill-ink-muted font-mono text-[22px]"
          >
            {t("upper")}
          </text>
          <text
            x="500"
            y="410"
            textAnchor="middle"
            className="fill-ink-muted font-mono text-[22px]"
          >
            {t("lower")}
          </text>
          <text x="24" y="40" className="fill-ink-muted font-mono text-[22px]">
            {t("right")}
          </text>
          <text x="976" y="40" textAnchor="end" className="fill-ink-muted font-mono text-[22px]">
            {t("left")}
          </text>
        </svg>
        {renderArch(UPPER_ARCH, t("upperArch"))}
        {renderArch(LOWER_ARCH, t("lowerArch"))}
      </div>
    </div>
  );
}

/** A simple crown outline per tooth type, with the FDI number on it. */
function ToothShape({
  type,
  tooth,
  selected,
}: {
  type: ToothType;
  tooth: number;
  selected: boolean;
}) {
  const path = {
    molar:
      "M14 22 Q14 8 30 9 Q50 4 70 9 Q86 8 86 22 L86 74 Q86 92 68 91 Q50 96 32 91 Q14 92 14 74 Z",
    premolar: "M20 26 Q20 8 50 8 Q80 8 80 26 L80 72 Q80 92 50 92 Q20 92 20 72 Z",
    canine: "M50 6 Q80 22 80 50 Q80 92 50 94 Q20 92 20 50 Q20 22 50 6 Z",
    incisor: "M24 14 Q24 6 50 6 Q76 6 76 14 L76 78 Q76 94 50 94 Q24 94 24 78 Z",
  }[type];
  return (
    <span className="relative flex size-full items-center justify-center">
      <svg viewBox="0 0 100 100" aria-hidden className="absolute inset-0 size-full">
        <path
          d={path}
          className={cn(
            "transition-colors duration-150",
            selected
              ? "fill-brand stroke-brand-deep"
              : "fill-surface stroke-line group-hover:fill-brand-ice group-hover:stroke-brand",
          )}
          strokeWidth="4"
        />
        {type === "molar" && !selected && (
          <path
            d="M34 34 L50 46 L66 34 M50 46 L50 66"
            fill="none"
            className="stroke-line"
            strokeWidth="3"
          />
        )}
      </svg>
      <span
        className={cn(
          "relative font-mono text-[clamp(0.625rem,1.2vw,0.8125rem)] leading-none font-medium tabular-nums",
          selected ? "text-white" : "text-ink",
        )}
      >
        {tooth}
      </span>
      {selected && (
        <span className="absolute -top-1 -right-1 flex size-[38%] max-h-5 max-w-5 items-center justify-center rounded-full bg-surface text-brand shadow-sm">
          <Check className="size-[70%]" strokeWidth={3} />
        </span>
      )}
    </span>
  );
}
