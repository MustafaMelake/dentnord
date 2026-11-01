import "server-only";

import { db } from "@/lib/db";
import { mediaStorageStatus } from "@/lib/media-storage";
import {
  buildDentistUsage,
  findMediaUsages,
  type DentistUsageRow,
  type MediaUsage,
} from "@/lib/storage-usage";
import { toBilingual } from "@/lib/validation/admin";
import { requireAdmin } from "@/server/queries/session";

type Client = Pick<typeof db, "service" | "portfolioImage" | "siteSetting">;

// /admin/storage. Usage comes from the database (CaseFile / MediaAsset sizes), not from listing the
// buckets: fast, free, and the same numbers the upload limits use. sizeBytes is BigInt on CaseFile,
// so everything leaves here as plain numbers.

export type StorageOverview = {
  cases: { bytes: number; files: number };
  media: { bytes: number; files: number };
  dentists: DentistUsageRow[];
};

export async function getStorageOverview(): Promise<StorageOverview> {
  await requireAdmin();
  const [cases, media, byCase, quota] = await Promise.all([
    db.caseFile.aggregate({
      where: { uploadStatus: "COMPLETE" },
      _sum: { sizeBytes: true },
      _count: { _all: true },
    }),
    db.mediaAsset.aggregate({ _sum: { sizeBytes: true }, _count: { _all: true } }),
    db.caseFile.groupBy({
      by: ["caseId"],
      where: { uploadStatus: "COMPLETE" },
      _sum: { sizeBytes: true },
      _count: { _all: true },
    }),
    // The 50 GB cap's definition (server/services/case-uploads.ts): own uploads, not yet failed.
    db.caseFile.groupBy({
      by: ["uploadedById"],
      where: { uploadStatus: { in: ["PENDING", "UPLOADING", "COMPLETE"] } },
      _sum: { sizeBytes: true },
    }),
  ]);

  const caseRows = await db.case.findMany({
    where: { id: { in: byCase.map((c) => c.caseId) } },
    select: { id: true, dentistId: true },
  });
  const dentistIds = [
    ...new Set([...caseRows.map((c) => c.dentistId), ...quota.map((q) => q.uploadedById)]),
  ];
  const dentists = await db.user.findMany({
    where: { id: { in: dentistIds }, role: "DENTIST" },
    select: { id: true, name: true, clinicName: true },
  });

  return {
    cases: { bytes: Number(cases._sum.sizeBytes ?? 0), files: cases._count._all },
    media: { bytes: media._sum.sizeBytes ?? 0, files: media._count._all },
    dentists: buildDentistUsage({
      byCase: byCase.map((c) => ({
        caseId: c.caseId,
        bytes: c._sum.sizeBytes ?? 0,
        files: c._count._all,
      })),
      caseDentist: Object.fromEntries(caseRows.map((c) => [c.id, c.dentistId])),
      quotaByDentist: Object.fromEntries(
        quota.map((q) => [q.uploadedById, q._sum?.sizeBytes ?? 0]),
      ),
      dentists: Object.fromEntries(
        dentists.map((d) => [d.id, { name: d.name, clinic: d.clinicName }]),
      ),
    }),
  };
}

/** Where each of `mediaIds` is used. Also the delete guard's source, inside its transaction. */
export async function mediaUsages(mediaIds: string[], client: Client = db) {
  const [services, portfolioImages, settings] = await Promise.all([
    client.service.findMany({
      where: { imageId: { in: mediaIds } },
      select: { id: true, title: true, imageId: true },
    }),
    client.portfolioImage.findMany({
      where: { mediaId: { in: mediaIds } },
      select: { mediaId: true, case: { select: { id: true, title: true } } },
    }),
    // All settings: an image id can sit anywhere in their JSON.
    client.siteSetting.findMany({ select: { key: true, value: true } }),
  ]);
  return findMediaUsages({
    mediaIds,
    services: services.map((s) => ({
      id: s.id,
      title: toBilingual(s.title).en,
      imageId: s.imageId,
    })),
    portfolioImages: portfolioImages.map((p) => ({
      mediaId: p.mediaId,
      caseId: p.case.id,
      caseTitle: toBilingual(p.case.title).en,
    })),
    settings,
  });
}

export type MediaLibraryItem = {
  id: string;
  url: string;
  alt: string;
  sizeBytes: number;
  width: number;
  height: number;
  createdAt: string;
  usages: MediaUsage[];
};

export async function listMediaWithUsage(): Promise<{
  configured: boolean;
  items: MediaLibraryItem[];
}> {
  await requireAdmin();
  const rows = await db.mediaAsset.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      url: true,
      alt: true,
      sizeBytes: true,
      width: true,
      height: true,
      createdAt: true,
    },
  });
  const usages = await mediaUsages(rows.map((r) => r.id));
  return {
    configured: mediaStorageStatus().configured,
    items: rows.map((r) => ({
      id: r.id,
      url: r.url,
      alt: toBilingual(r.alt).en,
      sizeBytes: r.sizeBytes,
      width: r.width,
      height: r.height,
      createdAt: r.createdAt.toISOString(),
      usages: usages.get(r.id) ?? [],
    })),
  };
}
