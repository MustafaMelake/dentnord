import "server-only";

import { notFound, redirect } from "next/navigation";

import type { CaseStatus, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { toBilingual } from "@/lib/validation/admin";
import { getDentistScope, ownCaseWhere } from "@/server/queries/dentist";

// The dentist's cases. Every function resolves the dentist from the DB-checked session and scopes its
// query with ownCaseWhere(), so another dentist's case is simply "not found".

export type CatalogOptions = Awaited<ReturnType<typeof getCaseCatalog>>;

/** Active guide types, implant systems (with allowed sizes) and kits (with compatible systems). */
export async function getCaseCatalog() {
  const [guideTypes, systems, kits] = await Promise.all([
    db.guideType.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, description: true },
    }),
    db.implantSystem.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { brand: "asc" }, { line: "asc" }],
      select: { id: true, brand: true, line: true, diameters: true, lengths: true },
    }),
    db.surgicalKit.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        manufacturer: true,
        implantSystems: { select: { id: true } },
      },
    }),
  ]);
  return {
    guideTypes: guideTypes.map((g) => ({
      id: g.id,
      name: toBilingual(g.name),
      description: toBilingual(g.description),
    })),
    systems,
    kits: kits.map((k) => ({
      id: k.id,
      name: k.name,
      manufacturer: k.manufacturer,
      systemIds: k.implantSystems.map((s) => s.id),
    })),
  };
}

/** The implant system and kit the dentist used most recently, as defaults for a new site. */
async function lastUsedDefaults(dentistId: string) {
  const last = await db.caseImplant.findFirst({
    where: { case: { dentistId }, implantSystemId: { not: null } },
    orderBy: { case: { updatedAt: "desc" } },
    select: { implantSystemId: true, surgicalKitId: true },
  });
  return {
    implantSystemId: last?.implantSystemId ?? null,
    surgicalKitId: last?.surgicalKitId ?? null,
  };
}

const fileSelect = {
  id: true,
  kind: true,
  fileName: true,
  sizeBytes: true,
  mimeType: true,
  uploadStatus: true,
  scanPart: true,
  createdAt: true,
  completedAt: true,
} satisfies Prisma.CaseFileSelect;

/** BigInt sizes can't cross to client components: convert to number (2 GB < 2^53). */
export function toClientFile(f: Prisma.CaseFileGetPayload<{ select: typeof fileSelect }>) {
  return {
    id: f.id,
    kind: f.kind,
    fileName: f.fileName,
    sizeBytes: Number(f.sizeBytes),
    mimeType: f.mimeType,
    uploadStatus: f.uploadStatus,
    scanPart: f.scanPart,
    createdAt: f.createdAt.toISOString(),
  };
}
export type ClientCaseFile = ReturnType<typeof toClientFile>;

/** Everything the wizard needs. `caseId` null = a new case (the draft is created on first save). */
export async function getWizardData(locale: string, caseId: string | null) {
  const { dentistId } = await getDentistScope(locale);
  const [catalog, defaults] = await Promise.all([getCaseCatalog(), lastUsedDefaults(dentistId)]);
  if (!caseId) return { catalog, defaults, draft: null };

  const draft = await db.case.findFirst({
    where: ownCaseWhere(dentistId, caseId),
    select: {
      id: true,
      status: true,
      patientCode: true,
      guideTypeId: true,
      surgeryDate: true,
      notes: true,
      implants: {
        orderBy: { fdiTooth: "asc" },
        select: {
          fdiTooth: true,
          implantSystemId: true,
          implantSystemOther: true,
          diameter: true,
          length: true,
          surgicalKitId: true,
        },
      },
      files: {
        where: { uploadStatus: { not: "FAILED" } },
        orderBy: { createdAt: "asc" },
        select: fileSelect,
      },
    },
  });
  if (!draft) notFound();
  // Submitted cases are read-only: show them instead of the wizard.
  if (draft.status !== "DRAFT") redirect(`/${locale}/portal/cases/${draft.id}`);

  return {
    catalog,
    defaults,
    draft: {
      id: draft.id,
      details: {
        patientCode: draft.patientCode,
        guideTypeId: draft.guideTypeId,
        surgeryDate: draft.surgeryDate ? draft.surgeryDate.toISOString().slice(0, 10) : "",
        notes: draft.notes ?? "",
      },
      sites: draft.implants.map((s) => ({ ...s, implantSystemOther: s.implantSystemOther ?? "" })),
      files: draft.files.map(toClientFile),
    },
  };
}

export const listSelect = {
  id: true,
  caseNumber: true,
  patientCode: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  submittedAt: true,
  surgeryDate: true,
  statusChangedAt: true,
  guideType: { select: { name: true } },
  _count: { select: { implants: true } },
} satisfies Prisma.CaseSelect;

export function toListRow(c: Prisma.CaseGetPayload<{ select: typeof listSelect }>) {
  return {
    id: c.id,
    caseNumber: c.caseNumber,
    patientCode: c.patientCode,
    status: c.status,
    guideTypeName: c.guideType ? toBilingual(c.guideType.name) : null,
    implantCount: c._count.implants,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    submittedAt: c.submittedAt?.toISOString() ?? null,
    surgeryDate: c.surgeryDate ? c.surgeryDate.toISOString().slice(0, 10) : null,
    statusChangedAt: c.statusChangedAt?.toISOString() ?? null,
  };
}
export type CaseListRow = ReturnType<typeof toListRow>;

