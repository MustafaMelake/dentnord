"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldAlert, Trash2 } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { FormProvider, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  portfolioSchema,
  slugify,
  type Bilingual,
  type PortfolioInput,
} from "@/lib/validation/admin";
import { savePortfolioCase } from "@/server/actions/admin/content";
import type { PublicImage } from "@/server/queries/media";

import {
  AdminField,
  applyServerErrors,
  BilingualField,
  SaveBar,
  SwitchField,
  TextField,
  useActionErrorToast,
  useAdminError,
  useUnsavedChangesWarning,
} from "./form-kit";
import { FormSection } from "./form-section";
import { ImagePicker } from "./image-picker";
import { SortableList } from "./sortable-list";

export type PortfolioFormCase = {
  id: string | null;
  slug: string;
  title: Bilingual;
  summary: Bilingual;
  guideTypeId: string | null;
  implantCount: number | null;
  published: boolean;
  images: { caption: Bilingual; image: PublicImage }[];
};

export function PortfolioForm({
  item,
  guideTypes,
  mediaConfigured,
}: {
  item: PortfolioFormCase;
  guideTypes: { id: string; name: Bilingual; active: boolean }[];
  mediaConfigured: boolean;
}) {
  const t = useTranslations("admin.portfolio");
  const tForm = useTranslations("admin.form");
  const router = useRouter();
  const errorToast = useActionErrorToast();
  const errorOf = useAdminError();
  const [saving, startTransition] = useTransition();
  const [previews, setPreviews] = useState<Record<string, PublicImage>>(() =>
    Object.fromEntries(item.images.map((i) => [i.image.id, i.image])),
  );

  const form = useForm<PortfolioInput>({
    resolver: zodResolver(portfolioSchema, undefined, { raw: true }),
    mode: "onTouched",
    defaultValues: {
      slug: item.slug,
      title: item.title,
      summary: item.summary,
      guideTypeId: item.guideTypeId,
      implantCount: item.implantCount === null ? "" : String(item.implantCount),
      images: item.images.map((i) => ({ mediaId: i.image.id, caption: i.caption })),
      published: item.published,
    },
  });
  useUnsavedChangesWarning(form.formState.isDirty);
  const gallery = useFieldArray({ control: form.control, name: "images", keyName: "key" });

  // For a new case, the slug follows the title until someone edits the slug field by hand
  // (auto-filled values don't count as "touched").
  const titleEn = useWatch({ control: form.control, name: "title.en" });
  const titleDa = useWatch({ control: form.control, name: "title.da" });
  const slug = useWatch({ control: form.control, name: "slug" });
  const autoSlug = slugify(titleEn || titleDa || "");
  const isNew = !item.id;
  useEffect(() => {
    if (!isNew || !autoSlug || form.getFieldState("slug").isTouched) return;
    if (form.getValues("slug") !== autoSlug) form.setValue("slug", autoSlug, { shouldDirty: true });
  }, [autoSlug, isNew, form]);
  const slugField = form.register("slug");

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await savePortfolioCase({ id: item.id, ...values }).catch(() => null);
      if (!result?.ok) {
        applyServerErrors(form.setError, result?.fieldErrors);
        errorToast(result?.error ?? "generic");
        return;
      }
      form.reset(values);
      toast.success(tForm("saved"));
      if (!item.id) router.replace(`/admin/portfolio/${result.data.id}`);
      else router.refresh();
    }),
  );

  const slugError = errorOf(form.formState.errors, "slug");
  const sortable = gallery.fields.map((f, index) => ({ id: f.key, index, mediaId: f.mediaId }));

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        <p
          role="note"
          className="flex items-start gap-3 rounded-card border border-[#c9831f]/40 bg-[#fbeedd] px-4 py-3 text-sm text-[#7a4a0c]"
        >
          <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t("consentNote")}
        </p>

        <FormSection title={t("sectionCase")}>
          <BilingualField<PortfolioInput> name="title" label={t("title")} />
          <AdminField
            id="slug"
            label={t("slug")}
            error={slugError}
            hint={t("slugHint", { slug: slug || "…" })}
          >
            <input
              id="slug"
              className="h-9 w-full rounded-lg border border-input bg-surface px-2.5 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
              aria-invalid={!!slugError || undefined}
              {...slugField}
            />
          </AdminField>
          <BilingualField<PortfolioInput>
            name="summary"
            label={t("summary")}
            multiline
            rows={4}
            optional
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <AdminField id="guideTypeId" label={t("guideType")} optional>
              <select
                id="guideTypeId"
                className="h-9 rounded-lg border border-input bg-surface px-2.5 text-sm"
                {...form.register("guideTypeId", { setValueAs: (v) => (v ? v : null) })}
              >
                <option value="">{t("noGuideType")}</option>
                {guideTypes.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name.en || g.name.da}
                    {g.active ? "" : ` (${t("archived")})`}
                  </option>
                ))}
              </select>
            </AdminField>
            <TextField<PortfolioInput>
              name="implantCount"
              label={t("implantCount")}
              inputMode="numeric"
              optional
            />
          </div>
        </FormSection>

        <FormSection title={t("sectionGallery")} description={t("galleryDescription")}>
          {gallery.fields.length > 0 && (
            <SortableList
              items={sortable}
              itemLabel={(row) => previews[row.mediaId]?.alt.en ?? t("image")}
              onCommit={async (keys) => {
                const values = form.getValues("images");
                const indexOf = new Map(sortable.map((row) => [row.id, row.index]));
                gallery.replace(keys.map((key) => values[indexOf.get(key)!]));
                return true;
              }}
              renderItem={({ index, mediaId }) => (
                <div className="flex items-start gap-3">
                  <span className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {previews[mediaId] && (
                      <Image
                        src={previews[mediaId].url}
                        alt={previews[mediaId].alt.en}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <BilingualField<PortfolioInput>
                      name={`images.${index}.caption`}
                      label={index === 0 ? t("captionCover") : t("caption")}
                      optional
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t("removeImage", { n: index + 1 })}
                    onClick={() => gallery.remove(index)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              )}
            />
          )}
          <ImagePicker
            id="add-image"
            label={t("addImage")}
            hint={gallery.fields.length === 0 ? t("firstIsCover") : undefined}
            configured={mediaConfigured}
            value={null}
            compact
            onChange={(img) => {
              if (!img) return;
              setPreviews((p) => ({ ...p, [img.id]: img }));
              gallery.append({ mediaId: img.id, caption: { da: "", en: "" } });
            }}
          />
        </FormSection>

        <FormSection title={t("sectionVisibility")}>
          <SwitchField<PortfolioInput>
            name="published"
            label={t("published")}
            description={t("publishedHint")}
          />
        </FormSection>

        <SaveBar
          dirty={form.formState.isDirty}
          saving={saving}
          label={item.id ? undefined : t("create")}
        />
      </form>
    </FormProvider>
  );
}
