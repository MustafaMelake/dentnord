"use client";

import { BellRing, CheckCircle2, PackageCheck, Send, Truck, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/shared/button";
import { FormAlert } from "@/components/shared/form-controls";
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
import { useRouter } from "@/i18n/navigation";
import { DENTIST_FILE_KINDS, FILE_RULES } from "@/lib/case-files";
import type { CaseStatusValue, TransitionId } from "@/lib/case-workflow-rules";
import { transitionCaseAction } from "@/server/actions/case-lifecycle";

import { UploadSlot } from "./upload-slot";
import { ZipHelp } from "./wizard/files-step";
import type { WizardFile } from "./wizard/types";
import { useCaseUploads } from "./wizard/use-case-uploads";

// The dentist's "Action needed" panel on a case page: whatever is their turn right now.
// - NEEDS_FILES: the lab's message, upload slots, then "send to Dentnord" (resubmit)
// - AWAITING_APPROVAL: approve the latest plan (with the confirmation) or request changes
// - SHIPPED: tracking, then "confirm delivery"
// - SUBMITTED / NEEDS_FILES: cancel the case
// Every button sends the status the dentist saw; if the case moved on meanwhile, the server says
// "stale" and we offer a refresh.

export function DentistCaseActions({
  caseId,
  locale,
  status,
  allowed,
  needsFilesNote,
  statusChangedAt,
  files: initialFiles,
  storageConfigured,
  latestPlan,
  shipping,
}: {
  caseId: string;
  locale: string;
  status: CaseStatusValue;
  allowed: TransitionId[];
  needsFilesNote: string | null;
  statusChangedAt: string | null;
  files: WizardFile[];
  storageConfigured: boolean;
  latestPlan: { id: string; version: number } | null;
  shipping: { carrier: string; trackingNumber: string; trackingUrl: string | null } | null;
}) {
  const t = useTranslations("cases.actions");
  const router = useRouter();
  const [pending, setPending] = useState<TransitionId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function run(
    transition: TransitionId,
    input: Record<string, unknown> = {},
    planId?: string,
  ) {
    setPending(transition);
    setError(null);
    setFieldErrors({});
    const result = await transitionCaseAction({
      locale,
      caseId,
      transition,
      expectedStatus: status,
      input,
      planId,
    }).catch(() => null);
    setPending(null);
    if (!result?.ok) {
      const code = result?.error ?? "network";
      setError(code);
      setFieldErrors(result && "fieldErrors" in result ? (result.fieldErrors ?? {}) : {});
      return false;
    }
    return true;
  }

  const errorBox = error && (
    <FormAlert>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {t.has(`errors.${error}` as "errors.generic")
          ? t(`errors.${error}` as "errors.generic")
          : t("errors.generic")}
        {error === "stale" && (
          <button type="button" className="font-medium underline" onClick={() => router.refresh()}>
            {t("refresh")}
          </button>
        )}
      </span>
    </FormAlert>
  );

  const canCancel = allowed.includes("cancelByDentist");
  const cancel = canCancel ? (
    <CancelCase
      pending={pending === "cancelByDentist"}
      onCancel={(reason) => run("cancelByDentist", { reason })}
    />
  ) : null;

  if (status === "NEEDS_FILES") {
    return (
      <NeedsFiles
        caseId={caseId}
        locale={locale}
        note={needsFilesNote}
        since={statusChangedAt}
        initialFiles={initialFiles}
        storageConfigured={storageConfigured}
        pending={pending === "resubmit"}
        onResubmit={() => run("resubmit")}
        error={errorBox}
        cancel={cancel}
      />
    );
  }

  if (status === "AWAITING_APPROVAL" && latestPlan) {
    return (
      <Banner
        icon={<BellRing className="size-5" />}
        title={t("approval.title", { version: latestPlan.version })}
        tone="action"
      >
        <p className="text-sm text-ink">{t("approval.body")}</p>
        <div className="flex flex-wrap gap-3 text-sm">
          <a href="#plans" className="font-medium text-brand hover:underline">
            {t("approval.toPlan")}
          </a>
          <a href="#viewer" className="font-medium text-brand hover:underline">
            {t("approval.toViewer")}
          </a>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ApproveForm
            pending={pending === "approvePlan"}
            error={fieldErrors.consent}
            onApprove={() => run("approvePlan", { consent: true }, latestPlan.id)}
          />
          <ChangesForm
            pending={pending === "requestChanges"}
            error={fieldErrors.comment}
            onSubmit={(comment) => run("requestChanges", { comment }, latestPlan.id)}
          />
        </div>
        {errorBox}
      </Banner>
    );
  }

  if (status === "SHIPPED") {
    return (
      <Banner icon={<Truck className="size-5" />} title={t("shipped.title")} tone="action">
        {shipping && <Shipping shipping={shipping} />}
        <div>
          <Button
            onClick={() => run("confirmDelivery")}
            disabled={pending !== null}
            data-action="confirmDelivery"
          >
            <span className="inline-flex items-center gap-2">
              <PackageCheck aria-hidden className="size-4" />
              {t("shipped.confirm")}
            </span>
          </Button>
        </div>
        {errorBox}
      </Banner>
    );
  }

  if (status === "DELIVERED" && shipping) {
    return (
      <Banner icon={<CheckCircle2 className="size-5" />} title={t("delivered.title")} tone="done">
        <Shipping shipping={shipping} />
      </Banner>
    );
  }

  if (cancel) {
    return (
      <div className="flex flex-col gap-2">
        {cancel}
        {errorBox}
      </div>
    );
  }
  return null;
}

function Banner({
  icon,
  title,
  tone,
  children,
}: {
  icon: ReactNode;
  title: string;
  tone: "action" | "done";
  children: ReactNode;
}) {
  return (
    <section
      data-action-needed={tone === "action" ? "" : undefined}
      className={
        tone === "action"
          ? "flex flex-col gap-4 rounded-card border border-brand/30 bg-brand-ice/60 p-5 sm:p-6"
          : "flex flex-col gap-4 rounded-card border border-line bg-surface p-5 sm:p-6"
      }
    >
      <h2 className="flex items-center gap-2 font-medium text-ink">
        <span aria-hidden className={tone === "action" ? "text-brand" : "text-[#2f8a57]"}>
          {icon}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Shipping({
  shipping,
}: {
  shipping: { carrier: string; trackingNumber: string; trackingUrl: string | null };
}) {
  const t = useTranslations("cases.actions.shipped");
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
      <div>
        <dt className="text-ink-muted">{t("carrier")}</dt>
        <dd className="text-ink">{shipping.carrier}</dd>
      </div>
      <div>
        <dt className="text-ink-muted">{t("trackingNumber")}</dt>
        <dd className="font-mono text-ink" data-tracking="">
          {shipping.trackingNumber}
        </dd>
      </div>
      {shipping.trackingUrl && (
        <div>
          <dt className="text-ink-muted">{t("tracking")}</dt>
          <dd>
            <a
              href={shipping.trackingUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="font-medium text-brand hover:underline"
            >
              {t("track")}
            </a>
          </dd>
        </div>
      )}
    </dl>
  );
}

function NeedsFiles({
  caseId,
  locale,
  note,
  since,
  initialFiles,
  storageConfigured,
  pending,
  onResubmit,
  error,
  cancel,
}: {
  caseId: string;
  locale: string;
  note: string | null;
  since: string | null;
  initialFiles: WizardFile[];
  storageConfigured: boolean;
  pending: boolean;
  onResubmit: () => Promise<boolean>;
  error: ReactNode;
  cancel: ReactNode;
}) {
  const t = useTranslations("cases.actions.needsFiles");
  const tFiles = useTranslations("cases.wizard.files");
  const [files, setFiles] = useState(initialFiles);
  const uploads = useCaseUploads({ caseId, onFilesChange: setFiles });
  const sinceTime = since ? new Date(since).getTime() : 0;
  const added = files.filter(
    (f) => f.uploadStatus === "COMPLETE" && new Date(f.createdAt).getTime() > sinceTime,
  ).length;
  const busy = uploads.uploading || uploads.live.some((l) => l.error);

  return (
    <Banner icon={<BellRing className="size-5" />} title={t("title")} tone="action">
      {note && (
        <figure className="rounded-xl border border-line bg-surface px-4 py-3">
          <figcaption className="text-xs text-ink-muted">{t("fromLab")}</figcaption>
          <p
            className="mt-1 text-sm [overflow-wrap:anywhere] whitespace-pre-wrap text-ink"
            data-needs-files-note=""
          >
            {note}
          </p>
        </figure>
      )}
      <p className="text-sm text-ink">{t("body")}</p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {DENTIST_FILE_KINDS.map((kind) => (
          <UploadSlot
            key={kind}
            kind={kind}
            title={tFiles(`slots.${kind}.title`)}
            extensions={FILE_RULES[kind].extensions}
            help={kind === "CBCT" ? <ZipHelp /> : undefined}
            locale={locale}
            // Earlier files are shown read-only; only new ones can still be cancelled.
            files={files.filter((f) => f.kind === kind)}
            live={uploads.live.filter((l) => l.kind === kind)}
            enabled={storageConfigured && uploads.ready}
            uploads={uploads}
            onFilesChange={setFiles}
            removeComplete={false}
          />
        ))}
      </div>
      <div className="flex flex-col gap-3 border-t border-brand/20 pt-4 sm:flex-row sm:items-center sm:justify-between">
        {cancel ?? <span />}
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          {!added && <p className="text-sm text-ink-muted">{t("addFirst")}</p>}
          <Button
            onClick={() => void onResubmit()}
            disabled={!added || busy || pending}
            data-action="resubmit"
          >
            <span className="inline-flex items-center gap-2">
              <Send aria-hidden className="size-4" />
              {t("send", { count: added })}
            </span>
          </Button>
        </div>
      </div>
      {error}
    </Banner>
  );
}

function ApproveForm({
  pending,
  error,
  onApprove,
}: {
  pending: boolean;
  error?: string;
  onApprove: () => Promise<boolean>;
}) {
  const t = useTranslations("cases.actions.approval");
  const tPlans = useTranslations("cases.plans");
  const [checked, setChecked] = useState(false);
  const [missing, setMissing] = useState(false);
  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!checked) return setMissing(true);
        void onApprove();
      }}
    >
      <h3 className="font-medium text-ink">{t("approveTitle")}</h3>
      <label className="flex items-start gap-3 text-sm leading-snug text-ink">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => {
            setChecked(e.target.checked);
            setMissing(false);
          }}
          aria-invalid={missing || !!error || undefined}
          className="mt-0.5 size-[1.125rem] shrink-0 accent-brand"
          data-approve-consent=""
        />
        {tPlans("approveStatement")}
      </label>
      {(missing || error) && (
        <p role="alert" className="text-sm text-destructive">
          {t("consentRequired")}
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending} data-action="approvePlan">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 aria-hidden className="size-4" />
            {t("approve")}
          </span>
        </Button>
      </div>
    </form>
  );
}

