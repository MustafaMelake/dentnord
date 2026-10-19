import { getUploadSession, notImplemented, unauthorized } from "@/server/services/upload-guard";

// TODO: completeMultipartUpload(key, uploadId, parts), mark CaseFile COMPLETED, add a FILE_ADDED CaseEvent.
export async function POST(request: Request) {
  const session = await getUploadSession(request);
  if (!session) return unauthorized();
  return notImplemented();
}
