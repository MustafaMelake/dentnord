import { getUploadSession, notImplemented, unauthorized } from "@/server/services/upload-guard";

// TODO: presignUploadPart(key, uploadId, partNumber) → { url }.
export async function GET(request: Request) {
  const session = await getUploadSession(request);
  if (!session) return unauthorized();
  return notImplemented();
}
