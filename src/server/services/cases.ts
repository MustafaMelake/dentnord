import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { REQUIRED_FILE_KINDS } from "@/lib/case-files";
import { db } from "@/lib/db";
import { detailsSchema, sitesSchema, type DetailsInput } from "@/lib/validation/case";
import { allocateCaseNumber } from "@/server/services/case-number";

// Case drafts and submission. Every function takes the dentist id from the DB-checked session (never
// from the client) and only touches that dentist's own DRAFT cases: the WHERE clause carries both, so
// a submitted or foreign case is simply "not found".

type Tx = Prisma.TransactionClient;

export class CaseError extends Error {
  constructor(
    readonly code: "notFound" | "invalid" | "incomplete" | "uploadsPending" | "storage",
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(code);
  }
}

type DraftDetails = {
  patientCode: string;
  guideTypeId: string | null;
  surgeryDate: string;
  notes: string;
};

type DraftSite = {
  fdiTooth: number;
  implantSystemId: string | null;
  implantSystemOther: string;
  diameter: number | null;
  length: number | null;
  surgicalKitId: string | null;
};

const draftWhere = (dentistId: string, caseId: string): Prisma.CaseWhereInput => ({
  id: caseId,
  dentistId,
  status: "DRAFT",
});

async function assertOwnDraft(tx: Tx, dentistId: string, caseId: string) {
  const found = await tx.case.findFirst({
    where: draftWhere(dentistId, caseId),
    select: { id: true },
  });
  if (!found) throw new CaseError("notFound");
}

async function assertGuideType(tx: Tx, guideTypeId: string | null) {
  if (!guideTypeId) return;
  const g = await tx.guideType.findFirst({
    where: { id: guideTypeId, active: true },
    select: { id: true },
  });
  if (!g) throw new CaseError("invalid", { guideTypeId: "optionInvalid" });
}

function detailsData(d: DraftDetails) {
  return {
    patientCode: d.patientCode,
    guideTypeId: d.guideTypeId,
    surgeryDate: d.surgeryDate ? new Date(`${d.surgeryDate}T00:00:00Z`) : null,
    notes: d.notes || null,
  };
}

/** Records that a wizard step was completed (once per step, so the timeline stays readable). */
async function markStep(tx: Tx, caseId: string, actorId: string, step: number) {
  const done = await tx.caseEvent.findFirst({
    where: { caseId, type: "UPDATED", metadata: { path: ["step"], equals: step } },
    select: { id: true },
  });
  if (!done) {
    await tx.caseEvent.create({ data: { caseId, type: "UPDATED", actorId, metadata: { step } } });
  }
}

/** The first save of the wizard creates the DRAFT (no case number until submit). */
export async function createDraft(dentistId: string, details: DraftDetails, complete: boolean) {
  return db.$transaction(async (tx) => {
    await assertGuideType(tx, details.guideTypeId);
    const created = await tx.case.create({
      data: { dentistId, status: "DRAFT", ...detailsData(details) },
      select: { id: true },
    });
    await tx.caseEvent.create({
      data: { caseId: created.id, type: "CREATED", actorId: dentistId, toStatus: "DRAFT" },
    });
    if (complete) await markStep(tx, created.id, dentistId, 1);
    return created.id;
  });
}

export async function saveDetails(
  dentistId: string,
  caseId: string,
  details: DraftDetails,
  complete: boolean,
) {
  await db.$transaction(async (tx) => {
    await assertGuideType(tx, details.guideTypeId);
    const { count } = await tx.case.updateMany({
      where: draftWhere(dentistId, caseId),
      data: detailsData(details),
    });
    if (count !== 1) throw new CaseError("notFound");
    if (complete) await markStep(tx, caseId, dentistId, 1);
  });
}

/**
 * Checks each site against the live catalog: an active system, a diameter and length from that
 * system's list (or null = "Let Dentnord suggest"), a kit that is active and compatible with it.
 */
async function validateSites(tx: Tx, sites: DraftSite[]) {
  const systemIds = [
    ...new Set(sites.map((s) => s.implantSystemId).filter((id): id is string => !!id)),
  ];
  const kitIds = [...new Set(sites.map((s) => s.surgicalKitId).filter((id): id is string => !!id))];
  const [systems, kits] = await Promise.all([
    tx.implantSystem.findMany({
      where: { id: { in: systemIds }, active: true },
      select: { id: true, diameters: true, lengths: true },
    }),
    tx.surgicalKit.findMany({
      where: { id: { in: kitIds }, active: true },
      select: { id: true, implantSystems: { select: { id: true } } },
    }),
  ]);
  const systemById = new Map(systems.map((s) => [s.id, s]));
  const kitById = new Map(kits.map((k) => [k.id, new Set(k.implantSystems.map((s) => s.id))]));

  const errors: Record<string, string> = {};
  sites.forEach((site, i) => {
    const at = (field: string) => `sites.${i}.${field}`;
    const system = site.implantSystemId ? systemById.get(site.implantSystemId) : null;
    if (site.implantSystemId && !system) errors[at("implantSystemId")] = "optionInvalid";
    if (system) {
      if (site.diameter !== null && !system.diameters.includes(site.diameter))
        errors[at("diameter")] = "optionInvalid";
      if (site.length !== null && !system.lengths.includes(site.length))
        errors[at("length")] = "optionInvalid";
    }
    if (site.surgicalKitId) {
      const compatible = kitById.get(site.surgicalKitId);
      if (!compatible) errors[at("surgicalKitId")] = "optionInvalid";
      else if (system && !compatible.has(system.id))
        errors[at("surgicalKitId")] = "kitIncompatible";
    }
  });
  if (Object.keys(errors).length) throw new CaseError("invalid", errors);
}