function ChangesForm({
  pending,
  error,
  onSubmit,
}: {
  pending: boolean;
  error?: string;
  onSubmit: (comment: string) => Promise<boolean>;
}) {
  const t = useTranslations("cases.actions.approval");
  const [comment, setComment] = useState("");
  const [missing, setMissing] = useState(false);
  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!comment.trim()) return setMissing(true);
        void onSubmit(comment);
      }}
    >
      <h3 className="font-medium text-ink">{t("changesTitle")}</h3>
      <label htmlFor="changes-comment" className="text-sm text-ink-muted">
        {t("changesHint")}
      </label>
      <textarea
        id="changes-comment"
        value={comment}
        onChange={(e) => {
          setComment(e.target.value);
          setMissing(false);
        }}
        maxLength={2000}
        rows={3}
        aria-invalid={missing || !!error || undefined}
        className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink"
      />
      {(missing || error) && (
        <p role="alert" className="text-sm text-destructive">
          {t("commentRequired")}
        </p>
      )}
      <div>
        <Button type="submit" variant="secondary" disabled={pending} data-action="requestChanges">
          {t("requestChanges")}
        </Button>
      </div>
    </form>
  );
}

function CancelCase({
  pending,
  onCancel,
}: {
  pending: boolean;
  onCancel: (reason: string) => Promise<boolean>;
}) {
  const t = useTranslations("cases.actions.cancel");
  const [reason, setReason] = useState("");
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          disabled={pending}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-muted hover:text-destructive"
          data-action="cancelByDentist"
        >
          <XCircle aria-hidden className="size-4" />
          {t("button")}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("body")}</AlertDialogDescription>
        </AlertDialogHeader>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-ink-muted">{t("reason")}</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={1000}
            rows={2}
            className="rounded-xl border border-line bg-surface px-3 py-2 text-ink"
          />
        </label>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("keep")}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => void onCancel(reason)}>
            {t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
