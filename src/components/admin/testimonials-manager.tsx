"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { testimonialSchema, type Bilingual, type TestimonialInput } from "@/lib/validation/admin";
import { saveTestimonial } from "@/server/actions/admin/content";

import { ContentList } from "./content-list";
import {
  applyServerErrors,
  BilingualField,
  SwitchField,
  TextField,
  useActionErrorToast,
} from "./form-kit";

type Testimonial = {
  id: string;
  quote: Bilingual;
  authorName: string;
  clinic: string;
  consent: boolean;
  published: boolean;
};

/**
 * Testimonials: a quote can only be published once written consent is ticked. Enforced here, in the
 * Server Action, and by a database CHECK constraint.
 */
export function TestimonialsManager({ items }: { items: Testimonial[] }) {
  const t = useTranslations("admin.testimonials");
  const [editing, setEditing] = useState<Testimonial | null | "new">(null);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-muted-foreground">{t("intro")}</p>
        <Button type="button" onClick={() => setEditing("new")}>
          <Plus data-icon="inline-start" />
          {t("add")}
        </Button>
      </div>
      <ContentList
        model="testimonial"
        flagLabel={t("published")}
        emptyText={t("empty")}
        onEdit={(id) => setEditing(items.find((i) => i.id === id) ?? null)}
        items={items.map((i) => ({
          id: i.id,
          title: [i.authorName, i.clinic].filter(Boolean).join(", "),
          subtitle: `“${i.quote.en || i.quote.da}”`,
          flag: i.published,
          flagBlockedReason: i.consent ? undefined : t("needsConsent"),
          badges: !i.consent ? (
            <span className="rounded-full bg-[#fbeedd] px-2 py-0.5 text-xs text-[#7a4a0c]">
              {t("noConsent")}
            </span>
          ) : undefined,
        }))}
      />
      {editing && (
        <TestimonialDialog
          item={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function TestimonialDialog({ item, onClose }: { item: Testimonial | null; onClose: () => void }) {
  const t = useTranslations("admin.testimonials");
  const tForm = useTranslations("admin.form");
  const router = useRouter();
  const errorToast = useActionErrorToast();
  const [saving, startTransition] = useTransition();
  const form = useForm<TestimonialInput>({
    resolver: zodResolver(testimonialSchema, undefined, { raw: true }),
    mode: "onTouched",
    defaultValues: item
      ? {
          quote: item.quote,
          authorName: item.authorName,
          clinic: item.clinic,
          consent: item.consent,
          published: item.published,
        }
      : { quote: { da: "", en: "" }, authorName: "", clinic: "", consent: false, published: false },
  });
  const consent = useWatch({ control: form.control, name: "consent" });

  // Unticking consent unpublishes.
  useEffect(() => {
    if (!consent && form.getValues("published"))
      form.setValue("published", false, { shouldDirty: true });
  }, [consent, form]);

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await saveTestimonial({ id: item?.id ?? null, ...values }).catch(() => null);
      if (!result?.ok) {
        applyServerErrors(form.setError, result?.fieldErrors);
        errorToast(result?.error ?? "generic");
        return;
      }
      toast.success(tForm("saved"));
      onClose();
      router.refresh();
    }),
  );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (open || saving) return;
        if (form.formState.isDirty && !window.confirm(tForm("leaveWarning"))) return;
        onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? t("edit") : t("add")}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>
        <FormProvider {...form}>
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
            <BilingualField<TestimonialInput> name="quote" label={t("quote")} multiline rows={4} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField<TestimonialInput> name="authorName" label={t("authorName")} />
              <TextField<TestimonialInput> name="clinic" label={t("clinic")} optional />
            </div>
            <SwitchField<TestimonialInput>
              name="consent"
              label={t("consent")}
              description={t("consentHint")}
            />
            <SwitchField<TestimonialInput>
              name="published"
              label={t("published")}
              description={consent ? t("publishedHint") : t("needsConsent")}
              disabled={!consent}
            />
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? tForm("saving") : tForm("save")}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
