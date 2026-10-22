"use server";

import { refresh } from "next/cache";
import { hasLocale } from "next-intl";
import { z } from "zod";

import { routing } from "@/i18n/routing";
import { db } from "@/lib/db";
import {
  detailsDraftSchema,
  detailsSchema,
  sitesDraftSchema,
  sitesSchema,
  submitSchema,
} from "@/lib/validation/case";
import { getDentistScope } from "@/server/queries/dentist";
import { removeCaseObjects } from "@/server/services/case-storage";
import { setScanPart, UploadError } from "@/server/services/case-uploads";
import {
  CaseError,
  createDraft,
  deleteDraftRow,
  getOwnDraftFiles,
  saveDetails,
  saveSites,
} from "@/server/services/cases";
import { runTransition, WorkflowError } from "@/server/services/case-workflow";
import { notifyCaseSubmitted } from "@/server/services/notifications";

// New-case wizard and draft actions (dentist). Order in every action: session (approved dentist,
// DB-checked) → zod → service, which scopes every query to that dentist's own DRAFT.

export type CaseActionResult<T = undefined> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: "invalid" | "notFound" | "incomplete" | "uploadsPending" | "storage";
      fieldErrors?: Record<string, string>;
    };

const caseId = z.string().trim().min(1).max(64);
const scanPartInput = z.object({
  fileId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  scanPart: z.enum(["UPPER", "LOWER", "BITE"]).nullable(),
});

function toFieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues)
    out[issue.path.map(String).join(".") || "form"] ??= issue.message;
  return out;
}

async function run<T>(
  locale: string,
  fn: (dentistId: string) => Promise<T>,
): Promise<CaseActionResult<T>> {
  const { dentistId } = await getDentistScope(
    hasLocale(routing.locales, locale) ? locale : routing.defaultLocale,
  );
  try {
    return { ok: true, data: await fn(dentistId) };
  } catch (error) {
    if (error instanceof CaseError)
      return { ok: false, error: error.code, fieldErrors: error.fieldErrors };
    throw error;
  }
}

/**
 * Step 1. `complete` = the dentist pressed "Next" (strict validation); otherwise it's an autosave
 * (lenient: incomplete is fine). With no `caseId`, the first save creates the DRAFT.
 */
export async function saveCaseDetails(
  locale: string,
  input: { caseId: string | null; complete: boolean; details: unknown },
): Promise<CaseActionResult<{ caseId: string }>> {
  return run(locale, async (dentistId) => {
    const parsed = (input.complete ? detailsSchema : detailsDraftSchema).safeParse(input.details);
    if (!parsed.success) throw new CaseError("invalid", toFieldErrors(parsed.error));
    if (input.caseId === null)
      return { caseId: await createDraft(dentistId, parsed.data, input.complete) };
    const id = caseId.parse(input.caseId);
    await saveDetails(dentistId, id, parsed.data, input.complete);
    return { caseId: id };
  });
}

/** Step 2 (autosave or "Next"). */
export async function saveCaseSites(
  locale: string,
  input: { caseId: string; complete: boolean; sites: unknown },
): Promise<CaseActionResult> {
  return run(locale, async (dentistId) => {
    const parsed = (input.complete ? sitesSchema : sitesDraftSchema).safeParse({
      sites: input.sites,
    });
    if (!parsed.success) throw new CaseError("invalid", toFieldErrors(parsed.error));
    await saveSites(dentistId, caseId.parse(input.caseId), parsed.data.sites, input.complete);
    return undefined;
  });
}

/** Step 4: submit. Re-validates everything on the server, allocates the case number, emails the lab. */
export async function submitCaseAction(
  locale: string,
  input: { caseId: string; consent: unknown },
): Promise<CaseActionResult<{ caseNumber: string }>> {
  return run(locale, async (dentistId) => {
    const parsed = submitSchema.safeParse({ consent: input.consent });
    if (!parsed.success) throw new CaseError("invalid", toFieldErrors(parsed.error));
    const id = caseId.parse(input.caseId);
    // DRAFT → SUBMITTED through the workflow (the only code that changes a case status).
    const result = await runTransition(
      { id: dentistId, role: "DENTIST" },
      { caseId: id, transition: "submit", expectedStatus: "DRAFT", input: { consent: true } },
    ).catch((error: unknown) => {
      if (!(error instanceof WorkflowError)) throw error;
      // Already submitted (double click) or not this dentist's draft: "not found" for the wizard.
      if (["notFound", "stale", "wrongState", "forbidden"].includes(error.code))
        throw new CaseError("notFound");
      if (error.code === "uploadsPending") throw new CaseError("uploadsPending");
      throw new CaseError("invalid", error.fieldErrors);
    });
    const submitted = result.submitted!;

    const [dentist, guideType] = await Promise.all([
      db.user.findUnique({ where: { id: dentistId }, select: { name: true, clinicName: true } }),
      db.guideType.findUnique({ where: { id: submitted.guideTypeId }, select: { name: true } }),
    ]);
    // No patient data in the email: case number, clinic, guide type and counts only.
    notifyCaseSubmitted({
      caseId: id,
      caseNumber: result.caseNumber!,
      dentistName: dentist?.name ?? "",
      clinicName: dentist?.clinicName ?? "",
      guideTypeName: guideType?.name ?? null,
      implantCount: submitted.implantCount,
    });
    // No refresh(): it would re-render the wizard route, which redirects a submitted case to its page
    // before the success screen shows. The case pages are dynamic and load fresh on navigation.
    return { caseNumber: result.caseNumber! };
  });
}

/** Deletes a draft and every object it has in R2 (objects first, so nothing is left behind). */
export async function deleteDraftCase(
  locale: string,
  input: { caseId: string },
): Promise<CaseActionResult> {
  return run(locale, async (dentistId) => {
    const id = caseId.parse(input.caseId);
    const files = await getOwnDraftFiles(dentistId, id);
    try {
      await removeCaseObjects(id, files);
    } catch (error) {
      console.error(
        "[cases] could not remove draft objects",
        error instanceof Error ? error.message : error,
      );
      throw new CaseError("storage");
    }
    await deleteDraftRow(dentistId, id);
    refresh();
    return undefined;
  });
}

/** Intraoral scans: mark a file as upper / lower / bite (or clear it). */
export async function setScanPartAction(
  locale: string,
  input: { fileId: string; scanPart: unknown },
): Promise<CaseActionResult> {
  return run(locale, async (dentistId) => {
    const parsed = scanPartInput.safeParse(input);
    if (!parsed.success) throw new CaseError("invalid");
    try {
      await setScanPart(dentistId, parsed.data.fileId, parsed.data.scanPart);
    } catch (error) {
      if (error instanceof UploadError) throw new CaseError("notFound");
      throw error;
    }
    return undefined;
  });
}
