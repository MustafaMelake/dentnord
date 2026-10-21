"use client";

import { CircleAlert, Languages, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  Controller,
  useFormContext,
  useWatch,
  type FieldErrors,
  type FieldValues,
  type Path,
  type UseFormSetError,
} from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatKronerInput, parseKroner } from "@/lib/price";
import { cn } from "@/lib/utils";

// Admin form building blocks (English only). Forms use react-hook-form with a FormProvider and the
// shared zod schemas in lib/validation/admin.ts; error messages are keys in `admin.validation`.

// ── Errors ───────────────────────────────────────────────────────────────────

function getAt(errors: unknown, path: string): { message?: unknown } | undefined {
  let node = errors as Record<string, unknown> | undefined;
  for (const key of path.split(".")) node = node?.[key] as Record<string, unknown> | undefined;
  return node as { message?: unknown } | undefined;
}

/** Translated error for a dotted field path ("title.da"), or undefined. */
export function useAdminError() {
  const t = useTranslations("admin.validation");
  return (errors: FieldErrors, path: string) => {
    const key = getAt(errors, path)?.message;
    if (typeof key !== "string" || !key) return undefined;
    return t.has(key as never) ? t(key as never) : key;
  };
}

/** Applies a Server Action's field errors to the form; returns true if there were any. */
export function applyServerErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  fieldErrors: Record<string, string> | undefined,
) {
  const entries = Object.entries(fieldErrors ?? {});
  for (const [path, message] of entries) setError(path as Path<T>, { type: "server", message });
  return entries.length > 0;
}

/** Toast for a failed action result. */
export function useActionErrorToast() {
  const t = useTranslations("admin.errors");
  return (error: string) => toast.error(t.has(error as never) ? t(error as never) : t("generic"));
}

// ── Field wrapper ────────────────────────────────────────────────────────────

