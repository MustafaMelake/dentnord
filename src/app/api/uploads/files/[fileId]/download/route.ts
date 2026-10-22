import { downloadUrl } from "@/server/services/case-uploads";
import { error, isFileId, requireUploadUser, respond } from "@/server/services/upload-guard";

// GET: download a finished case file. Owner dentist (any status) or the admin (submitted cases only).
// Redirects to a 5-minute signed URL; the bucket itself stays private.

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/uploads/files/[fileId]/download">,
) {
  const user = await requireUploadUser(request, "read", "download");
  if (user instanceof Response) return user;
  const { fileId } = await ctx.params;
  if (!isFileId(fileId)) return error(404, "notFound");
  return respond(async () => {
    const url = await downloadUrl(user, fileId);
    return new Response(null, {
      status: 303,
      headers: { Location: url, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
    });
  });
}
