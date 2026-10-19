import { getUploadSession, notImplemented, unauthorized } from "@/server/services/upload-guard";

// TODO: GET → listUploadParts(key, uploadId) (Uppy resume). DELETE → abortMultipartUpload() and mark CaseFile ABORTED. Key comes from ?key= and must match the CaseFile row.
export async function GET(request: Request) {
  const session = await getUploadSession(request);
  if (!session) return unauthorized();
  return notImplemented();
}

export async function DELETE(request: Request) {
  const session = await getUploadSession(request);
  if (!session) return unauthorized();
  return notImplemented();
}
