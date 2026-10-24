"use client";

import AwsS3, { type AwsBody } from "@uppy/aws-s3";
import Uppy, { type UppyFile } from "@uppy/core";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { CASE_UPLOAD_PART_BYTES } from "@/lib/case-files";
import { checkFileType } from "@/lib/upload-permissions";

import type { WizardFile } from "./types";

// Case-file uploads with Uppy (@uppy/aws-s3, multipart). One Uppy instance per wizard, so moving
// between steps never aborts an upload.
//
// Flow per file: the pre-processor registers it (POST /api/uploads/multipart: the server checks it,
// creates the multipart upload in R2 and the CaseFile row) and hands Uppy `s3Multipart` = our file id
// + key, so the plugin goes straight to uploading parts. `signRequest` then maps each S3 request:
// part PUTs → signed R2 URLs (the only thing the browser sends to R2); list / complete / abort → our
// API routes, which talk to R2 themselves. Uppy retries failed requests and waits while offline; when
// the connection comes back we also retry anything that failed.

type Meta = { kind: string; serverId?: string; registerError?: string };
type Body = AwsBody;
type LiveFile = UppyFile<Meta, Body>;

export type LiveUpload = {
  uppyId: string;
  serverId: string | null;
  kind: string;
  name: string;
  size: number;
  percent: number;
  paused: boolean;
  /** Error code (see messages cases.wizard.files.errors), or null. */
  error: string | null;
  complete: boolean;
};

/** Our error code from whatever Uppy / the S3 client threw. */
export function uploadErrorCode(message: string | undefined) {
  if (!message) return "generic";
  if (/network|failed to fetch|offline|status 0/i.test(message)) return "network";
  const fromS3 = /–\s*([A-Za-z]+)\s*$/.exec(message)?.[1];
  const code = fromS3 ?? message;
  return /^[A-Za-z]+$/.test(code) ? code : "generic";
}

async function apiError(res: Response) {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return new Error(body?.error ?? (res.status === 429 ? "rateLimited" : "generic"));
}

