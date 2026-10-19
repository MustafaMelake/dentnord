import { getUploadSession, notImplemented, unauthorized } from "@/server/services/upload-guard";

// TODO: validate {caseId, kind, fileName, mimeType, sizeBytes} with zod, create a PENDING CaseFile row, return presignPutObject() URL (small files only, e.g. photos).
export async function POST(request: Request) {
  const session = await getUploadSession(request);
  if (!session) return unauthorized();
  return notImplemented();
}
