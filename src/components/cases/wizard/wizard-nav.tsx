"use client";

import { ArrowLeft, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/shared/button";

/** Back / Next row at the bottom of each step. "Next" is the form's submit button. */
export function WizardNav({
  step,
  onBack,
  submitting,
  nextDisabled,
  nextLabel,
  disabledReason,
}: {
  step: 1 | 2 | 3 | 4;
  onBack?: () => void;
  submitting?: boolean;
  nextDisabled?: boolean;
  nextLabel?: string;
  /** Shown next to a disabled "Next" (e.g. which files are still missing). */
  disabledReason?: string;
}) {
  const t = useTranslations("cases.wizard");
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
      {step > 1 && onBack ? (
        <Button variant="secondary" onClick={onBack} disabled={submitting}>
          <span className="inline-flex items-center gap-2">
            <ArrowLeft aria-hidden className="size-4" />
            {t("back")}
          </span>
        </Button>
      ) : (
        <span />
      )}
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        {nextDisabled && disabledReason && (
          <p className="text-sm text-ink-muted">{disabledReason}</p>
        )}
        <Button
          type="submit"
          icon
          disabled={submitting || nextDisabled}
          aria-disabled={submitting || nextDisabled}
        >
          {submitting ? (
            <span className="inline-flex items-center gap-2">
              <LoaderCircle aria-hidden className="size-4 animate-spin" />
              {t("saving")}
            </span>
          ) : (
            (nextLabel ?? t("next"))
          )}
        </Button>
      </div>
    </div>
  );
}
