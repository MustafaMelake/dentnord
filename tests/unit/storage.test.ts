import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isCronAuthorized,
  runStorageCleanup,
  type CleanupStore,
  type StaleDraft,
  type StaleUpload,
} from "../../src/lib/storage-cleanup";
import {
  canOpenDraft,
  cleanupCutoffs,
  formatBytes,
  STORAGE_LIMITS,
  withinStorageQuota,
} from "../../src/lib/storage-limits";

const GiB = 1024 ** 3;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = new Date("2026-10-26T02:30:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe("storage limits", () => {
  it("caps a dentist at 50 GiB, counting the new file", () => {
    const max = STORAGE_LIMITS.maxBytesPerDentist;
    assert.equal(max, 50 * GiB);
    assert.equal(withinStorageQuota(0, 2 * GiB), true);
    assert.equal(withinStorageQuota(BigInt(max - GiB), GiB), true, "exactly at the limit is fine");
    assert.equal(withinStorageQuota(BigInt(max - GiB), GiB + 1), false);
    assert.equal(withinStorageQuota(BigInt(max), 1), false);
    // BigInt sums: no float rounding near the limit.
    assert.equal(withinStorageQuota(BigInt(max) - BigInt(1), 1), true);
  });

  it("allows 10 open drafts", () => {
    assert.equal(STORAGE_LIMITS.maxOpenDrafts, 10);
    assert.equal(canOpenDraft(0), true);
    assert.equal(canOpenDraft(9), true);
    assert.equal(canOpenDraft(10), false);
    assert.equal(canOpenDraft(3, { maxOpenDrafts: 3, maxBytesPerDentist: 1 }), false);
  });

  it("treats uploads after 24 h and drafts after 60 days as stale", () => {
    const cutoffs = cleanupCutoffs(NOW);
    assert.equal(cutoffs.uploads.toISOString(), "2026-10-25T02:30:00.000Z");
    assert.equal(cutoffs.drafts.toISOString(), "2026-08-27T02:30:00.000Z");
  });

  it("formats sizes for people", () => {
    assert.equal(formatBytes(512), "512 B");
    assert.equal(formatBytes(1536), "1.5 KB");
    assert.equal(formatBytes(BigInt(50) * BigInt(GiB)), "50.0 GB");
  });
});

// In-memory stand-in for Prisma + R2, with the same rules as server/services/storage-cleanup.ts.
type FakeFile = StaleUpload & { status: string; createdAt: Date; inR2: boolean };
type FakeDraft = { id: string; dentistId: string; lastActivity: Date; deleted: boolean };

function fakeStore({
  files = [] as FakeFile[],
  drafts = [] as FakeDraft[],
  draftFiles = {} as Record<string, StaleDraft["files"]>,
  r2Down = false,
} = {}) {
  const log: string[] = [];
  const store: CleanupStore = {
    async staleUploads(before, limit) {
      return files
        .filter((f) => ["PENDING", "UPLOADING"].includes(f.status) && f.createdAt < before)
        .slice(0, limit);
    },
    async abortUpload(file) {
      if (r2Down) throw new Error("R2 down");
      log.push(`abort ${file.id}`);
      files.find((f) => f.id === file.id)!.inR2 = false;
    },
    async expireUpload(file) {
      const row = files.find((f) => f.id === file.id)!;
      if (!["PENDING", "UPLOADING"].includes(row.status)) return false;
      row.status = "FAILED";
      log.push(`event FILE_FAILED ${file.id}`);
      return true;
    },
    async staleDrafts(since, limit) {
      return drafts
        .filter((d) => !d.deleted && d.lastActivity < since)
        .slice(0, limit)
        .map((d) => ({ id: d.id, dentistId: d.dentistId, files: draftFiles[d.id] ?? [] }));
    },
    async isStaleDraft(draft, since) {
      const d = drafts.find((x) => x.id === draft.id)!;
      return !d.deleted && d.lastActivity < since;
    },
    async removeDraftObjects(draft) {
      if (r2Down) throw new Error("R2 down");
      log.push(`r2 delete ${draft.id}`);
    },
    async deleteDraft(draft, since) {
      const d = drafts.find((x) => x.id === draft.id)!;
      if (d.deleted || d.lastActivity >= since) return false;
      d.deleted = true;
      log.push(`audit DRAFT_EXPIRED ${draft.id}`);
      return true;
    },
  };
  return { store, log, files, drafts };
}

const upload = (id: string, createdAt: Date, status = "UPLOADING"): FakeFile => ({
  id,
  caseId: `case-${id}`,
  kind: "CBCT",
  storageKey: `cases/case-${id}/${id}/scan.zip`,
  uploadId: `r2-${id}`,
  sizeBytes: BigInt(1000),
  status,
  createdAt,
  inR2: true,
});

