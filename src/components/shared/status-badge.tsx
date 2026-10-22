import { useTranslations } from "next-intl";

import type { CaseStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

// Case status pill, shared by the marketing preview, the portal and the admin.
// Labels come from messages `caseStatus.*`.

const tones: Record<CaseStatus, string> = {
  DRAFT: "border border-dashed border-line bg-surface text-ink-muted",
  SUBMITTED: "bg-surface-2 text-ink",
  NEEDS_FILES: "bg-[#fbeedd] text-[#7a4a0c]",
  IN_PLANNING: "bg-brand-ice text-brand",
  AWAITING_APPROVAL: "bg-brand-soft text-brand-deep",
  CHANGES_REQUESTED: "bg-[#fbeedd] text-[#7a4a0c]",
  APPROVED: "bg-[#e1f2e8] text-[#1d5b38]",
  IN_PRODUCTION: "bg-brand-ice text-brand",
  SHIPPED: "bg-[#e1f2e8] text-[#1d5b38]",
  DELIVERED: "bg-[#e1f2e8] text-[#1d5b38]",
  CANCELLED: "bg-surface-2 text-ink-muted",
};

const dots: Record<CaseStatus, string> = {
  DRAFT: "bg-line",
  SUBMITTED: "bg-ink-muted",
  NEEDS_FILES: "bg-[#c9831f]",
  IN_PLANNING: "bg-brand",
  AWAITING_APPROVAL: "bg-brand",
  CHANGES_REQUESTED: "bg-[#c9831f]",
  APPROVED: "bg-[#2f8a57]",
  IN_PRODUCTION: "bg-brand",
  SHIPPED: "bg-[#2f8a57]",
  DELIVERED: "bg-[#2f8a57]",
  CANCELLED: "bg-ink-muted",
};

export function StatusBadge({ status, className }: { status: CaseStatus; className?: string }) {
  const t = useTranslations("caseStatus");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
        tones[status],
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", dots[status])} />
      {t(status)}
    </span>
  );
}
