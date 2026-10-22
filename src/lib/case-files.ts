// Case file rules (which kinds, extensions and sizes are allowed), file-name sanitising and storage
// key building. Pure: used by the browser (Uppy restrictions), the upload API and the unit tests.
// The server always decides: it re-checks every upload and derives the MIME type from the
// extension instead of trusting the browser's.

export const MAX_CASE_FILE_BYTES = 2 * 1024 ** 3; // 2 GB

export const DENTIST_FILE_KINDS = ["CBCT", "INTRAORAL_SCAN", "PHOTO", "OTHER"] as const;
export type DentistFileKind = (typeof DENTIST_FILE_KINDS)[number];

const MIME: Record<string, string> = {
  ".zip": "application/zip",
  ".dcm": "application/dicom",
  ".stl": "model/stl",
  ".ply": "application/octet-stream",
  ".obj": "model/obj",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
};

export const FILE_RULES: Record<
  DentistFileKind,
  { extensions: readonly string[]; required: boolean; maxBytes: number }
> = {
  // A zipped DICOM folder, or one multi-frame .dcm.
  CBCT: { extensions: [".zip", ".dcm"], required: true, maxBytes: MAX_CASE_FILE_BYTES },
  INTRAORAL_SCAN: {
    extensions: [".stl", ".ply", ".obj"],
    required: true,
    maxBytes: MAX_CASE_FILE_BYTES,
  },
  PHOTO: {
    extensions: [".jpg", ".jpeg", ".png", ".heic", ".heif"],
    required: false,
    maxBytes: MAX_CASE_FILE_BYTES,
  },
  // Anything else useful for planning; never executables, HTML or SVG.
  OTHER: {
    extensions: [
      ".pdf",
      ".zip",
      ".jpg",
      ".jpeg",
      ".png",
      ".heic",
      ".stl",
      ".ply",
      ".obj",
      ".dcm",
      ".txt",
    ],
    required: false,
    maxBytes: MAX_CASE_FILE_BYTES,
  },
};

export const REQUIRED_FILE_KINDS = DENTIST_FILE_KINDS.filter((k) => FILE_RULES[k].required);

export function isDentistFileKind(kind: unknown): kind is DentistFileKind {
  return typeof kind === "string" && (DENTIST_FILE_KINDS as readonly string[]).includes(kind);
}

/** ".STL" → ".stl"; "" when there is none. */
export function extensionOf(fileName: string) {
  const base = fileName.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot).toLowerCase() : "";
}

export type UploadCheck =
  | { ok: true; extension: string; mimeType: string }
  | { ok: false; reason: "kind" | "extension" | "empty" | "tooLarge" };

/** Is this file allowed in this slot? The server's answer is final; the browser checks first. */
export function checkCaseUpload(kind: unknown, fileName: string, sizeBytes: number): UploadCheck {
  if (!isDentistFileKind(kind)) return { ok: false, reason: "kind" };
  const rules = FILE_RULES[kind];
  const extension = extensionOf(fileName);
  if (!rules.extensions.includes(extension)) return { ok: false, reason: "extension" };
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) return { ok: false, reason: "empty" };
  if (sizeBytes > rules.maxBytes) return { ok: false, reason: "tooLarge" };
  return { ok: true, extension, mimeType: MIME[extension] ?? "application/octet-stream" };
}

/**
 * A file name that is safe in a storage key and a download header: no path, ASCII letters, digits,
 * "-", "_" and ".", at most 120 characters, lower-case extension kept.
 * "C:\\scans\\Kæbe øvre (1).STL" → "Kaebe_oevre_1.stl"
 */
export function sanitizeFileName(name: string) {
  const base = (name.split(/[\\/]/).pop() ?? "").trim();
  const extension = extensionOf(base);
  const stem = (extension ? base.slice(0, -extension.length) : base)
    .replace(/æ/g, "ae")
    .replace(/Æ/g, "Ae")
    .replace(/ø/g, "oe")
    .replace(/Ø/g, "Oe")
    .replace(/å/g, "aa")
    .replace(/Å/g, "Aa")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "");
  const ext = extension.replace(/[^a-z0-9.]/g, "");
  const maxStem = 120 - ext.length;
  return `${(stem || "file").slice(0, maxStem).replace(/[._-]+$/, "") || "file"}${ext}`;
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const SAFE_PREFIX = /^(?:[a-z0-9-]+\/)*$/;

/**
 * cases/{caseId}/{fileId}/{sanitisedName}, under an optional prefix ("test/" in E2E runs).
 * Built only on the server, from ids it generated; never from a client-sent key or path.
 */
export function buildCaseFileKey({
  prefix = "",
  caseId,
  fileId,
  fileName,
}: {
  prefix?: string;
  caseId: string;
  fileId: string;
  fileName: string;
}) {
  if (!SAFE_PREFIX.test(prefix)) throw new Error("Invalid storage key prefix");
  if (!SAFE_ID.test(caseId) || !SAFE_ID.test(fileId)) throw new Error("Invalid id in storage key");
  return `${prefix}cases/${caseId}/${fileId}/${sanitizeFileName(fileName)}`;
}

/** The key prefix a case's files live under (used to delete a draft's objects). */
export function caseKeyPrefix(prefix: string, caseId: string) {
  if (!SAFE_PREFIX.test(prefix) || !SAFE_ID.test(caseId)) throw new Error("Invalid key prefix");
  return `${prefix}cases/${caseId}/`;
}
