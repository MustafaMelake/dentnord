"use client";

import { Check, RotateCcw, X } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DentistStatus } from "@/generated/prisma/enums";
import {
  approveDentist,
  reactivateDentist,
  rejectDentist,
  type ReviewResult,
} from "@/server/actions/admin-dentists";

type Decision = "approve" | "reject" | "reactivate";
type Dentist = { id: string; name: string; status: DentistStatus };

/** The decisions available for a status: approve/reject (pending), disable (approved), re-activate (rejected). */
export function DentistActions({
  dentist,
  size = "default",
}: {
  dentist: Dentist;
  size?: "sm" | "default";
}) {
  if (dentist.status === "PENDING") {
    return (
      <div className="flex flex-wrap gap-2">
        <ReviewDialog dentist={dentist} decision="approve" size={size} />
        <ReviewDialog dentist={dentist} decision="reject" size={size} />
      </div>
    );
  }
  if (dentist.status === "APPROVED")
    return <ReviewDialog dentist={dentist} decision="reject" size={size} />;
  return <ReviewDialog dentist={dentist} decision="reactivate" size={size} />;
}

const actions: Record<
  Decision,
  (input: { dentistId: string; reason?: string }) => Promise<ReviewResult>
> = {
  approve: approveDentist,
  reject: rejectDentist,
  reactivate: reactivateDentist,
};

function ReviewDialog({
  dentist,
  decision,
  size,
}: {
  dentist: Dentist;
  decision: Decision;
  size: "sm" | "default";
}) {
  const t = useTranslations("admin.dentists");
  const router = useRouter();
  const reasonId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  // Rejecting an approved dentist reads as "disable".
  const disabling = decision === "reject" && dentist.status === "APPROVED";
  const copy = {
    approve: {
      button: t("actions.approve"),
      title: t("actions.approveTitle", { name: dentist.name }),
      body: t("actions.approveBody"),
      done: t("actions.approved", { name: dentist.name }),
    },
    reject: {
      button: disabling ? t("actions.disable") : t("actions.reject"),
      title: disabling
        ? t("actions.disableTitle", { name: dentist.name })
        : t("actions.rejectTitle", { name: dentist.name }),
      body: disabling ? t("actions.disableBody") : t("actions.rejectBody"),
      done: t("actions.rejected", { name: dentist.name }),
    },
    reactivate: {
      button: t("actions.reactivate"),
      title: t("actions.reactivateTitle", { name: dentist.name }),
      body: t("actions.reactivateBody"),
      done: t("actions.reactivated", { name: dentist.name }),
    },
  }[decision];
  const Icon = decision === "approve" ? Check : decision === "reject" ? X : RotateCcw;

  function confirm(event: React.MouseEvent) {
    event.preventDefault(); // keep the dialog open until the action finishes
    startTransition(async () => {
      const result = await actions[decision]({
        dentistId: dentist.id,
        ...(decision === "reject" && reason.trim() ? { reason: reason.trim() } : {}),
      }).catch(() => null);
      if (!result?.ok) {
        toast.error(t(`errors.${result?.error ?? "generic"}`));
        if (result?.error === "invalidState" || result?.error === "notFound") {
          setOpen(false);
          router.refresh();
        }
        return;
      }
      setOpen(false);
      setReason("");
      toast.success(copy.done);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <AlertDialogTrigger asChild>
        <Button variant={decision === "reject" ? "outline" : "default"} size={size}>
          <Icon aria-hidden data-icon="inline-start" />
          {copy.button}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.body}</AlertDialogDescription>
        </AlertDialogHeader>
        {decision === "reject" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor={reasonId}>{t("actions.reasonLabel")}</Label>
            <Textarea
              id={reasonId}
              value={reason}
              maxLength={1000}
              rows={3}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t("actions.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant={decision === "reject" ? "destructive" : "default"}
            onClick={confirm}
            disabled={pending}
          >
            {pending ? t("actions.working") : copy.button}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
