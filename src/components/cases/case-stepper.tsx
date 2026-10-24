import { Check, CircleAlert, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import type { CaseStatusValue } from "@/lib/case-workflow-rules";
import { cn } from "@/lib/utils";

// Where the case is: six steps from "submitted" to "delivered", the current one highlighted, and a
// sentence on what happens next. The page passes that sentence (worded for the dentist, or for the
// lab from the admin-only strings). Server component.

const STEPS = ["submitted", "planning", "approval", "production", "shipped", "delivered"] as const;

const STEP_OF: Record<CaseStatusValue, number> = {
  DRAFT: 0,
  SUBMITTED: 0,
  NEEDS_FILES: 0,
  IN_PLANNING: 1,
  CHANGES_REQUESTED: 1,
  AWAITING_APPROVAL: 2,
  APPROVED: 3,
  IN_PRODUCTION: 3,
  SHIPPED: 4,
  DELIVERED: 5,
  CANCELLED: -1,
};

/** Statuses where the step needs attention (someone has to fix something). */
const ATTENTION: CaseStatusValue[] = ["NEEDS_FILES", "CHANGES_REQUESTED"];

export function CaseStepper({ status, next }: { status: CaseStatusValue; next: string }) {
  const t = useTranslations("cases.stepper");
  const current = STEP_OF[status];
  const done = status === "DELIVERED";
  const cancelled = status === "CANCELLED";

  return (
    <section
      aria-label={t("label")}
      data-stepper={status}
      className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5 sm:p-6"
    >
      {cancelled ? (
        <p className="flex items-center gap-2 font-medium text-ink">
          <XCircle aria-hidden className="size-5 text-ink-muted" />
          {t("cancelled")}
        </p>
      ) : (
        <ol className="grid grid-cols-6 gap-1.5 sm:gap-3">
          {STEPS.map((step, i) => {
            const isDone = done || i < current;
            const isCurrent = !done && i === current;
            const attention = isCurrent && ATTENTION.includes(status);
            return (
              <li
                key={step}
                aria-current={isCurrent ? "step" : undefined}
                className="flex min-w-0 flex-col gap-2"
              >
                <span
                  className={cn(
                    "h-1.5 rounded-full",
                    isDone
                      ? "bg-brand"
                      : isCurrent
                        ? attention
                          ? "bg-[#c9831f]"
                          : "bg-brand/60"
                        : "bg-surface-2",
                  )}
                />
                <span
                  className={cn(
                    "flex items-center gap-1 text-[0.6875rem] leading-tight sm:text-xs",
                    isCurrent ? "font-medium text-ink" : isDone ? "text-ink" : "text-ink-muted",
                  )}
                >
                  {isDone && (
                    <Check aria-hidden className="hidden size-3.5 shrink-0 text-brand sm:block" />
                  )}
                  {attention && (
                    <CircleAlert
                      aria-hidden
                      className="hidden size-3.5 shrink-0 text-[#c9831f] sm:block"
                    />
                  )}
                  <span className="truncate sm:whitespace-normal">{t(`steps.${step}`)}</span>
                </span>
                <span className="sr-only">
                  {isDone ? t("stateDone") : isCurrent ? t("stateCurrent") : t("stateUpcoming")}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <p className="text-sm text-ink-muted" data-next="">
        {next}
      </p>
    </section>
  );
}
