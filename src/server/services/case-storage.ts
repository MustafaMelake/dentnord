import "server-only";

import { env } from "@/env";
import { caseKeyPrefix } from "@/lib/case-files";
import { abortMultipartUpload, caseStorageConfigured, deleteKeys, listKeys } from "@/lib/storage";

/**
 * Removes everything a case has in R2: aborts unfinished multipart uploads (their parts are not
 * listed as objects), then deletes every object under the case's prefix, including any stray object
 * without a row. Throws if anything is left, so the caller keeps the rows and can retry.
 */
export async function removeCaseObjects(
  caseId: string,
  files: { storageKey: string; uploadId: string | null; uploadStatus: string }[],
) {
  if (!caseStorageConfigured()) {
    // Without R2 nothing can have been uploaded; refuse only if rows say otherwise.
    if (files.length) throw new Error("R2 is not configured, but the case has files");
    return;
  }
  for (const f of files) {
    if (f.uploadId && (f.uploadStatus === "PENDING" || f.uploadStatus === "UPLOADING")) {
      await abortMultipartUpload(f.storageKey, f.uploadId).catch((error: unknown) => {
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode;
        if (status !== 404) throw error; // already completed or aborted
      });
    }
  }
  const prefix = caseKeyPrefix(env.R2_KEY_PREFIX, caseId);
  const keys = new Set([...(await listKeys(prefix)), ...files.map((f) => f.storageKey)]);
  if (keys.size) await deleteKeys([...keys]);
  if ((await listKeys(prefix)).length) throw new Error("Some case objects could not be deleted");
}
