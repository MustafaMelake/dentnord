"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import {
  describedBy,
  FormAlert,
  FormField,
  SubmitButton,
  TextInput,
  useFieldError,
} from "@/components/shared/form-controls";
import { authClient } from "@/lib/auth-client";
import { changePasswordSchema } from "@/lib/validation/auth";

import { authErrorKey } from "./auth-errors";

// Change your own password (dentist portal and admin). Goes through Better Auth's /change-password
// endpoint, so it is rate-limited, verifies the current password, and signs out other devices.

type PasswordInput = z.input<typeof changePasswordSchema>;

export function ChangePasswordForm() {
  const t = useTranslations();
  const fieldError = useFieldError();
  const [error, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    mode: "onTouched",
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: PasswordInput) {
    setFormError(null);
    const { error } = await authClient
      .changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        revokeOtherSessions: true,
      })
      .catch(() => ({ error: { status: 0, code: undefined } }));
    if (error) {
      if (error.code === "INVALID_PASSWORD") {
        return setError("currentPassword", { message: t("changePassword.wrongCurrent") });
      }
      return setFormError(t(`auth.errors.${authErrorKey(error)}`));
    }
    reset();
    toast.success(t("changePassword.changed"));
  }

  const e = {
    current: fieldError(errors.currentPassword),
    next: fieldError(errors.newPassword),
    confirm: fieldError(errors.confirmPassword),
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {error && <FormAlert>{error}</FormAlert>}
      <FormField id="currentPassword" label={t("changePassword.current")} error={e.current}>
        <TextInput
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          {...describedBy("currentPassword", e.current)}
          {...register("currentPassword")}
        />
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          id="newPassword"
          label={t("auth.fields.newPassword")}
          error={e.next}
          hint={t("auth.fields.passwordHint")}
        >
          <TextInput
            id="newPassword"
            type="password"
            autoComplete="new-password"
            {...describedBy("newPassword", e.next, true)}
            {...register("newPassword")}
          />
        </FormField>
        <FormField id="confirmPassword" label={t("auth.fields.confirmPassword")} error={e.confirm}>
          <TextInput
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...describedBy("confirmPassword", e.confirm)}
            {...register("confirmPassword")}
          />
        </FormField>
      </div>
      <SubmitButton
        pending={isSubmitting}
        pendingLabel={t("changePassword.submitting")}
        className="sm:w-fit"
      >
        {t("changePassword.submit")}
      </SubmitButton>
    </form>
  );
}
