import { getUploadSession, notImplemented, unauthorized } from "@/server/services/upload-guard";

// TODO: validate {caseId, kind, fileName, mimeType, sizeBytes} with zod, create CaseFile (UPLOADING) + createMultipartUpload(); return { key, uploadId }.
export async function POST(request: Request) {
  const session = await getUploadSession(request);
  if (!session) return unauthorized();
  return notImplemented();
}
