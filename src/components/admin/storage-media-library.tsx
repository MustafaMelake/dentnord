"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
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
import { formatBytes } from "@/lib/storage-limits";
import type { MediaUsage } from "@/lib/storage-usage";
import { deleteMediaAsset } from "@/server/actions/admin/media";
import type { MediaLibraryItem } from "@/server/queries/admin-storage";

import { useActionErrorToast } from "./form-kit";

// The media library on /admin/storage: every uploaded site image, where it's used, and a delete
// button for the unused ones. The server checks "unused" again before deleting.

export function StorageMediaLibrary({
  configured,
  items,
}: {
  configured: boolean;
  items: MediaLibraryItem[];
}) {
  const t = useTranslations("admin.storage.library");
  const unused = items.filter((i) => i.usages.length === 0);
  return (
    <section aria-labelledby="storage-media-heading" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="storage-media-heading" className="font-mono text-label text-ink-muted">
          {t("heading")}
        </h2>
        <p className="text-sm text-ink-muted">
          {t("intro", {
            count: items.length,
            unused: unused.length,
            unusedSize: formatBytes(unused.reduce((sum, i) => sum + i.sizeBytes, 0)),
          })}
        </p>
        {!configured && <p className="text-sm text-ink-muted">{t("notConfigured")}</p>}
      </div>
      {items.length === 0 ? (
        <p className="rounded-card border border-dashed border-line bg-surface p-6 text-center text-sm text-ink-muted">
          {t("empty")}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <MediaCard key={item.id} item={item} canDelete={configured} />
          ))}
        </ul>
      )}
    </section>
  );
}

function MediaCard({ item, canDelete }: { item: MediaLibraryItem; canDelete: boolean }) {
  const t = useTranslations("admin.storage.library");
  const used = item.usages.length > 0;
  const usageId = useId();
  return (
    <li
      data-media-id={item.id}
      data-media-used={used ? "true" : "false"}
      className="flex flex-col overflow-hidden rounded-card border border-line bg-surface"
    >
      <span className="relative aspect-[16/10] bg-surface-2">
        <Image
          src={item.url}
          alt={item.alt}
          fill
          sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 100vw"
          className="object-cover"
        />
      </span>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          <p className="line-clamp-2 font-medium text-ink">{item.alt || t("noAlt")}</p>
          <p className="text-sm text-ink-muted tabular-nums">
            {formatBytes(item.sizeBytes)} · {item.width} × {item.height}
          </p>
        </div>
        <div id={usageId} className="flex flex-1 flex-col gap-1 text-sm">
          {used ? (
            <>
              <p className="text-ink-muted">{t("usedIn")}</p>
              <ul className="flex flex-col gap-0.5">
                {item.usages.map((usage, index) => (
                  <li key={index}>
                    <UsageLink usage={usage} />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <Badge variant="secondary" className="w-fit">
              {t("unused")}
            </Badge>
          )}
        </div>
        {used ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            aria-describedby={usageId}
            className="w-fit"
          >
            <Trash2 data-icon="inline-start" />
            {t("deleteBlocked")}
          </Button>
        ) : (
          <DeleteMedia item={item} disabled={!canDelete} />
        )}
      </div>
    </li>
  );
}

function UsageLink({ usage }: { usage: MediaUsage }) {
  const t = useTranslations("admin.storage.library.usage");
  const label =
    usage.type === "service"
      ? t("service", { title: usage.title })
      : usage.type === "portfolio"
        ? t("portfolio", { title: usage.title })
        : usage.slot === "other"
          ? t("other", { key: usage.key, path: usage.path })
          : t(`slots.${usage.slot}` as never);
  return (
    <NextLink href={usage.href} className="text-brand-deep underline-offset-4 hover:underline">
      {label}
    </NextLink>
  );
}

function DeleteMedia({ item, disabled }: { item: MediaLibraryItem; disabled: boolean }) {
  const t = useTranslations("admin.storage.library");
  const router = useRouter();
  const errorToast = useActionErrorToast();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <AlertDialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={disabled}
          className="w-fit"
          aria-label={t("deleteLabel", { alt: item.alt })}
        >
          <Trash2 data-icon="inline-start" />
          {t("delete")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("confirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("confirmBody", { alt: item.alt, size: formatBytes(item.sizeBytes) })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const result = await deleteMediaAsset({ id: item.id }).catch(() => null);
                if (!result?.ok) {
                  errorToast(result?.error ?? "generic");
                  setOpen(false);
                  router.refresh();
                  return;
                }
                setOpen(false);
                toast.success(t("deleted"));
                router.refresh();
              });
            }}
          >
            {pending ? t("deleting") : t("confirmDelete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
