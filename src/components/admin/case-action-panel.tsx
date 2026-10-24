"use client";

import {
  Ban,
  ClipboardList,
  Factory,
  FilePlus2,
  PackageCheck,
  Send,
  Truck,
  Upload,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { UploadSlot } from "@/components/cases/upload-slot";
import type { WizardFile } from "@/components/cases/wizard/types";
import { useCaseUploads } from "@/components/cases/wizard/use-case-uploads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CaseStatusValue, TransitionId } from "@/lib/case-workflow-rules";
import { LAB_FILE_KINDS, LAB_FILE_RULES } from "@/lib/upload-permissions";
import {
  savePlanNoteAction,
  startPlanVersionAction,
  transitionCaseAction,
} from "@/server/actions/case-lifecycle";
import type { PlanView } from "@/server/services/case-plans";

// The admin's action panel on a case: ONLY the transitions the workflow allows right now
// (lib/case-workflow-rules.ts), each with the fields it needs, plus plan preparation while the case
// is in planning. The server re-checks everything; a stale page gets "please refresh".

export function CaseActionPanel({
  caseId,
  status,
  allowed,
  plans,
  storageConfigured,
}: {
  caseId: string;
  status: CaseStatusValue;
  allowed: TransitionId[];
  plans: PlanView[];
  storageConfigured: boolean;
}) {
  const t = useTranslations("admin.lifecycle");
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(transition: TransitionId, input: Record<string, unknown> = {}) {
    setPending(transition);
    setError(null);
    const result = await transitionCaseAction({
      locale: "en",
      caseId,
      transition,
      expectedStatus: status,
      input,
    }).catch(() => null);
    setPending(null);
    if (!result?.ok) {
      setError(result?.error ?? "network");
      return false;
    }
    toast.success(t("done"));
    return true;
  }

  const openPlan = plans.find((p) => !p.sentAt) ?? null;
  const preparing = status === "IN_PLANNING" || status === "CHANGES_REQUESTED";
  const actions = allowed.filter((a) => a !== "sendPlan");

  return (
    <section
      aria-labelledby="actions-heading"
      data-admin-actions=""
      className="flex flex-col gap-5 rounded-card border border-brand/30 bg-brand-ice/40 p-5 sm:p-6"
    >
      <h2 id="actions-heading" className="flex items-center gap-2 font-medium text-ink">
        <ClipboardList aria-hidden className="size-4 text-brand" />
        {t("title")}
      </h2>

      {actions.length === 0 && !preparing && (
        <p className="text-sm text-muted-foreground">{t("nothing")}</p>
      )}

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {t.has(`errors.${error}` as "errors.generic")
            ? t(`errors.${error}` as "errors.generic")
            : t("errors.generic")}
          {error === "stale" && (
            <button
              type="button"
              className="font-medium underline"
              onClick={() => router.refresh()}
            >
              {t("refresh")}
            </button>
          )}
        </div>
      )}

      {preparing && (
        <PlanPreparation
          caseId={caseId}
          status={status}
          plan={openPlan}
          nextVersion={(plans[0]?.version ?? 0) + (openPlan ? 0 : 1)}
          storageConfigured={storageConfigured}
          canSend={allowed.includes("sendPlan")}
          sending={pending === "sendPlan"}
          onSend={() => run("sendPlan")}
        />
      )}

      <div className="flex flex-col gap-4">
        {actions.includes("startPlanning") && (
          <ActionRow
            icon={<FilePlus2 className="size-4" />}
            title={t("startPlanning.title")}
            description={t(
              status === "CHANGES_REQUESTED" ? "startPlanning.again" : "startPlanning.description",
            )}
          >
            <Button
              onClick={() => run("startPlanning")}
              disabled={!!pending}
              data-action="startPlanning"
            >
              {t("startPlanning.button")}
            </Button>
          </ActionRow>
        )}
        {actions.includes("requestFiles") && (
          <TextAction
            id="requestFiles"
            icon={<Upload className="size-4" />}
            title={t("requestFiles.title")}
            description={t("requestFiles.description")}
            label={t("requestFiles.label")}
            button={t("requestFiles.button")}
            pending={pending === "requestFiles"}
            onSubmit={(message) => run("requestFiles", { message })}
          />
        )}
        {actions.includes("startProduction") && (
          <ActionRow
            icon={<Factory className="size-4" />}
            title={t("startProduction.title")}
            description={t("startProduction.description")}
          >
            <Button
              onClick={() => run("startProduction")}
              disabled={!!pending}
              data-action="startProduction"
            >
              {t("startProduction.button")}
            </Button>
          </ActionRow>
        )}
        {actions.includes("ship") && (
          <ShipForm pending={pending === "ship"} onSubmit={(input) => run("ship", input)} />
        )}
        {actions.includes("confirmDelivery") && (
          <ActionRow
            icon={<PackageCheck className="size-4" />}
            title={t("confirmDelivery.title")}
            description={t("confirmDelivery.description")}
          >
            <Button
              variant="outline"
              onClick={() => run("confirmDelivery")}
              disabled={!!pending}
              data-action="confirmDelivery"
            >
              {t("confirmDelivery.button")}
            </Button>
          </ActionRow>
        )}
        {actions.includes("cancelByAdmin") && (
          <TextAction
            id="cancelByAdmin"
            icon={<Ban className="size-4" />}
            title={t("cancel.title")}
            description={t("cancel.description")}
            label={t("cancel.label")}
            button={t("cancel.button")}
            destructive
            pending={pending === "cancelByAdmin"}
            onSubmit={(reason) => run("cancelByAdmin", { reason })}
          />
        )}
      </div>
    </section>
  );
}

