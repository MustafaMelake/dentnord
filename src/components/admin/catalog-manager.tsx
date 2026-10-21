"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import {
  Controller,
  FormProvider,
  useForm,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  guideTypeSchema,
  implantSystemSchema,
  surgicalKitSchema,
  type Bilingual,
  type GuideTypeInput,
  type ImplantSystemInput,
  type SurgicalKitInput,
} from "@/lib/validation/admin";
import { saveGuideType, saveImplantSystem, saveSurgicalKit } from "@/server/actions/admin/catalog";
import type { ActionResult } from "@/server/services/admin-action";

import { ContentList, ExampleBanner } from "./content-list";
import type { CatalogTab } from "./tabs";
import {
  applyServerErrors,
  BilingualField,
  NumberChipsField,
  SwitchField,
  TextField,
  useActionErrorToast,
  useAdminError,
} from "./form-kit";

type GuideType = {
  id: string;
  name: Bilingual;
  description: Bilingual;
  active: boolean;
  usage: number;
  isExample: boolean;
};
type ImplantSystem = {
  id: string;
  brand: string;
  line: string;
  diameters: number[];
  lengths: number[];
  active: boolean;
  usage: number;
  isExample: boolean;
};
type Kit = {
  id: string;
  name: string;
  manufacturer: string;
  active: boolean;
  implantSystemIds: string[];
  usage: number;
  isExample: boolean;
};

const mm = (list: number[]) => list.map((n) => String(n).replace(".", ",")).join(" · ");