describe("storage cleanup job", () => {
  it("aborts uploads stuck for more than 24 h and leaves newer or finished ones alone", async () => {
    const { store, log, files } = fakeStore({
      files: [
        upload("old", ago(25 * HOUR)),
        upload("pending", ago(3 * DAY), "PENDING"),
        upload("fresh", ago(23 * HOUR)),
        upload("done", ago(5 * DAY), "COMPLETE"),
      ],
    });
    const result = await runStorageCleanup(store, NOW);
    assert.equal(result.uploadsExpired, 2);
    assert.deepEqual(
      files.map((f) => [f.id, f.status]),
      [
        ["old", "FAILED"],
        ["pending", "FAILED"],
        ["fresh", "UPLOADING"],
        ["done", "COMPLETE"],
      ],
    );
    // R2 first, then the row + event.
    assert.deepEqual(log, [
      "abort old",
      "event FILE_FAILED old",
      "abort pending",
      "event FILE_FAILED pending",
    ]);
  });

  it("doesn't count an upload that finished between the query and the update", async () => {
    const { store, files } = fakeStore({ files: [upload("race", ago(2 * DAY))] });
    const expire = store.expireUpload;
    store.expireUpload = async (file) => {
      files[0].status = "COMPLETE"; // completed meanwhile
      return expire(file);
    };
    const result = await runStorageCleanup(store, NOW);
    assert.equal(result.uploadsExpired, 0);
    assert.equal(files[0].status, "COMPLETE");
  });

  it("deletes drafts idle for 60 days with their files, R2 before the row", async () => {
    const { store, log, drafts } = fakeStore({
      drafts: [
        { id: "idle", dentistId: "d1", lastActivity: ago(61 * DAY), deleted: false },
        { id: "recent", dentistId: "d1", lastActivity: ago(59 * DAY), deleted: false },
      ],
      draftFiles: {
        idle: [
          { storageKey: "a", uploadId: null, uploadStatus: "COMPLETE", sizeBytes: BigInt(300) },
          { storageKey: "b", uploadId: "u", uploadStatus: "UPLOADING", sizeBytes: BigInt(200) },
        ],
      },
    });
    const result = await runStorageCleanup(store, NOW);
    assert.equal(result.draftsDeleted, 1);
    assert.equal(result.bytesFreed, BigInt(500));
    assert.deepEqual(
      drafts.map((d) => [d.id, d.deleted]),
      [
        ["idle", true],
        ["recent", false],
      ],
    );
    assert.deepEqual(log, ["r2 delete idle", "audit DRAFT_EXPIRED idle"]);
  });

  it("skips a draft that became active again before its files were deleted", async () => {
    const { store, log, drafts } = fakeStore({
      drafts: [{ id: "back", dentistId: "d1", lastActivity: ago(90 * DAY), deleted: false }],
    });
    const stale = store.staleDrafts;
    store.staleDrafts = async (since, limit) => {
      const found = await stale(since, limit);
      drafts[0].lastActivity = NOW; // the dentist opened it again
      return found;
    };
    const result = await runStorageCleanup(store, NOW);
    assert.equal(result.draftsDeleted, 0);
    assert.equal(drafts[0].deleted, false);
    assert.deepEqual(log, [], "nothing deleted in R2 either");
  });

  it("keeps rows when R2 fails, counts the failures and goes on", async () => {
    const errors: unknown[] = [];
    const { store, files, drafts } = fakeStore({
      r2Down: true,
      files: [upload("a", ago(2 * DAY)), upload("b", ago(2 * DAY))],
      drafts: [{ id: "x", dentistId: "d", lastActivity: ago(100 * DAY), deleted: false }],
    });
    const result = await runStorageCleanup(store, NOW, { onError: (e) => errors.push(e) });
    assert.deepEqual(result, {
      uploadsExpired: 0,
      draftsDeleted: 0,
      bytesFreed: BigInt(0),
      failures: 3,
    });
    assert.equal(errors.length, 3);
    assert.ok(
      files.every((f) => f.status === "UPLOADING"),
      "retried next night",
    );
    assert.equal(drafts[0].deleted, false);
  });

  it("handles at most `batch` rows of each kind per run", async () => {
    const { store } = fakeStore({
      files: Array.from({ length: 5 }, (_, i) => upload(`f${i}`, ago(2 * DAY))),
      drafts: Array.from({ length: 5 }, (_, i) => ({
        id: `d${i}`,
        dentistId: "d",
        lastActivity: ago(70 * DAY),
        deleted: false,
      })),
    });
    const result = await runStorageCleanup(store, NOW, { batch: 2 });
    assert.equal(result.uploadsExpired, 2);
    assert.equal(result.draftsDeleted, 2);
  });
});

describe("cron authorization", () => {
  const secret = "a-long-cron-secret-123";

  it("accepts exactly `Bearer <CRON_SECRET>`", () => {
    assert.equal(isCronAuthorized(`Bearer ${secret}`, secret), true);
    assert.equal(isCronAuthorized(`Bearer ${secret}x`, secret), false);
    assert.equal(isCronAuthorized(secret, secret), false);
    assert.equal(isCronAuthorized(`bearer ${secret}`, secret), false);
    assert.equal(isCronAuthorized(null, secret), false);
  });

  it("is closed without a (long enough) secret", () => {
    assert.equal(isCronAuthorized("Bearer ", ""), false);
    assert.equal(isCronAuthorized("Bearer undefined", undefined), false);
    assert.equal(isCronAuthorized("Bearer short", "short"), false);
  });
});
