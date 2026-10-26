"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteDentist } from "@/server/actions/admin-dentists";

// GDPR erasure of a dentist (server/services/dentist-erasure.ts). The admin types the dentist's email
// to confirm; the button stays disabled until it matches, and the server checks it again.

export type ErasureSummary = {
  cases: number;
  drafts: number;
  open: number;
  files: number;
  size: string;
  messages: number;
};

export function DentistErase({
  dentist,
  summary,
}: {
  dentist: { id: string; name: string; email: string };
  summary: ErasureSummary;
}) {
  const t = useTranslations("admin.dentists.erase");
  const tErrors = useTranslations("admin.dentists.errors");
  const router = useRouter();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();
  const matches = typed.trim().toLowerCase() === dentist.email.toLowerCase();

  function confirm(event: React.MouseEvent) {
    event.preventDefault(); // keep the dialog open until the action finishes
    if (!matches) return;
    startTransition(async () => {
      const result = await deleteDentist({ dentistId: dentist.id, confirmEmail: typed }).catch(
        () => null,
      );
      if (!result?.ok) {
        toast.error(tErrors(result?.error ?? "generic"));
        if (result?.error === "notFound") router.push("/admin/dentists");
        return;
      }
      setOpen(false);
      toast.success(t("deleted", { name: dentist.name }));
      router.push("/admin/dentists");
      router.refresh();
    });
  }

  return (
    <section
      aria-labelledby="erase-heading"
      className="flex flex-col gap-3 rounded-card border border-destructive/25 bg-surface p-5 sm:p-6"
    >
      <h2 id="erase-heading" className="font-mono text-label text-destructive">
        {t("title")}
      </h2>
      <p className="max-w-3xl text-sm text-ink-muted">{t("intro", summary)}</p>
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (pending) return;
          setOpen(next);
          if (!next) setTyped("");
        }}
      >
        <AlertDialogTrigger asChild>
          <Button variant="destructive" className="w-fit">
            <Trash2 aria-hidden data-icon="inline-start" />
            {t("button")}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmTitle", { name: dentist.name })}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirmBody", summary)}</AlertDialogDescription>
          </AlertDialogHeader>
          {summary.open > 0 && (
            <p className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">
              {t("openCases", { count: summary.open })}
            </p>
          )}
          <p className="text-sm text-muted-foreground">{t("retention")}</p>
          <div className="flex flex-col gap-2">
            <Label htmlFor={inputId}>{t("confirmLabel", { email: dentist.email })}</Label>
            <Input
              id={inputId}
              value={typed}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setTyped(event.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirm}
              disabled={pending || !matches}
            >
              {pending ? t("working") : t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
