import { cleanupCutoffs } from "./storage-limits";

// The nightly storage cleanup (Vercel Cron → /api/cron/storage-cleanup), as pure orchestration over
// a store (server/services/storage-cleanup.ts talks to Prisma and R2; the unit tests use a fake):
// 1. uploads still unfinished 24 h after they were registered: abort the multipart upload in R2,
//    then mark the file FAILED with a FILE_FAILED case event
// 2. drafts with no activity for 60 days: delete their R2 objects, then the draft (files, sites and
//    events cascade) with a DRAFT_EXPIRED audit entry
// R2 first in both: if R2 fails, the row stays as it was and the next run retries. Every DB write
// re-checks the row is still stale, so an upload finished or a draft edited meanwhile is left alone.
// Each run handles at most `batch` of each; the rest waits for the next night.

export type StaleUpload = {
  id: string;
  caseId: string;
  kind: string;
  storageKey: string;
  uploadId: string | null;
  sizeBytes: bigint;
};

export type StaleDraft = {
  id: string;
  dentistId: string;
  files: { storageKey: string; uploadId: string | null; uploadStatus: string; sizeBytes: bigint }[];
};

export interface CleanupStore {
  staleUploads(registeredBefore: Date, limit: number): Promise<StaleUpload[]>;
  /** Aborts the multipart upload in R2 (one that is already gone counts as done). */
  abortUpload(file: StaleUpload): Promise<void>;
  /** FAILED + FILE_FAILED event, if the file is still unfinished. False if it changed meanwhile. */
  expireUpload(file: StaleUpload): Promise<boolean>;
  staleDrafts(inactiveSince: Date, limit: number): Promise<StaleDraft[]>;
  /** Still a draft with no activity since `inactiveSince`? (checked again right before R2) */
  isStaleDraft(draft: StaleDraft, inactiveSince: Date): Promise<boolean>;
  /** Deletes everything the draft has in R2; throws if anything is left. */
  removeDraftObjects(draft: StaleDraft): Promise<void>;
  /** Deletes the draft + writes the audit entry, if it is still stale. False if it changed. */
  deleteDraft(draft: StaleDraft, inactiveSince: Date): Promise<boolean>;
}

export type CleanupResult = {
  uploadsExpired: number;
  draftsDeleted: number;
  /** Bytes of the deleted drafts' files. */
  bytesFreed: bigint;
  /** Rows skipped because R2 or the DB failed; retried on the next run. */
  failures: number;
};

export async function runStorageCleanup(
  store: CleanupStore,
  now: Date,
  { batch = 100, onError }: { batch?: number; onError?: (error: unknown) => void } = {},
): Promise<CleanupResult> {
  const cutoffs = cleanupCutoffs(now);
  const result: CleanupResult = {
    uploadsExpired: 0,
    draftsDeleted: 0,
    bytesFreed: BigInt(0), // (no 0n literal: tsconfig targets ES2017)
    failures: 0,
  };
  const fail = (error: unknown) => {
    result.failures++;
    onError?.(error);
  };

  for (const file of await store.staleUploads(cutoffs.uploads, batch)) {
    try {
      await store.abortUpload(file);
      if (await store.expireUpload(file)) result.uploadsExpired++;
    } catch (error) {
      fail(error);
    }
  }

  for (const draft of await store.staleDrafts(cutoffs.drafts, batch)) {
    try {
      if (!(await store.isStaleDraft(draft, cutoffs.drafts))) continue;
      await store.removeDraftObjects(draft);
      if (await store.deleteDraft(draft, cutoffs.drafts)) {
        result.draftsDeleted++;
        for (const f of draft.files) result.bytesFreed += f.sizeBytes;
      }
    } catch (error) {
      fail(error);
    }
  }

  return result;
}

/**
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Without a configured secret the job
 * never runs (an unset secret must not mean "open"). Constant-time comparison.
 */
export function isCronAuthorized(header: string | null, secret: string | undefined) {
  if (!secret || secret.length < 16 || !header) return false;
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= header.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
