import { completeUpload } from "@/server/services/case-uploads";
import {
  error,
  escapeXml,
  isFileId,
  requireUploadUser,
  respond,
  xml,
} from "@/server/services/upload-guard";

// POST: finish the upload. The part list Uppy sends is ignored: the server completes with the parts
// R2 has, HEADs the object, and marks the file COMPLETE only if the size matches. Answers with S3
// CompleteMultipartUpload XML, as Uppy's S3 client expects.

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/uploads/multipart/[uploadId]/complete">,
) {
  const user = await requireUploadUser(request, "write", "control", "xml");
  if (user instanceof Response) return user;
  const { uploadId } = await ctx.params;
  if (!isFileId(uploadId)) return error(404, "notFound", {}, "xml");
  return respond(async () => {
    const { key, file } = await completeUpload(user.id, uploadId);
    return xml(
      `<CompleteMultipartUploadResult><Location>${escapeXml(file.id)}</Location><Key>${escapeXml(key)}</Key></CompleteMultipartUploadResult>`,
    );
  }, "xml");
}
