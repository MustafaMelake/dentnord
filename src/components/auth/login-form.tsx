"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import {
  describedBy,
  FormAlert,
  FormField,
  SubmitButton,
  TextInput,
  useFieldError,
} from "@/components/shared/form-controls";
import { Link } from "@/i18n/navigation";
import { hardNavigate } from "@/lib/hard-navigate";
import { authClient, signIn } from "@/lib/auth-client";
import { postLoginPath } from "@/lib/redirects";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";

import { authErrorKey, twoFactorErrorKey, type AuthErrorKey } from "./auth-errors";

type LoggedInUser = Parameters<typeof postLoginPath>[0];

/** Full page load to where this user belongs (`?next=` is read now, so the form prerenders). */
function goAfterLogin(user: LoggedInUser, locale: string) {
  const next = new URLSearchParams(window.location.search).get("next");
  // Full page load: the destination may be a different root layout (/admin).
  hardNavigate(postLoginPath(user, locale, next));
}

export function LoginForm({ contactEmail }: { contactEmail: string }) {
  const t = useTranslations("auth");
  const fieldError = useFieldError();
  const locale = useLocale();
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  // Password accepted, but the account has 2FA: Better Auth asks for a code before the session.
  const [needsCode, setNeedsCode] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setError(null);
    // No callbackURL here: Better Auth would answer a successful login with a redirect to it.
    const { data, error } = await signIn
      .email({ email: values.email, password: values.password })
      .catch(() => ({ data: null, error: { status: 0 } }));
    if (error || !data) {
      const key = authErrorKey(error, "login");
      // EMAIL_VERIFICATION=on, right password, address not confirmed: send a fresh link back here.
      if (key === "emailNotVerified") {
        await authClient
          .sendVerificationEmail({
            email: values.email,
            callbackURL: `/${locale}/login?verified=1`,
          })
          .catch(() => undefined);
      }
      setError(key);
      return;
    }
    if ("twoFactorRedirect" in data && data.twoFactorRedirect) {
      setNeedsCode(true);
      return;
    }
    setRedirecting(true);
    goAfterLogin((data as { user: LoggedInUser }).user, locale);
  }

  const emailError = fieldError(errors.email);
  const passwordError = fieldError(errors.password);
  const busy = isSubmitting || redirecting;

  if (needsCode) return <TwoFactorStep onRestart={() => setNeedsCode(false)} />;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {error && (
        <FormAlert>
          {error === "accountRejected"
            ? t("errors.accountRejected", { email: contactEmail })
            : t(`errors.${error}`)}
        </FormAlert>
      )}
      <FormField id="email" label={t("fields.email")} error={emailError}>
        <TextInput
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          {...describedBy("email", emailError)}
          {...register("email")}
        />
      </FormField>
      <FormField id="password" label={t("fields.password")} error={passwordError}>
        <TextInput
          id="password"
          type="password"
          autoComplete="current-password"
          {...describedBy("password", passwordError)}
          {...register("password")}
        />
      </FormField>
      <div className="-mt-2 flex justify-end">
        <Link
          href="/forgot-password"
          className="text-sm text-brand underline-offset-4 hover:underline"
        >
          {t("login.forgot")}
        </Link>
      </div>
      <SubmitButton pending={busy} pendingLabel={t("login.submitting")} size="lg">
        {t("login.submit")}
      </SubmitButton>
    </form>
  );
}

/**
 * Second login step for accounts with 2FA: a code from the authenticator app, or a backup code.
 * Better Auth keeps the pending login in a signed cookie for 10 minutes and allows 5 tries per login
 * (10 in a row per account before a 15-minute lock); after that the user starts again.
 */
function TwoFactorStep({ onRestart }: { onRestart: () => void }) {
  const t = useTranslations("twoFactor");
  const locale = useLocale();
  const [mode, setMode] = useState<"app" | "backup">("app");
  const [code, setCode] = useState("");
  const [error, setError] = useState<ReturnType<typeof twoFactorErrorKey> | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = mode === "app" ? code.replace(/\s+/g, "") : code.trim();
    if (mode === "app" ? !/^\d{6}$/.test(value) : value.length < 6) {
      setError("codeFormat");
      return;
    }
    setError(null);
    setPending(true);
    const verify =
      mode === "app" ? authClient.twoFactor.verifyTotp : authClient.twoFactor.verifyBackupCode;
    const { data, error } = await verify({ code: value }).catch(() => ({
      data: null,
      error: { status: 0, code: undefined },
    }));
    if (error || !data) {
      setPending(false);
      setError(twoFactorErrorKey(error));
      setCode("");
      return;
    }
    goAfterLogin(data.user as LoggedInUser, locale);
  }

  function switchMode() {
    setMode(mode === "app" ? "backup" : "app");
    setCode("");
    setError(null);
  }

  const inputError = error === "invalidCode" || error === "codeFormat";
  const message = error ? t(`errors.${error}`) : undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5" data-step="two-factor">
      <FormAlert tone="info">
        {mode === "app" ? t("login.intro") : t("login.introBackup")}
      </FormAlert>
      {error && !inputError && (
        <FormAlert>
          {message}
          {error === "expired" && (
            <button
              type="button"
              onClick={onRestart}
              className="mt-1 block font-medium underline underline-offset-4"
            >
              {t("login.back")}
            </button>
          )}
        </FormAlert>
      )}
      <FormField
        id="code"
        label={mode === "app" ? t("login.codeLabel") : t("login.backupLabel")}
        error={inputError ? message : undefined}
      >
        <TextInput
          id="code"
          name="code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoFocus
          autoComplete={mode === "app" ? "one-time-code" : "off"}
          inputMode={mode === "app" ? "numeric" : "text"}
          maxLength={mode === "app" ? 8 : 24}
          spellCheck={false}
          className="font-mono tracking-widest"
          {...describedBy("code", inputError ? message : undefined)}
        />
      </FormField>
      <SubmitButton pending={pending} pendingLabel={t("login.submitting")} size="lg">
        {t("login.submit")}
      </SubmitButton>
      <div className="-mt-1 flex flex-wrap justify-between gap-3 text-sm">
        <button
          type="button"
          onClick={switchMode}
          className="text-brand underline-offset-4 hover:underline"
        >
          {mode === "app" ? t("login.useBackup") : t("login.useApp")}
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="text-ink-muted underline-offset-4 hover:text-ink hover:underline"
        >
          {t("login.back")}
        </button>
      </div>
    </form>
  );
}

/**
 * Notices carried in the URL (?reset=done, ?signedOut=1, and ?verified=1 from the email
 * confirmation link, with &error=… when the link was expired or used). Needs a <Suspense> parent.
 */
export function LoginNotice() {
  const t = useTranslations("auth.login");
  const params = useSearchParams();
  if (params.get("verified") === "1") {
    return params.get("error") ? (
      <FormAlert tone="info">{t("verifyLinkInvalid")}</FormAlert>
    ) : (
      <FormAlert tone="success">{t("emailVerified")}</FormAlert>
    );
  }
  if (params.get("reset") === "done") return <FormAlert tone="success">{t("resetDone")}</FormAlert>;
  if (params.get("signedOut") === "1") return <FormAlert tone="info">{t("signedOut")}</FormAlert>;
  return null;
}