function ActionRow({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-2">
        <span aria-hidden className="mt-0.5 text-brand">
          {icon}
        </span>
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-medium text-ink">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function TextAction({
  id,
  icon,
  title,
  description,
  label,
  button,
  destructive,
  pending,
  onSubmit,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  description: string;
  label: string;
  button: string;
  destructive?: boolean;
  pending: boolean;
  onSubmit: (text: string) => Promise<boolean>;
}) {
  const t = useTranslations("admin.lifecycle");
  const [text, setText] = useState("");
  const [missing, setMissing] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return setMissing(true);
    if (await onSubmit(text)) setText("");
  }
  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
      data-form={id}
    >
      <div className="flex items-start gap-2">
        <span aria-hidden className={destructive ? "mt-0.5 text-destructive" : "mt-0.5 text-brand"}>
          {icon}
        </span>
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-medium text-ink">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <label htmlFor={`${id}-text`} className="text-sm font-medium">
        {label}
      </label>
      <Textarea
        id={`${id}-text`}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setMissing(false);
        }}
        maxLength={2000}
        rows={3}
        aria-invalid={missing || undefined}
      />
      {missing && (
        <p role="alert" className="text-sm text-destructive">
          {t("required")}
        </p>
      )}
      <div>
        <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={pending}>
          {button}
        </Button>
      </div>
    </form>
  );
}

function ShipForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (input: {
    carrier: string;
    trackingNumber: string;
    trackingUrl: string;
  }) => Promise<boolean>;
}) {
  const t = useTranslations("admin.lifecycle.ship");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [missing, setMissing] = useState(false);
  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
      data-form="ship"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!carrier.trim() || !trackingNumber.trim()) return setMissing(true);
        await onSubmit({ carrier, trackingNumber, trackingUrl });
      }}
    >
      <div className="flex items-start gap-2">
        <Truck aria-hidden className="mt-0.5 size-4 text-brand" />
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-medium text-ink">{t("title")}</h3>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("carrier")}
          <Input
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            maxLength={80}
            name="carrier"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("trackingNumber")}
          <Input
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            maxLength={80}
            name="trackingNumber"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
          {t("trackingUrl")}
          <Input
            value={trackingUrl}
            onChange={(e) => setTrackingUrl(e.target.value)}
            maxLength={500}
            type="url"
            placeholder="https://"
            name="trackingUrl"
          />
        </label>
      </div>
      {missing && (
        <p role="alert" className="text-sm text-destructive">
          {t("required")}
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {t("button")}
        </Button>
      </div>
    </form>
  );
}

