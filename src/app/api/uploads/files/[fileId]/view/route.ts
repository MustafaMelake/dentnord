import { viewUrl } from "@/server/services/case-uploads";
import { error, isFileId, json, requireUploadUser, respond } from "@/server/services/upload-guard";

// GET: for the 3D viewer. Same access rules as downloads (owner dentist, admin for submitted cases,
// plan files only once sent to the dentist), 3D formats only. Returns { url, sizeBytes } with a
// 5-minute signed GET the browser fetches directly from R2 (needs GET in the bucket's CORS rule).

export async function GET(request: Request, ctx: RouteContext<"/api/uploads/files/[fileId]/view">) {
  const user = await requireUploadUser(request, "download");
  if (user instanceof Response) return user;
  const { fileId } = await ctx.params;
  if (!isFileId(fileId)) return error(404, "notFound");
  return respond(async () => json(await viewUrl(user, fileId)));
}
