"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { ButtonLink } from "@/components/shared/button";
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
import { authClient } from "@/lib/auth-client";
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/validation/auth";

import { authErrorKey, type AuthErrorKey } from "./auth-errors";

/** Step 1: request a link. Always answers "check your email" (no account enumeration). */
export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const fieldError = useFieldError();
  const locale = useLocale();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onTouched",
    defaultValues: { email: "" },
  });

  async function onSubmit({ email }: z.input<typeof forgotPasswordSchema>) {
    setError(null);
    const { error } = await authClient
      .requestPasswordReset({ email, redirectTo: `/${locale}/reset-password` })
      .catch(() => ({ error: { status: 0 } }));
    if (error) return setError(authErrorKey(error));
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-6">
        <FormAlert tone="success">
          <p className="font-medium">{t("forgotPassword.sentTitle")}</p>
          <p>{t("forgotPassword.sentBody", { email: sentTo })}</p>
        </FormAlert>
        <BackToLogin />
      </div>
    );
  }

  const emailError = fieldError(errors.email);
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {error && <FormAlert>{t(`errors.${error}`)}</FormAlert>}
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
      <SubmitButton pending={isSubmitting} pendingLabel={t("forgotPassword.submitting")} size="lg">
        {t("forgotPassword.submit")}
      </SubmitButton>
      <BackToLogin />
    </form>
  );
}

/**
 * Step 2: Better Auth redirects here with ?token=… (or ?error=INVALID_TOKEN). Uses useSearchParams,
 * so the page wraps it in <Suspense>.
 */
export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const fieldError = useFieldError();
  const locale = useLocale();
  const params = useSearchParams();
  const token = params.get("token");
  const [error, setError] = useState<AuthErrorKey | "invalidToken" | null>(
    !token || params.get("error") ? "invalidToken" : null,
  );
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onTouched",
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit({ password }: z.input<typeof resetPasswordSchema>) {
    if (!token) return;
    setError(null);
    const { error } = await authClient
      .resetPassword({ newPassword: password, token })
      .catch(() => ({ error: { status: 0, code: undefined } }));
    if (error) {
      return setError(error.code === "INVALID_TOKEN" ? "invalidToken" : authErrorKey(error));
    }
    setDone(true);
    hardNavigate(`/${locale}/login?reset=done`);
  }

  if (error === "invalidToken") {
    return (
      <div className="flex flex-col gap-6">
        <FormAlert>
          <p className="font-medium">{t("resetPassword.invalidTitle")}</p>
          <p>{t("resetPassword.invalidBody")}</p>
        </FormAlert>
        <ButtonLink href="/forgot-password" size="lg" className="w-full">
          {t("resetPassword.requestNew")}
        </ButtonLink>
        <BackToLogin />
      </div>
    );
  }

  const passwordError = fieldError(errors.password);
  const confirmError = fieldError(errors.confirmPassword);
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {error && <FormAlert>{t(`errors.${error}`)}</FormAlert>}
      <FormField
        id="password"
        label={t("fields.newPassword")}
        error={passwordError}
        hint={t("fields.passwordHint")}
      >
        <TextInput
          id="password"
          type="password"
          autoComplete="new-password"
          {...describedBy("password", passwordError, true)}
          {...register("password")}
        />
      </FormField>
      <FormField id="confirmPassword" label={t("fields.confirmPassword")} error={confirmError}>
        <TextInput
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          {...describedBy("confirmPassword", confirmError)}
          {...register("confirmPassword")}
        />
      </FormField>
      <SubmitButton
        pending={isSubmitting || done}
        pendingLabel={t("resetPassword.submitting")}
        size="lg"
      >
        {t("resetPassword.submit")}
      </SubmitButton>
    </form>
  );
}

function BackToLogin() {
  const t = useTranslations("auth.forgotPassword");
  return (
    <Link
      href="/login"
      className="self-center text-sm text-brand underline-offset-4 hover:underline"
    >
      {t("backToLogin")}
    </Link>
  );
}
