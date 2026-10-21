"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LogOut } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { authErrorKey } from "@/components/auth/auth-errors";
import { CountrySelect, LanguageSelect } from "@/components/auth/profile-selects";
import { Button } from "@/components/shared/button";
import {
  describedBy,
  FormAlert,
  FormField,
  SubmitButton,
  TextArea,
  TextInput,
  useFieldError,
} from "@/components/shared/form-controls";
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
import { hardNavigate } from "@/lib/hard-navigate";
import { authClient } from "@/lib/auth-client";
import { changePasswordSchema, profileSchema, type ProfileInput } from "@/lib/validation/auth";
import { updateProfile } from "@/server/actions/account";

export function ProfileForm({ email, defaults }: { email: string; defaults: ProfileInput }) {
  const t = useTranslations();
  const fieldError = useFieldError();
  const locale = useLocale();
  const [failed, setFailed] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    mode: "onTouched",
    defaultValues: defaults,
  });

  async function onSubmit(values: ProfileInput) {
    setFailed(false);
    const result = await updateProfile(locale, values).catch(() => null);
    if (!result) return setFailed(true);
    if (!result.ok) {
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        setError(field as keyof ProfileInput, { message });
      }
      return;
    }
    reset(values);
    toast.success(t("portal.account.profile.saved"));
  }

  const e = Object.fromEntries(
    (["name", "clinicName", "phone", "country", "address", "cvr", "preferredLocale"] as const).map(
      (k) => [k, fieldError(errors[k])],
    ),
  ) as Record<keyof ProfileInput, string | undefined>;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {failed && <FormAlert>{t("auth.errors.generic")}</FormAlert>}
      <FormField
        id="account-email"
        label={t("portal.account.profile.email")}
        hint={t("portal.account.profile.emailNote")}
      >
        <TextInput
          id="account-email"
          value={email}
          readOnly
          disabled
          aria-describedby="account-email-hint"
        />
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="name" label={t("auth.register.name")} error={e.name}>
          <TextInput
            id="name"
            autoComplete="name"
            {...describedBy("name", e.name)}
            {...register("name")}
          />
        </FormField>
        <FormField id="clinicName" label={t("auth.register.clinicName")} error={e.clinicName}>
          <TextInput
            id="clinicName"
            autoComplete="organization"
            {...describedBy("clinicName", e.clinicName)}
            {...register("clinicName")}
          />
        </FormField>
        <FormField id="phone" label={t("auth.register.phone")} error={e.phone}>
          <TextInput
            id="phone"
            type="tel"
            autoComplete="tel"
            {...describedBy("phone", e.phone)}
            {...register("phone")}
          />
        </FormField>
        <FormField id="country" label={t("auth.register.country")} error={e.country}>
          <CountrySelect
            id="country"
            {...describedBy("country", e.country)}
            {...register("country")}
          />
        </FormField>
      </div>
      <FormField id="address" label={t("auth.register.address")} error={e.address}>
        <TextArea
          id="address"
          rows={2}
          autoComplete="street-address"
          {...describedBy("address", e.address)}
          {...register("address")}
        />
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          id="cvr"
          label={t("auth.register.cvr")}
          optional={t("auth.register.optional")}
          error={e.cvr}
        >
          <TextInput id="cvr" {...describedBy("cvr", e.cvr)} {...register("cvr")} />
        </FormField>
        <FormField
          id="preferredLocale"
          label={t("auth.register.preferredLocale")}
          error={e.preferredLocale}
        >
          <LanguageSelect id="preferredLocale" {...register("preferredLocale")} />
        </FormField>
      </div>
      <SubmitButton
        pending={isSubmitting}
        pendingLabel={t("portal.account.profile.saving")}
        disabled={!isDirty || isSubmitting}
        className="sm:w-fit"
      >
        {t("portal.account.profile.save")}
      </SubmitButton>
    </form>
  );
}

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
        return setError("currentPassword", { message: t("portal.account.password.wrongCurrent") });
      }
      return setFormError(t(`auth.errors.${authErrorKey(error)}`));
    }
    reset();
    toast.success(t("portal.account.password.changed"));
  }

  const e = {
    current: fieldError(errors.currentPassword),
    next: fieldError(errors.newPassword),
    confirm: fieldError(errors.confirmPassword),
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {error && <FormAlert>{error}</FormAlert>}
      <FormField
        id="currentPassword"
        label={t("portal.account.password.current")}
        error={e.current}
      >
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
        pendingLabel={t("portal.account.password.submitting")}
        className="sm:w-fit"
      >
        {t("portal.account.password.submit")}
      </SubmitButton>
    </form>
  );
}

export function SignOutEverywhere() {
  const t = useTranslations("portal.account.sessions");
  const tErrors = useTranslations("auth.errors");
  const locale = useLocale();
  const [pending, setPending] = useState(false);

  async function signOutEverywhere() {
    setPending(true);
    const { error } = await authClient.revokeSessions().catch(() => ({ error: { status: 0 } }));
    if (error) {
      setPending(false);
      toast.error(tErrors(authErrorKey(error)));
      return;
    }
    hardNavigate(`/${locale}/login?signedOut=1`);
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="secondary" disabled={pending}>
          <span className="inline-flex items-center gap-2">
            <LogOut aria-hidden className="size-4" />
            {t("button")}
          </span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("confirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("confirmBody")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={signOutEverywhere} disabled={pending}>
            {t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
