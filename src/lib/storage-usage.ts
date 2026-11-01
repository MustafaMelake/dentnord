// Storage overview math and "where is this image used?" for /admin/storage. Pure (unit-tested in
// tests/unit/storage-usage.test.ts); the Prisma reads live in server/queries/admin-storage.ts.

import type { SettingsTab } from "@/components/admin/tabs";

/** Cloudflare R2's free storage allowance (10 GB-month), in the same 1024-based units as formatBytes. */
export const R2_FREE_TIER_BYTES = 10 * 1024 ** 3;

/** `used` as a share of `limit`: `ratio` clamped to 0…1 for a bar, `percent` unclamped and rounded. */
export function usageShare(used: bigint | number, limit: number) {
  const n = Number(used);
  const raw = limit > 0 ? n / limit : 0;
  return {
    ratio: Math.min(Math.max(raw, 0), 1),
    percent: Math.round(raw * 1000) / 10,
    over: n > limit,
  };
}

// ── Per-dentist case-file usage ──────────────────────────────────────────────

export type DentistUsageRow = {
  dentistId: string;
  name: string;
  clinic: string | null;
  /** COMPLETE files on the dentist's cases (their uploads and the lab's plan files). */
  storedBytes: number;
  fileCount: number;
  /** What the 50 GB cap counts: their own uploads, complete or still uploading (case-uploads.ts). */
  quotaBytes: number;
};

/**
 * Joins per-case sums (grouped by Prisma) to dentists, adds each dentist's quota usage, and sorts
 * the largest first. Dentists with only quota usage (uploads still in flight) are included too.
 */
export function buildDentistUsage(input: {
  byCase: { caseId: string; bytes: bigint | number; files: number }[];
  caseDentist: Record<string, string>;
  quotaByDentist: Record<string, bigint | number>;
  dentists: Record<string, { name: string; clinic: string | null }>;
}): DentistUsageRow[] {
  const rows = new Map<string, DentistUsageRow>();
  const row = (dentistId: string) => {
    let r = rows.get(dentistId);
    if (!r) {
      const d = input.dentists[dentistId];
      r = {
        dentistId,
        name: d?.name ?? "",
        clinic: d?.clinic ?? null,
        storedBytes: 0,
        fileCount: 0,
        quotaBytes: 0,
      };
      rows.set(dentistId, r);
    }
    return r;
  };
  for (const c of input.byCase) {
    const dentistId = input.caseDentist[c.caseId];
    if (!dentistId) continue;
    const r = row(dentistId);
    r.storedBytes += Number(c.bytes);
    r.fileCount += c.files;
  }
  for (const [dentistId, bytes] of Object.entries(input.quotaByDentist)) {
    if (input.dentists[dentistId]) row(dentistId).quotaBytes = Number(bytes);
  }
  return [...rows.values()].sort(
    (a, b) =>
      b.storedBytes - a.storedBytes || b.quotaBytes - a.quotaBytes || a.name.localeCompare(b.name),
  );
}

// ── Where an image is used ───────────────────────────────────────────────────

/** Known image slots in SiteSetting JSON: setting key → field → slot (label in admin.storage.slots). */
export const SETTING_IMAGE_SLOTS: Record<string, Record<string, string>> = {
  images: { heroId: "hero", technologyId: "technology" },
  doctor: { portraitId: "portrait", cardPhotoId: "cardPhoto" },
  "page.services": { imageId: "servicesPage" },
  "page.about": { imageId: "aboutPage" },
};

const SLOT_LINKS: Record<string, string> = {
  hero: `/admin/settings?tab=${"images" satisfies SettingsTab}`,
  technology: `/admin/settings?tab=${"images" satisfies SettingsTab}`,
  portrait: `/admin/settings?tab=${"doctor" satisfies SettingsTab}`,
  cardPhoto: `/admin/settings?tab=${"doctor" satisfies SettingsTab}`,
  servicesPage: "/admin/pages/services",
  aboutPage: "/admin/pages/about",
};

export type MediaUsage =
  | { type: "service"; id: string; title: string; href: string }
  | { type: "portfolio"; id: string; title: string; href: string }
  /** `slot` is a known slot, or "other" with the setting key and JSON path. */
  | { type: "setting"; slot: string; key: string; path: string; href: string };

/**
 * Every place each media id is referenced. Settings are searched in full (any string in the JSON
 * equal to a media id counts, at any depth), so an image slot added later is never missed: unknown
 * places show as "other" and still block deletion.
 */
export function findMediaUsages(input: {
  mediaIds: string[];
  services: { id: string; title: string; imageId: string | null }[];
  portfolioImages: { mediaId: string; caseId: string; caseTitle: string }[];
  settings: { key: string; value: unknown }[];
}): Map<string, MediaUsage[]> {
  const ids = new Set(input.mediaIds);
  const usages = new Map<string, MediaUsage[]>(input.mediaIds.map((id) => [id, []]));
  const add = (id: string, usage: MediaUsage) => {
    if (ids.has(id)) usages.get(id)!.push(usage);
  };

  for (const s of input.services) {
    if (s.imageId)
      add(s.imageId, {
        type: "service",
        id: s.id,
        title: s.title,
        href: `/admin/services/${s.id}`,
      });
  }
  const seenPortfolio = new Set<string>();
  for (const p of input.portfolioImages) {
    // One entry per case, even if the image appears twice in its gallery.
    if (seenPortfolio.has(`${p.mediaId}:${p.caseId}`)) continue;
    seenPortfolio.add(`${p.mediaId}:${p.caseId}`);
    add(p.mediaId, {
      type: "portfolio",
      id: p.caseId,
      title: p.caseTitle,
      href: `/admin/portfolio/${p.caseId}`,
    });
  }
  for (const { key, value } of input.settings) {
    walk(value, [], (str, path) => {
      if (!ids.has(str)) return;
      const slot = (path.length === 1 && SETTING_IMAGE_SLOTS[key]?.[path[0]]) || "other";
      add(str, {
        type: "setting",
        slot,
        key,
        path: path.join("."),
        href: SLOT_LINKS[slot] ?? "/admin/settings",
      });
    });
  }
  return usages;
}

function walk(value: unknown, path: string[], visit: (s: string, path: string[]) => void) {
  if (typeof value === "string") visit(value, path);
  else if (Array.isArray(value)) value.forEach((v, i) => walk(v, [...path, String(i)], visit));
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) walk(v, [...path, k], visit);
}

/** Thrown when an image is still referenced: deleting it would break a live page. */
export class MediaInUseError extends Error {
  constructor(readonly usages: MediaUsage[]) {
    super("media in use");
  }
}

/** The delete guard: refuses while anything references the image. */
export function assertMediaUnused(usages: MediaUsage[] | undefined) {
  if (usages && usages.length > 0) throw new MediaInUseError(usages);
}
