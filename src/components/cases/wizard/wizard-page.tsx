import "server-only";

import { caseStorageConfigured } from "@/lib/storage";
import { getWizardData } from "@/server/queries/cases";

import { CaseWizard } from "./case-wizard";
import type { WizardStep } from "./types";

const EMPTY_DETAILS = { patientCode: "", guideTypeId: null, surgeryDate: "", notes: "" };

/** Loads the catalog (+ the draft, when editing one) and renders the wizard. Call inside <Suspense>. */
export async function WizardLoader({
  locale,
  caseId,
  step,
}: {
  locale: string;
  caseId: string | null;
  step?: string | string[];
}) {
  const { catalog, defaults, draft } = await getWizardData(locale, caseId);
  const n = Number(Array.isArray(step) ? step[0] : step);
  const initialStep = (n >= 1 && n <= 4 ? Math.trunc(n) : 1) as WizardStep;
  return (
    <CaseWizard
      key={draft?.id ?? "new"}
      locale={locale}
      catalog={catalog}
      defaults={defaults}
      storageConfigured={caseStorageConfigured()}
      initialStep={initialStep}
      initial={
        draft
          ? {
              caseId: draft.id,
              details: draft.details,
              // "Other" = no catalog system but a typed name.
              sites: draft.sites.map((s) => ({
                ...s,
                other: !s.implantSystemId && !!s.implantSystemOther,
              })),
              files: draft.files,
            }
          : { caseId: null, details: EMPTY_DETAILS, sites: [], files: [] }
      }
    />
  );
}
