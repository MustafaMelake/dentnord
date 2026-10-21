"use client";

import { ChevronDown, CircleAlert, CircleCheck, Info, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentProps, ReactNode } from "react";
import type { FieldError } from "react-hook-form";

import { Button } from "@/components/shared/button";
import { cn } from "@/lib/utils";

// Form building blocks for the auth pages and the portal (roomier than the admin's shadcn inputs).
// Validation messages are keys from lib/validation (namespace `validation`), translated here.

const controlClass =
  "w-full min-w-0 rounded-xl border border-line bg-surface px-3.5 text-[0.9375rem] text-ink transition-[border-color,box-shadow] duration-200 outline-none placeholder:text-ink-muted/70 hover:border-ink/25 focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/15 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15";

export function TextInput({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlClass, "h-11", className)} {...props} />;
}

export function TextArea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(controlClass, "min-h-24 resize-y py-2.5 leading-relaxed", className)}
      {...props}
    />
  );
}

/** Native <select>: accessible, and the platform picker on phones. */
export function SelectInput({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cn(controlClass, "h-11 appearance-none pr-10", className)} {...props}>
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink-muted"
      />
    </div>
  );
}

/** Translates a validation key (or passes through an already-translated message). */
export function useFieldError() {
  const t = useTranslations("validation");
  return (error: FieldError | { message?: string } | undefined) => {
    const key = error?.message;
    if (!key) return undefined;
    return t.has(key as never) ? t(key as never) : key;
  };
}

export function FormField({
  id,
  label,
  error,
  hint,
  optional,
  className,
  children,
}: {
  id: string;
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  /** Text shown after the label, e.g. "optional". */
  optional?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="flex items-baseline gap-2 text-sm font-medium text-ink">
        {label}
        {optional && <span className="text-xs font-normal text-ink-muted">({optional})</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm text-destructive">
          <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-sm text-ink-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** aria props tying an input to its error/hint text. */
export function describedBy(id: string, error?: string, hint?: boolean) {
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  } as const;
}

const alertTones = {
  error: {
    className: "border-destructive/25 bg-destructive/5 text-destructive",
    Icon: CircleAlert,
  },
  success: { className: "border-[#2f8a57]/25 bg-[#e1f2e8] text-[#1d5b38]", Icon: CircleCheck },
  info: { className: "border-brand/20 bg-brand-ice text-brand-deep", Icon: Info },
};

export function FormAlert({
  tone = "error",
  children,
  className,
}: {
  tone?: keyof typeof alertTones;
  children: ReactNode;
  className?: string;
}) {
  const { className: toneClass, Icon } = alertTones[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm leading-relaxed",
        toneClass,
        className,
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function SubmitButton({
  pending,
  pendingLabel,
  children,
  className,
  ...props
}: { pending: boolean; pendingLabel: string } & Omit<ComponentProps<typeof Button>, "type">) {
  return (
    <Button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={cn("w-full", className)}
      {...props}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <LoaderCircle aria-hidden className="size-4 animate-spin" />
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </Button>
  );
}
