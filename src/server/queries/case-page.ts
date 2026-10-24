import "server-only";

import { notFound } from "next/navigation";

import { allowedTransitions, type Actor, type CaseStatusValue } from "@/lib/case-workflow-rules";
import { db } from "@/lib/db";
import { isLabFileKind, isViewable } from "@/lib/upload-permissions";
import { caseDetailSelect, toCaseDetail, toClientFile } from "@/server/queries/cases";
import { listMessages } from "@/server/services/case-messages";
import { listPlans } from "@/server/services/case-plans";

// Everything one case page shows, for the dentist (their own case) or the admin (any submitted
// case). Built from the DB-checked actor; the dentist's version never contains internal notes, plans
// still being prepared, or history entries about them.

export type CasePageActor = { id: string; role: Actor };

export async function getCasePage(actor: CasePageActor, caseId: string) {
  const c = await db.case.findFirst({
    where: {
      id: caseId,
      ...(actor.role === "DENTIST" ? { dentistId: actor.id } : { status: { not: "DRAFT" } }),
    },
    select: caseDetailSelect,
  });
  if (!c) notFound();
  // A dentist's draft opens in the wizard instead (the caller redirects).
  if (c.status === "DRAFT") return null;
  const detail = toCaseDetail(c);
  const status = detail.status as CaseStatusValue;
  const isAdmin = actor.role === "ADMIN";

  const [plans, messages, internalNotes, unfinished] = await Promise.all([
    listPlans(caseId, isAdmin),
    listMessages(actor, caseId, false),
    isAdmin ? listMessages(actor, caseId, true) : Promise.resolve([]),
    // The dentist's unfinished uploads (NEEDS_FILES): shown so they can be cancelled; the server
    // refuses to resubmit while any upload is still open.
    db.caseFile.findMany({
      where: { caseId, planId: null, uploadStatus: { in: ["PENDING", "UPLOADING"] } },
      select: {
        id: true,
        kind: true,
        fileName: true,
        sizeBytes: true,
        mimeType: true,
        uploadStatus: true,
        scanPart: true,
        createdAt: true,
        completedAt: true,
      },
    }),
  ]);

  // The dentist's history: nothing about a plan they haven't been sent yet.
  const events = isAdmin
    ? detail.events
    : detail.events.filter((e) => {
        if (e.type === "PLAN_CREATED") return false;
        const kind = e.metadata.kind;
        return !(typeof kind === "string" && isLabFileKind(kind));
      });

  // NEEDS_FILES: what the lab asked for (the note on the latest change into NEEDS_FILES).
  const needsFilesNote =
    status === "NEEDS_FILES"
      ? ([...detail.events].reverse().find((e) => e.toStatus === "NEEDS_FILES")?.note ?? null)
      : null;

  // Files the dentist added since the case entered NEEDS_FILES (resubmit needs at least one).
  const since = detail.statusChangedAt ? new Date(detail.statusChangedAt) : null;
  const newFiles =
    status === "NEEDS_FILES" && since
      ? detail.files.filter((f) => new Date(f.createdAt) > since).length
      : 0;

  // 3D viewer layers: the case's own scans / models, then each plan's 3D files (newest plan first).
  const sentPlans = plans.filter((p) => p.sentAt);
  const latestSent = sentPlans[0] ?? null;
  const layers = [
    ...detail.files
      .filter((f) => isViewable(f.fileName))
      .map((f) => ({
        fileId: f.id,
        name: f.fileName,
        kind: f.kind,
        scanPart: f.scanPart,
        sizeBytes: f.sizeBytes,
        planVersion: null as number | null,
        // Reviewing a plan: the scans load with it.
        defaultOn: status === "AWAITING_APPROVAL",
      })),
    ...plans.flatMap((p) =>
      p.files
        .filter((f) => f.uploadStatus === "COMPLETE" && isViewable(f.fileName))
        .map((f) => ({
          fileId: f.id,
          name: f.fileName,
          kind: f.kind,
          scanPart: null,
          sizeBytes: f.sizeBytes,
          planVersion: p.version,
          defaultOn: status === "AWAITING_APPROVAL" && p.id === latestSent?.id,
        })),
    ),
  ];

  return {
    detail: { ...detail, events },
    status,
    plans,
    latestSentPlanId: latestSent?.id ?? null,
    messages,
    internalNotes,
    needsFilesNote,
    newFiles,
    /** The dentist's files incl. unfinished uploads (for the NEEDS_FILES upload slots). */
    uploadFiles: [...detail.files, ...unfinished.map(toClientFile)],
    hasCbct: detail.files.some((f) => f.kind === "CBCT"),
    layers,
    allowed: allowedTransitions(status, actor.role).map((t) => t.id),
  };
}
export type CasePageData = NonNullable<Awaited<ReturnType<typeof getCasePage>>>;
export type ViewerLayer = CasePageData["layers"][number];
