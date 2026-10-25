"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";

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
import { contactFormSchema, type ContactFormInput } from "@/lib/validation/contact";
import { submitContactMessage } from "@/server/actions/contact";

const EMPTY: ContactFormInput = {
  name: "",
  clinic: "",
  email: "",
  phone: "",
  message: "",
  website: "",
};

/** The public contact form. Messages land in /admin/messages; the admin gets an email. */
export function ContactForm() {
  const t = useTranslations("contactPage.form");
  const locale = useLocale();
  const fieldError = useFieldError();
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<"rateLimited" | "generic" | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormInput>({
    resolver: zodResolver(contactFormSchema),
    mode: "onTouched",
    defaultValues: EMPTY,
  });

  async function onSubmit(values: ContactFormInput) {
    setFailure(null);
    const result = await submitContactMessage(locale, values).catch(() => null);
    if (!result) return setFailure("generic");
    if (!result.ok) {
      if (result.error) return setFailure(result.error);
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        setError(field as keyof ContactFormInput, { message });
      }
      return;
    }
    reset(EMPTY);
    setSent(true);
  }

  if (sent) {
    return (
      <div role="status" data-contact-sent="" className="flex flex-col items-start gap-4 py-6">
        <span className="flex size-12 items-center justify-center rounded-full bg-[#e1f2e8] text-[#1d5b38]">
          <CircleCheck aria-hidden className="size-6" />
        </span>
        <p className="text-display-sm text-ink">{t("sentTitle")}</p>
        <p className="max-w-[44ch] text-ink-muted">{t("sentBody")}</p>
        <Button variant="secondary" onClick={() => setSent(false)}>
          {t("sendAnother")}
        </Button>
      </div>
    );
  }

  const e = {
    name: fieldError(errors.name),
    clinic: fieldError(errors.clinic),
    email: fieldError(errors.email),
    phone: fieldError(errors.phone),
    message: fieldError(errors.message),
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-label={t("label")}
      className="relative flex flex-col gap-5"
    >
      {failure && (
        <FormAlert>{failure === "rateLimited" ? t("rateLimited") : t("failed")}</FormAlert>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="contact-name" label={t("name")} error={e.name}>
          <TextInput
            id="contact-name"
            autoComplete="name"
            {...describedBy("contact-name", e.name)}
            {...register("name")}
          />
        </FormField>
        <FormField id="contact-clinic" label={t("clinic")} error={e.clinic}>
          <TextInput
            id="contact-clinic"
            autoComplete="organization"
            {...describedBy("contact-clinic", e.clinic)}
            {...register("clinic")}
          />
        </FormField>
        <FormField id="contact-email" label={t("email")} error={e.email}>
          <TextInput
            id="contact-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            {...describedBy("contact-email", e.email)}
            {...register("email")}
          />
        </FormField>
        <FormField id="contact-phone" label={t("phone")} optional={t("optional")} error={e.phone}>
          <TextInput
            id="contact-phone"
            type="tel"
            autoComplete="tel"
            {...describedBy("contact-phone", e.phone)}
            {...register("phone")}
          />
        </FormField>
      </div>
      <FormAlert tone="info">
        <span data-patient-note="">{t("patientNote")}</span>
      </FormAlert>
      <FormField id="contact-message" label={t("message")} error={e.message}>
        <TextArea
          id="contact-message"
          rows={6}
          {...describedBy("contact-message", e.message)}
          {...register("message")}
        />
      </FormField>
      {/* Honeypot: invisible to people and screen readers, filled in by bots. */}
      <div aria-hidden className="absolute -left-[9999px] size-px overflow-hidden">
        <label htmlFor="contact-website">{t("honeypot")}</label>
        <input
          id="contact-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          {...register("website")}
        />
      </div>
      <SubmitButton pending={isSubmitting} pendingLabel={t("sending")} className="sm:w-fit">
        {t("send")}
      </SubmitButton>
    </form>
  );
}
