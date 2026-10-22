"use client";

import { FilePen, Trash2 } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { ButtonLink } from "@/components/shared/button";
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
import { localized } from "@/lib/utils";
import { deleteDraftCase } from "@/server/actions/cases";
import type { CaseListRow } from "@/server/queries/cases";

/** Unsent drafts: continue in the wizard, or delete (with every uploaded file). */
export function DraftList({ drafts }: { drafts: CaseListRow[] }) {
  const t = useTranslations("cases.drafts");
  const locale = useLocale();
  const format = useFormatter();
  const [deleting, setDeleting] = useState<string | null>(null);

  async function remove(id: string) {
    setDeleting(id);
    const result = await deleteDraftCase(locale, { caseId: id }).catch(() => null);
    setDeleting(null);
    if (!result?.ok) {
      toast.error(t("deleteFailed"));
      return;
    }
    toast.success(t("deleted")); // the action refresh()es the list
  }

  return (
    <ul className="flex flex-col gap-3">
      {drafts.map((d) => (
        <li
          key={d.id}
          data-draft={d.id}
          className="flex flex-col gap-3 rounded-card border border-dashed border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-muted"
            >
              <FilePen className="size-4" />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-medium text-ink">
                {d.patientCode ? <span className="font-mono">{d.patientCode}</span> : t("untitled")}
              </span>
              <span className="text-sm text-ink-muted">
                {[
                  d.guideTypeName ? localized(d.guideTypeName, locale) : null,
                  t("implants", { count: d.implantCount }),
                  t("saved", {
                    date: format.dateTime(new Date(d.updatedAt), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }),
                  }),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <ButtonLink
              href={`/portal/cases/${d.id}/edit`}
              variant="secondary"
              className="h-10 flex-1 px-4 sm:flex-none"
            >
              {t("continue")}
            </ButtonLink>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  disabled={deleting === d.id}
                  aria-label={t("deleteLabel", { name: d.patientCode || t("untitled") })}
                  className="flex size-10 items-center justify-center rounded-full border border-line text-ink-muted transition-colors hover:border-destructive/40 hover:text-destructive disabled:opacity-50"
                >
                  <Trash2 aria-hidden className="size-4" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("confirmTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("confirmBody")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={() => remove(d.id)}>
                    {t("confirm")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </li>
      ))}
    </ul>
  );
}
