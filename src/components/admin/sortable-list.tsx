"use client";

import { GripVertical } from "lucide-react";
import { Reorder, useDragControls } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { usePrefersReducedMotion } from "@/components/motion/use-media-query";
import { cn } from "@/lib/utils";

/**
 * Drag-to-reorder list (motion's Reorder) that is also keyboard accessible: focus a row's handle and
 * use ↑/↓ (Home/End) to move it. Moves are announced to screen readers. `onCommit` gets the new id
 * order after a drag ends or a key move, and returns false to roll back (e.g. the save failed).
 */
export function SortableList<T extends { id: string }>({
  items,
  itemLabel,
  onCommit,
  renderItem,
  className,
  disabled,
}: {
  items: T[];
  /** Accessible name of a row, e.g. its title. */
  itemLabel: (item: T) => string;
  onCommit: (ids: string[]) => Promise<boolean>;
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const t = useTranslations("admin.list");
  const [order, setOrder] = useState(items);
  const [announcement, setAnnouncement] = useState("");
  const orderRef = useRef(items);
  const committedRef = useRef(items);

  // Follow the server's list when it changes (after a save, add or delete): adjust state during
  // render rather than in an effect.
  const [source, setSource] = useState(items);
  if (source !== items) {
    setSource(items);
    setOrder(items);
  }
  useEffect(() => {
    orderRef.current = order;
  }, [order]);
  useEffect(() => {
    committedRef.current = items;
  }, [items]);

  const update = (next: T[]) => {
    orderRef.current = next;
    setOrder(next);
  };

  async function commit(next: T[]) {
    const before = committedRef.current;
    if (next.map((i) => i.id).join() === before.map((i) => i.id).join()) return;
    committedRef.current = next;
    const ok = await onCommit(next.map((i) => i.id));
    if (!ok) {
      committedRef.current = before;
      update(before);
    }
  }

  function moveBy(index: number, to: number) {
    const target = Math.max(0, Math.min(order.length - 1, to));
    if (target === index) return;
    const next = [...order];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    update(next);
    setAnnouncement(
      t("moved", { item: itemLabel(item), position: target + 1, total: next.length }),
    );
    void commit(next);
  }

  return (
    <>
      <Reorder.Group
        as="ul"
        axis="y"
        values={order}
        onReorder={update}
        className={cn("flex flex-col gap-2", className)}
      >
        {order.map((item, index) => (
          <SortableRow
            key={item.id}
            item={item}
            label={itemLabel(item)}
            disabled={disabled}
            onDragEnd={() => void commit(orderRef.current)}
            onMove={(delta) =>
              moveBy(
                index,
                delta === "first" ? 0 : delta === "last" ? order.length - 1 : index + delta,
              )
            }
            position={t("position", { position: index + 1, total: order.length })}
          >
            {renderItem(item, index)}
          </SortableRow>
        ))}
      </Reorder.Group>
      <p aria-live="assertive" className="sr-only">
        {announcement}
      </p>
    </>
  );
}

function SortableRow<T>({
  item,
  label,
  position,
  disabled,
  onDragEnd,
  onMove,
  children,
}: {
  item: T;
  label: string;
  position: string;
  disabled?: boolean;
  onDragEnd: () => void;
  onMove: (delta: number | "first" | "last") => void;
  children: ReactNode;
}) {
  const t = useTranslations("admin.list");
  const controls = useDragControls();
  const reduce = usePrefersReducedMotion();
  return (
    <Reorder.Item
      as="li"
      value={item}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      layout={reduce ? undefined : "position"}
      className="relative flex items-stretch gap-2 rounded-card border border-line bg-surface"
      whileDrag={{ scale: 1.01, boxShadow: "0 12px 32px rgb(11 27 43 / 0.12)", zIndex: 10 }}
    >
      <button
        type="button"
        disabled={disabled}
        aria-label={t("handle", { item: label })}
        title={t("handleHint")}
        onPointerDown={(e) => {
          if (disabled) return;
          e.preventDefault();
          controls.start(e);
        }}
        onKeyDown={(e) => {
          const moves: Record<string, number | "first" | "last"> = {
            ArrowUp: -1,
            ArrowDown: 1,
            Home: "first",
            End: "last",
          };
          if (e.key in moves) {
            e.preventDefault();
            onMove(moves[e.key]);
          }
        }}
        className="flex w-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-l-card text-muted-foreground hover:bg-muted active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
      >
        <GripVertical aria-hidden className="size-4" />
        <span className="sr-only">{position}</span>
      </button>
      <div className="min-w-0 flex-1 py-3 pr-3">{children}</div>
    </Reorder.Item>
  );
}