export function useCaseUploads({
  caseId,
  planId = null,
  onFilesChange,
}: {
  caseId: string | null;
  /** Lab plan files: the plan version being prepared. */
  planId?: string | null;
  onFilesChange: (update: (files: WizardFile[]) => WizardFile[]) => void;
}) {
  const [uppy, setUppy] = useState<Uppy<Meta, Body> | null>(null);
  const caseIdRef = useRef(caseId);
  const planIdRef = useRef(planId);
  const onFilesChangeRef = useRef(onFilesChange);
  useEffect(() => {
    caseIdRef.current = caseId;
    planIdRef.current = planId;
    onFilesChangeRef.current = onFilesChange;
  });

  useEffect(() => {
    const u = new Uppy<Meta, Body>({ autoProceed: false, allowMultipleUploadBatches: true });
    const setFiles = (update: (files: WizardFile[]) => WizardFile[]) =>
      onFilesChangeRef.current(update);

    // 1. Register every new file with the server before Uppy starts on it.
    u.addPreProcessor(async (fileIds) => {
      await Promise.all(
        fileIds.map(async (id) => {
          const file = u.getFile(id);
          if (!file || file.meta.serverId) return;
          const res = await fetch("/api/uploads/multipart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              caseId: caseIdRef.current,
              kind: file.meta.kind,
              fileName: file.name,
              sizeBytes: file.size,
              ...(planIdRef.current ? { planId: planIdRef.current } : {}),
            }),
          }).catch(() => null);
          if (!res?.ok) {
            const code = res ? (await apiError(res)).message : "network";
            u.setFileMeta(id, { ...file.meta, registerError: code });
            return;
          }
          const data = (await res.json()) as { fileId: string; key: string; file: WizardFile };
          u.setFileMeta(id, { ...file.meta, serverId: data.fileId });
          u.setFileState(id, { s3Multipart: { uploadId: data.fileId, key: data.key } });
          setFiles((files) => [...files, data.file]);
        }),
      );
    });

    u.use(AwsS3<Meta, Body>, {
      shouldUseMultipart: true,
      getChunkSize: () => CASE_UPLOAD_PART_BYTES,
      limit: 3,
      // Only reached for files whose registration failed (no s3Multipart): fail them with its code.
      generateObjectKey: (file) => `unregistered/${file.id}`,
      signRequest: async (request) => {
        if (!("uploadId" in request) || !request.uploadId) {
          const uppyId = request.key.replace(/^unregistered\//, "");
          throw new Error(u.getFile(uppyId)?.meta.registerError ?? "generic");
        }
        const base = `/api/uploads/multipart/${encodeURIComponent(request.uploadId)}`;
        if (request.method === "PUT" && "partNumber" in request) {
          const res = await fetch(`${base}/${request.partNumber}`);
          if (!res.ok) throw await apiError(res);
          return { url: ((await res.json()) as { url: string }).url };
        }
        if (request.method === "POST") return { url: `${base}/complete` };
        return { url: base }; // GET = list parts, DELETE = abort / remove
      },
    });

    u.on("upload-success", (file) => {
      const serverId = file?.meta.serverId;
      if (!serverId) return;
      setFiles((files) =>
        files.map((f) => (f.id === serverId ? { ...f, uploadStatus: "COMPLETE" as const } : f)),
      );
    });

    // Removing a file in Uppy also removes it on the server (the route is idempotent).
    u.on("file-removed", (file) => {
      const serverId = file.meta.serverId;
      if (!serverId) return;
      void fetch(`/api/uploads/multipart/${encodeURIComponent(serverId)}`, {
        method: "DELETE",
      }).catch(() => undefined);
      setFiles((files) => files.filter((f) => f.id !== serverId));
    });

    setUppy(u);
    const retryOnline = () => {
      for (const f of u.getFiles()) if (f.error && f.meta.serverId) void u.retryUpload(f.id);
    };
    window.addEventListener("online", retryOnline);
    return () => {
      window.removeEventListener("online", retryOnline);
      u.destroy();
    };
  }, []);

  // Live state for the UI.
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!uppy) return () => undefined;
      uppy.on("state-update", onChange);
      return () => uppy.off("state-update", onChange);
    },
    [uppy],
  );
  const state = useSyncExternalStore(
    subscribe,
    () => uppy?.getState().files,
    () => undefined,
  );
  const live: LiveUpload[] = Object.values(state ?? {}).map((f: LiveFile) => ({
    uppyId: f.id,
    serverId: f.meta.serverId ?? null,
    kind: f.meta.kind,
    name: f.name ?? "",
    size: f.size ?? 0,
    percent: f.progress.percentage ?? 0,
    paused: Boolean(f.isPaused),
    error: f.error ? uploadErrorCode(f.meta.registerError ?? f.error) : null,
    complete: Boolean(f.progress.uploadComplete),
  }));

  // Warn before leaving the page while something is still uploading.
  const uploading = live.some((f) => !f.complete && !f.error);
  useEffect(() => {
    if (!uploading) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uploading]);

  /** Adds files to a slot. Returns the files refused before upload, with the reason code. */
  const add = useCallback(
    (kind: string, files: File[]) => {
      const refused: { name: string; reason: string }[] = [];
      if (!uppy) return refused;
      let added = 0;
      for (const file of files) {
        const check = checkFileType(kind, file.name, file.size);
        if (!check.ok) {
          refused.push({ name: file.name, reason: check.reason });
          continue;
        }
        try {
          uppy.addFile({ name: file.name, type: file.type, data: file, meta: { kind } });
          added++;
        } catch {
          refused.push({ name: file.name, reason: "duplicate" });
        }
      }
      if (added) void uppy.upload();
      return refused;
    },
    [uppy],
  );

  return {
    ready: uppy !== null,
    live,
    uploading,
    add,
    pauseResume: (uppyId: string) => uppy?.pauseResume(uppyId),
    retry: (uppyId: string) => void uppy?.retryUpload(uppyId),
    /** Cancels / removes a live file (Uppy aborts it; we delete it on the server). */
    removeLive: (uppyId: string) => uppy?.removeFile(uppyId),
    /** Removes a file that isn't live in this tab (finished earlier, or interrupted). */
    removeStored: async (serverId: string) => {
      const res = await fetch(`/api/uploads/multipart/${encodeURIComponent(serverId)}`, {
        method: "DELETE",
      }).catch(() => null);
      if (!res || (!res.ok && res.status !== 404)) return false;
      onFilesChangeRef.current((files) => files.filter((f) => f.id !== serverId));
      return true;
    },
  };
}

export type CaseUploads = ReturnType<typeof useCaseUploads>;
