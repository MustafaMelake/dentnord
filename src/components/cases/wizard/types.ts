import type { DetailsInput, SiteInput } from "@/lib/validation/case";
import type { CatalogOptions, ClientCaseFile } from "@/server/queries/cases";

export type WizardCatalog = CatalogOptions;
export type WizardDetails = DetailsInput & {
  patientCode: string;
  surgeryDate: string;
  notes: string;
};
export type WizardSite = SiteInput & {
  implantSystemId: string | null;
  implantSystemOther: string;
  diameter: number | null;
  length: number | null;
  surgicalKitId: string | null;
  /** UI only: "Other" chosen in the system select (not saved; zod strips it). */
  other: boolean;
};
export type WizardFile = ClientCaseFile;

export const WIZARD_STEPS = ["details", "sites", "files", "review"] as const;
export type WizardStep = 1 | 2 | 3 | 4;
