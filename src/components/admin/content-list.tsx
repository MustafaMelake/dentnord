"use client";

import { Archive, Pencil, Trash2 } from "lucide-react";
import Image from "next/image";
import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { deleteContent, reorderContent, setContentFlag } from "@/server/actions/admin/lists";
import type { PublicImage } from "@/server/queries/media";
import type { ContentModel } from "@/server/services/content-admin";

import { useActionErrorToast } from "./form-kit";
import { SortableList } from "./sortable-list";

export type ContentListItem = {
  id: string;
  title: string;
  subtitle?: string;
  thumbnail?: PublicImage | null;
  /** Published (services, testimonials, portfolio) or active (catalog). */
  flag: boolean;
  /** Why the flag can't be switched on (e.g. a testimonial without consent). */
  flagBlockedReason?: string;
  isExample?: boolean;
  /** Cases using the row: deleting archives instead. */
  usage?: number;
  badges?: ReactNode;
};

/**
 * One admin content list: drag (or ↑/↓) to reorder, switch to publish/activate, edit, delete.
 * Rows referenced by cases are archived instead of deleted (the server decides; the dialog says so).
 */
export function ContentList({
  model,
  items,
  flagLabel,
  editPath,
  onEdit,
  emptyText,
}: {
  model: ContentModel;
  items: ContentListItem[];
  /** "Published" or "Active". */
  flagLabel: string;
  /** Edit pages live at `${editPath}${id}` (a string, so server pages can pass it). */
  editPath?: string;
  onEdit?: (id: string) => void;
  emptyText: string;
}) {
  const t = useTranslations("admin.list");
  const router = useRouter();
  const errorToast = useActionErrorToast();
  const [busy, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});

  if (items.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-line bg-surface p-8 text-center text-sm text-muted-foreground">
        {emptyText}
      </p>
    );
  }

  return (
    <SortableList
      items={items}
      itemLabel={(item) => item.title}
      disabled={busy}
      onCommit={async (ids) => {
        const result = await reorderContent({ model, ids }).catch(() => null);
        if (!result?.ok) {
          errorToast(result?.error ?? "generic");
          return false;
        }
        toast.success(t("reordered"));
        router.refresh();
        return true;
      }}
      renderItem={(item) => {
        const flag = optimistic[item.id] ?? item.flag;
        return (
          <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
            {item.thumbnail !== undefined && (
              <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                {item.thumbnail && (
                  <Image
                    src={item.thumbnail.url}
                    alt=""
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                )}
              </span>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-medium text-ink">{item.title}</span>
                {item.isExample && (
                  <Badge variant="outline" className="border-[#c9831f]/60 text-[#7a4a0c]">
                    {t("example")}
                  </Badge>
                )}
                {!flag && (
                  <Badge variant="secondary">
                    {model === "service" || model === "testimonial" || model === "portfolioCase"
                      ? t("draft")
                      : t("archived")}
                  </Badge>
                )}
                {item.badges}
              </div>
              {item.subtitle && (
                <span className="truncate text-sm text-muted-foreground">{item.subtitle}</span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <label
                className="mr-2 flex items-center gap-2 text-sm text-muted-foreground"
                title={item.flagBlockedReason}
              >
                <Switch
                  checked={flag}
                  disabled={busy || (!flag && !!item.flagBlockedReason)}
                  aria-label={`${flagLabel}: ${item.title}`}
                  onCheckedChange={(value) => {
                    setOptimistic((o) => ({ ...o, [item.id]: value }));
                    startTransition(async () => {
                      const result = await setContentFlag({ model, id: item.id, value }).catch(
                        () => null,
                      );
                      if (!result?.ok) {
                        setOptimistic((o) => ({ ...o, [item.id]: !value }));
                        errorToast(result?.error ?? "generic");
                        return;
                      }
                      toast.success(
                        value
                          ? t("flagOn", { flag: flagLabel })
                          : t("flagOff", { flag: flagLabel }),
                      );
                      router.refresh();
                    });
                  }}
                />
                <span className="hidden md:inline">{flagLabel}</span>
              </label>
              {editPath ? (
                <Button
                  asChild
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t("edit", { item: item.title })}
                >
                  <NextLink href={`${editPath}${item.id}`}>
                    <Pencil />
                  </NextLink>
                </Button>
              ) : (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t("edit", { item: item.title })}
                  onClick={() => onEdit?.(item.id)}
                >
                  <Pencil />
                </Button>
              )}
              <DeleteButton model={model} item={item} />
            </div>
          </div>
        );
      }}
    />
  );
}

function DeleteButton({ model, item }: { model: ContentModel; item: ContentListItem }) {
  const t = useTranslations("admin.list");
  const router = useRouter();
  const errorToast = useActionErrorToast();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const archives = (item.usage ?? 0) > 0;
  const Icon = archives ? Archive : Trash2;
  return (
    <AlertDialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={(archives ? t("archive") : t("delete")) + `: ${item.title}`}
        >
          <Icon />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {archives
              ? t("archiveTitle", { item: item.title })
              : t("deleteTitle", { item: item.title })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {archives ? t("archiveBody", { count: item.usage ?? 0 }) : t("deleteBody")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant={archives ? "default" : "destructive"}
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const result = await deleteContent({ model, id: item.id }).catch(() => null);
                if (!result?.ok) {
                  errorToast(result?.error ?? "generic");
                  return;
                }
                setOpen(false);
                toast.success(
                  result.data === "archived" ? t("archived_toast") : t("deleted_toast"),
                );
                router.refresh();
              });
            }}
          >
            {archives ? t("archive") : t("delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** "These are example entries — edit or archive them." Dismissible per browser. */
export function ExampleBanner({ count, storageKey }: { count: number; storageKey: string }) {
  const t = useTranslations("admin.list");
  const key = `dn-admin-example-banner:${storageKey}`;
  // Server snapshot: not dismissed (so hydration matches); then the stored choice applies.
  const stored = useSyncExternalStore(
    noopSubscribe,
    () => readFlag(key),
    () => false,
  );
  const [dismissed, setDismissed] = useState(false);
  if (count === 0 || stored || dismissed) return null;
  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-card border border-[#c9831f]/40 bg-[#fbeedd] px-4 py-3 text-sm text-[#7a4a0c]",
      )}
    >
      <p>{t("exampleBanner", { count })}</p>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-[#7a4a0c] hover:bg-[#f7e2c4]"
        onClick={() => {
          setDismissed(true);
          try {
            window.localStorage.setItem(key, "1");
          } catch {
            // Storage unavailable (private mode): dismissed for this visit only.
          }
        }}
      >
        {t("dismiss")}
      </Button>
    </div>
  );
}

const noopSubscribe = () => () => {};

function readFlag(key: string) {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