function PlanPreparation({
  caseId,
  status,
  plan,
  nextVersion,
  storageConfigured,
  canSend,
  sending,
  onSend,
}: {
  caseId: string;
  status: CaseStatusValue;
  plan: PlanView | null;
  nextVersion: number;
  storageConfigured: boolean;
  canSend: boolean;
  sending: boolean;
  onSend: () => Promise<boolean>;
}) {
  const t = useTranslations("admin.lifecycle.plan");
  const [starting, setStarting] = useState(false);

  if (!plan) {
    return (
      <ActionRow
        icon={<FilePlus2 className="size-4" />}
        title={t("startTitle", { version: nextVersion })}
        description={t("startDescription")}
      >
        <Button
          disabled={starting}
          data-action="startPlanVersion"
          onClick={async () => {
            setStarting(true);
            const result = await startPlanVersionAction({ caseId }).catch(() => null);
            setStarting(false);
            if (!result?.ok) toast.error(t("startFailed"));
          }}
        >
          {t("start", { version: nextVersion })}
        </Button>
      </ActionRow>
    );
  }
  return (
    <PreparePlan
      key={plan.id}
      caseId={caseId}
      status={status}
      plan={plan}
      storageConfigured={storageConfigured}
      canSend={canSend}
      sending={sending}
      onSend={onSend}
    />
  );
}

function PreparePlan({
  caseId,
  status,
  plan,
  storageConfigured,
  canSend,
  sending,
  onSend,
}: {
  caseId: string;
  status: CaseStatusValue;
  plan: PlanView;
  storageConfigured: boolean;
  canSend: boolean;
  sending: boolean;
  onSend: () => Promise<boolean>;
}) {
  const t = useTranslations("admin.lifecycle.plan");
  const [files, setFiles] = useState<WizardFile[]>(plan.files);
  const uploads = useCaseUploads({ caseId, planId: plan.id, onFilesChange: setFiles });
  const [note, setNote] = useState({ da: plan.note?.da ?? "", en: plan.note?.en ?? "" });
  const [savedNote, setSavedNote] = useState(note);
  const hasReport = files.some((f) => f.kind === "PLAN_REPORT" && f.uploadStatus === "COMPLETE");
  const busy = uploads.uploading || files.some((f) => f.uploadStatus !== "COMPLETE");
  const noteDirty = note.da !== savedNote.da || note.en !== savedNote.en;

  async function saveNote() {
    const result = await savePlanNoteAction({ planId: plan.id, note }).catch(() => null);
    if (!result?.ok) {
      toast.error(t("noteFailed"));
      return false;
    }
    setSavedNote(note);
    return true;
  }

  return (
    <div
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4"
      data-plan-prep={plan.version}
    >
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-medium text-ink">
          {t("preparing", { version: plan.version })}
        </h3>
        <p className="text-sm text-muted-foreground">{t("preparingDescription")}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {LAB_FILE_KINDS.map((kind) => (
          <UploadSlot
            key={kind}
            kind={kind}
            title={t(`files.${kind}.title`)}
            description={t(`files.${kind}.description`)}
            extensions={LAB_FILE_RULES[kind].extensions}
            required={kind === "PLAN_REPORT"}
            locale="en"
            files={files.filter((f) => f.kind === kind)}
            live={uploads.live.filter((l) => l.kind === kind)}
            enabled={storageConfigured && uploads.ready}
            uploads={uploads}
            onFilesChange={setFiles}
          />
        ))}
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t("note")}</legend>
        <p className="text-xs text-muted-foreground">{t("noteHint")}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(["da", "en"] as const).map((lang) => (
            <label key={lang} className="flex flex-col gap-1">
              <span className="font-mono text-xs text-muted-foreground">{lang.toUpperCase()}</span>
              <Textarea
                value={note[lang]}
                onChange={(e) => setNote({ ...note, [lang]: e.target.value })}
                maxLength={2000}
                rows={3}
                name={`note-${lang}`}
              />
            </label>
          ))}
        </div>
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={saveNote}
            disabled={!noteDirty}
          >
            {t("saveNote")}
          </Button>
        </div>
      </fieldset>
      <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {status === "CHANGES_REQUESTED"
            ? t("moveToPlanningFirst")
            : !hasReport
              ? t("reportRequired")
              : busy
                ? t("waitForUploads")
                : t("readyToSend")}
        </p>
        <Button
          disabled={!canSend || !hasReport || busy || sending}
          data-action="sendPlan"
          onClick={async () => {
            if (noteDirty && !(await saveNote())) return;
            await onSend();
          }}
        >
          <Send aria-hidden className="size-4" />
          {t("send")}
        </Button>
      </div>
    </div>
  );
}