export function AdminField({
  id,
  label,
  hint,
  error,
  optional,
  className,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const t = useTranslations("admin.form");
  return (
    <div id={`field-${id}`} className={cn("flex scroll-mt-24 flex-col gap-1.5", className)}>
      <Label htmlFor={id} className="flex items-baseline gap-2">
        {label}
        {optional && (
          <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
        )}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
          <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      ) : (
        hint && <p className="text-sm text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

const inputSize = "h-9 bg-surface";

// ── Text ─────────────────────────────────────────────────────────────────────

export function TextField<T extends FieldValues>({
  name,
  label,
  hint,
  optional,
  type = "text",
  inputMode,
  placeholder,
  className,
}: {
  name: Path<T>;
  label: string;
  hint?: ReactNode;
  optional?: boolean;
  type?: string;
  inputMode?: "text" | "numeric" | "decimal" | "email" | "tel";
  placeholder?: string;
  className?: string;
}) {
  const { register, formState } = useFormContext<T>();
  const errorOf = useAdminError();
  const error = errorOf(formState.errors, name);
  return (
    <AdminField
      id={name}
      label={label}
      hint={hint}
      error={error}
      optional={optional}
      className={className}
    >
      <Input
        id={name}
        type={type}
        inputMode={inputMode}
        placeholder={placeholder}
        aria-invalid={!!error || undefined}
        className={inputSize}
        {...register(name)}
      />
    </AdminField>
  );
}

// ── Bilingual (da + en) ──────────────────────────────────────────────────────

/**
 * Danish and English side by side (stacked on phones). If one side is filled and the other empty, a
 * "missing translation" marker shows: the site then falls back to the other language.
 */
export function BilingualField<T extends FieldValues>({
  name,
  label,
  hint,
  optional,
  multiline,
  rows = 3,
  className,
}: {
  name: Path<T>;
  label: string;
  hint?: ReactNode;
  optional?: boolean;
  multiline?: boolean | "markdown";
  rows?: number;
  className?: string;
}) {
  const t = useTranslations("admin.form");
  const { register, formState, control } = useFormContext<T>();
  const errorOf = useAdminError();
  const value = useWatch({ control, name }) as { da?: string; en?: string } | undefined;
  const da = value?.da?.trim() ?? "";
  const en = value?.en?.trim() ?? "";
  const missing = da && !en ? "en" : en && !da ? "da" : null;
  const rootError = errorOf(formState.errors, name);

  return (
    <fieldset id={`field-${name}`} className={cn("flex scroll-mt-24 flex-col gap-1.5", className)}>
      <legend className="mb-1.5 flex w-full flex-wrap items-center gap-2 text-sm font-medium">
        {label}
        {optional && (
          <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
        )}
        {missing && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#fbeedd] px-2 py-0.5 text-xs font-normal text-[#7a4a0c]">
            <Languages aria-hidden className="size-3" />
            {t("missingTranslation", { lang: missing.toUpperCase() })}
          </span>
        )}
      </legend>
      <div className="grid gap-3 md:grid-cols-2">
        {(["da", "en"] as const).map((lang) => {
          const path = `${name}.${lang}` as Path<T>;
          const id = `${name}-${lang}`;
          const error = errorOf(formState.errors, path);
          const control = multiline ? (
            <Textarea
              id={id}
              rows={rows}
              aria-invalid={!!error || undefined}
              className={cn("bg-surface", multiline === "markdown" && "font-mono text-[0.8125rem]")}
              {...register(path)}
            />
          ) : (
            <Input
              id={id}
              aria-invalid={!!error || undefined}
              className={inputSize}
              {...register(path)}
            />
          );
          return (
            <div key={lang} className="flex flex-col gap-1">
              <label
                htmlFor={id}
                className="flex items-center gap-1.5 font-mono text-[0.6875rem] text-muted-foreground"
              >
                <span className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                  {lang.toUpperCase()}
                </span>
                {lang === "da" ? t("danish") : t("english")}
              </label>
              {control}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          );
        })}
      </div>
      {rootError ? (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
          <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {rootError}
        </p>
      ) : (
        hint && <p className="text-sm text-muted-foreground">{hint}</p>
      )}
    </fieldset>
  );
}

// ── Switch ───────────────────────────────────────────────────────────────────

export function SwitchField<T extends FieldValues>({
  name,
  label,
  description,
  disabled,
}: {
  name: Path<T>;
  label: string;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const { control, formState } = useFormContext<T>();
  const errorOf = useAdminError();
  const error = errorOf(formState.errors, name);
  const id = useId();
  return (
    <div id={`field-${name}`} className="flex scroll-mt-24 flex-col gap-1">
      <div className="flex items-start gap-3">
        <Controller
          control={control}
          name={name}
          render={({ field }) => (
            <Switch
              id={id}
              checked={!!field.value}
              onCheckedChange={field.onChange}
              onBlur={field.onBlur}
              disabled={disabled}
              aria-invalid={!!error || undefined}
              className="mt-0.5"
            />
          )}
        />
        <div className="flex flex-col gap-0.5">
          <Label htmlFor={id}>{label}</Label>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {error && (
        <p role="alert" className="pl-12 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

// ── Price (kroner ↔ øre) ─────────────────────────────────────────────────────

/** `price` object: { onRequest, amount (kroner text, Danish format), from }. */
export function PriceField<T extends FieldValues>({
  name,
  label,
}: {
  name: Path<T>;
  label: string;
}) {
  const t = useTranslations("admin.form");
  const { control, register, setValue, formState } = useFormContext<T>();
  const errorOf = useAdminError();
  const onRequest = useWatch({ control, name: `${name}.onRequest` as Path<T> }) as boolean;
  const amountPath = `${name}.amount` as Path<T>;
  const error = errorOf(formState.errors, amountPath);
  const amountField = register(amountPath);

  return (
    <fieldset id={`field-${name}`} className="flex scroll-mt-24 flex-col gap-3">
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <SwitchField name={`${name}.onRequest` as Path<T>} label={t("priceOnRequest")} />
      {!onRequest && (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_1fr] sm:items-start">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={amountPath}>{t("amount")}</Label>
            <div className="relative">
              <Input
                id={amountPath}
                inputMode="decimal"
                placeholder="1 250,00"
                aria-invalid={!!error || undefined}
                className={cn(inputSize, "pr-10 tabular-nums")}
                {...amountField}
                onBlur={(event) => {
                  void amountField.onBlur(event);
                  // Tidy "1250,5" into "1 250,50" when it parses.
                  const ore = parseKroner(event.target.value);
                  if (ore !== null) {
                    setValue(amountPath, formatKronerInput(ore) as never, { shouldDirty: true });
                  }
                }}
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
                kr.
              </span>
            </div>
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{t("amountHint")}</p>
            )}
          </div>
          <div className="sm:pt-6">
            <SwitchField
              name={`${name}.from` as Path<T>}
              label={t("priceFrom")}
              description={t("priceFromHint")}
            />
          </div>
        </div>
      )}
    </fieldset>
  );
}

// ── Chips (numbers in mm) ────────────────────────────────────────────────────

/** List of numbers (mm). Type a value, Enter adds it; Backspace on an empty input removes the last. */
export function NumberChipsField<T extends FieldValues>({
  name,
  label,
  hint,
  unit = "mm",
}: {
  name: Path<T>;
  label: string;
  hint?: ReactNode;
  unit?: string;
}) {
  const t = useTranslations("admin.form");
  const { control, formState } = useFormContext<T>();
  const errorOf = useAdminError();
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const id = useId();
  const error = errorOf(formState.errors, name) ?? findNestedError(formState.errors, name, errorOf);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const values = (field.value ?? []) as number[];
        const add = () => {
          const raw = draft.trim().replace(",", ".");
          if (!raw) return;
          const n = Number(raw);
          if (!Number.isFinite(n) || n <= 0) {
            setDraftError(t("chipInvalid"));
            return;
          }
          setDraftError(null);
          if (!values.includes(n)) field.onChange([...values, n].sort((a, b) => a - b));
          setDraft("");
        };
        return (
          <div id={`field-${name}`} className="flex scroll-mt-24 flex-col gap-1.5">
            <Label htmlFor={id}>{label}</Label>
            <div
              className={cn(
                "flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-surface px-2 py-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
                (error || draftError) && "border-destructive",
              )}
            >
              {values.map((v) => (
                <span
                  key={v}
                  className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pr-1 pl-2.5 text-sm tabular-nums"
                >
                  {String(v).replace(".", ",")} {unit}
                  <button
                    type="button"
                    aria-label={t("removeValue", { value: `${v} ${unit}` })}
                    onClick={() => field.onChange(values.filter((x) => x !== v))}
                    className="rounded-full p-0.5 hover:bg-foreground/10"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              <input
                id={id}
                value={draft}
                inputMode="decimal"
                placeholder={values.length ? "" : t("chipPlaceholder")}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  // Enter (or leaving the field) adds the value. A comma is a decimal separator
                  // ("3,75"), so it never adds.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    add();
                  } else if (e.key === "Backspace" && !draft && values.length) {
                    field.onChange(values.slice(0, -1));
                  }
                }}
                onBlur={() => {
                  add();
                  field.onBlur();
                }}
                className="min-w-24 flex-1 bg-transparent px-1 text-sm outline-none"
              />
            </div>
            {draftError || error ? (
              <p role="alert" className="text-sm text-destructive">
                {draftError ?? error}
              </p>
            ) : (
              hint && <p className="text-sm text-muted-foreground">{hint}</p>
            )}
          </div>
        );
      }}
    />
  );
}

function findNestedError(
  errors: FieldErrors,
  name: string,
  errorOf: (e: FieldErrors, p: string) => string | undefined,
) {
  const node = getAt(errors, name) as Record<string, unknown> | undefined;
  if (!node || typeof node !== "object") return undefined;
  for (const key of Object.keys(node)) {
    if (/^\d+$/.test(key)) return errorOf(errors, `${name}.${key}`);
  }
  return undefined;
}

// ── Save bar + unsaved changes ───────────────────────────────────────────────

/** Sticky save bar. Shows "Unsaved changes" while dirty. */
export function SaveBar({
  dirty,
  saving,
  label,
  extra,
}: {
  dirty: boolean;
  saving: boolean;
  label?: string;
  extra?: ReactNode;
}) {
  const t = useTranslations("admin.form");
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-canvas/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {dirty ? t("unsaved") : t("allSaved")}
      </p>
      <div className="flex items-center gap-2">
        {extra}
        <Button type="submit" disabled={saving || !dirty}>
          {saving ? t("saving") : (label ?? t("save"))}
        </Button>
      </div>
    </div>
  );
}

/**
 * Warns before leaving with unsaved changes: browser navigation (reload, close, back to another
 * site) via `beforeunload`, and in-app links via a capture-phase click listener.
 */
export function useUnsavedChangesWarning(dirty: boolean) {
  const t = useTranslations("admin.form");
  const message = t("leaveWarning");
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
    };
    const onClick = (event: MouseEvent) => {
      if (!dirtyRef.current || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank") return;
      const url = new URL(anchor.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.hash))
        return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [message]);
}