export async function saveSites(
  dentistId: string,
  caseId: string,
  sites: DraftSite[],
  complete: boolean,
) {
  await db.$transaction(async (tx) => {
    await assertOwnDraft(tx, dentistId, caseId);
    await validateSites(tx, sites);
    await tx.caseImplant.deleteMany({ where: { caseId } });
    if (sites.length) {
      await tx.caseImplant.createMany({
        data: sites.map((s) => ({
          caseId,
          fdiTooth: s.fdiTooth,
          implantSystemId: s.implantSystemId,
          // "Other" text only when no catalog system is chosen.
          implantSystemOther: s.implantSystemId ? null : s.implantSystemOther || null,
          diameter: s.diameter,
          length: s.length,
          surgicalKitId: s.surgicalKitId,
        })),
      });
    }
    // Touch the case so "last used" defaults and the draft list ordering follow edits.
    await tx.case.update({ where: { id: caseId }, data: { updatedAt: new Date() } });
    if (complete) await markStep(tx, caseId, dentistId, 2);
  });
}

/**
 * DRAFT → SUBMITTED: re-validates everything stored (details, sites, required files COMPLETE, no
 * upload still running), allocates the case number and records the event, in one transaction. The
 * status guard in the WHERE makes a double submit a no-op.
 */
export async function submitCase(dentistId: string, caseId: string) {
  return db.$transaction(async (tx) => {
    const c = await tx.case.findFirst({
      where: draftWhere(dentistId, caseId),
      select: {
        patientCode: true,
        guideTypeId: true,
        surgeryDate: true,
        notes: true,
        implants: true,
        files: { select: { kind: true, uploadStatus: true } },
      },
    });
    if (!c) throw new CaseError("notFound");

    const details: DetailsInput = {
      patientCode: c.patientCode,
      guideTypeId: c.guideTypeId,
      surgeryDate: c.surgeryDate ? c.surgeryDate.toISOString().slice(0, 10) : "",
      notes: c.notes ?? "",
    };
    const sites: DraftSite[] = c.implants.map((s) => ({
      fdiTooth: s.fdiTooth,
      implantSystemId: s.implantSystemId,
      implantSystemOther: s.implantSystemOther ?? "",
      diameter: s.diameter,
      length: s.length,
      surgicalKitId: s.surgicalKitId,
    }));
    const missing: Record<string, string> = {};
    if (!detailsSchema.safeParse(details).success) missing.details = "incomplete";
    if (!sitesSchema.safeParse({ sites }).success) missing.sites = "incomplete";
    for (const kind of REQUIRED_FILE_KINDS) {
      if (!c.files.some((f) => f.kind === kind && f.uploadStatus === "COMPLETE"))
        missing[`files.${kind}`] = "fileRequired";
    }
    if (Object.keys(missing).length) throw new CaseError("incomplete", missing);
    if (c.files.some((f) => f.uploadStatus === "PENDING" || f.uploadStatus === "UPLOADING")) {
      throw new CaseError("uploadsPending");
    }
    await assertGuideType(tx, c.guideTypeId);
    await validateSites(tx, sites);

    const caseNumber = await allocateCaseNumber(tx);
    const now = new Date();
    const { count } = await tx.case.updateMany({
      where: draftWhere(dentistId, caseId),
      data: { status: "SUBMITTED", caseNumber, submittedAt: now, consentAt: now },
    });
    if (count !== 1) throw new CaseError("notFound");
    await tx.caseEvent.create({
      data: {
        caseId,
        type: "STATUS_CHANGED",
        fromStatus: "DRAFT",
        toStatus: "SUBMITTED",
        actorId: dentistId,
      },
    });
    return { caseNumber, implantCount: sites.length, guideTypeId: c.guideTypeId! };
  });
}

/** A draft's files (for deleting their objects before the rows). */
export async function getOwnDraftFiles(dentistId: string, caseId: string) {
  const c = await db.case.findFirst({
    where: draftWhere(dentistId, caseId),
    select: { files: { select: { storageKey: true, uploadId: true, uploadStatus: true } } },
  });
  if (!c) throw new CaseError("notFound");
  return c.files;
}

/** Deletes the draft row (implants, files rows and events cascade). Call after its objects are gone. */
export async function deleteDraftRow(dentistId: string, caseId: string) {
  const { count } = await db.case.deleteMany({ where: draftWhere(dentistId, caseId) });
  if (count !== 1) throw new CaseError("notFound");
}
