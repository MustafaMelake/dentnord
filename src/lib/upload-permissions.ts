// Who may upload, remove, download or view which case file, in which case state. Pure: the upload
// service (server/services/case-uploads.ts) enforces it, the UI uses it to decide what to show, and
// the unit tests cover every combination.

import {
  checkCaseUpload,
  DENTIST_FILE_KINDS,
  extensionOf,
  MAX_CASE_FILE_BYTES,
  type DentistFileKind,
  type UploadCheck,
} from "./case-files";
import type { Actor, CaseStatusValue } from "./case-workflow-rules";

export const LAB_FILE_KINDS = ["PLAN_REPORT", "PLAN_3D", "GUIDE_STL"] as const;
export type LabFileKind = (typeof LAB_FILE_KINDS)[number];
export type CaseFileKindValue = DentistFileKind | LabFileKind;

export const LAB_FILE_RULES: Record<
  LabFileKind,
  { extensions: readonly string[]; maxBytes: number }
> = {
  PLAN_REPORT: { extensions: [".pdf"], maxBytes: 200 * 1024 ** 2 },
  PLAN_3D: { extensions: [".stl", ".ply", ".obj", ".glb"], maxBytes: MAX_CASE_FILE_BYTES },
  GUIDE_STL: { extensions: [".stl"], maxBytes: MAX_CASE_FILE_BYTES },
};

const LAB_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".stl": "model/stl",
  ".ply": "application/octet-stream",
  ".obj": "model/obj",
  ".glb": "model/gltf-binary",
};

export const isLabFileKind = (kind: unknown): kind is LabFileKind =>
  typeof kind === "string" && (LAB_FILE_KINDS as readonly string[]).includes(kind);

/** Type and size check for any case file kind (dentist slots or the lab's plan files). */
export function checkFileType(kind: unknown, fileName: string, sizeBytes: number): UploadCheck {
  if (!isLabFileKind(kind)) return checkCaseUpload(kind, fileName, sizeBytes);
  const rules = LAB_FILE_RULES[kind];
  const extension = extensionOf(fileName);
  if (!rules.extensions.includes(extension)) return { ok: false, reason: "extension" };
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) return { ok: false, reason: "empty" };
  if (sizeBytes > rules.maxBytes) return { ok: false, reason: "tooLarge" };
  return { ok: true, extension, mimeType: LAB_MIME[extension] ?? "application/octet-stream" };
}

/** States in which each side may add files. */
export const DENTIST_UPLOAD_STATES = ["DRAFT", "NEEDS_FILES"] as const satisfies CaseStatusValue[];
export const LAB_UPLOAD_STATES = [
  "IN_PLANNING",
  "CHANGES_REQUESTED",
] as const satisfies CaseStatusValue[];

/** The plan a lab file belongs to: none (dentist files), still being prepared, or sent. */
export type PlanState = "none" | "unsent" | "sent";

export type Permission =
  { ok: true } | { ok: false; reason: "kind" | "wrongState" | "planRequired" };

/**
 * Upload (register, sign parts, complete):
 * - dentist: their own case, in DRAFT or NEEDS_FILES, dentist kinds only
 * - admin: plan files only, in IN_PLANNING or CHANGES_REQUESTED, into a plan still being prepared
 * Ownership (which dentist) is checked by the service; this decides kind × state × plan.
 */
export function canUpload(p: {
  actor: Actor;
  status: CaseStatusValue;
  kind: string;
  plan: PlanState;
}): Permission {
  if (p.actor === "DENTIST") {
    if (!(DENTIST_FILE_KINDS as readonly string[]).includes(p.kind))
      return { ok: false, reason: "kind" };
    if (p.plan !== "none") return { ok: false, reason: "kind" };
    if (!(DENTIST_UPLOAD_STATES as readonly string[]).includes(p.status))
      return { ok: false, reason: "wrongState" };
    return { ok: true };
  }
  if (!isLabFileKind(p.kind)) return { ok: false, reason: "kind" };
  if (!(LAB_UPLOAD_STATES as readonly string[]).includes(p.status))
    return { ok: false, reason: "wrongState" };
  if (p.plan !== "unsent") return { ok: false, reason: "planRequired" };
  return { ok: true };
}

/**
 * Remove (abort / delete):
 * - dentist: anything in a DRAFT; on a submitted case only an upload that hasn't finished (cancel)
 *   while in NEEDS_FILES. Finished files on a submitted case are permanent.
 * - admin: plan files of a plan still being prepared, in IN_PLANNING / CHANGES_REQUESTED. Never the
 *   dentist's files, never a sent plan's files.
 */
export function canRemove(p: {
  actor: Actor;
  status: CaseStatusValue;
  kind: string;
  plan: PlanState;
  complete: boolean;
}): Permission {
  if (p.actor === "DENTIST") {
    if (isLabFileKind(p.kind)) return { ok: false, reason: "kind" };
    if (p.status === "DRAFT") return { ok: true };
    if (p.status === "NEEDS_FILES" && !p.complete) return { ok: true };
    return { ok: false, reason: "wrongState" };
  }
  if (!isLabFileKind(p.kind)) return { ok: false, reason: "kind" };
  if (!(LAB_UPLOAD_STATES as readonly string[]).includes(p.status))
    return { ok: false, reason: "wrongState" };
  if (p.plan !== "unsent") return { ok: false, reason: "planRequired" };
  return { ok: true };
}

/**
 * Download / view a finished file:
 * - dentist: own case; their files always; lab files only once the plan was SENT (never a plan
 *   still being prepared)
 * - admin: any file of a submitted case (drafts stay private to the dentist)
 */
export function canDownload(p: {
  actor: Actor;
  status: CaseStatusValue;
  plan: PlanState;
}): Permission {
  if (p.actor === "ADMIN")
    return p.status === "DRAFT" ? { ok: false, reason: "wrongState" } : { ok: true };
  if (p.plan === "unsent") return { ok: false, reason: "planRequired" };
  return { ok: true };
}

/** File types the 3D viewer can show. */
export const VIEWABLE_EXTENSIONS = [".stl", ".ply", ".obj", ".glb"] as const;
export const isViewable = (fileName: string) =>
  (VIEWABLE_EXTENSIONS as readonly string[]).includes(extensionOf(fileName));
