"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";

import { formatKronerInput } from "@/lib/price";
import { serviceSchema, type Bilingual, type ServiceInput } from "@/lib/validation/admin";
import { saveService } from "@/server/actions/admin/services";
import type { PublicImage } from "@/server/queries/media";

import {
  applyServerErrors,
  BilingualField,
  PriceField,
  SaveBar,
  SwitchField,
  useActionErrorToast,
  useUnsavedChangesWarning,
} from "./form-kit";
import { FormSection } from "./form-section";
import { ImageField } from "./image-picker";

export type ServiceFormValues = {
  id: string | null;
  title: Bilingual;
  summary: Bilingual;
  description: Bilingual;
  priceAmount: number | null;
  priceFrom: boolean;
  priceNote: Bilingual;
  published: boolean;
  image: PublicImage | null;
};

export function ServiceForm({
  service,
  mediaConfigured,
}: {
  service: ServiceFormValues;
  mediaConfigured: boolean;
}) {
  const t = useTranslations("admin.services");
  const tForm = useTranslations("admin.form");
  const router = useRouter();
  const errorToast = useActionErrorToast();
  const [saving, startTransition] = useTransition();

  const form = useForm<ServiceInput>({
    resolver: zodResolver(serviceSchema, undefined, { raw: true }),
    mode: "onTouched",
    defaultValues: {
      title: service.title,
      summary: service.summary,
      description: service.description,
      price: {
        onRequest: service.priceAmount === null,
        amount: service.priceAmount === null ? "" : formatKronerInput(service.priceAmount),
        from: service.priceFrom,
      },
      priceNote: service.priceNote,
      imageId: service.image?.id ?? null,
      published: service.published,
    },
  });
  const dirty = form.formState.isDirty;
  useUnsavedChangesWarning(dirty);

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await saveService({ id: service.id, ...values }).catch(() => null);
      if (!result?.ok) {
        applyServerErrors(form.setError, result?.fieldErrors);
        errorToast(result?.error ?? "generic");
        return;
      }
      form.reset(values);
      toast.success(tForm("saved"));
      if (!service.id) router.replace(`/admin/services/${result.data.id}`);
      else router.refresh();
    }),
  );

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        <FormSection title={t("sectionContent")}>
          <BilingualField<ServiceInput> name="title" label={t("title")} />
          <BilingualField<ServiceInput>
            name="summary"
            label={t("summary")}
            hint={t("summaryHint")}
            multiline
            rows={2}
            optional
          />
          <BilingualField<ServiceInput>
            name="description"
            label={t("description")}
            multiline
            rows={6}
            optional
          />
        </FormSection>
        <FormSection title={t("sectionPrice")} description={t("priceDescription")}>
          <PriceField<ServiceInput> name="price" label={t("price")} />
          <BilingualField<ServiceInput>
            name="priceNote"
            label={t("priceNote")}
            hint={t("priceNoteHint")}
            optional
          />
        </FormSection>
        <FormSection title={t("sectionImage")}>
          <ImageField<ServiceInput>
            name="imageId"
            label={t("image")}
            initial={service.image}
            configured={mediaConfigured}
          />
        </FormSection>
        <FormSection title={t("sectionVisibility")}>
          <SwitchField<ServiceInput>
            name="published"
            label={t("published")}
            description={t("publishedHint")}
          />
        </FormSection>
        <SaveBar dirty={dirty} saving={saving} label={service.id ? undefined : t("create")} />
      </form>
    </FormProvider>
  );
}
