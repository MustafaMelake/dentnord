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
import { signIn } from "@/lib/auth-client";
import { postLoginPath } from "@/lib/redirects";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";

import { authErrorKey, type AuthErrorKey } from "./auth-errors";

export function LoginForm({ contactEmail }: { contactEmail: string }) {
  const t = useTranslations("auth");
  const fieldError = useFieldError();
  const locale = useLocale();
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [redirecting, setRedirecting] = useState(false);
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
    const { data, error } = await signIn
      .email({ email: values.email, password: values.password })
      .catch(() => ({ data: null, error: { status: 0 } }));
    if (error || !data) {
      setError(authErrorKey(error, "login"));
      return;
    }
    setRedirecting(true);
    // Read on submit (not via useSearchParams) so the form itself prerenders in the static shell.
    const next = new URLSearchParams(window.location.search).get("next");
    // Full page load: the destination may be a different root layout (/admin).
    hardNavigate(postLoginPath(data.user, locale, next));
  }

  const emailError = fieldError(errors.email);
  const passwordError = fieldError(errors.password);
  const busy = isSubmitting || redirecting;

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

/** Notices carried in the URL (?reset=done, ?signedOut=1). Needs a <Suspense> parent. */
export function LoginNotice() {
  const t = useTranslations("auth.login");
  const params = useSearchParams();
  if (params.get("reset") === "done") return <FormAlert tone="success">{t("resetDone")}</FormAlert>;
  if (params.get("signedOut") === "1") return <FormAlert tone="info">{t("signedOut")}</FormAlert>;
  return null;
}