export function CatalogManager({
  guideTypes,
  implantSystems,
  kits,
  defaultTab,
}: {
  guideTypes: GuideType[];
  implantSystems: ImplantSystem[];
  kits: Kit[];
  defaultTab: CatalogTab;
}) {
  const t = useTranslations("admin.catalog");
  const [editing, setEditing] = useState<
    | { kind: "guideType"; item: GuideType | null }
    | { kind: "implantSystem"; item: ImplantSystem | null }
    | { kind: "kit"; item: Kit | null }
    | null
  >(null);
  const examples = [...guideTypes, ...implantSystems, ...kits].filter((r) => r.isExample).length;

  return (
    <div className="flex flex-col gap-4">
      <ExampleBanner count={examples} storageKey="catalog" />
      <Tabs
        defaultValue={defaultTab}
        onValueChange={(tab) => window.history.replaceState(null, "", `?tab=${tab}`)}
      >
        <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
          <TabsTrigger value="guide-types">{t("guideTypes")}</TabsTrigger>
          <TabsTrigger value="implant-systems">{t("implantSystems")}</TabsTrigger>
          <TabsTrigger value="surgical-kits">{t("surgicalKits")}</TabsTrigger>
        </TabsList>

        <TabsContent value="guide-types" className="flex flex-col gap-4 pt-4">
          <TabIntro
            text={t("guideTypesIntro")}
            onAdd={() => setEditing({ kind: "guideType", item: null })}
            addLabel={t("addGuideType")}
          />
          <ContentList
            model="guideType"
            flagLabel={t("active")}
            emptyText={t("empty")}
            onEdit={(id) =>
              setEditing({ kind: "guideType", item: guideTypes.find((g) => g.id === id) ?? null })
            }
            items={guideTypes.map((g) => ({
              id: g.id,
              title: g.name.en || g.name.da,
              subtitle: g.name.da && g.name.en ? g.name.da : undefined,
              flag: g.active,
              isExample: g.isExample,
              usage: g.usage,
            }))}
          />
        </TabsContent>

        <TabsContent value="implant-systems" className="flex flex-col gap-4 pt-4">
          <TabIntro
            text={t("implantSystemsIntro")}
            onAdd={() => setEditing({ kind: "implantSystem", item: null })}
            addLabel={t("addImplantSystem")}
          />
          <ContentList
            model="implantSystem"
            flagLabel={t("active")}
            emptyText={t("empty")}
            onEdit={(id) =>
              setEditing({
                kind: "implantSystem",
                item: implantSystems.find((s) => s.id === id) ?? null,
              })
            }
            items={implantSystems.map((s) => ({
              id: s.id,
              title: `${s.brand} ${s.line}`,
              subtitle: `Ø ${mm(s.diameters) || "–"} mm  ·  L ${mm(s.lengths) || "–"} mm`,
              flag: s.active,
              isExample: s.isExample,
              usage: s.usage,
            }))}
          />
        </TabsContent>

        <TabsContent value="surgical-kits" className="flex flex-col gap-4 pt-4">
          <TabIntro
            text={t("surgicalKitsIntro")}
            onAdd={() => setEditing({ kind: "kit", item: null })}
            addLabel={t("addSurgicalKit")}
          />
          <ContentList
            model="surgicalKit"
            flagLabel={t("active")}
            emptyText={t("empty")}
            onEdit={(id) =>
              setEditing({ kind: "kit", item: kits.find((k) => k.id === id) ?? null })
            }
            items={kits.map((k) => ({
              id: k.id,
              title: k.name,
              subtitle: [k.manufacturer, t("compatibleCount", { count: k.implantSystemIds.length })]
                .filter(Boolean)
                .join(" · "),
              flag: k.active,
              isExample: k.isExample,
              usage: k.usage,
            }))}
          />
        </TabsContent>
      </Tabs>

      {editing?.kind === "guideType" && (
        <GuideTypeDialog item={editing.item} onClose={() => setEditing(null)} />
      )}
      {editing?.kind === "implantSystem" && (
        <ImplantSystemDialog item={editing.item} onClose={() => setEditing(null)} />
      )}
      {editing?.kind === "kit" && (
        <KitDialog item={editing.item} systems={implantSystems} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function TabIntro({
  text,
  onAdd,
  addLabel,
}: {
  text: string;
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="max-w-prose text-sm text-muted-foreground">{text}</p>
      <Button type="button" onClick={onAdd}>
        <Plus data-icon="inline-start" />
        {addLabel}
      </Button>
    </div>
  );
}

/** Dialog wrapping a form; asks before closing with unsaved changes. */
function FormDialog<T extends FieldValues>({
  title,
  description,
  form,
  onClose,
  onSubmit,
  saving,
  children,
}: {
  title: string;
  description?: string;
  form: UseFormReturn<T>;
  onClose: () => void;
  onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  saving: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("admin.form");
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (open || saving) return;
        if (form.formState.isDirty && !window.confirm(t("leaveWarning"))) return;
        onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <FormProvider {...form}>
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
            {children}
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? t("saving") : t("save")}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}

/** Shared submit handling for the catalog dialogs. */
function useSave<T extends FieldValues>(
  form: UseFormReturn<T>,
  save: (values: T) => Promise<ActionResult<{ id: string }>>,
  onDone: () => void,
) {
  const tForm = useTranslations("admin.form");
  const router = useRouter();
  const errorToast = useActionErrorToast();
  const [saving, startTransition] = useTransition();
  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await save(values).catch(() => null);
      if (!result?.ok) {
        applyServerErrors(form.setError, result?.fieldErrors);
        errorToast(result?.error ?? "generic");
        return;
      }
      toast.success(tForm("saved"));
      onDone();
      router.refresh();
    }),
  );
  return { saving, onSubmit };
}

function GuideTypeDialog({ item, onClose }: { item: GuideType | null; onClose: () => void }) {
  const t = useTranslations("admin.catalog");
  const form = useForm<GuideTypeInput>({
    resolver: zodResolver(guideTypeSchema, undefined, { raw: true }),
    mode: "onTouched",
    defaultValues: item
      ? { name: item.name, description: item.description, active: item.active }
      : { name: { da: "", en: "" }, description: { da: "", en: "" }, active: true },
  });
  const { saving, onSubmit } = useSave(
    form,
    (v) => saveGuideType({ id: item?.id ?? null, ...v }),
    onClose,
  );
  return (
    <FormDialog
      title={item ? t("editGuideType") : t("addGuideType")}
      form={form}
      onClose={onClose}
      onSubmit={onSubmit}
      saving={saving}
    >
      <BilingualField<GuideTypeInput> name="name" label={t("name")} />
      <BilingualField<GuideTypeInput>
        name="description"
        label={t("description")}
        multiline
        rows={3}
        optional
      />
      <SwitchField<GuideTypeInput>
        name="active"
        label={t("active")}
        description={t("guideTypeActiveHint")}
      />
    </FormDialog>
  );
}

function ImplantSystemDialog({
  item,
  onClose,
}: {
  item: ImplantSystem | null;
  onClose: () => void;
}) {
  const t = useTranslations("admin.catalog");
  const form = useForm<ImplantSystemInput>({
    resolver: zodResolver(implantSystemSchema, undefined, { raw: true }),
    mode: "onTouched",
    defaultValues: item
      ? {
          brand: item.brand,
          line: item.line,
          diameters: item.diameters,
          lengths: item.lengths,
          active: item.active,
        }
      : { brand: "", line: "", diameters: [], lengths: [], active: true },
  });
  const { saving, onSubmit } = useSave(
    form,
    (v) => saveImplantSystem({ id: item?.id ?? null, ...v }),
    onClose,
  );
  return (
    <FormDialog
      title={item ? t("editImplantSystem") : t("addImplantSystem")}
      form={form}
      onClose={onClose}
      onSubmit={onSubmit}
      saving={saving}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField<ImplantSystemInput> name="brand" label={t("brand")} placeholder="Straumann" />
        <TextField<ImplantSystemInput> name="line" label={t("line")} placeholder="BLX" />
      </div>
      <NumberChipsField<ImplantSystemInput>
        name="diameters"
        label={t("diameters")}
        hint={t("chipsHint")}
      />
      <NumberChipsField<ImplantSystemInput>
        name="lengths"
        label={t("lengths")}
        hint={t("chipsHint")}
      />
      <SwitchField<ImplantSystemInput>
        name="active"
        label={t("active")}
        description={t("implantActiveHint")}
      />
    </FormDialog>
  );
}

function KitDialog({
  item,
  systems,
  onClose,
}: {
  item: Kit | null;
  systems: ImplantSystem[];
  onClose: () => void;
}) {
  const t = useTranslations("admin.catalog");
  const errorOf = useAdminError();
  const form = useForm<SurgicalKitInput>({
    resolver: zodResolver(surgicalKitSchema, undefined, { raw: true }),
    mode: "onTouched",
    defaultValues: item
      ? {
          name: item.name,
          manufacturer: item.manufacturer,
          implantSystemIds: item.implantSystemIds,
          active: item.active,
        }
      : { name: "", manufacturer: "", implantSystemIds: [], active: true },
  });
  const { saving, onSubmit } = useSave(
    form,
    (v) => saveSurgicalKit({ id: item?.id ?? null, ...v }),
    onClose,
  );
  const systemsError = errorOf(form.formState.errors, "implantSystemIds");
  return (
    <FormDialog
      title={item ? t("editSurgicalKit") : t("addSurgicalKit")}
      form={form}
      onClose={onClose}
      onSubmit={onSubmit}
      saving={saving}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField<SurgicalKitInput> name="name" label={t("kitName")} />
        <TextField<SurgicalKitInput> name="manufacturer" label={t("brand")} optional />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t("compatibleSystems")}</legend>
        <Controller
          control={form.control}
          name="implantSystemIds"
          render={({ field }) => {
            const selected = new Set(field.value ?? []);
            return (
              <ul className="grid max-h-64 gap-1 overflow-y-auto rounded-lg border border-line p-2 sm:grid-cols-2">
                {systems.map((s) => (
                  <li key={s.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                      <Checkbox
                        checked={selected.has(s.id)}
                        onCheckedChange={(checked) => {
                          const next = new Set(selected);
                          if (checked) next.add(s.id);
                          else next.delete(s.id);
                          field.onChange([...next]);
                        }}
                      />
                      <span className={s.active ? "" : "text-muted-foreground line-through"}>
                        {s.brand} {s.line}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            );
          }}
        />
        {systemsError && <p className="text-sm text-destructive">{systemsError}</p>}
      </fieldset>
      <SwitchField<SurgicalKitInput>
        name="active"
        label={t("active")}
        description={t("kitActiveHint")}
      />
    </FormDialog>
  );
}
