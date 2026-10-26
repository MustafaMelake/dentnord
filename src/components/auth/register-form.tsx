"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";

import {
  describedBy,
  FormAlert,
  FormField,
  SubmitButton,
  TextArea,
  TextInput,
  useFieldError,
} from "@/components/shared/form-controls";
import { Link } from "@/i18n/navigation";
import { hardNavigate } from "@/lib/hard-navigate";
import { signUp } from "@/lib/auth-client";
import { DEFAULT_COUNTRY, registerFormSchema, type RegisterFormInput } from "@/lib/validation/auth";

import { authErrorKey, type AuthErrorKey } from "./auth-errors";
import { CountrySelect, LanguageSelect } from "./profile-selects";

export function RegisterForm() {
  const t = useTranslations("auth");
  const fieldError = useFieldError();
  const locale = useLocale();
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [verifyEmailSentTo, setVerifyEmailSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormInput>({
    resolver: zodResolver(registerFormSchema),
    mode: "onTouched",
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      clinicName: "",
      phone: "",
      country: DEFAULT_COUNTRY,
      address: "",
      cvr: "",
      preferredLocale: locale === "en" ? "en" : "da",
      acceptTerms: false,
    },
  });

  async function onSubmit(values: RegisterFormInput) {
    setError(null);
    const { cvr, ...rest } = values;
    delete (rest as Partial<typeof rest>).confirmPassword; // form-only field
    // Same schema is enforced again on the server (Better Auth hooks.before in lib/auth.ts).
    const body = {
      ...rest,
      ...(cvr?.trim() ? { cvr: cvr.trim() } : {}),
      // Where the email confirmation link leads (only used with EMAIL_VERIFICATION=on).
      callbackURL: `/${locale}/login?verified=1`,
    };
    const { data, error } = await signUp
      .email(body as Parameters<typeof signUp.email>[0])
      .catch(() => ({ data: null, error: { status: 0 } }));
    if (error) {
      setError(authErrorKey(error, "register"));
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    // Email verification on: no session until the address is confirmed.
    if (!data?.token) {
      setVerifyEmailSentTo(values.email.trim());
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    // Signed in (new accounts start as PENDING): show the status page.
    setRedirecting(true);
    hardNavigate(`/${locale}/pending-approval`);
  }

  if (verifyEmailSentTo) {
    return (
      <FormAlert tone="success">
        <strong className="block font-medium">{t("register.checkEmailTitle")}</strong>
        {t("register.checkEmailBody", { email: verifyEmailSentTo })}
      </FormAlert>
    );
  }

  const e = {
    name: fieldError(errors.name),
    email: fieldError(errors.email),
    password: fieldError(errors.password),
    confirmPassword: fieldError(errors.confirmPassword),
    clinicName: fieldError(errors.clinicName),
    phone: fieldError(errors.phone),
    country: fieldError(errors.country),
    address: fieldError(errors.address),
    cvr: fieldError(errors.cvr),
    preferredLocale: fieldError(errors.preferredLocale),
    acceptTerms: fieldError(errors.acceptTerms),
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-8">
      {error && (
        <FormAlert>
          {t(`errors.${error}`)}
          {error === "registrationFailed" && (
            <span className="mt-1 flex gap-4">
              <Link href="/login" className="font-medium underline underline-offset-4">
                {t("register.login")}
              </Link>
              <Link href="/forgot-password" className="font-medium underline underline-offset-4">
                {t("login.forgot")}
              </Link>
            </span>
          )}
        </FormAlert>
      )}

      <Section title={t("register.sections.you")}>
        <FormField id="name" label={t("register.name")} error={e.name}>
          <TextInput
            id="name"
            autoComplete="name"
            {...describedBy("name", e.name)}
            {...register("name")}
          />
        </FormField>
        <FormField id="email" label={t("fields.email")} error={e.email}>
          <TextInput
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            {...describedBy("email", e.email)}
            {...register("email")}
          />
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            id="password"
            label={t("fields.password")}
            error={e.password}
            hint={t("fields.passwordHint")}
          >
            <TextInput
              id="password"
              type="password"
              autoComplete="new-password"
              {...describedBy("password", e.password, true)}
              {...register("password")}
            />
          </FormField>
          <FormField
            id="confirmPassword"
            label={t("fields.confirmPassword")}
            error={e.confirmPassword}
          >
            <TextInput
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...describedBy("confirmPassword", e.confirmPassword)}
              {...register("confirmPassword")}
            />
          </FormField>
        </div>
      </Section>

      <Section title={t("register.sections.clinic")}>
        <FormField id="clinicName" label={t("register.clinicName")} error={e.clinicName}>
          <TextInput
            id="clinicName"
            autoComplete="organization"
            {...describedBy("clinicName", e.clinicName)}
            {...register("clinicName")}
          />
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="phone" label={t("register.phone")} error={e.phone}>
            <TextInput
              id="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              {...describedBy("phone", e.phone)}
              {...register("phone")}
            />
          </FormField>
          <FormField id="country" label={t("register.country")} error={e.country}>
            <CountrySelect
              id="country"
              {...describedBy("country", e.country)}
              {...register("country")}
            />
          </FormField>
        </div>
        <FormField id="address" label={t("register.address")} error={e.address}>
          <TextArea
            id="address"
            rows={2}
            autoComplete="street-address"
            {...describedBy("address", e.address)}
            {...register("address")}
          />
        </FormField>
        <FormField
          id="cvr"
          label={t("register.cvr")}
          optional={t("register.optional")}
          error={e.cvr}
        >
          <TextInput
            id="cvr"
            inputMode="numeric"
            {...describedBy("cvr", e.cvr)}
            {...register("cvr")}
          />
        </FormField>
      </Section>

      <Section title={t("register.sections.preferences")}>
        <FormField
          id="preferredLocale"
          label={t("register.preferredLocale")}
          error={e.preferredLocale}
        >
          <LanguageSelect id="preferredLocale" {...register("preferredLocale")} />
        </FormField>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="acceptTerms"
            className="flex items-start gap-3 text-[0.9375rem] leading-snug text-ink"
          >
            <input
              id="acceptTerms"
              type="checkbox"
              className="mt-0.5 size-[1.125rem] shrink-0 accent-brand"
              {...describedBy("acceptTerms", e.acceptTerms)}
              {...register("acceptTerms")}
            />
            <span>
              {t.rich("register.acceptTerms", {
                terms: (chunks) => <LegalLink href="/terms">{chunks}</LegalLink>,
                privacy: (chunks) => <LegalLink href="/privacy">{chunks}</LegalLink>,
              })}
            </span>
          </label>
          {e.acceptTerms && (
            <p id="acceptTerms-error" className="pl-[1.875rem] text-sm text-destructive">
              {e.acceptTerms}
            </p>
          )}
        </div>
      </Section>

      <SubmitButton
        pending={isSubmitting || redirecting}
        pendingLabel={t("register.submitting")}
        size="lg"
      >
        {t("register.submit")}
      </SubmitButton>
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-5">
      <legend className="mb-5 w-full border-b border-line pb-2 font-mono text-label text-ink-muted">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function LegalLink({ href, children }: { href: "/terms" | "/privacy"; children: ReactNode }) {
  return (
    <Link
      href={href}
      target="_blank"
      className="text-brand underline underline-offset-4 hover:text-brand-deep"
    >
      {children}
    </Link>
  );
}
