"use client";

import { Check, Copy, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

import {
  describedBy,
  FormAlert,
  FormField,
  SubmitButton,
  TextInput,
} from "@/components/shared/form-controls";
import { Button } from "@/components/shared/button";
import { authClient } from "@/lib/auth-client";
import { hardNavigate } from "@/lib/hard-navigate";

import { twoFactorErrorKey, type TwoFactorErrorKey } from "./auth-errors";
import { BackupCodes } from "./backup-codes";

// Turning on two-factor authentication (TOTP), through Better Auth's endpoints:
// 1. password → /two-factor/enable: creates an unverified secret + backup codes
// 2. scan the QR code (or type the key), enter a code → /two-factor/verify-totp: 2FA is on, the
//    session is replaced and every other session is signed out (lib/auth.ts hooks.after)
// 3. save the backup codes → continue to `next` (a full page load: the session cookie changed)

type Enrolment = { totpURI: string; backupCodes: string[] };

/** The base32 key inside an otpauth:// URI, in groups of four for typing. */
function manualKey(uri: string) {
  const secret = new URL(uri).searchParams.get("secret") ?? "";
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

export function TwoFactorSetup({
  email,
  next,
  required,
}: {
  email: string;
  /** Where to go when done (already checked server-side). */
  next: string;
  /** Admin accounts: 2FA is mandatory, say so. */
  required: boolean;
}) {
  const t = useTranslations("twoFactor.setup");
  const tErrors = useTranslations("twoFactor.errors");
  const tFields = useTranslations("auth.fields");
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [verified, setVerified] = useState(false);
  const [saved, setSaved] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<TwoFactorErrorKey | null>(null);
  const [pending, setPending] = useState(false);

  async function start(event: React.FormEvent) {
    event.preventDefault();
    if (!password) return setError("wrongPassword");
    setError(null);
    setPending(true);
    const { data, error } = await authClient.twoFactor
      .enable({ password })
      .catch(() => ({ data: null, error: { status: 0, code: undefined } }));
    setPending(false);
    if (error || !data || !("totpURI" in data) || !data.totpURI) {
      return setError(twoFactorErrorKey(error));
    }
    setPassword("");
    setEnrolment({ totpURI: data.totpURI, backupCodes: data.backupCodes ?? [] });
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    const value = code.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(value)) return setError("codeFormat");
    setError(null);
    setPending(true);
    const { error } = await authClient.twoFactor
      .verifyTotp({ code: value })
      .catch(() => ({ error: { status: 0, code: undefined } }));
    setPending(false);
    if (error) {
      setCode("");
      return setError(twoFactorErrorKey(error));
    }
    setVerified(true);
  }

  const message = error ? tErrors(error) : undefined;
  const fieldError = error === "invalidCode" || error === "codeFormat" || error === "wrongPassword";

  if (verified && enrolment) {
    return (
      <div className="flex flex-col gap-6" data-step="backup-codes">
        <FormAlert tone="success">{t("enabled")}</FormAlert>
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-medium text-ink">{t("backupTitle")}</h2>
          <p className="text-sm text-ink-muted">{t("backupBody")}</p>
        </div>
        <BackupCodes codes={enrolment.backupCodes} email={email} />
        <label className="flex items-start gap-3 text-sm text-ink">
          <input
            type="checkbox"
            checked={saved}
            onChange={(event) => setSaved(event.target.checked)}
            className="mt-0.5 size-4 accent-brand"
          />
          {t("savedConfirm")}
        </label>
        <Button type="button" size="lg" disabled={!saved} onClick={() => hardNavigate(next)}>
          {t("continue")}
        </Button>
      </div>
    );
  }

  if (enrolment) {
    return (
      <form onSubmit={verify} noValidate className="flex flex-col gap-6" data-step="scan">
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-ink">{t("scanTitle")}</h2>
          <p className="text-sm text-ink-muted">{t("scanBody")}</p>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <QrImage uri={enrolment.totpURI} alt={t("qrAlt")} />
            <ManualKey uri={enrolment.totpURI} />
          </div>
        </div>
        <FormField id="code" label={t("codeLabel")} error={fieldError ? message : undefined}>
          <TextInput
            id="code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={8}
            spellCheck={false}
            className="font-mono tracking-widest sm:max-w-48"
            {...describedBy("code", fieldError ? message : undefined)}
          />
        </FormField>
        {error && !fieldError && <FormAlert>{message}</FormAlert>}
        <SubmitButton pending={pending} pendingLabel={t("verifying")} className="sm:w-fit">
          {t("verify")}
        </SubmitButton>
      </form>
    );
  }

  return (
    <form onSubmit={start} noValidate className="flex flex-col gap-5" data-step="password">
      <FormAlert tone="info">{required ? t("introRequired") : t("intro")}</FormAlert>
      <p className="text-sm text-ink-muted">{t("passwordStep")}</p>
      <FormField
        id="current-password"
        label={tFields("password")}
        error={fieldError ? message : undefined}
      >
        <TextInput
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          {...describedBy("current-password", fieldError ? message : undefined)}
        />
      </FormField>
      {error && !fieldError && <FormAlert>{message}</FormAlert>}
      <SubmitButton pending={pending} pendingLabel={t("starting")} size="lg">
        {t("start")}
      </SubmitButton>
    </form>
  );
}

/** The otpauth:// URI as a QR code (SVG, rendered in the browser; the secret never leaves it). */
function QrImage({ uri, alt }: { uri: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toString(uri, { type: "svg", margin: 1, errorCorrectionLevel: "M" })
      .then((svg) => live && setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`))
      .catch(() => live && setSrc(null));
    return () => {
      live = false;
    };
  }, [uri]);
  return (
    <div className="flex size-48 shrink-0 items-center justify-center rounded-xl border border-line bg-white p-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL, nothing to optimise */}
      {src && <img src={src} alt={alt} width={176} height={176} data-qr />}
    </div>
  );
}

function ManualKey({ uri }: { uri: string }) {
  const t = useTranslations("twoFactor.setup");
  const [copied, setCopied] = useState(false);
  const key = manualKey(uri);

  async function copy() {
    await navigator.clipboard.writeText(key.replace(/\s+/g, "")).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex min-w-0 flex-col gap-2 text-sm">
      <p className="text-ink-muted">{t("manualLabel")}</p>
      <code data-manual-key className="font-mono text-[0.9375rem] break-all text-ink">
        {key}
      </code>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 text-brand underline-offset-4 hover:underline"
        >
          {copied ? (
            <Check aria-hidden className="size-3.5" />
          ) : (
            <Copy aria-hidden className="size-3.5" />
          )}
          {copied ? t("copied") : t("copyKey")}
        </button>
        {/* On a phone, this opens the authenticator app directly. */}
        <a
          href={uri}
          className="inline-flex items-center gap-1.5 text-brand underline-offset-4 hover:underline"
        >
          <Smartphone aria-hidden className="size-3.5" />
          {t("openApp")}
        </a>
      </div>
    </div>
  );
}
