// Per-dentist storage limits and the retention rules of the storage cleanup job. Pure (unit-tested
// in tests/unit/storage.test.ts); enforced by server/services/case-uploads.ts (bytes),
// server/services/cases.ts (drafts) and server/services/storage-cleanup.ts (cron).
// These are abuse guards, not a billing quota: a normal clinic stays far below them.

export const STORAGE_LIMITS = {
  /**
   * The dentist's own uploads (complete + still uploading), across all their cases. Lab files
   * (plans, guide designs) don't count. 50 GiB ≈ 25 maximum-size (2 GB) CBCT exports, or a few
   * hundred typical cases.
   */
  maxBytesPerDentist: 50 * 1024 ** 3,
  /** Unsubmitted drafts at once. */
  maxOpenDrafts: 10,
  /** Cleanup: an upload still unfinished this long after it was registered is aborted. */
  staleUploadMs: 24 * 60 * 60 * 1000,
  /** Cleanup: a draft with no activity (edits, files, events) for this long is deleted. */
  staleDraftMs: 60 * 24 * 60 * 60 * 1000,
} as const;

export type Limits = { maxBytesPerDentist: number; maxOpenDrafts: number };

/** May a dentist who already stores `usedBytes` register a file of `newBytes`? */
export function withinStorageQuota(
  usedBytes: bigint | number,
  newBytes: number,
  limits: Limits = STORAGE_LIMITS,
) {
  return BigInt(usedBytes) + BigInt(newBytes) <= BigInt(limits.maxBytesPerDentist);
}

/** May a dentist with `openDrafts` drafts start another one? */
export function canOpenDraft(openDrafts: number, limits: Limits = STORAGE_LIMITS) {
  return openDrafts < limits.maxOpenDrafts;
}

/** Rows older than these are stale (cleanup job). */
export function cleanupCutoffs(now: Date, rules = STORAGE_LIMITS) {
  return {
    uploads: new Date(now.getTime() - rules.staleUploadMs),
    drafts: new Date(now.getTime() - rules.staleDraftMs),
  };
}

/** Readable size for logs and the admin ("1.5 GB"). */
export function formatBytes(bytes: bigint | number) {
  const n = Number(bytes);
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = n;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`;
}
