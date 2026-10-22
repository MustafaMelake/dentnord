import { listParts, removeUpload } from "@/server/services/case-uploads";
import {
  error,
  escapeXml,
  isFileId,
  requireUploadUser,
  respond,
  xml,
} from "@/server/services/upload-guard";

// `uploadId` here is our CaseFile id (the handle the browser got from POST /api/uploads/multipart).
// GET: the parts R2 already has, as S3 ListParts XML (Uppy resumes from them).
// DELETE: cancel or remove the file: abort the upload / delete the object, then the row.

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/uploads/multipart/[uploadId]">,
) {
  const user = await requireUploadUser(request, "write", "control");
  if (user instanceof Response) return user;
  const { uploadId } = await ctx.params;
  if (!isFileId(uploadId)) return error(404, "notFound");
  return respond(async () => {
    const parts = await listParts(user.id, uploadId);
    const items = parts
      .map(
        (p) =>
          `<Part><PartNumber>${p.PartNumber}</PartNumber><ETag>${escapeXml(p.ETag.replaceAll('"', ""))}</ETag><Size>${p.Size}</Size></Part>`,
      )
      .join("");
    return xml(`<ListPartsResult>${items}</ListPartsResult>`);
  });
}

export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/uploads/multipart/[uploadId]">,
) {
  const user = await requireUploadUser(request, "write", "control");
  if (user instanceof Response) return user;
  const { uploadId } = await ctx.params;
  if (!isFileId(uploadId)) return error(404, "notFound");
  return respond(async () => {
    await removeUpload(user.id, uploadId);
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  });
}
