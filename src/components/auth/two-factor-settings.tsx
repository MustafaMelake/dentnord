"use client";

import { KeyRound, ShieldCheck, ShieldOff } from "lucide-react";
import { useTranslations } from "next-intl";
import NextLink from "next/link";
import { useState } from "react";

import { Button, buttonStyles } from "@/components/shared/button";
import {
  describedBy,
  FormAlert,
  FormField,
  SubmitButton,
  TextInput,
} from "@/components/shared/form-controls";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";
import { hardNavigate } from "@/lib/hard-navigate";

import { twoFactorErrorKey, type TwoFactorErrorKey } from "./auth-errors";
import { BackupCodes } from "./backup-codes";

// Two-factor authentication on the account pages (dentist portal and admin). Off: a link to the
// setup page. On: new backup codes, and (dentists only) turning it off. Both ask for the password
// again (Better Auth checks it). Admins can't turn it off (lib/auth.ts refuses /two-factor/disable).

export function TwoFactorSettings({
  enabled,
  email,
  setupHref,
  canDisable,
}: {
  enabled: boolean;
  email: string;
  setupHref: string;
  canDisable: boolean;
}) {
  const t = useTranslations("twoFactor.settings");

  if (!enabled) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <ShieldOff aria-hidden className="size-4" />
          {t("statusOff")}
        </p>
        <NextLink href={setupHref} className={buttonStyles({ variant: "primary" })}>
          {t("setUp")}
        </NextLink>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-4" data-two-factor="on">
      <p className="flex items-start gap-2 text-sm text-ink">
        <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
        {t("statusOn")}
      </p>
      <div className="flex flex-wrap gap-2">
        <PasswordAction kind="regenerate" email={email} />
        {canDisable && <PasswordAction kind="disable" email={email} />}
      </div>
    </div>
  );
}

function PasswordAction({ kind, email }: { kind: "regenerate" | "disable"; email: string }) {
  const t = useTranslations("twoFactor.settings");
  const tErrors = useTranslations("twoFactor.errors");
  const tFields = useTranslations("auth.fields");
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<TwoFactorErrorKey | null>(null);
  const [pending, setPending] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const id = `${kind}-password`;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!password) return setError("wrongPassword");
    setError(null);
    setPending(true);
    const result =
      kind === "regenerate"
        ? await authClient.twoFactor.generateBackupCodes({ password })
        : await authClient.twoFactor.disable({ password });
    if (result.error) {
      setPending(false);
      return setError(twoFactorErrorKey(result.error));
    }
    setPassword("");
    setPending(false);
    if (kind === "disable") return hardNavigate(window.location.pathname); // session was replaced
    setCodes((result.data as { backupCodes?: string[] }).backupCodes ?? []);
  }

  function onOpenChange(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (!next) {
      setPassword("");
      setError(null);
      setCodes(null);
    }
  }

  const message = error ? tErrors(error) : undefined;
  const fieldError = error === "wrongPassword";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <span className="inline-flex items-center gap-2">
            {kind === "regenerate" ? (
              <KeyRound aria-hidden className="size-4" />
            ) : (
              <ShieldOff aria-hidden className="size-4" />
            )}
            {kind === "regenerate" ? t("regenerate") : t("disable")}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {kind === "regenerate" ? t("regenerateTitle") : t("disableTitle")}
          </DialogTitle>
          <DialogDescription>
            {codes
              ? t("regeneratedBody")
              : kind === "regenerate"
                ? t("regenerateBody")
                : t("disableBody")}
          </DialogDescription>
        </DialogHeader>
        {codes ? (
          <div className="flex flex-col gap-4">
            <BackupCodes codes={codes} email={email} />
            <Button type="button" onClick={() => onOpenChange(false)} className="sm:w-fit">
              {t("done")}
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <FormField id={id} label={tFields("password")} error={fieldError ? message : undefined}>
              <TextInput
                id={id}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                {...describedBy(id, fieldError ? message : undefined)}
              />
            </FormField>
            {error && !fieldError && <FormAlert>{message}</FormAlert>}
            <SubmitButton pending={pending} pendingLabel={t("working")} className="sm:w-fit">
              {kind === "regenerate" ? t("regenerateConfirm") : t("disableConfirm")}
            </SubmitButton>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
