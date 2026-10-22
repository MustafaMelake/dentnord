import { z } from "zod";

import { isFdiTooth } from "@/lib/fdi";

// New-case wizard schemas, shared by the browser and the Server Actions. Each step has a lenient
// DRAFT schema (autosave: incomplete is fine, but nothing invalid or identifying is stored) and a
// COMPLETE schema (to move on and to submit). Error messages are keys in `validation` / `cases.errors`.

// ── Patient code ─────────────────────────────────────────────────────────────

/**
 * Patient codes must not identify the patient (GDPR). Refuses what looks like a full name (two or
 * more capitalised words, "Anna Hansen"), a Danish CPR number (ddmmyy-xxxx) or an email address.
 */
export function patientCodeIssue(
  code: string,
): "looksLikeName" | "looksLikeCpr" | "looksLikeEmail" | null {
  const value = code.trim();
  if (!value) return null;
  if (/\d{6}[\s-]?\d{4}/.test(value.replace(/\s+/g, " "))) return "looksLikeCpr";
  if (/@/.test(value)) return "looksLikeEmail";
  const capitalisedWords = value.split(/[\s,.;_/-]+/).filter((w) => /^\p{Lu}\p{Ll}+$/u.test(w));
  if (capitalisedWords.length >= 2) return "looksLikeName";
  return null;
}

const patientCodeDraft = z
  .string()
  .trim()
  .max(40, { error: "tooLong" })
  .regex(/^[\p{L}\p{N} ._#/-]*$/u, { error: "patientCodeChars" })
  .superRefine((value, ctx) => {
    const issue = patientCodeIssue(value);
    if (issue) ctx.addIssue({ code: "custom", message: issue });
  });

const optionalId = z
  .string()
  .trim()
  .max(64)
  .nullable()
  .transform((v) => v || null);

/** "" or a real calendar date YYYY-MM-DD. */
const optionalDate = z
  .string()
  .trim()
  .refine(
    (v) =>
      v === "" ||
      (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
        !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) &&
        new Date(`${v}T00:00:00Z`).toISOString().startsWith(v)),
    { error: "dateInvalid" },
  );

// ── Step 1: case details ─────────────────────────────────────────────────────

export const detailsDraftSchema = z.object({
  patientCode: patientCodeDraft,
  guideTypeId: optionalId,
  surgeryDate: optionalDate,
  notes: z.string().trim().max(2000, { error: "tooLong" }),
});
export type DetailsInput = z.input<typeof detailsDraftSchema>;

export const detailsSchema = detailsDraftSchema.superRefine((v, ctx) => {
  if (!v.patientCode) ctx.addIssue({ code: "custom", path: ["patientCode"], message: "required" });
  if (!v.guideTypeId) ctx.addIssue({ code: "custom", path: ["guideTypeId"], message: "required" });
});

// ── Step 2: implant sites ────────────────────────────────────────────────────

const mm = (min: number, max: number) =>
  z
    .number({ error: "numberInvalid" })
    .min(min, { error: "outOfRange" })
    .max(max, { error: "outOfRange" })
    .nullable();

export const siteDraftSchema = z.object({
  fdiTooth: z.number().refine(isFdiTooth, { error: "toothInvalid" }),
  /** A catalog system, or null with `implantSystemOther` filled in ("Other"). */
  implantSystemId: optionalId,
  implantSystemOther: z.string().trim().max(120, { error: "tooLong" }),
  /** null = "Let Dentnord suggest". */
  diameter: mm(1, 10),
  length: mm(3, 30),
  surgicalKitId: optionalId,
});
export type SiteInput = z.input<typeof siteDraftSchema>;

const uniqueTeeth = (sites: { fdiTooth: number }[]) =>
  new Set(sites.map((s) => s.fdiTooth)).size === sites.length;

export const sitesDraftSchema = z.object({
  sites: z
    .array(siteDraftSchema)
    .max(32, { error: "tooMany" })
    .refine(uniqueTeeth, { error: "duplicateTooth" }),
});
export type SitesInput = z.input<typeof sitesDraftSchema>;

export const sitesSchema = sitesDraftSchema.superRefine((v, ctx) => {
  if (v.sites.length === 0)
    ctx.addIssue({ code: "custom", path: ["sites"], message: "siteRequired" });
  v.sites.forEach((site, i) => {
    if (!site.implantSystemId && !site.implantSystemOther) {
      ctx.addIssue({
        code: "custom",
        path: ["sites", i, "implantSystemId"],
        message: "systemRequired",
      });
    }
  });
});

// ── Step 4: submit ───────────────────────────────────────────────────────────

export const submitSchema = z.object({
  consent: z.boolean().refine((v) => v === true, { error: "consentRequired" }),
});