/** Submitted cases (any status except DRAFT), newest first, with optional filters. */
export async function listOwnCases(
  locale: string,
  filter: { status?: CaseStatus; query?: string },
) {
  const { dentistId } = await getDentistScope(locale);
  const q = filter.query?.trim().slice(0, 60);
  const rows = await db.case.findMany({
    where: {
      ...ownCaseWhere(dentistId),
      status: filter.status && filter.status !== "DRAFT" ? filter.status : { not: "DRAFT" },
      ...(q
        ? {
            OR: [
              { caseNumber: { contains: q, mode: "insensitive" } },
              { patientCode: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { submittedAt: "desc" },
    select: listSelect,
    take: 200,
  });
  return rows.map(toListRow);
}

export async function listOwnDrafts(locale: string) {
  const { dentistId } = await getDentistScope(locale);
  const rows = await db.case.findMany({
    where: { ...ownCaseWhere(dentistId), status: "DRAFT" },
    orderBy: { updatedAt: "desc" },
    select: listSelect,
    take: 50,
  });
  return rows.map(toListRow);
}

/** Statuses where it's the dentist's turn (dashboard "Action needed"). */
export const DENTIST_ACTION_STATUSES = ["AWAITING_APPROVAL", "NEEDS_FILES", "SHIPPED"] as const;

/** Dashboard: what needs the dentist, counts per status, the five latest cases, drafts. */
export async function getOwnCaseOverview(locale: string) {
  const { dentistId } = await getDentistScope(locale);
  const [groups, recent, drafts, actionNeeded] = await Promise.all([
    db.case.groupBy({
      by: ["status"],
      where: ownCaseWhere(dentistId),
      _count: { _all: true },
    }),
    db.case.findMany({
      where: { ...ownCaseWhere(dentistId), status: { not: "DRAFT" } },
      orderBy: { submittedAt: "desc" },
      select: listSelect,
      take: 5,
    }),
    db.case.count({ where: { ...ownCaseWhere(dentistId), status: "DRAFT" } }),
    db.case.findMany({
      where: { ...ownCaseWhere(dentistId), status: { in: [...DENTIST_ACTION_STATUSES] } },
      orderBy: { statusChangedAt: "asc" },
      select: listSelect,
      take: 20,
    }),
  ]);
  const counts = Object.fromEntries(groups.map((g) => [g.status, g._count._all])) as Partial<
    Record<CaseStatus, number>
  >;
  return {
    counts,
    recent: recent.map(toListRow),
    drafts,
    actionNeeded: actionNeeded.map(toListRow),
  };
}

export const caseDetailSelect = {
  id: true,
  caseNumber: true,
  patientCode: true,
  status: true,
  surgeryDate: true,
  notes: true,
  createdAt: true,
  submittedAt: true,
  statusChangedAt: true,
  shippingCarrier: true,
  trackingNumber: true,
  trackingUrl: true,
  shippedAt: true,
  deliveredAt: true,
  cancelledAt: true,
  guideType: { select: { name: true } },
  dentist: { select: { id: true, name: true, clinicName: true, email: true } },
  implants: {
    orderBy: { fdiTooth: "asc" as const },
    select: {
      fdiTooth: true,
      implantSystemOther: true,
      diameter: true,
      length: true,
      implantSystem: { select: { brand: true, line: true } },
      surgicalKit: { select: { name: true } },
    },
  },
  // The case's own files; plan files are listed with their plan version (case-plans.ts).
  files: {
    where: { uploadStatus: "COMPLETE" as const, planId: null },
    orderBy: [{ kind: "asc" as const }, { createdAt: "asc" as const }],
    select: fileSelect,
  },
  events: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      type: true,
      fromStatus: true,
      toStatus: true,
      createdAt: true,
      metadata: true,
      note: true,
      actor: { select: { name: true, role: true } },
    },
  },
} satisfies Prisma.CaseSelect;

export function toCaseDetail(c: Prisma.CaseGetPayload<{ select: typeof caseDetailSelect }>) {
  return {
    id: c.id,
    caseNumber: c.caseNumber,
    patientCode: c.patientCode,
    status: c.status,
    surgeryDate: c.surgeryDate ? c.surgeryDate.toISOString().slice(0, 10) : null,
    notes: c.notes,
    createdAt: c.createdAt.toISOString(),
    submittedAt: c.submittedAt?.toISOString() ?? null,
    statusChangedAt: c.statusChangedAt?.toISOString() ?? null,
    shipping: c.shippingCarrier
      ? {
          carrier: c.shippingCarrier,
          trackingNumber: c.trackingNumber ?? "",
          trackingUrl: c.trackingUrl,
          shippedAt: c.shippedAt?.toISOString() ?? null,
        }
      : null,
    deliveredAt: c.deliveredAt?.toISOString() ?? null,
    cancelledAt: c.cancelledAt?.toISOString() ?? null,
    guideTypeName: c.guideType ? toBilingual(c.guideType.name) : null,
    dentist: c.dentist,
    implants: c.implants.map((i) => ({
      fdiTooth: i.fdiTooth,
      system: i.implantSystem
        ? `${i.implantSystem.brand} ${i.implantSystem.line}`
        : i.implantSystemOther || null,
      diameter: i.diameter,
      length: i.length,
      kit: i.surgicalKit?.name ?? null,
    })),
    files: c.files.map(toClientFile),
    events: c.events.map((e) => ({
      id: e.id,
      type: e.type,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      note: e.note,
      metadata: (e.metadata ?? {}) as Record<string, unknown>,
      actorRole: e.actor?.role ?? null,
      actorName: e.actor?.name ?? null,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}
export type CaseDetail = ReturnType<typeof toCaseDetail>;
